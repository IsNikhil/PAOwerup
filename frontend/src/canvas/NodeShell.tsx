import { Handle, Position, useNodeConnections } from '@xyflow/react'
import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, Loader2, MoreHorizontal, Play, Trash2, Copy } from 'lucide-react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'
import { SPECS, type NodeKind, type PortSpec } from '../lib/nodeSpecs'
import { runWorkflow } from '../lib/runner'
import { TYPE_COLOR, TYPE_HEX, type NodeStatus } from '../lib/types'
import { useGraph, useNodeResult } from '../store/graph'

const ENGINE_STYLE: Record<string, string> = {
  TF: 'text-[#FDBA74] border-[#FB923C]/30 bg-[#FB923C]/10',
  Gemini: 'text-[#C4B5FD] border-[#A78BFA]/30 bg-[#A78BFA]/10',
  Whisper: 'text-[#A5F3FC] border-[#22D3EE]/25 bg-[#22D3EE]/10',
  Python: 'text-ink-3 border-line bg-white/[0.04]',
}

const STATUS_LABEL: Record<NodeStatus, string> = {
  idle: '',
  queued: 'queued',
  running: 'running',
  done: 'done',
  error: 'error',
  skipped: 'waiting',
}

function StatusDot({ status, color }: { status: NodeStatus; color: string }) {
  const base = 'inline-block h-[7px] w-[7px] shrink-0 rounded-full'
  if (status === 'running') return <span className={base} style={{ background: color, boxShadow: `0 0 10px ${color}`, animation: 'pulse-dot 1s infinite' }} />
  if (status === 'queued') return <span className={clsx(base, 'bg-ink-4')} style={{ animation: 'pulse-dot 1.4s infinite' }} />
  if (status === 'error') return <span className={base} style={{ background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)' }} />
  if (status === 'skipped') return <span className={clsx(base, 'border border-ink-4')} />
  return <span className={clsx(base, 'bg-white')} style={status === 'done' ? { boxShadow: '0 0 8px rgba(255,255,255,0.6)' } : undefined} />
}

function PortRow({ input, output, nodeId, errorPorts }: { input?: PortSpec; output?: PortSpec; nodeId: string; errorPorts: Set<string> }) {
  return (
    <div className="relative flex h-[26px] items-center justify-between px-3.5 text-xs">
      {input ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id={input.type}
            className={clsx(errorPorts.has(`in:${input.type}`) && 'is-error')}
            style={{ ['--port' as string]: TYPE_COLOR[input.type] }}
            isConnectableStart={false}
          />
          <span className="flex items-center gap-1.5 text-ink-3">
            {input.label}
            {input.optional && <span className="text-2xs text-ink-5">opt</span>}
          </span>
        </>
      ) : (
        <span />
      )}
      {output ? (
        <>
          <span className="flex items-center gap-1.5 text-ink-3">{output.label}</span>
          <Handle
            type="source"
            position={Position.Right}
            id={output.type}
            className={clsx(errorPorts.has(`out:${output.type}`) && 'is-error')}
            style={{ ['--port' as string]: TYPE_COLOR[output.type] }}
            data-node={nodeId}
          />
        </>
      ) : null}
    </div>
  )
}

