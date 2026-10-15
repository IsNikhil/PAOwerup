import type { NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import { NodeShell, EmptyHint } from '../canvas/NodeShell'
import { Row, Select, Skeleton, Slider, Stepper, Tip } from '../components/ui'
import type { ScoreValue } from '../lib/types'
import { useGraph } from '../store/graph'
import { useBusy, useOutput, useParams } from './hooks'

function Bar({ label, value, weight }: { label: string; value: number; weight: number }) {
  return (
    <div className="flex items-center gap-2 text-2xs">
      <span className="w-[74px] shrink-0 text-ink-4">{label}</span>
      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div className="h-full rounded-full bg-[var(--t-score)]" initial={{ width: 0 }} animate={{ width: `${value * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <span className="mono w-9 text-right text-ink-3">{Math.round(value * 100)}</span>
      <span className="mono w-7 text-right text-ink-5">×{weight}</span>
    </div>
  )
}

export function MatchEngineNode({ id, selected }: NodeProps) {
  const [params, set] = useParams<{ model: string; threshold: number; topK: number }>(id)
  const out = useOutput<ScoreValue>(id)
  const busy = useBusy(id)
  const use = useGraph((s) => s.health?.use)
  const tf = useGraph((s) => s.health?.tensorflow_version)
  const ready = use?.status === 'ready'
  const m = out?.match

  return (
    <NodeShell id={id} kind="matchEngine" selected={selected}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={params.model ?? 'use-v4'}
            onChange={(v) => set('model', v)}
            options={[
              { value: 'use-v4', label: 'USE v4', hint: 'DAN · fast' },
              { value: 'use-large-v5', label: 'USE Large v5', hint: 'transformer' },
            ]}
          />
        </div>
        <Tip label={use ? `${use.status}: ${use.detail}${tf ? ` · TF ${tf}` : ''}` : 'Checking backend…'}>
          <div className="inset flex h-8 items-center gap-1.5 px-2.5">
            <span className="mono text-2xs font-semibold text-[#FDBA74]">TF</span>
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{
                background: ready ? 'var(--ok)' : use?.status === 'error' ? 'var(--danger)' : 'var(--warn)',
                boxShadow: ready ? '0 0 8px var(--ok)' : undefined,
                animation: !ready && use?.status !== 'error' ? 'pulse-dot 1.2s infinite' : undefined,
              }}
            />
          </div>
        </Tip>
      </div>
      <Row label="Skill match threshold" hint={(params.threshold ?? 0.5).toFixed(2)}>
        <Slider value={params.threshold ?? 0.5} onChange={(v) => set('threshold', Math.round(v * 100) / 100)} min={0.3} max={0.8} step={0.01} />
      </Row>
      <Row label="Top-k evidence">
        <Stepper value={params.topK ?? 3} onChange={(v) => set('topK', v)} min={1} max={6} />
      </Row>
      {busy ? (
        <div className="inset-deep flex flex-col gap-2 p-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-2" />
          <Skeleton className="h-2" />
          <Skeleton className="h-2" />
        </div>
      ) : m ? (
        <div className="inset-deep flex flex-col gap-2 p-3">
          <div className="flex items-baseline gap-2">
            <span className="mono text-2xl font-medium tracking-tight text-ink">{m.score.toFixed(1)}</span>
            <span className="text-xs text-ink-3">{m.verdict}</span>
            <span className="mono ml-auto text-2xs text-ink-5">{Math.round(m.elapsed_ms)}ms</span>
          </div>
          <Bar label="Skill coverage" value={m.breakdown.skill_coverage} weight={m.weights.skill_coverage} />
          <Bar label="Sentences" value={m.breakdown.sentence_similarity} weight={m.weights.sentence_similarity} />
          <Bar label="Document" value={m.breakdown.document_similarity} weight={m.weights.document_similarity} />
        </div>
      ) : (
        <EmptyHint>Run to embed both documents with USE and score the match</EmptyHint>
      )}
    </NodeShell>
  )
}
