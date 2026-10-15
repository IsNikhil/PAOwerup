import type { NodeProps } from '@xyflow/react'
import { Fragment } from 'react'
import { NodeShell, EmptyHint } from '../canvas/NodeShell'
import { Row, Select, Skeleton } from '../components/ui'
import type { TranscriptValue } from '../lib/types'
import { useGraph } from '../store/graph'
import { useBusy, useOutput, useParams } from './hooks'

const FILLERS = /^(um+|uh+|er|ah|erm|hmm|basically|actually|literally)$/i

export function TranscriberNode({ id, selected }: NodeProps) {
  const [params, set] = useParams<{ model: string }>(id)
  const out = useOutput<TranscriptValue>(id)
  const busy = useBusy(id)
  const whisper = useGraph((s) => s.health?.whisper)

  return (
    <NodeShell id={id} kind="transcriber" selected={selected}>
      <Row label="Model size" hint={whisper ? `whisper: ${whisper.status}` : undefined}>
        <Select
          value={params.model ?? 'base'}
          onChange={(v) => set('model', v)}
          options={[
            { value: 'tiny', label: 'tiny', hint: '39M · fastest' },
            { value: 'base', label: 'base', hint: '74M · default' },
            { value: 'small', label: 'small', hint: '244M · accurate' },
          ]}
        />
      </Row>
      {busy ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-2.5" />
          <Skeleton className="h-2.5 w-11/12" />
          <Skeleton className="h-2.5 w-4/5" />
          <span className="text-2xs text-ink-4">Transcribing locally with Whisper…</span>
        </div>
      ) : out ? (
        <>
          <div className="inset-deep nowheel max-h-[130px] overflow-y-auto px-3 py-2.5 text-xs leading-[18px] text-ink-2">
            {out.text ? (
              out.text.split(/(\s+)/).map((tok, i) => {
                const bare = tok.replace(/[^a-z]/gi, '')
                return FILLERS.test(bare) ? (
                  <mark key={i} className="rounded bg-[rgba(248,113,113,0.2)] px-0.5 text-[#fecaca]">
                    {tok}
                  </mark>
                ) : (
                  <Fragment key={i}>{tok}</Fragment>
                )
              })
            ) : (
              <span className="text-ink-4">No speech detected.</span>
            )}
          </div>
          <div className="mono flex gap-3 text-2xs text-ink-4">
            <span>{out.words.length} words</span>
            <span>{out.duration.toFixed(1)}s audio</span>
            <span className="ml-auto">{(out.elapsed_ms / 1000).toFixed(1)}s · {out.model}</span>
          </div>
        </>
      ) : (
        <EmptyHint>Transcript with word timestamps appears after recording</EmptyHint>
      )}
    </NodeShell>
  )
}
