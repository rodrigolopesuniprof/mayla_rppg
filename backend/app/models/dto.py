from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Literal, Optional, List


class SessionStartReq(BaseModel):
    consent: bool = Field(..., description="LGPD consent must be true")


class SessionParams(BaseModel):
    session_id: str

    capture_seconds: int
    target_fps: int
    resolution: str
    jpeg_quality: float
    roi_refresh_interval: int

    ttl_sec: int
    max_frames: int
    max_bytes_mb: int
    max_chunk_size: int

    mock_mode: bool


class SessionEndReq(BaseModel):
    session_id: str


class SessionEndResp(BaseModel):
    ok: bool


class ChunkAck(BaseModel):
    type: Literal["ack"] = "ack"
    chunk_seq: int
    received: int


class SessionResult(BaseModel):
    bpm: Optional[float]
    confidence: float
    quality: Literal["good", "medium", "poor"]
    message: Optional[str] = None

    duration_s: float
    frames_received: int
    face_detect_rate: float
    snr_db: Optional[float] = None
    bpm_series: Optional[List[float]] = None
