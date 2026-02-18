from __future__ import annotations

import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services.rppg_service import SESSION_MANAGER

router = APIRouter(tags=["ws"])


@router.websocket("/ws/sessions/{session_id}")
async def ws_session(websocket: WebSocket, session_id: str):
    await websocket.accept()

    s = SESSION_MANAGER.get(session_id)
    if not s:
        await websocket.send_text(json.dumps({"type": "error", "message": "session_not_found_or_expired"}))
        await websocket.close(code=4404)
        return

    SESSION_MANAGER.touch_started(session_id)

    try:
        while True:
            msg = await websocket.receive_text()
            try:
                payload = json.loads(msg)
            except Exception:
                await websocket.send_text(json.dumps({"type": "error", "message": "invalid_json"}))
                continue

            # Build 1: JSON + base64 frames
            frames = payload.get("frames")
            n = payload.get("n")
            chunk_seq = payload.get("chunk_seq")

            if not isinstance(chunk_seq, int):
                await websocket.send_text(json.dumps({"type": "error", "message": "missing_chunk_seq"}))
                continue

            if not isinstance(frames, list):
                await websocket.send_text(json.dumps({"type": "error", "message": "missing_frames"}))
                continue

            if not isinstance(n, int):
                n = len(frames)

            # Estimate sizes (base64 payload size isn't raw bytes, but it still protects memory)
            frame_sizes = [len(f) if isinstance(f, str) else 0 for f in frames]
            total_bytes = sum(frame_sizes)

            try:
                SESSION_MANAGER.validate_and_count_chunk(
                    session_id=session_id,
                    n_frames=n,
                    total_chunk_bytes=total_bytes,
                    frame_sizes=frame_sizes,
                )
            except ValueError as e:
                await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
                await websocket.close(code=4400)
                return

            # Ack
            await websocket.send_text(json.dumps({"type": "ack", "chunk_seq": chunk_seq, "received": n}))

            # Finalize after capture_seconds since first chunk
            if SESSION_MANAGER.should_finalize(session_id):
                result = SESSION_MANAGER.finalize_mock(session_id)
                await websocket.send_text(json.dumps(result))
                await websocket.close(code=1000)
                SESSION_MANAGER.end_session(session_id)
                return

    except WebSocketDisconnect:
        # Client disconnected early: cleanup
        SESSION_MANAGER.end_session(session_id)
        return
