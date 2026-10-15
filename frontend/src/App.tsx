import { FIT } from './lib/view'
import * as RTooltip from '@radix-ui/react-tooltip'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { MotionConfig } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Canvas } from './canvas/Canvas'
import { connectPresence } from './canvas/presence'
import { CommandBar } from './components/CommandBar'
import { HelpDialog, SettingsDialog } from './components/Dialogs'
import { NodePalette } from './components/NodePalette'
import { StatsReadout } from './components/StatsReadout'
import { Toasts } from './components/Toasts'
import { TopBar } from './components/TopBar'
import { ZoomRail } from './components/ZoomRail'
import { api } from './lib/api'
import { runWorkflow } from './lib/runner'
import { useGraph } from './store/graph'

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.getAttribute('role') === 'combobox')

function useShortcuts() {
  const { fitView, screenToFlowPosition } = useReactFlow()
  useEffect(() => {
    let mouse = { x: innerWidth / 2, y: innerHeight / 2 }
    const onMove = (e: MouseEvent) => (mouse = { x: e.clientX, y: e.clientY })
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        runWorkflow({ kind: 'all' })
        return
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space') {
        e.preventDefault()
        const flow = screenToFlowPosition(mouse)
        useGraph.getState().set({ palette: { x: mouse.x, y: mouse.y, flowX: flow.x, flowY: flow.y } })
      } else if (e.key === 'f' || e.key === 'F') {
        fitView(FIT)
      } else if (e.key === 'Escape') {
        useGraph.getState().set({ palette: null })
      }
    }
    addEventListener('mousemove', onMove)
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('mousemove', onMove)
      removeEventListener('keydown', onKey)
    }
  }, [fitView, screenToFlowPosition])
}

function useHealth() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let alive = true
    const poll = async () => {
      let delay = 15000
      try {
        const h = await api.health()
        useGraph.getState().set({ health: h })
        if ([h.use.status, h.whisper.status].includes('loading')) delay = 2500
      } catch {
        useGraph.getState().set({ health: null })
        delay = 3000
      }
      if (alive) timer = setTimeout(poll, delay)
    }
    poll()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])
}

function Shell() {
  const theme = useGraph((s) => s.theme)
  const [help, setHelp] = useState(false)
  const [settings, setSettings] = useState(false)
  useShortcuts()
  useHealth()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    connectPresence(useGraph.getState().userName)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas />
      <TopBar onHelp={() => setHelp(true)} onSettings={() => setSettings(true)} />
      <ZoomRail />
      <CommandBar onSettings={() => setSettings(true)} />
      <StatsReadout />
      <NodePalette />
      <Toasts />
      <HelpDialog open={help} onOpenChange={setHelp} />
      <SettingsDialog open={settings} onOpenChange={setSettings} />
    </div>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RTooltip.Provider>
        <ReactFlowProvider>
          <Shell />
        </ReactFlowProvider>
      </RTooltip.Provider>
    </MotionConfig>
  )
}
