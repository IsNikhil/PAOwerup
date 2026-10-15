import type { Edge, Node } from '@xyflow/react'
import { SPECS, type NodeKind } from './nodeSpecs'
import type { SamplePair } from './samples'
import type { DataType } from './types'

export interface NodeData extends Record<string, unknown> {
  kind: NodeKind
  params: Record<string, unknown>
}
export type FlowNode = Node<NodeData>

export function makeNode(kind: NodeKind, position: { x: number; y: number }, id?: string, params?: Record<string, unknown>): FlowNode {
  return {
    id: id ?? `${kind}-${Math.random().toString(36).slice(2, 7)}`,
    type: kind,
    position,
    data: { kind, params: { ...SPECS[kind].defaults, ...params } },
  }
}

export function makeEdge(source: string, target: string, type: DataType): Edge {
  return {
    id: `e-${source}-${target}-${type}`,
    source,
    target,
    sourceHandle: type,
    targetHandle: type,
    type: 'flow',
    data: { dataType: type },
  }
}

const COL = [0, 380, 760, 1140, 1520]

export function defaultWorkflow(sample?: SamplePair): { nodes: FlowNode[]; edges: Edge[] } {
  const nodes: FlowNode[] = [
    makeNode('resume', { x: COL[0], y: 0 }, 'resume', sample ? { ...sample.resume } : {}),
    makeNode('job', { x: COL[0], y: 330 }, 'job', sample ? { ...sample.job } : {}),
    makeNode('skillExtractor', { x: COL[1], y: 150 }, 'skills'),
    makeNode('matchEngine', { x: COL[2], y: -40 }, 'match'),
    makeNode('skillGap', { x: COL[2], y: 400 }, 'gap'),
    makeNode('rewriter', { x: COL[3], y: -40 }, 'rewrite'),
    makeNode('coach', { x: COL[3], y: 400 }, 'coach'),
    makeNode('recorder', { x: COL[0], y: 920 }, 'recorder'),
    makeNode('transcriber', { x: COL[1], y: 940 }, 'transcriber'),
    makeNode('speechMetrics', { x: COL[2], y: 920 }, 'metrics'),
    makeNode('feedback', { x: COL[3], y: 920 }, 'feedback'),
    makeNode('report', { x: COL[4], y: -40 }, 'report'),
  ]
  const edges: Edge[] = [
    makeEdge('resume', 'skills', 'resume'),
    makeEdge('job', 'skills', 'job'),
    makeEdge('resume', 'match', 'resume'),
    makeEdge('job', 'match', 'job'),
    makeEdge('skills', 'match', 'skills'),
    makeEdge('match', 'gap', 'score'),
    makeEdge('skills', 'gap', 'skills'),
    makeEdge('resume', 'rewrite', 'resume'),
    makeEdge('job', 'rewrite', 'job'),
    makeEdge('gap', 'rewrite', 'skills'),
    makeEdge('match', 'coach', 'score'),
    makeEdge('gap', 'coach', 'skills'),
    makeEdge('match', 'report', 'score'),
    makeEdge('gap', 'report', 'skills'),
    makeEdge('rewrite', 'report', 'doc'),
    makeEdge('coach', 'report', 'doc'),
    makeEdge('recorder', 'transcriber', 'audio'),
    makeEdge('transcriber', 'metrics', 'transcript'),
    makeEdge('transcriber', 'feedback', 'transcript'),
    makeEdge('metrics', 'feedback', 'score'),
    makeEdge('job', 'feedback', 'job'),
    makeEdge('feedback', 'report', 'doc'),
  ]
  return { nodes, edges }
}