export function NodeShell({
  id,
  kind,
  selected,
  children,
  footer,
  hero,
  width,
}: {
  id: string
  kind: NodeKind
  selected?: boolean
  children: ReactNode
  footer?: ReactNode
  hero?: boolean
  width?: number
}) {
  const spec = SPECS[kind]
  const result = useNodeResult(id)
  const reduce = useReducedMotion()
  const connections = useNodeConnections({ id, handleType: 'target' })
  const status = result.status
  const glowColor = TYPE_HEX[spec.glow]

  const rows = Math.max(spec.inputs.length, spec.outputs.length)
  const errorPorts = new Set<string>()
  if (status === 'error') {
    const connected = new Set(connections.map((c) => c.targetHandle))
    const missing = spec.inputs.filter((p) => !p.optional && !connected.has(p.type))
    if (missing.length) missing.forEach((p) => errorPorts.add(`in:${p.type}`))
    else spec.outputs.forEach((p) => errorPorts.add(`out:${p.type}`))
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.96, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
      style={{ width: width ?? spec.width }}
    >
      {/* ambient glow behind the card */}
      {(hero || status === 'running') && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {hero ? (
            <>
              <div className="absolute -right-16 -top-14 h-64 w-64 rounded-full opacity-60 blur-[70px]" style={{ background: 'radial-gradient(circle, #60A5FA 0%, transparent 70%)', animation: 'aurora-drift 9s ease-in-out infinite' }} />
              <div className="absolute -left-10 top-24 h-56 w-56 rounded-full opacity-40 blur-[70px]" style={{ background: 'radial-gradient(circle, #F472B6 0%, transparent 70%)', animation: 'aurora-drift 12s ease-in-out infinite reverse' }} />
              <div className="absolute -bottom-10 right-10 h-48 w-48 rounded-full opacity-35 blur-[70px]" style={{ background: 'radial-gradient(circle, #A78BFA 0%, transparent 70%)', animation: 'aurora-drift 14s ease-in-out infinite' }} />
            </>
          ) : (
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-70 blur-[56px]" style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`, animation: 'aurora-drift 4s ease-in-out infinite' }} />
          )}
        </div>
      )}

      {/* title row, outside the card */}
      <div className="flex h-7 items-center gap-2 px-1.5 pb-1.5">
        <StatusDot status={status} color={glowColor} />
        <span className="min-w-0 truncate text-[13px] font-medium tracking-[-0.01em] text-ink">{spec.title}</span>
        {spec.engine && <span className={clsx('rounded-md border px-1.5 py-px text-[10px] font-semibold tracking-wide', ENGINE_STYLE[spec.engine])}>{spec.engine}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          {status === 'running' && <Loader2 size={12} className="animate-spin text-ink-3" />}
          {STATUS_LABEL[status] && status !== 'running' && (
            <span className={clsx('mono text-2xs', status === 'error' ? 'text-[var(--danger)]' : 'text-ink-4')}>
              {STATUS_LABEL[status]}
              {status === 'done' && result.ms !== undefined ? ` · ${result.ms < 1000 ? `${Math.round(result.ms)}ms` : `${(result.ms / 1000).toFixed(1)}s`}` : ''}
            </span>
          )}
          <NodeMenu id={id} />
        </span>
      </div>

      <div className={clsx('node-card', selected && 'is-selected', status === 'error' && 'is-error')}>
        {rows > 0 && (
          <div className="border-b border-[var(--line-soft)] py-1.5">
            {Array.from({ length: rows }).map((_, i) => (
              <PortRow key={i} input={spec.inputs[i]} output={spec.outputs[i]} nodeId={id} errorPorts={errorPorts} />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-3 p-3.5">
          {children}
          {status === 'error' && result.error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 rounded-[10px] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] px-2.5 py-2 text-xs text-[#fecaca]">
              <AlertCircle size={13} className="mt-px shrink-0 text-[var(--danger)]" />
              <span className="break-words">{result.error}</span>
            </motion.div>
          )}
        </div>
        {footer}
      </div>
    </motion.div>
  )
}

function NodeMenu({ id }: { id: string }) {
  const removeNode = useGraph((s) => s.removeNode)
  const addNode = useGraph((s) => s.addNode)
  const node = useGraph((s) => s.nodes.find((n) => n.id === id))
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button className="nodrag grid h-5 w-5 place-items-center rounded-md text-ink-4 opacity-0 transition hover:bg-white/10 hover:text-ink group-hover:opacity-100 data-[state=open]:opacity-100" aria-label="Node menu">
          <MoreHorizontal size={14} />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" align="end" sideOffset={6}>
          <Menu.Item className="menu-item" onSelect={() => runWorkflow({ kind: 'node', id })}>
            <Play size={13} /> Run this node
          </Menu.Item>
          <Menu.Item className="menu-item" onSelect={() => runWorkflow({ kind: 'from', id })}>
            <Play size={13} /> Run from here
          </Menu.Item>
          <Menu.Item className="menu-item" onSelect={() => node && addNode(node.data.kind, { x: node.position.x + 40, y: node.position.y + 40 })}>
            <Copy size={13} /> Duplicate
          </Menu.Item>
          <div className="menu-sep" />
          <Menu.Item className="menu-item text-[#fca5a5]" onSelect={() => removeNode(id)}>
            <Trash2 size={13} /> Delete <span className="kbd">⌫</span>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function EmptyHint({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-dashed border-white/10 px-3 py-2.5 text-xs text-ink-4">
      {icon}
      <span>{children}</span>
    </div>
  )
}

export function GeminiNote({ note }: { note?: string }) {
  if (!note) return null
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-[#A78BFA]/20 bg-[#A78BFA]/[0.07] px-2.5 py-1.5 text-2xs text-[#ddd6fe]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#A78BFA]" />
      <span className="truncate" title={note}>{note.includes('not connected') ? 'Connect Gemini — showing template output' : note}</span>
    </div>
  )
}
