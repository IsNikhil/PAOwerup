import { useEffect, useState } from 'react'
import { useGraph } from '../store/graph'

const short: Record<string, string> = { ready: 'ready', loading: 'loading', idle: 'idle', error: 'error', disabled: 'off' }

export function StatsReadout() {
  const lastRun = useGraph((s) => s.lastRun)
  const running = useGraph((s) => s.running)
  const startedAt = useGraph((s) => s.runStartedAt)
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  const health = useGraph((s) => s.health)
  const doneCount = useGraph((s) => Object.values(s.results).filter((r) => r.status === 'done').length)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 50)
    return () => clearInterval(t)
  }, [running])

  const t = running && startedAt ? (now - startedAt) / 1000 : (lastRun?.ms ?? 0) / 1000
  const connected = new Set(edges.flatMap((e) => [e.source, e.target])).size
  const use = health ? short[health.use.status] : '…'
  const color = health?.use.status === 'ready' ? 'text-[#86efac]' : health?.use.status === 'error' ? 'text-[#fca5a5]' : 'text-[#fcd34d]'

  return (
    <div className="mono pointer-events-none fixed bottom-3.5 right-4 z-20 flex items-center gap-1.5 text-[10.5px] tracking-wide text-ink-4">
      <span>
        T: <span className="text-ink-3">{t.toFixed(2)}s</span>
      </span>
      <span className="text-ink-5">/</span>
      <span>
        I: <span className="text-ink-3">{running ? doneCount : lastRun?.nodes ?? 0}</span>
      </span>
      <span className="text-ink-5">/</span>
      <span>
        N: <span className="text-ink-3">{nodes.length}</span> ({connected})
      </span>
      <span className="text-ink-5">/</span>
      <span>
        USE: <span className={color}>{use}</span>
      </span>
      {health && (
        <span className="hidden items-center gap-1.5 min-[1400px]:flex">
          <span className="text-ink-5">/</span>
          <span>
            WSP: <span className="text-ink-3">{short[health.whisper.status]}</span>
          </span>
          <span className="text-ink-5">/</span>
          <span>
            GEM: <span className={health.gemini.status === 'ready' ? 'text-[#86efac]' : 'text-ink-3'}>{short[health.gemini.status]}</span>
          </span>
        </span>
      )}
    </div>
  )
}
