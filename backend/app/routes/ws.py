from __future__ import annotations

import json
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services.rppg_service import SESSION_MANAGER

router = APIRouter(tags=["ws"])


@router.websocket("/ws/sessions/{session_id}")
async def ws_session(websocket: WebSocket, session_id: str):
    await websocket.accept()

    client = None
    try:
        client = websocket.client
    except Exception:
        client = None

    client_str = f"{client.host}:{client.port}" if client else "unknown"
    print(f"[WS] accept session_id={session_id} client={client_str}")

    s = SESSION_MANAGER.get(session_id)
    if not s:
        print(f"[WS] invalid session_id={session_id} (not found/expired)")
        await websocket.send_text(json.dumps({"type": "error", "message": "session_not_found_or_expired"}))
        await websocket.close(code=4404)
        return

    SESSION_MANAGER.touch_started(session_id)
    started_at = time.time()
    print(
        f"[WS] session started session_id={session_id} capture_seconds={s.capture_seconds} max_chunk_size={s.max_chunk_size}"
    )

    async def _finalize(reason: str):
        elapsed = time.time() - started_at
        try:
            result = SESSION_MANAGER.finalize_mock(session_id)
        except Exception as e:
            result = {
                "type": "result",
                "bpm": None,
                "confidence": 0.0,
                "quality": "poor",
                "message": "Falha ao finalizar sessão.",
                "duration_s": round(elapsed, 2),
                "frames_received": 0,
                "face_detect_rate": 0.0,
                "snr_db": None,
                "bpm_series": None,
            }
            print(f"[WS] finalize error session_id={session_id} err={repr(e)}")

        result["type"] = "result"
        # Prefer server-side measured duration
        result["duration_s"] = round(elapsed, 2)

        print(f"[WS] finalize session_id={session_id} reason={reason} elapsed={elapsed:.2f}s")
        await websocket.send_text(json.dumps(result))
        await websocket.close(code=1000)
        SESSION_MANAGER.end_session(session_id)

    try:
        while True:
            msg = await websocket.receive_text()

            try:
                payload = json.loads(msg)
            except Exception:
                print(f"[WS] invalid_json session_id={session_id}")
                await websocket.send_text(json.dumps({"type": "error", "message": "invalid_json"}))
                continue

            # Explicit end event from client
            if payload.get("type") == "end":
                await _finalize(reason="client_end")
                return

            frames = payload.get("frames")
            n_declared = payload.get("n")
            chunk_seq = payload.get("chunk_seq")

            if not isinstance(chunk_seq, int):
                await websocket.send_text(json.dumps({"type": "error", "message": "missing_chunk_seq"}))
                continue

            if not isinstance(frames, list):
                await websocket.send_text(json.dumps({"type": "error", "message": "missing_frames"}))
                continue

            try:
                n_ingested, total_bytes = SESSION_MANAGER.ingest_chunk_base64(session_id=session_id, frames_b64=frames)
            except ValueError as e:
                print(f"[WS] guardrail_triggered session_id={session_id} err={str(e)}")
                await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
                await websocket.close(code=4400)
                return

            # Ack per chunk (echo declared n if present; otherwise use ingested count)
            n_ack = n_declared if isinstance(n_declared, int) else n_ingested
            await websocket.send_text(json.dumps({"type": "ack", "chunk_seq": chunk_seq, "received": n_ack}))

            s2 = SESSION_MANAGER.get(session_id)
            print(
                f"[WS] chunk session_id={session_id} chunk_seq={chunk_seq} n_ingested={n_ingested} bytes={total_bytes} totals: frames={s2.frames_received if s2 else '?'} chunks={s2.chunks_received if s2 else '?'}"
            )

            # Optional automatic finalize by time (only when a message arrives)
            elapsed = time.time() - started_at
            if elapsed >= s.capture_seconds:
                await _finalize(reason="elapsed")
                return

    except WebSocketDisconnect:
        print(f"[WS] disconnect session_id={session_id}")
        SESSION_MANAGER.end_session(session_id)
        return
    except Exception as e:
        print(f"[WS] error session_id={session_id} err={repr(e)}")
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": "server_error"}))
        except Exception:
            pass
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
        SESSION_MANAGER.end_session(session_id)
        return