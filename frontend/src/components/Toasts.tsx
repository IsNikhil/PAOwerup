import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { useGraph } from '../store/graph'

export function Toasts() {
  const toasts = useGraph((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed left-1/2 top-[84px] z-[90] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="glass-solid flex max-w-[460px] items-center gap-2 rounded-full px-3.5 py-2 text-xs text-ink-2"
          >
            {t.tone === 'ok' ? <CheckCircle2 size={14} className="text-[var(--ok)]" /> : t.tone === 'error' ? <AlertCircle size={14} className="text-[var(--danger)]" /> : <Info size={14} className="text-[var(--t-score)]" />}
            <span className="truncate">{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
