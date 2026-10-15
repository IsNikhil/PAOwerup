import { FIT } from '../lib/view'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { useReactFlow } from '@xyflow/react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eraser,
  FilePlus2,
  Globe,
  Loader2,
  Menu as MenuIcon,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { usePresence } from '../canvas/presence'
import { runWorkflow } from '../lib/runner'
import { SAMPLES } from '../lib/samples'
import { useGraph } from '../store/graph'
import { Tip } from './ui'

export function TopBar({ onHelp, onSettings }: { onHelp: () => void; onSettings: () => void }) {
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-4 px-4 pt-3.5">
        <LeftCluster onHelp={onHelp} />
        <DocTab />
        <RightCluster onSettings={onSettings} />
      </div>
      <PresenceStack />
    </>
  )
}

function LeftCluster({ onHelp }: { onHelp: () => void }) {
  const st = useGraph.getState() // actions only; read fresh state inside handlers
  const { getNodes, fitView } = useReactFlow()
  const selected = () => getNodes().filter((n) => n.selected)
  return (
    <div className="pointer-events-auto flex items-center gap-2.5">
      <div className="glass grid h-10 w-10 place-items-center rounded-[12px]">
        <img src="/logo.svg" alt="PAOwerUp" className="h-[26px] w-[26px]" />
      </div>
      <div className="glass flex h-10 items-center gap-0.5 rounded-full p-1">
        <button className="h-8 rounded-full bg-white/[0.09] px-3.5 text-[12.5px] font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">Workflow</button>
        <Menu.Root>
          <Menu.Trigger asChild>
            <button className="h-8 rounded-full px-3.5 text-[12.5px] font-medium text-ink-3 transition hover:text-ink data-[state=open]:text-ink">Edit</button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content className="menu w-56" sideOffset={8} align="start">
              <Menu.Item className="menu-item" onSelect={() => st.set({ palette: { x: innerWidth / 2 - 140, y: innerHeight / 2 - 160, flowX: 0, flowY: 0 } })}>
                <Plus size={13} /> Add node <span className="kbd">Space</span>
              </Menu.Item>
              <Menu.Item
                className="menu-item"
                disabled={!selected().length}
                onSelect={() => selected().forEach((n) => st.addNode(useGraph.getState().nodes.find((x) => x.id === n.id)!.data.kind, { x: n.position.x + 40, y: n.position.y + 40 }))}
              >
                <Copy size={13} /> Duplicate selected
              </Menu.Item>
              <Menu.Item className="menu-item" disabled={!selected().length} onSelect={() => selected().forEach((n) => st.removeNode(n.id))}>
                <Trash2 size={13} /> Delete selected <span className="kbd">⌫</span>
              </Menu.Item>
              <div className="menu-sep" />
              <Menu.Item className="menu-item" onSelect={() => st.clearResults()}>
                <Eraser size={13} /> Clear results
              </Menu.Item>
              <Menu.Item
                className="menu-item"
                onSelect={() => {
                  st.loadSample(useGraph.getState().sampleIndex)
                  setTimeout(() => fitView(FIT), 50)
                }}
              >
                <RotateCcw size={13} /> Reset workflow
              </Menu.Item>
              <Menu.Item className="menu-item" onSelect={() => st.newBlank()}>
                <FilePlus2 size={13} /> New blank workflow
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
        <button onClick={onHelp} className="h-8 rounded-full px-3.5 text-[12.5px] font-medium text-ink-3 transition hover:text-ink">
          Help
        </button>
      </div>
    </div>
  )
}

