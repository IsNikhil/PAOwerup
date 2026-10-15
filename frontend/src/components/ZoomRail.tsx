import { FIT } from '../lib/view'
import { useReactFlow } from '@xyflow/react'
import { Lock, Map, Maximize, Minus, Plus, Unlock } from 'lucide-react'
import { useGraph } from '../store/graph'
import { Tip } from './ui'

export function ZoomRail() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const minimap = useGraph((s) => s.minimap)
  const locked = useGraph((s) => s.locked)
  const set = useGraph((s) => s.set)
  const btn = 'icon-btn h-9 w-9 rounded-[10px]'
  return (
    <div className="fixed right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1.5">
      <div className="glass flex flex-col gap-0.5 rounded-[14px] p-1">
        <Tip label="Zoom in" side="left">
          <button className={btn} onClick={() => zoomIn({ duration: 200 })} aria-label="Zoom in">
            <Plus size={16} />
          </button>
        </Tip>
        <Tip label="Zoom out" side="left">
          <button className={btn} onClick={() => zoomOut({ duration: 200 })} aria-label="Zoom out">
            <Minus size={16} />
          </button>
        </Tip>
        <Tip label="Fit view" side="left" kbd="F">
          <button className={btn} onClick={() => fitView(FIT)} aria-label="Fit view">
            <Maximize size={15} />
          </button>
        </Tip>
      </div>
      <div className="glass flex flex-col gap-0.5 rounded-[14px] p-1">
        <Tip label={minimap ? 'Hide minimap' : 'Show minimap'} side="left">
          <button className={btn} data-active={minimap} onClick={() => set({ minimap: !minimap })} aria-label="Toggle minimap">
            <Map size={15} />
          </button>
        </Tip>
        <Tip label={locked ? 'Unlock canvas' : 'Lock canvas'} side="left">
          <button className={btn} data-active={locked} onClick={() => set({ locked: !locked })} aria-label="Lock canvas">
            {locked ? <Lock size={15} /> : <Unlock size={15} />}
          </button>
        </Tip>
      </div>
    </div>
  )
}
