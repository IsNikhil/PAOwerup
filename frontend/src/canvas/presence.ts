// Live presence over the FastAPI WebSocket: other tabs' cursors in flow coordinates.
import { create } from 'zustand'

export interface Peer {
  id: string
  name: string
  color: string
  x: number | null
  y: number | null
}

interface PresenceState {
  connected: boolean
  self: Peer | null
  peers: Record<string, Peer>
}

export const usePresence = create<PresenceState>(() => ({ connected: false, self: null, peers: {} }))

let socket: WebSocket | null = null
let lastSend = 0
let retry = 0

export function connectPresence(name: string) {
  if (socket && socket.readyState <= 1) return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/ws/presence${name ? `?name=${encodeURIComponent(name)}` : ''}`)
  socket = ws
  ws.onopen = () => {
    retry = 0
    usePresence.setState({ connected: true })
  }
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    const st = usePresence.getState()
    switch (msg.type) {
      case 'welcome':
        usePresence.setState({ self: msg.self, peers: Object.fromEntries(msg.peers.map((p: Peer) => [p.id, p])) })
        break
      case 'join':
      case 'update':
        usePresence.setState({ peers: { ...st.peers, [msg.peer.id]: { ...st.peers[msg.peer.id], ...msg.peer } } })
        break
      case 'leave': {
        const peers = { ...st.peers }
        delete peers[msg.id]
        usePresence.setState({ peers })
        break
      }
      case 'cursor':
        if (st.peers[msg.id]) usePresence.setState({ peers: { ...st.peers, [msg.id]: { ...st.peers[msg.id], x: msg.x, y: msg.y } } })
        break
    }
  }
  ws.onclose = () => {
    usePresence.setState({ connected: false, peers: {} })
    socket = null
    retry = Math.min(retry + 1, 6)
    setTimeout(() => connectPresence(name), 1000 * retry)
  }
}

export function sendCursor(x: number | null, y: number | null) {
  const now = performance.now()
  if (x !== null && now - lastSend < 33) return // ~30 updates/s
  lastSend = now
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(x === null ? { type: 'hide' } : { type: 'cursor', x, y }))
}

export function renamePresence(name: string) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'rename', name }))
  const self = usePresence.getState().self
  if (self) usePresence.setState({ self: { ...self, name } })
}