function DocTab() {
  const name = useGraph((s) => s.workflowName)
  const sampleIndex = useGraph((s) => s.sampleIndex)
  const loadSample = useGraph((s) => s.loadSample)
  const newBlank = useGraph((s) => s.newBlank)
  const set = useGraph((s) => s.set)
  const { fitView } = useReactFlow()
  const [editing, setEditing] = useState(false)

  const go = (d: number) => {
    loadSample(sampleIndex + d)
    setTimeout(() => fitView({ ...FIT, nodes: [{ id: 'resume' }, { id: 'report' }, { id: 'job' }, { id: 'match' }], maxZoom: 0.95 }), 60)
  }

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1">
      <div className="glass flex h-10 items-center gap-1 rounded-full px-1.5">
        <Tip label="Previous sample" side="bottom">
          <button className="icon-btn h-7 w-7 rounded-full" onClick={() => go(-1)} aria-label="Previous workflow">
            <ChevronLeft size={15} />
          </button>
        </Tip>
        <div className="flex h-7 max-w-[340px] items-center gap-2 rounded-full bg-white/[0.06] pl-3 pr-1.5">
          {editing ? (
            <input
              autoFocus
              defaultValue={name}
              className="w-60 bg-transparent text-[12.5px] font-medium text-ink outline-none"
              onBlur={(e) => {
                set({ workflowName: e.target.value.trim() || name })
                setEditing(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <span className="truncate text-[12.5px] font-medium text-ink" onDoubleClick={() => setEditing(true)} title="Double-click to rename">
              {name}
            </span>
          )}
          <Tip label="Close workflow (new blank)" side="bottom">
            <button className="grid h-5 w-5 place-items-center rounded-full text-ink-4 transition hover:bg-white/10 hover:text-ink" onClick={newBlank} aria-label="Close workflow">
              <X size={12} />
            </button>
          </Tip>
        </div>
        <Tip label="Next sample" side="bottom">
          <button className="icon-btn h-7 w-7 rounded-full" onClick={() => go(1)} aria-label="Next workflow">
            <ChevronRight size={15} />
          </button>
        </Tip>
      </div>
      <span className="mono text-2xs tracking-wide text-ink-4">career workflow v1 · {sampleIndex + 1}/{SAMPLES.length}</span>
    </div>
  )
}

function RightCluster({ onSettings }: { onSettings: () => void }) {
  const running = useGraph((s) => s.running)
  const history = useGraph((s) => s.history)
  const isPublic = useGraph((s) => s.isPublic)
  const clearResults = useGraph((s) => s.clearResults)
  const set = useGraph((s) => s.set)
  const toast = useGraph((s) => s.toast)
  const loadSample = useGraph((s) => s.loadSample)
  const { getNodes } = useReactFlow()

  const runSelected = () => {
    const sel = getNodes().filter((n) => n.selected)
    if (!sel.length) return toast('Select a node first', 'error')
    runWorkflow({ kind: 'nodes', ids: sel.map((n) => n.id) })
  }

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      <div className="flex items-center gap-1.5">
        <div className="flex h-10 items-center overflow-hidden rounded-full bg-[#fafafa] text-[#0b0b0d] shadow-[0_8px_30px_-6px_rgba(255,255,255,0.25)]">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => runWorkflow({ kind: 'all' })}
            disabled={running}
            className="flex h-full items-center gap-2 pl-4 pr-3 text-[13px] font-semibold transition hover:bg-white disabled:opacity-70"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
            {running ? 'Running' : 'Run'}
          </motion.button>
          <Menu.Root>
            <Menu.Trigger asChild>
              <button className="flex h-full items-center border-l border-black/10 px-2 transition hover:bg-white" aria-label="Run options">
                <ChevronDown size={14} />
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className="menu w-52" sideOffset={8} align="end">
                <Menu.Item className="menu-item" onSelect={() => runWorkflow({ kind: 'all' })}>
                  <Play size={13} /> Run all <span className="kbd">⌘↵</span>
                </Menu.Item>
                <Menu.Item className="menu-item" onSelect={runSelected}>
                  <Play size={13} /> Run selected node
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
        <div className="glass flex h-10 items-center gap-0.5 rounded-full px-1">
          <Tip label="Clear results" side="bottom">
            <button className="icon-btn rounded-full" onClick={clearResults} aria-label="Clear results">
              <X size={15} />
            </button>
          </Tip>
          <Menu.Root>
            <Tip label="Run history" side="bottom">
              <Menu.Trigger asChild>
                <button className="icon-btn rounded-full" aria-label="History">
                  <Clock size={15} />
                </button>
              </Menu.Trigger>
            </Tip>
            <Menu.Portal>
              <Menu.Content className="menu w-72" sideOffset={8} align="end">
                <div className="label px-2 pb-1 pt-1.5">Recent runs</div>
                {history.length === 0 && <div className="px-2 py-3 text-xs text-ink-4">No runs yet — press Run.</div>}
                {history.slice(0, 8).map((h) => (
                  <Menu.Item key={h.id} className="menu-item h-auto py-1.5">
                    <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', h.ok ? 'bg-[var(--ok)]' : 'bg-[var(--danger)]')} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-ink-2">{h.name}</div>
                      <div className="mono text-[10.5px] text-ink-4">
                        {new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {(h.ms / 1000).toFixed(1)}s · {h.nodes} nodes
                      </div>
                    </div>
                    {h.score !== undefined && <span className="mono text-xs text-ink">{Math.round(h.score)}</span>}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root>
            <Menu.Trigger asChild>
              <button className="icon-btn rounded-full" aria-label="Menu">
                <MenuIcon size={15} />
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className="menu w-60" sideOffset={8} align="end">
                <div className="label px-2 pb-1 pt-1.5">Load sample</div>
                {SAMPLES.map((s, i) => (
                  <Menu.Item key={s.id} className="menu-item h-auto flex-col items-start gap-0 py-1.5" onSelect={() => loadSample(i)}>
                    <span className="text-xs text-ink-2">{s.name}</span>
                    <span className="text-[10.5px] text-ink-4">{s.description}</span>
                  </Menu.Item>
                ))}
                <div className="menu-sep" />
                <Menu.Item className="menu-item" onSelect={onSettings}>
                  <Settings size={13} /> Settings
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          className="btn btn-white h-8"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.href)
              toast('Link copied — open it in another tab to collaborate live', 'ok')
            } catch {
              toast(location.href, 'info')
            }
          }}
        >
          Share
        </button>
        <button className={clsx('btn btn-dark h-8', isPublic && 'border-[rgba(74,222,128,0.4)] text-[#bbf7d0]')} onClick={() => set({ isPublic: !isPublic })}>
          <Globe size={13} /> {isPublic ? 'Public' : 'Make Public'}
        </button>
      </div>
    </div>
  )
}

