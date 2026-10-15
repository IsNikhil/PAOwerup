import { useViewport } from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePresence } from './presence'

/** Colored arrow cursors with name tags for every other viewer. */
export function PresenceCursors() {
  const peers = usePresence((s) => s.peers)
  const { x: vx, y: vy, zoom } = useViewport()
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      <AnimatePresence>
        {Object.values(peers)
          .filter((p) => p.x !== null && p.y !== null)
          .map((p) => (
            <motion.div
              key={p.id}
              className="absolute left-0 top-0"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1, x: p.x! * zoom + vx, y: p.y! * zoom + vy }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ x: { type: 'spring', stiffness: 500, damping: 40, mass: 0.4 }, y: { type: 'spring', stiffness: 500, damping: 40, mass: 0.4 }, opacity: { duration: 0.15 } }}
            >
              <svg width="18" height="20" viewBox="0 0 18 20" className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                <path d="M2 1.5 L16 9 L9.4 10.6 L6.2 17.5 Z" fill={p.color} stroke="#0B0B0D" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              <span
                className="absolute left-3.5 top-[17px] whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-semibold leading-none text-[#0B0B0D] shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                style={{ background: p.color }}
              >
                {p.name}
              </span>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  )
}
