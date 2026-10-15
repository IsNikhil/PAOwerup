import { FIT_PADDING } from '../lib/view'
import {
  Background,
  useNodesInitialized,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type FinalConnectionState,
  type IsValidConnection,
} from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef } from 'react'
import { SPECS } from '../lib/nodeSpecs'
import { TYPE_HEX, type DataType } from '../lib/types'
import { nodeTypes } from '../nodes'
import { useGraph } from '../store/graph'
import { FlowEdge } from './FlowEdge'
import { sendCursor } from './presence'
import { PresenceCursors } from './PresenceCursors'

const edgeTypes: EdgeTypes = { flow: FlowEdge }

export const MAIN_LANE = ['resume', 'job', 'skills', 'match', 'gap', 'rewrite', 'coach', 'report']

/** On first load, fit the main pipeline horizontally and pin its top just under the top bar. */
function InitialView() {
  const ready = useNodesInitialized()
  const { getViewport, setViewport, getNodesBounds, fitView } = useReactFlow()
  const done = useRef(false)
  useEffect(() => {
    if (!ready || done.current) return
    done.current = true
    fitView({ nodes: MAIN_LANE.map((id) => ({ id })), padding: FIT_PADDING, maxZoom: 0.95 }).then(() => {
      const { x, zoom } = getViewport()
      const bounds = getNodesBounds(MAIN_LANE)
      setViewport({ x, y: 118 - bounds.y * zoom, zoom })
    })
  }, [ready, fitView, getViewport, getNodesBounds, setViewport])
  return null
}

export function Canvas() {
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  const onNodesChange = useGraph((s) => s.onNodesChange)
  const onEdgesChange = useGraph((s) => s.onEdgesChange)
  const onConnect = useGraph((s) => s.onConnect)
  const locked = useGraph((s) => s.locked)
  const minimap = useGraph((s) => s.minimap)
  const reject = useGraph((s) => s.reject)
  const set = useGraph((s) => s.set)
  const { screenToFlowPosition } = useReactFlow()

  const isValidConnection: IsValidConnection = useCallback(
    (c: Connection | Edge) => !!c.sourceHandle && c.sourceHandle === c.targetHandle && c.source !== c.target,
    [],
  )

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (!state.toHandle || state.isValid) return
      const pt = 'changedTouches' in event ? event.changedTouches[0] : event
      const from = state.fromHandle?.id ?? '?'
      const to = state.toHandle.id ?? '?'
      set({ reject: { x: pt.clientX, y: pt.clientY, text: `${from} can't connect to ${to}`, key: Date.now() } })
      setTimeout(() => {
        if (useGraph.getState().reject?.key) set({ reject: null })
      }, 1400)
    },
    [set],
  )

  const openPalette = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault()
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      set({ palette: { x: e.clientX, y: e.clientY, flowX: flow.x, flowY: flow.y } })
    },
    [screenToFlowPosition, set],
  )

  return (
    <div
      className="absolute inset-0"
      onMouseMove={(e) => {
        const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        sendCursor(p.x, p.y)
      }}
      onMouseLeave={() => sendCursor(null, null)}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onConnectEnd={onConnectEnd}
        onPaneContextMenu={openPalette}
        onPaneClick={() => set({ palette: null })}
        minZoom={0.2}
        maxZoom={1.8}
        deleteKeyCode={['Delete', 'Backspace']}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        panOnDrag={!locked}
        zoomOnScroll={!locked}
        elementsSelectable
        selectNodesOnDrag={false}
        connectionRadius={28}
        defaultEdgeOptions={{ type: 'flow' }}
        attributionPosition="bottom-left"
      >
        <InitialView />
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.1} color="var(--grid-dot)" />
        {minimap && (
          <MiniMap
            position="bottom-right"
            style={{ bottom: 44, right: 64, width: 180, height: 120 }}
            nodeColor={(n) => TYPE_HEX[SPECS[(n.data as { kind: keyof typeof SPECS }).kind]?.glow as DataType] ?? '#fff'}
            nodeStrokeWidth={0}
            nodeBorderRadius={6}
            maskColor="rgba(11,11,13,0.7)"
            pannable
            zoomable
          />
        )}
      </ReactFlow>
      <PresenceCursors />

      <AnimatePresence>
        {reject && (
          <motion.div key={reject.key} className="pointer-events-none fixed z-50" style={{ left: reject.x, top: reject.y }} initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span className="absolute h-8 w-8 rounded-full border-2 border-[var(--danger)]" style={{ animation: 'reject-ring 0.6s ease-out forwards' }} />
            <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--danger)] shadow-[0_0_12px_var(--danger)]" />
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
              transition={{ duration: 0.35 }}
              className="absolute left-4 top-3 whitespace-nowrap rounded-full border border-[rgba(248,113,113,0.4)] bg-[#2a1215]/90 px-2.5 py-1 text-2xs font-medium text-[#fecaca]"
            >
              {reject.text}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
