import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { SPECS, type NodeKind } from '../lib/nodeSpecs'
import { SAMPLES } from '../lib/samples'
import type { DataType, Health, NodeResult, NodeStatus, WireValue } from '../lib/types'
import { defaultWorkflow, makeEdge, makeNode, type FlowNode } from '../lib/workflow'

export interface RunRecord {
  id: string
  at: number
  name: string
  ms: number
  nodes: number
  score?: number
  verdict?: string
  ok: boolean
  saved?: boolean
}

export interface Toast {
  id: number
  text: string
  tone?: 'ok' | 'error' | 'info'
}

interface GraphState {
  nodes: FlowNode[]
  edges: Edge[]
  results: Record<string, NodeResult>
  workflowName: string
  sampleIndex: number
  prompt: string
  notes: string
  userName: string
  theme: 'midnight' | 'graphite'
  minimap: boolean
  locked: boolean
  isPublic: boolean
  running: boolean
  runStartedAt: number | null
  lastRun: { ms: number; nodes: number } | null
  history: RunRecord[]
  health: Health | null
  toasts: Toast[]
  palette: { x: number; y: number; flowX: number; flowY: number } | null
  reject: { x: number; y: number; text: string; key: number } | null

  onNodesChange: (changes: NodeChange<FlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (c: Connection) => void
  setParam: (id: string, key: string, value: unknown) => void
  setResult: (id: string, patch: Partial<NodeResult>) => void
  setStatus: (ids: string[], status: NodeStatus) => void
  addNode: (kind: NodeKind, pos: { x: number; y: number }) => void
  removeNode: (id: string) => void
  loadSample: (index: number) => void
  newBlank: () => void
  clearResults: () => void
  set: (patch: Partial<GraphState>) => void
  toast: (text: string, tone?: Toast['tone']) => void
}

let toastId = 0

function initial() {
  const sample = SAMPLES[0]
  const { nodes, edges } = defaultWorkflow(sample)
  return { nodes, edges, workflowName: sample.name, sampleIndex: 0 }
}

export const useGraph = create<GraphState>()(
  persist(
    (set, get) => ({
      ...initial(),
      results: {},
      prompt: '',
      notes: '',
      userName: '',
      theme: 'midnight',
      minimap: false,
      locked: false,
      isPublic: false,
      running: false,
      runStartedAt: null,
      lastRun: null,
      history: [],
      health: null,
      toasts: [],
      palette: null,
      reject: null,

      onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
      onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
      onConnect: (c) => {
        if (!c.sourceHandle || c.sourceHandle !== c.targetHandle) return
        const target = get().nodes.find((n) => n.id === c.target)
        const port = target && SPECS[target.data.kind].inputs.find((p) => p.type === c.targetHandle)
        let edges = get().edges
        // single-input ports replace their existing wire
        if (port && !port.multi) {
          edges = edges.filter((e) => !(e.target === c.target && e.targetHandle === c.targetHandle))
        }
        const edge = makeEdge(c.source, c.target, c.sourceHandle as DataType)
        set({ edges: addEdge(edge, edges) })
      },
      setParam: (id, key, value) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } } : n,
          ),
        }),
      setResult: (id, patch) =>
        set((s) => ({ results: { ...s.results, [id]: { ...(s.results[id] ?? { status: 'idle' }), ...patch, updatedAt: Date.now() } } })),
      setStatus: (ids, status) =>
        set((s) => {
          const results = { ...s.results }
          for (const id of ids) results[id] = { ...results[id], status, error: status === 'error' ? results[id]?.error : undefined }
          return { results }
        }),
      addNode: (kind, pos) => {
        const node = makeNode(kind, pos)
        set({ nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), { ...node, selected: true }], palette: null })
      },
      removeNode: (id) =>
        set({
          nodes: get().nodes.filter((n) => n.id !== id),
          edges: get().edges.filter((e) => e.source !== id && e.target !== id),
        }),
      loadSample: (index) => {
        const i = ((index % SAMPLES.length) + SAMPLES.length) % SAMPLES.length
        const sample = SAMPLES[i]
        const { nodes, edges } = defaultWorkflow(sample)
        set({ nodes, edges, results: {}, workflowName: sample.name, sampleIndex: i, lastRun: null })
      },
      newBlank: () => {
        const { nodes, edges } = defaultWorkflow()
        set({ nodes, edges, results: {}, workflowName: 'Untitled career workflow', lastRun: null })
      },
      clearResults: () => set({ results: {}, lastRun: null }),
      set: (patch) => set(patch),
      toast: (text, tone = 'info') => {
        const id = ++toastId
        set({ toasts: [...get().toasts, { id, text, tone }] })
        setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3200)
      },
    }),
    {
      name: 'paowerup-workflow-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        nodes: s.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: s.edges,
        // never persist transient run states
        results: Object.fromEntries(
          Object.entries(s.results).map(([k, r]) => [
            k,
            r.status === 'running' || r.status === 'queued' ? { ...r, status: 'idle' as const } : r,
          ]),
        ),
        workflowName: s.workflowName,
        sampleIndex: s.sampleIndex,
        prompt: s.prompt,
        notes: s.notes,
        userName: s.userName,
        theme: s.theme,
        minimap: s.minimap,
        isPublic: s.isPublic,
        lastRun: s.lastRun,
        history: s.history.slice(0, 30),
      }),
    },
  ),
)

/** Values arriving at each input port of a node, grouped by data type. */
export function collectInputs(id: string, state = useGraph.getState()): Partial<Record<DataType, WireValue[]>> {
  const out: Partial<Record<DataType, WireValue[]>> = {}
  for (const e of state.edges) {
    if (e.target !== id) continue
    const value = state.results[e.source]?.output
    if (!value) continue
    const type = e.targetHandle as DataType
    ;(out[type] ??= []).push(value)
  }
  return out
}

export function useNodeResult(id: string): NodeResult {
  return useGraph((s) => s.results[id]) ?? IDLE
}
const IDLE: NodeResult = { status: 'idle' }