function PresenceStack() {
  const self = usePresence((s) => s.self)
  const peers = usePresence((s) => s.peers)
  const connected = usePresence((s) => s.connected)
  const all = [...(self ? [self] : []), ...Object.values(peers)]
  const shown = all.slice(0, 4)
  const extra = all.length - shown.length
  return (
    <div className="pointer-events-auto fixed left-4 top-[66px] z-30 flex items-center gap-2.5">
      <div className="flex -space-x-2">
        <AnimatePresence initial={false}>
          {shown.map((p, i) => (
            <Tip key={p.id} label={i === 0 && self?.id === p.id ? `${p.name} (you)` : p.name} side="bottom">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--canvas)] text-[11px] font-semibold text-[#0b0b0d]"
                style={{ background: p.color, zIndex: 10 - i }}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </motion.div>
            </Tip>
          ))}
        </AnimatePresence>
        {extra > 0 && (
          <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--canvas)] bg-[#27272a] text-[10.5px] font-semibold text-ink-2">+{extra}</div>
        )}
      </div>
      <div className="glass flex h-6 items-center gap-1.5 rounded-full px-2 text-2xs text-ink-3">
        <span
          className={clsx('h-1.5 w-1.5 rounded-full', connected ? 'bg-[var(--ok)]' : 'bg-ink-4')}
          style={connected ? { boxShadow: '0 0 6px var(--ok)', animation: 'pulse-dot 2s infinite' } : undefined}
        />
        {connected ? (all.length > 1 ? `${all.length} live` : 'Live') : 'Offline'}
      </div>
    </div>
  )
}
