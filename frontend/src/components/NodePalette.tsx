import { useReactFlow } from '@xyflow/react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PALETTE_ORDER, SPECS } from '../lib/nodeSpecs'
import { TYPE_HEX } from '../lib/types'
import { useGraph } from '../store/graph'

export function NodePalette() {
  const palette = useGraph((s) => s.palette)
  const addNode = useGraph((s) => s.addNode)
  const set = useGraph((s) => s.set)
  const { screenToFlowPosition } = useReactFlow()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  const items = useMemo(
    () => PALETTE_ORDER.map((k) => SPECS[k]).filter((s) => `${s.title} ${s.description} ${s.engine ?? ''}`.toLowerCase().includes(q.toLowerCase())),
    [q],
  )

  useEffect(() => {
    setQ('')
    setActive(0)
  }, [palette])

  if (!palette) return null
  const left = Math.min(palette.x, innerWidth - 300)
  const top = Math.min(palette.y, innerHeight - 420)

  const add = (i: number) => {
    const spec = items[i]
    if (!spec) return
    const pos = palette.flowX || palette.flowY ? { x: palette.flowX, y: palette.flowY } : screenToFlowPosition({ x: innerWidth / 2, y: innerHeight / 2 })
    addNode(spec.kind, pos)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="menu fixed z-[60] w-[290px] p-1.5"
        style={{ left, top }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') set({ palette: null })
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, items.length - 1))
          if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
          if (e.key === 'Enter') add(active)
        }}
      >
        <div className="mb-1 flex h-9 items-center gap-2 rounded-[9px] border border-line bg-black/30 px-2.5">
          <Search size={14} className="text-ink-4" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            placeholder="Add a node…"
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-5"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="max-h-[340px] overflow-y-auto">
          {items.map((s, i) => (
            <button
              key={s.kind}
              onMouseEnter={() => setActive(i)}
              onClick={() => add(i)}
              className={clsx('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left', i === active && 'bg-white/[0.08]')}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_HEX[s.glow], boxShadow: `0 0 8px ${TYPE_HEX[s.glow]}` }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] text-ink-2">{s.title}</span>
                <span className="block truncate text-[10.5px] text-ink-4">{s.description}</span>
              </span>
              {s.engine && <span className="text-[10px] text-ink-4">{s.engine}</span>}
            </button>
          ))}
          {!items.length && <div className="px-2 py-3 text-xs text-ink-4">No matching nodes</div>}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
