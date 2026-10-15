import type { NodeProps } from '@xyflow/react'
import { Download, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { NodeShell, EmptyHint, GeminiNote } from '../canvas/NodeShell'
import { Row, Select, Skeleton, Switch } from '../components/ui'
import { downloadResumeDocx } from '../lib/exports'
import { runWorkflow } from '../lib/runner'
import type { DocValue } from '../lib/types'
import { useGraph, useNodeResult } from '../store/graph'
import { useBusy, useOutput, useParams } from './hooks'

export function RewriterNode({ id, selected }: NodeProps) {
  const [params, set] = useParams<{ tone: string }>(id)
  const out = useOutput<DocValue>(id)
  const busy = useBusy(id)
  const { note } = useNodeResult(id)
  const toast = useGraph((s) => s.toast)
  const [saving, setSaving] = useState(false)
  const doc = out?.resume?.resume

  async function download() {
    if (!doc) return
    setSaving(true)
    try {
      await downloadResumeDocx(doc)
      toast('Improved resume downloaded', 'ok')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Download failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <NodeShell id={id} kind="rewriter" selected={selected}>
      <Row label="Tone">
        <Select
          value={params.tone ?? 'Professional'}
          onChange={(v) => set('tone', v)}
          options={[
            { value: 'Professional', label: 'Professional' },
            { value: 'Concise', label: 'Concise' },
            { value: 'Bold', label: 'Bold' },
          ]}
        />
      </Row>
      <Switch label="Never invent experience" checked locked />
      {busy ? (
        <div className="inset-deep flex flex-col gap-2 p-3">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-2.5" />
          <Skeleton className="h-2.5 w-5/6" />
          <Skeleton className="h-2.5 w-4/6" />
        </div>
      ) : doc ? (
        <div className="inset-deep nowheel flex max-h-[150px] flex-col gap-1.5 overflow-y-auto p-3">
          <div className="text-sm font-medium text-ink">{doc.name || 'Improved resume'}</div>
          {doc.headline && <div className="text-2xs text-ink-3">{doc.headline}</div>}
          <ul className="mt-1 flex flex-col gap-1">
            {(doc.changes ?? []).slice(0, 4).map((c) => (
              <li key={c} className="flex gap-1.5 text-2xs leading-4 text-ink-3">
                <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[var(--t-doc)]" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyHint>Generates a tailored resume you can download as DOCX</EmptyHint>
      )}
      <GeminiNote note={note} />
      <div className="flex items-center gap-2">
        <button className="btn btn-mint nodrag" disabled={busy} onClick={() => runWorkflow({ kind: 'node', id })}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate
        </button>
        {doc && (
          <button className="btn btn-ghost nodrag h-[26px] px-2.5 text-xs" onClick={download} disabled={saving}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} DOCX
          </button>
        )}
      </div>
    </NodeShell>
  )
}
