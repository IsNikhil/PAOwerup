import { motion, useReducedMotion } from 'framer-motion'
import clsx from 'clsx'
import { Sparkles } from 'lucide-react'

export function SkillChips({ items, tone = 'neutral', max = 14 }: { items: { name: string; source?: string; count?: number }[]; tone?: 'neutral' | 'ok' | 'miss'; max?: number }) {
  const reduce = useReducedMotion()
  const shown = items.slice(0, max)
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((s, i) => (
        <motion.span
          key={s.name}
          initial={reduce ? false : { opacity: 0, y: 4, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.25 }}
          className={clsx('chip', tone === 'ok' && 'chip-ok', tone === 'miss' && 'chip-miss', s.source === 'gemini' && tone === 'neutral' && 'chip-gem')}
          title={s.source === 'gemini' ? 'Added by Gemini' : undefined}
        >
          {s.source === 'gemini' && <Sparkles size={10} />}
          {s.name}
          {s.count && s.count > 1 ? <span className="mono text-[10px] text-ink-4">×{s.count}</span> : null}
        </motion.span>
      ))}
      {items.length > max && <span className="chip text-ink-4">+{items.length - max}</span>}
    </div>
  )
}
