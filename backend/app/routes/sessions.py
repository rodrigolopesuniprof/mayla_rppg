from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from ..models.dto import SessionEndReq, SessionEndResp, SessionParams, SessionStartReq
from ..services.rppg_service import SESSION_MANAGER
from ..config import DEFAULTS

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=SessionParams)
def start_session(req: SessionStartReq, request: Request):
    if not req.consent:
        raise HTTPException(status_code=400, detail="consent_required")

    client_ip = request.client.host if request.client else "unknown"
    try:
        s = SESSION_MANAGER.create_session(client_ip=client_ip)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))

    # If we're in mock_mode, the backend must not require heavy deps.
    # In real mode we still try to run even if deps are missing, but the result may be "poor".
    return SessionParams(
        session_id=s.session_id,
        capture_seconds=s.capture_seconds,
        target_fps=s.target_fps,
        resolution=s.resolution,
        jpeg_quality=s.jpeg_quality,
        roi_refresh_interval=s.roi_refresh_interval,
        ttl_sec=s.ttl_sec,
        max_frames=s.max_frames,
        max_bytes_mb=s.max_bytes_mb,
        max_chunk_size=s.max_chunk_size,
        mock_mode=DEFAULTS.mock_mode,
    )


class _ChunkReq(BaseModel):
    chunk_seq: int
    n: int
    frames: list[str]


@router.post("/{session_id}/chunk")
def ingest_chunk(session_id: str, req: _ChunkReq):
    try:
        n_ingested, _ = SESSION_MANAGER.ingest_chunk_base64(session_id=session_id, frames_b64=req.frames)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Keep response compatible with the WS ack structure
    return {"type": "ack", "chunk_seq": int(req.chunk_seq), "received": int(n_ingested)}


@router.post("/{session_id}/end")
def finalize_session(session_id: str):
    try:
        out = SESSION_MANAGER.finalize_session(session_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        # always cleanup
        SESSION_MANAGER.end_session(session_id)

    out["type"] = "result"
    return out


@router.post("/end", response_model=SessionEndResp)
def end_session(req: SessionEndReq):
    SESSION_MANAGER.end_session(req.session_id)
    return SessionEndResp(ok=True)