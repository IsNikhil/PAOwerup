import type { NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import { Loader2, Mic, Pause, Play, RefreshCw, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NodeShell } from '../canvas/NodeShell'
import { Row, Select, Tip } from '../components/ui'
import { api } from '../lib/api'
import { runWorkflow } from '../lib/runner'
import type { AudioValue, SkillsValue } from '../lib/types'
import { useGraph } from '../store/graph'
import { useParams } from './hooks'

const FALLBACK_QUESTIONS = [
  'Tell me about yourself and why you want this role.',
  'Describe a project you are proud of. What was your contribution?',
  'Tell me about a time you learned a new tool quickly.',
  'Describe a time you worked through a disagreement on a team.',
  'How do you explain a technical result to a non-technical audience?',
]
const BARS = 48
const MAX_SECONDS = 180

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function pickMime() {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? ''
}

export function RecorderNode({ id, selected }: NodeProps) {
  const [params, set] = useParams<{ question: string; questions?: string[]; audio?: AudioValue & { peaks?: number[] } }>(id)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loadingQ, setLoadingQ] = useState(false)
  const [error, setError] = useState('')
  const [live, setLive] = useState<number[]>(() => Array(BARS).fill(0.04))
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; ctx: AudioContext; raf: number; t0: number; peaks: number[] } | null>(null)
  const audioEl = useRef<HTMLAudioElement>(null)
  const setResult = useGraph((s) => s.setResult)
  const toast = useGraph((s) => s.toast)

  const questions = params.questions?.length ? params.questions : FALLBACK_QUESTIONS
  const question = params.question || questions[0]

  useEffect(() => () => stopTracks(), [])

  function stopTracks() {
    const r = rec.current
    if (!r) return
    cancelAnimationFrame(r.raf)
    r.stream.getTracks().forEach((t) => t.stop())
    r.ctx.close().catch(() => {})
  }

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      const mime = pickMime()
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      const state = { mr, stream, ctx, raf: 0, t0: performance.now(), peaks: [] as number[] }
      rec.current = state

      let lastPeak = 0
      const tick = () => {
        analyser.getByteTimeDomainData(buf)
        let peak = 0
        for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128)
        const level = Math.min(1, Math.max(0.04, peak * 1.8))
        const secs = (performance.now() - state.t0) / 1000
        setElapsed(secs)
        if (performance.now() - lastPeak > 80) {
          lastPeak = performance.now()
          state.peaks.push(level)
          setLive((prev) => [...prev.slice(1), level])
        }
        if (secs >= MAX_SECONDS) stop()
        else state.raf = requestAnimationFrame(tick)
      }
      state.raf = requestAnimationFrame(tick)

      mr.onstop = async () => {
        stopTracks()
        const duration = (performance.now() - state.t0) / 1000
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
        const dataUrl: string = await new Promise((res) => {
          const fr = new FileReader()
          fr.onload = () => res(String(fr.result))
          fr.readAsDataURL(blob)
        })
        // downsample peaks for the static waveform
        const p = state.peaks
        const peaks = Array.from({ length: BARS }, (_, i) => p[Math.floor((i / BARS) * p.length)] ?? 0.04)
        const audio: AudioValue & { peaks: number[] } = {
          type: 'audio',
          dataUrl,
          mime: blob.type,
          duration,
          question,
          id: Math.random().toString(36).slice(2, 10),
          peaks,
        }
        set('audio', audio)
        setResult(id, { status: 'done', output: audio, error: undefined, note: undefined })
        if (duration < 2) {
          toast('That recording was very short — try a 20–60 second answer', 'error')
          return
        }
        runWorkflow({ kind: 'from', id })
      }
      mr.start(250)
      setRecording(true)
    } catch (e) {
      setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Microphone permission was denied.' : 'Could not access the microphone.')
    }
  }

  function stop() {
    const r = rec.current
    if (r && r.mr.state !== 'inactive') r.mr.stop()
    setRecording(false)
  }

  async function generateQuestions() {
    const s = useGraph.getState()
    const jobNode = s.nodes.find((n) => n.data.kind === 'job')
    const gap = Object.values(s.results).find((r) => r.output?.type === 'skills' && r.output.kind === 'gap')?.output as SkillsValue | undefined
    const jobText = String(jobNode?.data.params.text ?? '')
    if (!jobText.trim()) {
      toast('Add a job description first', 'error')
      return
    }
    setLoadingQ(true)
    try {
      const res = await api.questions(jobText, String(jobNode?.data.params.title ?? ''), gap?.missing?.map((m) => m.name) ?? [])
      set('questions', res.questions)
      set('question', res.questions[0])
      toast(res.source === 'gemini' ? 'Questions generated by Gemini' : 'Loaded template questions (connect Gemini for tailored ones)', 'ok')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not generate questions', 'error')
    } finally {
      setLoadingQ(false)
    }
  }

  function togglePlay() {
    const el = audioEl.current
    if (!el) return
    if (playing) el.pause()
    else el.play()
  }

  const bars = recording ? live : params.audio?.peaks ?? Array(BARS).fill(0.04)
  const shownTime = recording ? elapsed : params.audio?.duration ?? 0

  return (
    <NodeShell id={id} kind="recorder" selected={selected}>
      <Row
        label="Question"
        hint={
          <Tip label="Generate questions from the job description">
            <button className="nodrag flex items-center gap-1 text-ink-4 hover:text-ink-2" onClick={generateQuestions} disabled={loadingQ}>
              {loadingQ ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} from job
            </button>
          </Tip>
        }
      >
        <Select value={question} onChange={(v) => set('question', v)} options={questions.map((q) => ({ value: q, label: q }))} />
      </Row>

      <div className="inset-deep flex flex-col gap-2.5 p-3">
        <div className="flex h-12 items-center gap-[2px]">
          {bars.map((v, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-full"
              animate={{ height: `${Math.max(6, v * 100)}%` }}
              transition={{ duration: recording ? 0.08 : 0.3 }}
              style={{ background: recording ? 'var(--t-audio)' : params.audio ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.12)' }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {recording ? (
            <button className="btn nodrag h-8 bg-[var(--danger)] px-3 text-xs font-semibold text-white hover:bg-[#ef5b5b]" onClick={stop}>
              <Square size={11} fill="currentColor" /> Stop
            </button>
          ) : (
            <button className="btn btn-ghost nodrag h-8 px-3 text-xs" onClick={start}>
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)] shadow-[0_0_8px_var(--danger)]" /> {params.audio ? 'Re-record' : 'Record'}
            </button>
          )}
          {params.audio && !recording && (
            <button className="icon-btn nodrag h-8 w-8 border border-line" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Replay'}>
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </button>
          )}
          <span className={clsx('mono ml-auto text-sm', recording ? 'text-[var(--danger)]' : 'text-ink-3')}>
            {recording && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--danger)] align-middle" style={{ animation: 'pulse-dot 1s infinite' }} />}
            {fmt(shownTime)}
          </span>
        </div>
        {params.audio && <audio ref={audioEl} src={params.audio.dataUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
      </div>
      {error && <div className="text-xs text-[#fca5a5]">{error}</div>}
      {!params.audio && !recording && (
        <div className="flex items-center gap-1.5 text-2xs text-ink-4">
          <Mic size={12} /> Answer in 20–60 seconds. Stopping runs the interview chain.
        </div>
      )}
    </NodeShell>
  )
}
