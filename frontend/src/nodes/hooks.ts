import { useCallback } from 'react'
import type { WireValue } from '../lib/types'
import { useGraph, useNodeResult } from '../store/graph'

export function useParams<T extends Record<string, unknown>>(id: string): [T, (key: keyof T & string, value: unknown) => void] {
  const params = useGraph((s) => s.nodes.find((n) => n.id === id)?.data.params) as T
  const setParam = useGraph((s) => s.setParam)
  const set = useCallback((key: keyof T & string, value: unknown) => setParam(id, key, value), [id, setParam])
  return [params ?? ({} as T), set]
}

export function useOutput<T extends WireValue>(id: string): T | undefined {
  return useNodeResult(id).output as T | undefined
}

export function useBusy(id: string) {
  const s = useNodeResult(id).status
  return s === 'running' || s === 'queued'
}

export const fmtPct = (v: number) => `${Math.round(v * 100)}%`
