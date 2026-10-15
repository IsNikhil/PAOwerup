import type { NodeProps } from '@xyflow/react'
import { Link2 } from 'lucide-react'
import { NodeShell } from '../canvas/NodeShell'
import { Row } from '../components/ui'
import { useParams } from './hooks'

export function JobNode({ id, selected }: NodeProps) {
  const [params, set] = useParams<{ text: string; title: string }>(id)
  const words = params.text ? params.text.split(/\s+/).filter(Boolean).length : 0
  return (
    <NodeShell id={id} kind="job" selected={selected}>
      <Row label="Job title">
        <input className="field nodrag h-8 py-0" placeholder="e.g. Data Analyst @ Acme" value={params.title ?? ''} onChange={(e) => set('title', e.target.value)} />
      </Row>
      <Row label="Description" hint={words ? `${words} words` : undefined}>
        <textarea
          className="field nodrag nowheel h-36 resize-none"
          placeholder="Paste the job description…"
          value={params.text ?? ''}
          onChange={(e) => set('text', e.target.value)}
        />
      </Row>
      <div className="flex items-center gap-1.5 text-2xs text-ink-4">
        <Link2 size={12} />
        Paste URL text: copy the posting from the job site and paste it here.
      </div>
    </NodeShell>
  )
}
