import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { renamePresence, usePresence } from '../canvas/presence'
import { TYPE_HEX, type DataType } from '../lib/types'
import { useGraph } from '../store/graph'

function Shell({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-sm" />
        <Dialog.Content className="glass-solid fixed left-1/2 top-1/2 z-[81] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[18px] outline-none">
          <div className="flex items-center border-b border-line px-5 py-3.5">
            <Dialog.Title className="text-sm font-medium text-ink">{title}</Dialog.Title>
            <Dialog.Close className="icon-btn ml-auto" aria-label="Close">
              <X size={15} />
            </Dialog.Close>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const SHORTCUTS: [string, string][] = [
  ['⌘ / Ctrl + Enter', 'Run the whole workflow'],
  ['Space', 'Add a node (or right-click the canvas)'],
  ['F', 'Fit view'],
  ['Delete / Backspace', 'Remove the selected node or wire'],
  ['Drag from a port', 'Connect nodes (only matching types snap)'],
  ['Scroll / pinch', 'Zoom · drag the background to pan'],
]

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Shell open={open} onOpenChange={onOpenChange} title="How PAOwerUp works">
      <div className="flex flex-col gap-4 text-xs leading-5 text-ink-3">
        <p>
          Each card is a step in your career pipeline. Data flows left to right along the wires. Press <b className="text-ink">Run</b> to execute every node in order;
          tweak any setting and run again.
        </p>
        <div>
          <div className="label mb-2">Wire colors</div>
          <div className="grid grid-cols-3 gap-2">
            {(['resume', 'job', 'skills', 'score', 'audio', 'doc'] as DataType[]).map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_HEX[t], boxShadow: `0 0 8px ${TYPE_HEX[t]}` }} />
                <span className="text-ink-2">{t === 'audio' ? 'audio / transcript' : t}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-2">Engines</div>
          <ul className="flex flex-col gap-1">
            <li><b className="text-[#FDBA74]">TensorFlow + USE</b> — embeds resume and job sentences and computes the match score.</li>
            <li><b className="text-[#C4B5FD]">Gemini</b> — rewrites the resume, coaches next steps and gives interview feedback (template output without a key).</li>
            <li><b className="text-[#A5F3FC]">Whisper</b> — transcribes your recorded interview answer locally.</li>
          </ul>
        </div>
        <div>
          <div className="label mb-2">Shortcuts</div>
          <div className="flex flex-col gap-1.5">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-ink-2">{v}</span>
                <span className="mono rounded-md border border-line bg-white/5 px-1.5 py-0.5 text-[10.5px] text-ink-3">{k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  )
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const health = useGraph((s) => s.health)
  const userName = useGraph((s) => s.userName)
  const set = useGraph((s) => s.set)
  const self = usePresence((s) => s.self)
  const [name, setName] = useState(userName || self?.name || '')
  const rows = health
    ? ([
        ['TensorFlow · USE', health.use, `TF ${health.tensorflow_version}`],
        ['Whisper', health.whisper, ''],
        ['Gemini', health.gemini, health.gemini_model],
      ] as const)
    : []
  return (
    <Shell open={open} onOpenChange={onOpenChange} title="Settings">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="label">Your name (shown on live cursors)</span>
          <div className="flex gap-2">
            <input className="field h-9 py-0" value={name} onChange={(e) => setName(e.target.value)} placeholder={self?.name ?? 'Your name'} />
            <button
              className="btn btn-white h-9"
              onClick={() => {
                set({ userName: name.trim() })
                if (name.trim()) renamePresence(name.trim())
              }}
            >
              Save
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label">Backend models</span>
          {!health && <span className="text-xs text-[#fca5a5]">Backend not reachable. Start it with `make dev`.</span>}
          {rows.map(([label, st, extra]) => (
            <div key={label} className="inset flex items-center gap-3 px-3 py-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: st.status === 'ready' ? 'var(--ok)' : st.status === 'error' ? 'var(--danger)' : st.status === 'disabled' ? 'var(--text-4)' : 'var(--warn)' }}
              />
              <span className="text-xs text-ink-2">{label}</span>
              <span className="ml-auto max-w-[300px] truncate text-[10.5px] text-ink-4" title={st.detail}>
                {st.status} {st.detail ? `· ${st.detail}` : ''} {extra ? `· ${extra}` : ''}
              </span>
            </div>
          ))}
          {health?.gemini.status === 'disabled' && (
            <p className="text-[11px] leading-4 text-ink-4">
              To connect Gemini, put <code className="mono text-ink-2">GEMINI_API_KEY=…</code> in <code className="mono text-ink-2">backend/.env</code> and restart the backend.
            </p>
          )}
        </div>
      </div>
    </Shell>
  )
}
