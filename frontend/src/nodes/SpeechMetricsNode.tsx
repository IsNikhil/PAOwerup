import type { NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import { NodeShell, EmptyHint } from '../canvas/NodeShell'
import { Skeleton } from '../components/ui'
import type { ScoreValue } from '../lib/types'
import { useBusy, useOutput } from './hooks'

export function Sparkline({ values, color = 'var(--t-score)', height = 34 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return <div style={{ height }} className="grid place-items-center text-2xs text-ink-5">not enough data</div>
  const w = 240
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 3 - (v / max) * (height - 6)])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#60A5FA" stopOpacity="0.3" />
          <stop offset="1" stopColor="#60A5FA" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${height} L0,${height} Z`} fill="url(#spark-fill)" />
      <motion.path d={d} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
    </svg>
  )
}

function Tile({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const color = tone === 'ok' ? 'text-[#86efac]' : tone === 'warn' ? 'text-[#fcd34d]' : tone === 'bad' ? 'text-[#fca5a5]' : 'text-ink-4'
  return (
    <div className="inset flex flex-col gap-0.5 px-2.5 py-2">
      <span className="label">{label}</span>
      <span className="mono text-lg leading-6 text-ink">
        {value}
        {unit && <span className="ml-0.5 text-2xs text-ink-4">{unit}</span>}
      </span>
      {sub && <span className={`text-[10.5px] ${color}`}>{sub}</span>}
    </div>
  )
}

export function SpeechMetricsNode({ id, selected }: NodeProps) {
  const out = useOutput<ScoreValue>(id)
  const busy = useBusy(id)
  const m = out?.speech
  return (
    <NodeShell id={id} kind="speechMetrics" selected={selected}>
      {busy ? (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[62px]" />
          ))}
        </div>
      ) : m ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Pace" value={m.wpm.toFixed(0)} unit="wpm" sub={m.pace_label} tone={m.pace_label === 'Good pace' ? 'ok' : 'warn'} />
            <Tile label="Fillers" value={String(m.filler_total)} sub={`${(m.filler_rate * 100).toFixed(1)}% of words`} tone={m.filler_rate < 0.03 ? 'ok' : m.filler_rate < 0.07 ? 'warn' : 'bad'} />
            <Tile label="Longest pause" value={m.longest_pause.toFixed(1)} unit="s" sub={`${m.pause_count} pauses`} tone={m.longest_pause < 2 ? 'ok' : 'warn'} />
            <Tile label="Clarity" value={m.clarity.toFixed(0)} unit="/100" sub={m.clarity >= 75 ? 'Clear' : m.clarity >= 55 ? 'Okay' : 'Needs work'} tone={m.clarity >= 75 ? 'ok' : m.clarity >= 55 ? 'warn' : 'bad'} />
          </div>
          {m.fillers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {m.fillers.map((f) => (
                <span key={f.word} className="chip chip-miss h-5 text-2xs">
                  {f.word} <span className="mono text-[10px] opacity-70">×{f.count}</span>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <span className="label">Words per minute over time</span>
            <Sparkline values={m.wpm_series} />
          </div>
        </>
      ) : (
        <EmptyHint>WPM, filler words, pauses and clarity</EmptyHint>
      )}
    </NodeShell>
  )
}
