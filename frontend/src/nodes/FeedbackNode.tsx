import type { NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import { ArrowUpRight, Check, ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { NodeShell, EmptyHint, GeminiNote } from '../canvas/NodeShell'
import { Skeleton } from '../components/ui'
import { runWorkflow } from '../lib/runner'
import type { DocValue } from '../lib/types'
import { useNodeResult } from '../store/graph'
import { useBusy, useOutput } from './hooks'

export function FeedbackNode({ id, selected }: NodeProps) {
  const out = useOutput<DocValue>(id)
  const busy = useBusy(id)
  const { note } = useNodeResult(id)
  const [open, setOpen] = useState(false)
  const fb = out?.feedback
  return (
    <NodeShell id={id} kind="feedback" selected={selected}>
      {busy ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : fb ? (
        <div className="nowheel flex max-h-[300px] flex-col gap-2.5 overflow-y-auto pr-0.5">
          <div className="flex items-baseline gap-2">
            <span className="mono text-2xl font-medium text-ink">{fb.rating}</span>
            <span className="mono text-xs text-ink-4">/10</span>
          </div>
          <p className="text-xs leading-[18px] text-ink-2">{fb.overall}</p>
          <div className="flex flex-col gap-1">
            <span className="label">Strengths</span>
            {fb.strengths.map((s) => (
              <div key={s} className="flex gap-1.5 text-2xs leading-4 text-ink-3">
                <Check size={12} className="mt-0.5 shrink-0 text-[var(--ok)]" />
                {s}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <span className="label">Improve</span>
            {fb.improvements.map((s) => (
              <div key={s} className="flex gap-1.5 text-2xs leading-4 text-ink-3">
                <ArrowUpRight size={12} className="mt-0.5 shrink-0 text-[var(--warn)]" />
                {s}
              </div>
            ))}
          </div>
          <button className="nodrag flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink" onClick={() => setOpen((v) => !v)}>
            <ChevronDown size={13} className={clsx('transition-transform', open && 'rotate-180')} /> Better sample answer
          </button>
          {open && <p className="inset px-2.5 py-2 text-2xs leading-4 text-ink-2">{fb.sample_answer}</p>}
        </div>
      ) : (
        <EmptyHint>Record an answer to get strengths, improvements and a sample answer</EmptyHint>
      )}
      <GeminiNote note={note} />
      <button className="btn btn-mint nodrag self-start" disabled={busy} onClick={() => runWorkflow({ kind: 'node', id })}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate
      </button>
    </NodeShell>
  )
}
