// Executes the workflow graph: every node waits for its upstream nodes, then
// runs. Independent branches (e.g. the Rewriter and the Coach) run in parallel.
import { collectInputs, useGraph } from '../store/graph'
import { api, dataUrlToBlob } from './api'
import type { NodeKind } from './nodeSpecs'
import type {
  AudioValue,
  DataType,
  DocValue,
  JobValue,
  ResumeValue,
  ScoreValue,
  SkillsValue,
  TranscriptValue,
  WireValue,
} from './types'

type Inputs = Partial<Record<DataType, WireValue[]>>

class Skip extends Error {}

interface Ctx {
  id: string
  params: Record<string, unknown>
  inputs: Inputs
  prompt: string
}

function first<T extends WireValue>(inputs: Inputs, type: DataType, pred?: (v: T) => boolean): T | undefined {
  return (inputs[type] as T[] | undefined)?.find((v) => (pred ? pred(v) : true))
}

function need<T>(value: T | undefined, message: string): T {
  if (value === undefined || value === null) throw new Error(message)
  return value
}

const jobTitle = (job: JobValue) => job.title || job.text.split('\n').find((l) => l.trim())?.slice(0, 80) || ''

const transcribeCache = new Map<string, TranscriptValue>()

const EXECUTORS: Record<NodeKind, (ctx: Ctx) => Promise<{ output?: WireValue; note?: string }>> = {
  async resume({ params }) {
    const text = String(params.text ?? '').trim()
    if (!text) throw new Error('Upload a resume or paste its text')
    return { output: { type: 'resume', text, filename: String(params.filename ?? '') } }
  },

  async job({ params }) {
    const text = String(params.text ?? '').trim()
    if (!text) throw new Error('Paste the job description')
    const title = String(params.title ?? '').trim() || text.split('\n')[0].slice(0, 80)
    return { output: { type: 'job', text, title } }
  },

  async skillExtractor({ inputs, params }) {
    const resume = need(first<ResumeValue>(inputs, 'resume'), 'Connect a resume')
    const job = need(first<JobValue>(inputs, 'job'), 'Connect a job description')
    const res = await api.skills(resume.text, job.text, params.source === 'taxonomy+gemini' ? 'taxonomy+gemini' : 'taxonomy')
    return { output: { type: 'skills', kind: 'extracted', resume: res.resume, job: res.job }, note: res.note }
  },

  async matchEngine({ inputs, params }) {
    const resume = need(first<ResumeValue>(inputs, 'resume'), 'Connect a resume')
    const job = need(first<JobValue>(inputs, 'job'), 'Connect a job description')
    const skills = first<SkillsValue>(inputs, 'skills', (v) => v.kind === 'extracted')
    const match = await api.match({
      resume_text: resume.text,
      job_text: job.text,
      model: String(params.model ?? 'use-v4'),
      threshold: Number(params.threshold ?? 0.5),
      top_k: Number(params.topK ?? 3),
      resume_skills: skills?.resume.map((s) => s.name),
      job_skills: skills?.job.map((s) => s.name),
    })
    return { output: { type: 'score', kind: 'match', match } }
  },

  async skillGap({ inputs }) {
    const score = need(first<ScoreValue>(inputs, 'score', (v) => v.kind === 'match'), 'Connect the Match Engine score')
    const skills = first<SkillsValue>(inputs, 'skills')
    return {
      output: {
        type: 'skills',
        kind: 'gap',
        resume: skills?.resume ?? [],
        job: skills?.job ?? [],
        matched: score.match!.matched_skills,
        missing: score.match!.missing_skills,
      },
    }
  },

  async rewriter({ inputs, params, prompt }) {
    const resume = need(first<ResumeValue>(inputs, 'resume'), 'Connect a resume')
    const job = need(first<JobValue>(inputs, 'job'), 'Connect a job description')
    const gap = first<SkillsValue>(inputs, 'skills', (v) => v.kind === 'gap')
    const res = await api.rewrite({
      resume_text: resume.text,
      job_text: job.text,
      job_title: jobTitle(job),
      matched_skills: gap?.matched?.map((m) => m.name) ?? [],
      missing_skills: gap?.missing?.map((m) => m.name) ?? [],
      tone: String(params.tone ?? 'Professional'),
      instructions: prompt,
    })
    return { output: { type: 'doc', kind: 'resume', resume: res }, note: res.note }
  },

  async coach({ inputs, prompt }) {
    const score = need(first<ScoreValue>(inputs, 'score', (v) => v.kind === 'match'), 'Connect the Match Engine score')
    const gap = first<SkillsValue>(inputs, 'skills', (v) => v.kind === 'gap')
    const job = findJob()
    const m = score.match!
    const res = await api.coach({
      job_title: job ? jobTitle(job) : '',
      job_text: job?.text ?? '',
      score: m.score,
      verdict: m.verdict,
      matched_skills: (gap?.matched ?? m.matched_skills).map((s) => s.name),
      missing_skills: (gap?.missing ?? m.missing_skills).map((s) => s.name),
      instructions: prompt,
    })
    return { output: { type: 'doc', kind: 'coach', coach: res }, note: res.note }
  },

  async recorder({ params }) {
    const audio = params.audio as AudioValue | undefined
    if (!audio?.dataUrl) throw new Skip('Record an answer to run the interview chain')
    return { output: audio }
  },

  async transcriber({ inputs, params }) {
    const audio = need(first<AudioValue>(inputs, 'audio'), 'Connect the Interview Recorder')
    const model = String(params.model ?? 'base')
    const key = `${audio.id}:${model}`
    const cached = transcribeCache.get(key)
    if (cached) return { output: cached }
    const res = await api.transcribe(await dataUrlToBlob(audio.dataUrl), model)
    const value: TranscriptValue = { ...res, type: 'transcript', question: audio.question, audioId: audio.id }
    transcribeCache.set(key, value)
    return { output: value }
  },

  async speechMetrics({ inputs }) {
    const t = need(first<TranscriptValue>(inputs, 'transcript'), 'Connect a transcript')
    const speech = await api.speechMetrics(t.text, t.words, t.duration)
    return { output: { type: 'score', kind: 'speech', speech } }
  },

  async feedback({ inputs, prompt }) {
    const t = need(first<TranscriptValue>(inputs, 'transcript'), 'Connect a transcript')
    if (!t.text.trim()) throw new Error('No speech detected in the recording')
    const metrics = first<ScoreValue>(inputs, 'score', (v) => v.kind === 'speech')?.speech
    const job = first<JobValue>(inputs, 'job') ?? findJob()
    const res = await api.feedback({
      question: t.question,
      transcript: t.text,
      metrics,
      job_title: job ? jobTitle(job) : '',
      job_text: job?.text ?? '',
      instructions: prompt,
    })
    const value: DocValue = { type: 'doc', kind: 'feedback', feedback: { ...res, question: t.question, transcript: t.text, metrics } }
    return { output: value, note: res.note }
  },

  async report({ inputs }) {
    if (!inputs.score?.length && !inputs.doc?.length) throw new Error('Connect a score or document')
    return {}
  },
}

