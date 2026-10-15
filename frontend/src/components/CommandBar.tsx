import { FIT } from '../lib/view'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Bookmark, FileText, FolderOpen, History, LayoutTemplate, Moon, NotebookPen, Settings, Sun } from 'lucide-react'
import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { downloadResumeDocx } from '../lib/exports'
import { runWorkflow } from '../lib/runner'
import { SAMPLES } from '../lib/samples'
import type { DocValue } from '../lib/types'
import { useGraph } from '../store/graph'
import { Tip } from './ui'

type Panel = 'history' | 'notes' | 'templates' | 'files' | null

export function CommandBar({ onSettings }: { onSettings: () => void }) {
  const prompt = useGraph((s) => s.prompt)
  const theme = useGraph((s) => s.theme)
  const running = useGraph((s) => s.running)
  const set = useGraph((s) => s.set)
  const [panel, setPanel] = useState<Panel>(null)

  const submit = () => {
    const ids = useGraph
      .getState()
      .nodes.filter((n) => n.data.kind === 'rewriter' || n.data.kind === 'coach')
      .map((n) => n.id)
    if (!ids.length) return useGraph.getState().toast('Add a Resume Rewriter or Career Coach node first', 'error')
    runWorkflow({ kind: 'nodes', ids })
    useGraph.getState().toast(prompt.trim() ? 'Sent to Gemini nodes as extra instructions' : 'Regenerating Gemini nodes', 'info')
  }

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p))
  const icons: { id: Panel | 'theme' | 'settings'; icon: JSX.Element; label: string }[] = [
    { id: 'history', icon: <History size={15} />, label: 'History' },
    { id: 'notes', icon: <NotebookPen size={15} />, label: 'Notes' },
    { id: 'templates', icon: <LayoutTemplate size={15} />, label: 'Templates' },
    { id: 'files', icon: <FolderOpen size={15} />, label: 'Saved files' },
    { id: 'theme', icon: theme === 'midnight' ? <Moon size={15} /> : <Sun size={15} />, label: theme === 'midnight' ? 'Theme: Midnight' : 'Theme: Graphite' },
    { id: 'settings', icon: <Settings size={15} />, label: 'Settings' },
  ]

  return (
    <div className="fixed bottom-4 left-1/2 z-30 flex w-[min(560px,calc(100vw-880px))] min-w-[420px] -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>{panel && <PanelView panel={panel} close={() => setPanel(null)} />}</AnimatePresence>
      <div className="glass w-full rounded-[18px] p-1.5">
        <div className="flex items-center gap-2 rounded-[13px] border border-[var(--line-soft)] bg-black/25 py-1.5 pl-3.5 pr-1.5">
          <span className="label shrink-0 text-ink-3">Prompt</span>
          <span className="h-4 w-px bg-white/10" />
          <input
            value={prompt}
            onChange={(e) => set({ prompt: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submit()}
            placeholder="Tailor my resume for this job and focus on SQL…"
            className="h-8 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-5"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={submit}
            disabled={running}
            className={clsx('grid h-8 w-8 place-items-center rounded-[10px] transition', prompt.trim() ? 'bg-[var(--mint)] text-[var(--mint-ink)]' : 'bg-white/[0.07] text-ink-3 hover:text-ink')}
            aria-label="Send prompt"
          >
            <ArrowUp size={15} />
          </motion.button>
        </div>
        <div className="flex items-center justify-center gap-1 pt-1.5">
          {icons.map((it) => (
            <Tip key={it.id} label={it.label}>
              <button
                className="icon-btn h-8 w-8"
                data-active={panel === it.id || (!panel && it.id === 'history')}
                aria-label={it.label}
                onClick={() => {
                  if (it.id === 'theme') set({ theme: theme === 'midnight' ? 'graphite' : 'midnight' })
                  else if (it.id === 'settings') onSettings()
                  else toggle(it.id)
                }}
              >
                {it.icon}
              </button>
            </Tip>
          ))}
        </div>
      </div>
    </div>
  )
}

function PanelView({ panel, close }: { panel: Exclude<Panel, null>; close: () => void }) {
  const history = useGraph((s) => s.history)
  const notes = useGraph((s) => s.notes)
  const loadSample = useGraph((s) => s.loadSample)
  const newBlank = useGraph((s) => s.newBlank)
  const nodes = useGraph((s) => s.nodes)
  const results = useGraph((s) => s.results)
  const set = useGraph((s) => s.set)
  const toast = useGraph((s) => s.toast)
  const { fitView } = useReactFlow()

  const resumeNode = nodes.find((n) => n.data.kind === 'resume')
  const rewrite = Object.values(results).find((r) => r.output?.type === 'doc' && r.output.kind === 'resume')?.output as DocValue | undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="glass-solid w-full rounded-[16px] p-3"
    >
      {panel === 'history' && (
        <div className="flex max-h-[240px] flex-col gap-1 overflow-y-auto">
          <div className="label mb-1">Run history</div>
          {!history.length && <div className="py-4 text-center text-xs text-ink-4">No runs yet.</div>}
          {history.map((h) => (
            <div key={h.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5">
              <span className={clsx('h-1.5 w-1.5 rounded-full', h.ok ? 'bg-[var(--ok)]' : 'bg-[var(--danger)]')} />
              <span className="flex-1 truncate text-xs text-ink-2">{h.name}</span>
              {h.saved && <Bookmark size={11} className="text-[var(--select)]" fill="currentColor" />}
              <span className="mono text-[10.5px] text-ink-4">{new Date(h.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="mono w-14 text-right text-[10.5px] text-ink-4">{(h.ms / 1000).toFixed(2)}s</span>
              <span className="mono w-8 text-right text-xs text-ink">{h.score !== undefined ? Math.round(h.score) : '—'}</span>
            </div>
          ))}
        </div>
      )}
      {panel === 'notes' && (
        <div className="flex flex-col gap-2">
          <div className="label">Notes · saved locally</div>
          <textarea
            autoFocus
            value={notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Interview prep notes, questions to ask, follow-ups…"
            className="field h-32 resize-none"
          />
        </div>
      )}
      {panel === 'templates' && (
        <div className="flex flex-col gap-1">
          <div className="label mb-1">Templates</div>
          {SAMPLES.map((s, i) => (
            <button
              key={s.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5"
              onClick={() => {
                loadSample(i)
                close()
                setTimeout(() => fitView(FIT), 60)
              }}
            >
              <LayoutTemplate size={15} className="text-ink-4" />
              <span className="flex-1">
                <span className="block text-xs text-ink-2">{s.name}</span>
                <span className="block text-[10.5px] text-ink-4">{s.description}</span>
              </span>
            </button>
          ))}
          <button
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5"
            onClick={() => {
              newBlank()
              close()
            }}
          >
            <LayoutTemplate size={15} className="text-ink-4" />
            <span className="flex-1">
              <span className="block text-xs text-ink-2">Blank career workflow</span>
              <span className="block text-[10.5px] text-ink-4">Full pipeline, bring your own resume and job</span>
            </span>
          </button>
        </div>
      )}
      {panel === 'files' && (
        <div className="flex flex-col gap-1">
          <div className="label mb-1">Files in this workflow</div>
          {resumeNode?.data.params.text ? (
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <FileText size={15} className="text-[var(--t-resume)]" />
              <span className="flex-1 truncate text-xs text-ink-2">{String(resumeNode.data.params.filename || 'Pasted resume')}</span>
              <span className="text-[10.5px] text-ink-4">source resume</span>
            </div>
          ) : null}
          {rewrite?.resume ? (
            <button
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5"
              onClick={() => downloadResumeDocx(rewrite.resume!.resume).catch(() => toast('Download failed', 'error'))}
            >
              <FileText size={15} className="text-[var(--t-doc)]" />
              <span className="flex-1 truncate text-xs text-ink-2">{rewrite.resume.resume.name || 'Improved'} resume (PAOwerUp).docx</span>
              <span className="text-[10.5px] text-ink-4">download</span>
            </button>
          ) : (
            <div className="px-2 py-2 text-xs text-ink-4">Run the Resume Rewriter to generate an improved DOCX.</div>
          )}
        </div>
      )}
    </motion.div>
  )
}
