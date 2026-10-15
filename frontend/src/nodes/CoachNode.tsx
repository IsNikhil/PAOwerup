import type { NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import { Loader2, Sparkles } from 'lucide-react'
import { NodeShell, EmptyHint, GeminiNote } from '../canvas/NodeShell'
import { Skeleton } from '../components/ui'
import { runWorkflow } from '../lib/runner'
import type { DocValue } from '../lib/types'
import { useNodeResult } from '../store/graph'
import { useBusy, useOutput } from './hooks'

export function CoachNode({ id, selected }: NodeProps) {
  const out = useOutput<DocValue>(id)
  const busy = useBusy(id)
  const { note } = useNodeResult(id)
  const coach = out?.coach
  return (
    <NodeShell id={id} kind="coach" selected={selected}>
      {busy ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : coach ? (
        <div className="nowheel flex max-h-[260px] flex-col gap-1.5 overflow-y-auto pr-0.5">
          <p className="text-xs leading-[18px] text-ink-2">{coach.headline}</p>
          {coach.steps.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="inset flex gap-2.5 px-2.5 py-2">
              <span className="mono mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-white/[0.07] text-[10px] text-ink-3">{i + 1}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-ink">{s.title}</span>
                  {s.timeframe && <span className="ml-auto shrink-0 text-[10px] text-ink-4">{s.timeframe}</span>}
                </div>
                <p className="mt-0.5 text-2xs leading-4 text-ink-3">{s.detail}</p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyHint>3–5 personalized next steps based on your score and gaps</EmptyHint>
      )}
      <GeminiNote note={note} />
      <button className="btn btn-mint nodrag self-start" disabled={busy} onClick={() => runWorkflow({ kind: 'node', id })}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate
      </button>
    </NodeShell>
  )
}