function findJob(): JobValue | undefined {
  const s = useGraph.getState()
  for (const n of s.nodes) {
    const out = s.results[n.id]?.output
    if (out?.type === 'job') return out
  }
  return undefined
}

// ------------------------------------------------------------------ graph walking
function upstreamOf(id: string): string[] {
  return [...new Set(useGraph.getState().edges.filter((e) => e.target === id).map((e) => e.source))]
}
function downstreamOf(id: string): string[] {
  return [...new Set(useGraph.getState().edges.filter((e) => e.source === id).map((e) => e.target))]
}

function closure(start: string[], next: (id: string) => string[]): Set<string> {
  const seen = new Set<string>()
  const stack = [...start]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...next(id))
  }
  return seen
}

export type RunMode = { kind: 'all' } | { kind: 'node'; id: string } | { kind: 'nodes'; ids: string[] } | { kind: 'from'; id: string }

let activeRun: Promise<void> | null = null

export function runWorkflow(mode: RunMode = { kind: 'all' }): Promise<void> {
  if (activeRun) return activeRun
  activeRun = execute(mode).finally(() => {
    activeRun = null
  })
  return activeRun
}

async function execute(mode: RunMode) {
  const store = useGraph.getState()
  const all = store.nodes.map((n) => n.id)
  let runSet: Set<string>
  if (mode.kind === 'all') {
    runSet = new Set(all)
  } else if (mode.kind === 'node' || mode.kind === 'nodes') {
    // the node(s) plus any ancestors that have never produced output
    const ids = mode.kind === 'node' ? [mode.id] : mode.ids.filter((id) => store.nodes.some((n) => n.id === id))
    const ancestors = closure(ids.flatMap(upstreamOf), upstreamOf)
    runSet = new Set([...ids, ...[...ancestors].filter((a) => !store.results[a]?.output)])
  } else {
    runSet = closure([mode.id], downstreamOf)
  }
  if (!runSet.size) return

  const t0 = performance.now()
  store.set({ running: true, runStartedAt: Date.now() })
  store.setStatus([...runSet], 'queued')

  const done = new Map<string, Promise<'ok' | 'fail' | 'skip'>>()
  const nodeById = new Map(store.nodes.map((n) => [n.id, n]))
  let count = 0

  const exec = (id: string): Promise<'ok' | 'fail' | 'skip'> => {
    const existing = done.get(id)
    if (existing) return existing
    const p = (async () => {
      const ups = upstreamOf(id).filter((u) => runSet.has(u))
      const states = await Promise.all(ups.map(exec))
      const node = nodeById.get(id)
      if (!node) return 'fail' as const
      const s = useGraph.getState()
      const isReport = node.data.kind === 'report'
      if (!isReport && states.some((st) => st !== 'ok')) {
        const skipped = states.includes('skip')
        s.setResult(id, {
          status: skipped ? 'skipped' : 'idle',
          output: skipped ? undefined : s.results[id]?.output,
          error: undefined,
          note: skipped ? 'Waiting for a recording' : 'Upstream node failed',
        })
        return skipped ? ('skip' as const) : ('fail' as const)
      }
      s.setResult(id, { status: 'running', error: undefined })
      const started = performance.now()
      try {
        const { output, note } = await EXECUTORS[node.data.kind]({
          id,
          params: node.data.params,
          inputs: collectInputs(id),
          prompt: useGraph.getState().prompt,
        })
        count++
        useGraph.getState().setResult(id, { status: 'done', output, note, error: undefined, ms: performance.now() - started })
        return 'ok' as const
      } catch (err) {
        if (err instanceof Skip) {
          useGraph.getState().setResult(id, { status: 'skipped', output: undefined, note: err.message, error: undefined })
          return 'skip' as const
        }
        const message = err instanceof Error ? err.message : String(err)
        useGraph.getState().setResult(id, { status: 'error', error: message, ms: performance.now() - started })
        return 'fail' as const
      }
    })()
    done.set(id, p)
    return p
  }

  const outcomes = await Promise.all([...runSet].map(exec))
  const ms = performance.now() - t0
  const s = useGraph.getState()
  const match = Object.values(s.results).find((r) => r.output?.type === 'score' && r.output.kind === 'match')?.output as
    | ScoreValue
    | undefined
  s.set({
    running: false,
    runStartedAt: null,
    lastRun: { ms, nodes: count },
    history: [
      {
        id: Math.random().toString(36).slice(2),
        at: Date.now(),
        name: s.workflowName,
        ms,
        nodes: count,
        score: match?.match?.score,
        verdict: match?.match?.verdict,
        ok: !outcomes.includes('fail'),
      },
      ...s.history,
    ].slice(0, 30),
  })
  if (outcomes.includes('fail')) s.toast('Some nodes need attention — check the red ports', 'error')
}
