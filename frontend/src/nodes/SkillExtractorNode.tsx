import type { NodeProps } from '@xyflow/react'
import { NodeShell, EmptyHint, GeminiNote } from '../canvas/NodeShell'
import { Row, Select, Skeleton } from '../components/ui'
import type { SkillsValue } from '../lib/types'
import { useNodeResult } from '../store/graph'
import { useBusy, useOutput, useParams } from './hooks'
import { SkillChips } from './SkillChips'

export function SkillExtractorNode({ id, selected }: NodeProps) {
  const [params, set] = useParams<{ source: string }>(id)
  const out = useOutput<SkillsValue>(id)
  const busy = useBusy(id)
  const { note } = useNodeResult(id)
  return (
    <NodeShell id={id} kind="skillExtractor" selected={selected}>
      <Row label="Skill source">
        <Select
          value={params.source ?? 'taxonomy'}
          onChange={(v) => set('source', v)}
          options={[
            { value: 'taxonomy', label: 'Built-in taxonomy' },
            { value: 'taxonomy+gemini', label: 'Taxonomy + Gemini' },
          ]}
        />
      </Row>
      {busy ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <div className="flex gap-1.5">{[48, 64, 40, 56].map((w, i) => <Skeleton key={i} width={w} className="h-[22px]" />)}</div>
          <Skeleton className="h-3 w-16" />
          <div className="flex gap-1.5">{[56, 40, 72].map((w, i) => <Skeleton key={i} width={w} className="h-[22px]" />)}</div>
        </div>
      ) : out ? (
        <>
          <Row label="Resume" hint={`${out.resume.length}`}>
            <SkillChips items={out.resume} max={10} />
          </Row>
          <Row label="Job" hint={`${out.job.length}`}>
            <SkillChips items={out.job} max={10} />
          </Row>
        </>
      ) : (
        <EmptyHint>Run to extract skills from both documents</EmptyHint>
      )}
      <GeminiNote note={note} />
    </NodeShell>
  )
}
