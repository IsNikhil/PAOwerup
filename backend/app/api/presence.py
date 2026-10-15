"""Live presence: every browser tab joins, gets a name/colour, and broadcasts its cursor."""
import asyncio
import json
import random
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

NAMES = ["Paul", "Kate", "Mario", "Ana", "Theo", "Lena", "Jin", "Priya", "Omar", "Zoe", "Luca", "Maya"]
COLORS = ["#E8FF5A", "#60A5FA", "#F472B6", "#4ADE80", "#A78BFA", "#FB923C", "#22D3EE", "#F87171"]


class Hub:
    def __init__(self) -> None:
        self.peers: dict[str, dict] = {}
        self.sockets: dict[str, WebSocket] = {}
        self.lock = asyncio.Lock()

    async def broadcast(self, message: dict, exclude: str | None = None) -> None:
        dead = []
        for pid, ws in list(self.sockets.items()):
            if pid == exclude:
                continue
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(pid)
        for pid in dead:
            await self.leave(pid)

    async def leave(self, pid: str) -> None:
        async with self.lock:
            self.sockets.pop(pid, None)
            existed = self.peers.pop(pid, None)
        if existed:
            await self.broadcast({"type": "leave", "id": pid})


hub = Hub()


@router.websocket("/ws/presence")
async def presence(ws: WebSocket) -> None:
    await ws.accept()
    pid = uuid.uuid4().hex[:8]
    used = {p["color"] for p in hub.peers.values()}
    color = next((c for c in COLORS if c not in used), random.choice(COLORS))
    me = {"id": pid, "name": ws.query_params.get("name") or random.choice(NAMES), "color": color, "x": None, "y": None}
    async with hub.lock:
        hub.peers[pid] = me
        hub.sockets[pid] = ws
    await ws.send_text(json.dumps({"type": "welcome", "self": me, "peers": [p for p in hub.peers.values() if p["id"] != pid]}))
    await hub.broadcast({"type": "join", "peer": me}, exclude=pid)
    try:
        while True:
            msg = json.loads(await ws.receive_text())
            kind = msg.get("type")
            if kind == "cursor":
                me["x"], me["y"] = msg.get("x"), msg.get("y")
                await hub.broadcast({"type": "cursor", "id": pid, "x": me["x"], "y": me["y"]}, exclude=pid)
            elif kind == "rename":
                me["name"] = str(msg.get("name", ""))[:24] or me["name"]
                await hub.broadcast({"type": "update", "peer": me}, exclude=pid)
            elif kind == "hide":
                me["x"] = me["y"] = None
                await hub.broadcast({"type": "cursor", "id": pid, "x": None, "y": None}, exclude=pid)
    except (WebSocketDisconnect, RuntimeError, json.JSONDecodeError):
        pass
    finally:
        await hub.leave(pid)
