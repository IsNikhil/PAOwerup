import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'
import { TYPE_HEX, type DataType } from '../lib/types'
import { useGraph } from '../store/graph'

/** Bezier wire. While the target node runs, a dashed gradient flows along it in the source port's color. */
export const FlowEdge = memo(function FlowEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, target, source, data, selected } = props
  const type = ((data as { dataType?: DataType } | undefined)?.dataType ?? 'resume') as DataType
  const targetStatus = useGraph((s) => s.results[target]?.status)
  const hasData = useGraph((s) => !!s.results[source]?.output)
  const color = TYPE_HEX[type]
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 })
  const active = targetStatus === 'running'
  const gradId = `wire-${id}`

  return (
    <>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
          <stop offset="0%" stopColor={color} stopOpacity={0.9} />
          <stop offset="100%" stopColor={color} stopOpacity={0.35} />
        </linearGradient>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        className="wire-base"
        style={{
          stroke: selected ? 'rgba(232,255,90,0.85)' : hasData && targetStatus === 'done' ? `color-mix(in srgb, ${color} 45%, rgba(255,255,255,0.3))` : 'var(--wire)',
          strokeWidth: 1.5,
          transition: 'stroke 300ms',
        }}
        interactionWidth={18}
      />
      {active && (
        <>
          <path d={path} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={6} style={{ filter: 'blur(4px)' }} />
          <path
            d={path}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="6 10"
            style={{ animation: 'flow-dash 0.7s linear infinite' }}
          />
        </>
      )}
    </>
  )
})
