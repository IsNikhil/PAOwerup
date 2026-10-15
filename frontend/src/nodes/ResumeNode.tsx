import type { NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, FileText, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { NodeShell } from '../canvas/NodeShell'
import { api } from '../lib/api'
import { Skeleton } from '../components/ui'
import { useGraph } from '../store/graph'
import { useParams } from './hooks'

const ACCEPT = '.pdf,.docx,.txt,.md'

export function ResumeNode({ id, selected }: NodeProps) {
  const [params, set] = useParams<{ text: string; filename: string }>(id)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const setResult = useGraph((s) => s.setResult)
  const toast = useGraph((s) => s.toast)

  async function upload(file?: File) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const res = await api.parseResume(file)
      set('text', res.text)
      set('filename', res.filename)
      setResult(id, { status: 'idle', output: undefined, error: undefined })
      toast(`Parsed ${res.filename} · ${res.words} words`, 'ok')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const words = params.text ? params.text.split(/\s+/).filter(Boolean).length : 0

  return (
    <NodeShell id={id} kind="resume" selected={selected}>
      {busy ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[74px]" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            upload(e.dataTransfer.files[0])
          }}
          onClick={() => input.current?.click()}
          className={clsx(
            'nodrag group/drop flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[12px] border border-dashed px-3 py-4 text-center transition',
            drag ? 'border-[var(--t-resume)] bg-[rgba(232,255,90,0.06)]' : 'border-white/12 bg-black/20 hover:border-white/25 hover:bg-black/30',
          )}
        >
          <div className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-ink-3 transition group-hover/drop:text-ink">
            <Upload size={15} />
          </div>
          <div className="text-sm text-ink-2">
            Drop resume or <span className="text-[var(--t-resume)]">browse</span>
          </div>
          <div className="text-2xs text-ink-4">PDF, DOCX or TXT · max 8 MB</div>
          <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => upload(e.target.files?.[0] ?? undefined)} />
        </div>
      )}

      {error && <div className="text-xs text-[#fca5a5]">{error}</div>}

      {params.text && (
        <div className="flex flex-col gap-2">
          <div className="inset flex items-center gap-2 px-2.5 py-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(232,255,90,0.12)] text-[var(--t-resume)]">
              <FileText size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-ink">{params.filename || 'Pasted text'}</div>
              <div className="mono text-2xs text-ink-4">{words} words</div>
            </div>
            <button
              className="nodrag icon-btn h-6 w-6"
              aria-label="Remove resume"
              onClick={() => {
                set('text', '')
                set('filename', '')
                setResult(id, { status: 'idle', output: undefined })
              }}
            >
              <X size={13} />
            </button>
          </div>
          {params.filename && <button className="nodrag flex items-center gap-1.5 text-xs text-ink-4 transition hover:text-ink-2" onClick={() => setOpen((v) => !v)}>
            <ChevronDown size={13} className={clsx('transition-transform', open && 'rotate-180')} />
            {open ? 'Hide extracted text' : 'Show extracted text'}
          </button>}
          <AnimatePresence initial={false}>
            {(open || !params.filename) && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <textarea
                  className="field nodrag nowheel h-40 resize-none font-mono text-2xs leading-[16px]"
                  value={params.text}
                  placeholder="Paste your resume text…"
                  autoFocus={!params.filename}
                  onChange={(e) => set('text', e.target.value)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {!params.text && !busy && (
        <button className="nodrag self-start text-xs text-ink-4 underline-offset-2 hover:text-ink-2 hover:underline" onClick={() => set('text', ' ')}>
          or paste resume text
        </button>
      )}
    </NodeShell>
  )
}
