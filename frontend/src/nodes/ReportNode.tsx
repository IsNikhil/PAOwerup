import * as Dialog from '@radix-ui/react-dialog'
import * as Menu from '@radix-ui/react-dropdown-menu'
import type { NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { ArrowUpRight, Bookmark, Check, ChevronDown, Copy, Download, Maximize2, RefreshCw, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NodeShell } from '../canvas/NodeShell'
import { Segmented, Tip } from '../components/ui'
import { downloadBlob } from '../lib/api'
import { downloadResumeDocx, printReport, reportSummaryText, resumeToMarkdown } from '../lib/exports'
import { runWorkflow } from '../lib/runner'
import type { CoachResponse, DocValue, FeedbackResponse, MatchResponse, ResumeDoc, ScoreValue, SkillsValue, SpeechMetrics } from '../lib/types'
import { useGraph } from '../store/graph'
import { useParams } from './hooks'
import { SkillChips } from './SkillChips'
import { Sparkline } from './SpeechMetricsNode'

type Tab = 'match' | 'resume' | 'interview'

interface ReportData {
  match?: MatchResponse
  speech?: SpeechMetrics
  gap?: SkillsValue
  resume?: ResumeDoc
  resumeSource?: string
  coach?: CoachResponse
  feedback?: FeedbackResponse & { question: string; transcript: string; metrics?: SpeechMetrics }
}

function useReportData(id: string): ReportData {
  const edges = useGraph((s) => s.edges)
  const results = useGraph((s) => s.results)
  return useMemo(() => {
    const data: ReportData = {}
    for (const e of edges) {
      if (e.target !== id) continue
      const v = results[e.source]?.output
      if (!v) continue
      if (v.type === 'score') {
        if (v.kind === 'match') data.match = (v as ScoreValue).match
        else data.speech = (v as ScoreValue).speech
      } else if (v.type === 'skills') data.gap = v as SkillsValue
      else if (v.type === 'doc') {
        const d = v as DocValue
        if (d.kind === 'resume') {
          data.resume = d.resume?.resume
          data.resumeSource = d.resume?.source
        } else if (d.kind === 'coach') data.coach = d.coach
        else if (d.kind === 'feedback') data.feedback = d.feedback
      }
    }
    if (!data.speech && data.feedback?.metrics) data.speech = data.feedback.metrics
    return data
  }, [edges, results, id])
}

// ---------------------------------------------------------------- gauge
function Gauge({ score, size = 168 }: { score?: number; size?: number }) {
  const reduce = useReducedMotion()
  const value = useMotionValue(0)
  const display = useTransform(value, (v) => Math.round(v).toString())
  const r = size / 2 - 12
  const c = 2 * Math.PI * r
  const arc = 0.75 // 270° gauge
  const dash = useTransform(value, (v) => `${(v / 100) * c * arc} ${c}`)

  useEffect(() => {
    if (score === undefined) {
      value.set(0)
      return
    }
    if (reduce) {
      value.set(score)
      return
    }
    const ctrl = animate(value, score, { duration: 1.4, ease: [0.22, 1, 0.36, 1] })
    return () => ctrl.stop()
  }, [score, reduce, value])

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[135deg]">
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
          <filter id="gauge-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10} strokeLinecap="round" strokeDasharray={`${c * arc} ${c}`} />
        {/* tick marks */}
        {Array.from({ length: 28 }).map((_, i) => {
          const a = (i / 27) * arc * 2 * Math.PI
          const r1 = r - 14
          const r2 = r - (i % 9 === 0 ? 19 : 16)
          return (
            <line
              key={i}
              x1={size / 2 + r1 * Math.cos(a)}
              y1={size / 2 + r1 * Math.sin(a)}
              x2={size / 2 + r2 * Math.cos(a)}
              y2={size / 2 + r2 * Math.sin(a)}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={1}
            />
          )
        })}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth={10}
          strokeLinecap="round"
          style={{ strokeDasharray: dash, opacity: score === undefined ? 0 : 1 }}
          filter="url(#gauge-glow)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <motion.span className="mono text-[46px] font-medium leading-none tracking-[-0.04em] text-ink">{score === undefined ? '—' : display}</motion.span>
        <span className="mono mt-1.5 text-2xs tracking-label text-ink-4">MATCH / 100</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- tab bodies
function MatchTab({ d, large }: { d: ReportData; large?: boolean }) {
  const m = d.match
  const matched = d.gap?.matched ?? m?.matched_skills ?? []
  const missing = d.gap?.missing ?? m?.missing_skills ?? []
  return (
    <div className="flex flex-col gap-3.5">
      {m && (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['Skills', m.breakdown.skill_coverage],
              ['Sentences', m.breakdown.sentence_similarity],
              ['Document', m.breakdown.document_similarity],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="inset px-2.5 py-2">
              <div className="label">{label}</div>
              <div className="mono mt-0.5 text-sm text-ink">{Math.round(v * 100)}%</div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-[#60A5FA] to-[#A78BFA]" initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 1, delay: 0.3 }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="label">Matched skills</span>
          <span className="mono text-2xs text-ink-4">{matched.length}</span>
        </div>
        {matched.length ? <SkillChips items={matched.map((s) => ({ name: s.name }))} tone="ok" max={large ? 40 : 12} /> : <span className="text-xs text-ink-4">—</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="label">Missing skills</span>
          <span className="mono text-2xs text-ink-4">{missing.length}</span>
        </div>
        {missing.length ? <SkillChips items={missing.map((s) => ({ name: s.name }))} tone="miss" max={large ? 40 : 10} /> : <span className="text-xs text-[#86efac]">None 🎉</span>}
      </div>
      {large && m && (
        <div className="flex flex-col gap-1.5">
          <span className="label">Evidence from your resume</span>
          {m.matched_skills.slice(0, 8).map((s) => (
            <div key={s.name} className="inset px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="chip chip-ok h-5">{s.name}</span>
                <span className="text-2xs text-ink-4">{s.match_type === 'exact' ? 'exact mention' : `semantic · ${s.similarity.toFixed(2)} via ${s.matched_with}`}</span>
              </div>
              {s.evidence[0] && <p className="mt-1.5 text-ink-3">“{s.evidence[0].sentence}”</p>}
            </div>
          ))}
        </div>
      )}
      {d.coach && (
        <div className="flex flex-col gap-1.5">
          <span className="label">Next steps</span>
          {d.coach.steps.slice(0, large ? 5 : 3).map((s, i) => (
            <div key={s.title} className="flex items-start gap-2 text-xs">
              <span className="mono mt-px text-2xs text-ink-4">0{i + 1}</span>
              <div className="min-w-0">
                <span className="text-ink-2">{s.title}</span>
                {large && <p className="text-2xs text-ink-4">{s.detail}</p>}
              </div>
              <span className="ml-auto shrink-0 text-2xs text-ink-4">{s.timeframe}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ResumeTab({ d, large }: { d: ReportData; large?: boolean }) {
  const r = d.resume
  if (!r) return <Empty>Run the Resume Rewriter to see your tailored resume here.</Empty>
  return (
    <div className={clsx('nowheel flex flex-col gap-3 overflow-y-auto rounded-[12px] bg-[#fafafa] p-4 text-[#18181b]', large ? 'max-h-[60vh]' : 'max-h-[300px]')}>
      <div className="text-center">
        <div className="text-base font-semibold tracking-tight">{r.name}</div>
        {r.headline && <div className="text-xs text-zinc-500">{r.headline}</div>}
        {r.contact && <div className="mt-0.5 text-[10.5px] text-zinc-500">{r.contact}</div>}
      </div>
      {r.summary && <p className="text-xs leading-[18px] text-zinc-700">{r.summary}</p>}
      {r.sections.map((s) => (
        <div key={s.title}>
          <div className="border-b border-zinc-200 pb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{s.title}</div>
          {s.items.map((it, i) => (
            <div key={i} className="mt-1.5">
              {(it.heading || it.dates) && (
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-semibold">{it.heading}</span>
                  {it.subheading && <span className="truncate text-zinc-500">{it.subheading}</span>}
                  <span className="ml-auto shrink-0 text-[10.5px] text-zinc-500">{it.dates}</span>
                </div>
              )}
              <ul className="mt-0.5 list-disc pl-4">
                {it.bullets.map((b, j) => (
                  <li key={j} className="text-[11.5px] leading-[17px] text-zinc-700">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
      {r.skills.length > 0 && (
        <div>
          <div className="border-b border-zinc-200 pb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Skills</div>
          <p className="mt-1 text-[11.5px] text-zinc-700">{r.skills.join(' · ')}</p>
        </div>
      )}
      {r.skills_to_develop.length > 0 && (
        <div className="rounded-lg border border-dashed border-pink-300 bg-pink-50 px-2.5 py-2 text-[11px] text-pink-900">
          <b>Skills to develop</b> (not claimed as experience): {r.skills_to_develop.join(', ')}
        </div>
      )}
    </div>
  )
}

function InterviewTab({ d, large }: { d: ReportData; large?: boolean }) {
  const f = d.feedback
  const s = d.speech
  if (!f && !s) return <Empty>Record an answer in the Interview Recorder to see feedback here.</Empty>
  return (
    <div className={clsx('nowheel flex flex-col gap-3 overflow-y-auto pr-0.5', !large && 'max-h-[320px]')}>
      {f?.question && <div className="text-xs text-ink-3">“{f.question}”</div>}
      {s && (
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ['WPM', s.wpm.toFixed(0)],
              ['Fillers', String(s.filler_total)],
              ['Pause', `${s.longest_pause.toFixed(1)}s`],
              ['Clarity', s.clarity.toFixed(0)],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="inset px-2 py-1.5">
              <div className="label">{k}</div>
              <div className="mono text-sm text-ink">{v}</div>
            </div>
          ))}
        </div>
      )}
      {s && s.wpm_series.length > 1 && <Sparkline values={s.wpm_series} height={30} />}
      {f && (
        <>
          <div className="flex items-baseline gap-2">
            <span className="mono text-xl text-ink">{f.rating}/10</span>
            <span className="text-xs text-ink-3">{f.overall}</span>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: large ? '1fr 1fr' : '1fr' }}>
            <div className="flex flex-col gap-1">
              <span className="label">Strengths</span>
              {f.strengths.map((x) => (
                <div key={x} className="flex gap-1.5 text-2xs leading-4 text-ink-2">
                  <Check size={12} className="mt-0.5 shrink-0 text-[var(--ok)]" />
                  {x}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <span className="label">Improve</span>
              {f.improvements.map((x) => (
                <div key={x} className="flex gap-1.5 text-2xs leading-4 text-ink-2">
                  <ArrowUpRight size={12} className="mt-0.5 shrink-0 text-[var(--warn)]" />
                  {x}
                </div>
              ))}
            </div>
          </div>
          {large && (
            <div className="flex flex-col gap-1">
              <span className="label">Better sample answer</span>
              <p className="inset px-3 py-2 text-xs leading-5 text-ink-2">{f.sample_answer}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[12px] border border-dashed border-white/10 px-4 py-8 text-center text-xs text-ink-4">{children}</div>
}

function ReportBody({ d, tab, setTab, large }: { d: ReportData; tab: Tab; setTab: (t: Tab) => void; large?: boolean }) {
  const m = d.match
  return (
    <div className="flex flex-col gap-3.5">
      {/* hero: aurora + gauge */}
      <div className="relative -mx-3.5 -mt-3.5 overflow-hidden rounded-t-[17px] px-3.5 pb-3 pt-5">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[38%] h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-[50px]" style={{ background: 'conic-gradient(from 200deg, #60A5FA, #A78BFA, #F472B6, #60A5FA)', animation: 'aurora-drift 10s ease-in-out infinite' }} />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#141418]/80 to-transparent" />
        </div>
        <div className="relative flex flex-col items-center">
          <Gauge score={m?.score} size={large ? 200 : 172} />
          <motion.div key={m?.verdict ?? 'none'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-1 flex flex-col items-center gap-1 text-center">
            <span className="text-sm font-medium text-ink">{m ? m.verdict : 'Run the workflow'}</span>
            <span className="max-w-[340px] text-xs leading-[18px] text-ink-3">{m ? m.summary : 'Your match score, skills and improved resume will appear here.'}</span>
          </motion.div>
        </div>
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'match', label: 'Match' },
          { value: 'resume', label: 'Resume' },
          { value: 'interview', label: 'Interview' },
        ]}
      />
      <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === 'match' && <MatchTab d={d} large={large} />}
        {tab === 'resume' && <ResumeTab d={d} large={large} />}
        {tab === 'interview' && <InterviewTab d={d} large={large} />}
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------- node
type Format = 'docx' | 'pdf' | 'md'
const FORMAT_LABEL: Record<Format, string> = { docx: 'DOCX', pdf: 'PDF', md: 'MD' }

export function ReportNode({ id, selected }: NodeProps) {
  const [params, set] = useParams<{ tab: Tab; format?: Format }>(id)
  const d = useReportData(id)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const toast = useGraph((s) => s.toast)
  const name = useGraph((s) => s.workflowName)
  const history = useGraph((s) => s.history)
  const setStore = useGraph((s) => s.set)
  const tab = (params.tab ?? 'match') as Tab
  const format = (params.format ?? 'docx') as Format
  const bookmarked = !!history[0]?.saved

  async function download() {
    try {
      if (format === 'docx') {
        if (!d.resume) return toast('Run the Resume Rewriter first', 'error')
        await downloadResumeDocx(d.resume)
        toast('Improved resume downloaded (DOCX)', 'ok')
      } else if (format === 'md') {
        if (!d.resume) return toast('Run the Resume Rewriter first', 'error')
        downloadBlob(new Blob([resumeToMarkdown(d.resume)], { type: 'text/markdown' }), `${d.resume.name || 'resume'}.md`)
      } else {
        if (!printReport(name, d.match, d.coach, d.feedback, d.resume)) toast('Allow pop-ups to export the PDF', 'error')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', 'error')
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(reportSummaryText(d.match, d.coach, d.feedback))
    setCopied(true)
    toast('Report summary copied', 'ok')
    setTimeout(() => setCopied(false), 1500)
  }

  function bookmark() {
    if (!history.length) return toast('Run the workflow first', 'error')
    const [head, ...rest] = history
    setStore({ history: [{ ...head, saved: !bookmarked }, ...rest] })
    toast(bookmarked ? 'Removed from saved runs' : 'Saved to your runs', 'ok')
  }

  const toolbar = (
    <div className="nodrag absolute -bottom-[52px] left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-[14px] border border-line bg-[#141418]/80 p-1 shadow-[var(--shadow-float)] backdrop-blur-xl">
      <Tip label="Expand">
        <button className="icon-btn" onClick={() => setExpanded(true)} aria-label="Expand">
          <Maximize2 size={14} />
        </button>
      </Tip>
      <Tip label={bookmarked ? 'Saved' : 'Save run'}>
        <button className="icon-btn" onClick={bookmark} aria-label="Bookmark">
          <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </Tip>
      <Tip label="Copy summary">
        <button className="icon-btn" onClick={copy} aria-label="Copy">
          {copied ? <Check size={14} className="text-[var(--ok)]" /> : <Copy size={14} />}
        </button>
      </Tip>
      <Tip label="Regenerate" kbd="⌘↵">
        <button className="icon-btn" onClick={() => runWorkflow({ kind: 'all' })} aria-label="Regenerate">
          <RefreshCw size={14} />
        </button>
      </Tip>
      <div className="mx-1 h-4 w-px bg-white/10" />
      <Menu.Root>
        <Menu.Trigger asChild>
          <button className="flex h-[30px] items-center gap-1 rounded-[9px] px-2 text-xs font-medium text-ink-2 hover:bg-white/[0.07]">
            {FORMAT_LABEL[format]} <ChevronDown size={12} className="text-ink-4" />
          </button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content className="menu" sideOffset={8}>
            <Menu.Item className="menu-item" onSelect={() => set('format', 'docx')}>
              DOCX <span className="kbd">improved resume</span>
            </Menu.Item>
            <Menu.Item className="menu-item" onSelect={() => set('format', 'pdf')}>
              PDF <span className="kbd">full report</span>
            </Menu.Item>
            <Menu.Item className="menu-item" onSelect={() => set('format', 'md')}>
              Markdown <span className="kbd">resume</span>
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      <Tip label={`Download ${FORMAT_LABEL[format]}`}>
        <button className="icon-btn text-ink" onClick={download} aria-label="Download">
          <Download size={14} />
        </button>
      </Tip>
    </div>
  )

  return (
    <>
      <NodeShell id={id} kind="report" selected={selected} hero footer={toolbar}>
        <ReportBody d={d} tab={tab} setTab={(t) => set('tab', t)} />
      </NodeShell>
      <Dialog.Root open={expanded} onOpenChange={setExpanded}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="node-card fixed left-1/2 top-1/2 z-[81] flex max-h-[88vh] w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden outline-none">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3">
              <span className="h-[7px] w-[7px] rounded-full bg-white" />
              <Dialog.Title className="text-sm font-medium">Career Report · {name}</Dialog.Title>
              <Dialog.Close className="icon-btn ml-auto" aria-label="Close">
                <X size={15} />
              </Dialog.Close>
            </div>
            <div className="overflow-y-auto p-5">
              <ReportBody d={d} tab={tab} setTab={(t) => set('tab', t)} large />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
