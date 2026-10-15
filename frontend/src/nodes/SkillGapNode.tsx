import type { NodeProps } from '@xyflow/react'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import { NodeShell, EmptyHint } from '../canvas/NodeShell'
import { Row, Skeleton } from '../components/ui'
import type { SkillsValue } from '../lib/types'
import { useBusy, useOutput } from './hooks'
import { SkillChips } from './SkillChips'

const IMPORTANCE = {
  high: 'text-[#fca5a5] bg-[#F87171]/12',
  medium: 'text-[#fcd34d] bg-[#FBBF24]/10',
  low: 'text-ink-4 bg-white/5',
}

export function SkillGapNode({ id, selected }: NodeProps) {
  const out = useOutput<SkillsValue>(id)
  const busy = useBusy(id)
  const missing = out?.missing ?? []
  return (
    <NodeShell id={id} kind="skillGap" selected={selected}>
      {busy ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[22px] w-3/4" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : out ? (
        <>
          <Row label="Matched" hint={`${out.matched?.length ?? 0}`}>
            {out.matched?.length ? (
              <SkillChips items={out.matched.map((m) => ({ name: m.name }))} tone="ok" max={12} />
            ) : (
              <span className="text-xs text-ink-4">No job skills found in the resume yet.</span>
            )}
          </Row>
          <Row label="Missing" hint={`${missing.length}`}>
            {missing.length ? (
              <div className="nowheel flex max-h-[210px] flex-col gap-1.5 overflow-y-auto pr-1">
                {missing.slice(0, 8).map((m, i) => (
                  <motion.div
                    key={m.name}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="inset px-2.5 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="chip chip-miss h-5">{m.name}</span>
                      <span className={clsx('rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wide', IMPORTANCE[m.importance_label])}>{m.importance_label}</span>
                      <span className="mono ml-auto text-[10px] text-ink-5">sim {m.similarity.toFixed(2)}</span>
                    </div>
                    <p className="mt-1.5 text-2xs leading-4 text-ink-3">{m.hint}</p>
                  </motion.div>
                ))}
                {missing.length > 8 && <span className="text-2xs text-ink-4">+{missing.length - 8} lower-priority gaps</span>}
              </div>
            ) : (
              <span className="text-xs text-[#86efac]">No gaps — you cover every skill we detected.</span>
            )}
          </Row>
        </>
      ) : (
        <EmptyHint>Matched and missing skills appear here after a run</EmptyHint>
      )}
    </NodeShell>
  )
}
