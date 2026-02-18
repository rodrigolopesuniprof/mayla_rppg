from __future__ import annotations

import base64
import json
import time
import uuid
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from ..config import DEFAULTS

# Optional heavy deps (Build 2).
# In many environments (e.g. Python 3.14), numpy/scipy/mediapipe wheels may be unavailable.
# We keep the backend working in mock mode without these packages.
try:
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover
    np = None  # type: ignore

try:
    from PIL import Image  # type: ignore
except Exception:  # pragma: no cover
    Image = None  # type: ignore


@dataclass
class SessionState:
    session_id: str
    created_at: float
    expires_at: float

    capture_seconds: int
    target_fps: int
    resolution: str
    jpeg_quality: float
    roi_refresh_interval: int

    ttl_sec: int
    max_frames: int
    max_bytes_mb: int
    max_chunk_size: int
    max_frame_bytes: int

    # Counters
    frames_received: int = 0
    bytes_received: int = 0
    chunks_received: int = 0

    started_at: Optional[float] = None
    finished: bool = False

    # Ingest/processing timing
    decode_ms_total: float = 0.0

    # Build 2: optionally store decoded frames (downscaled RGB) for adapter processing.
    # When running in mock_mode (or without deps), we keep this empty.
    frames_rgb: List[Any] = field(default_factory=list)


class SessionManager:
    def __init__(self):
        self._sessions: Dict[str, SessionState] = {}
        # Very simple in-memory per-IP counter
        self._ip_counter: Dict[str, Tuple[int, float]] = {}

    def _cleanup_expired(self):
        now = time.time()
        expired = [sid for sid, s in self._sessions.items() if s.expires_at <= now]
        for sid in expired:
            # Ensure memory is released
            try:
                self._sessions[sid].frames_rgb.clear()
            except Exception:
                pass
            del self._sessions[sid]

    def create_session(self, client_ip: str) -> SessionState:
        self._cleanup_expired()
        self._rate_limit_ip(client_ip)

        sid = str(uuid.uuid4())
        now = time.time()
        s = SessionState(
            session_id=sid,
            created_at=now,
            expires_at=now + DEFAULTS.ttl_sec,
            capture_seconds=DEFAULTS.capture_seconds,
            target_fps=DEFAULTS.target_fps,
            resolution=DEFAULTS.resolution,
            jpeg_quality=DEFAULTS.jpeg_quality,
            roi_refresh_interval=DEFAULTS.roi_refresh_interval,
            ttl_sec=DEFAULTS.ttl_sec,
            max_frames=DEFAULTS.max_frames,
            max_bytes_mb=DEFAULTS.max_bytes_mb,
            max_chunk_size=DEFAULTS.max_chunk_size,
            max_frame_bytes=DEFAULTS.max_frame_bytes,
        )
        self._sessions[sid] = s
        return s

    def end_session(self, session_id: str):
        self._cleanup_expired()
        s = self._sessions.pop(session_id, None)
        if s is not None:
            try:
                s.frames_rgb.clear()
            except Exception:
                pass

    def get(self, session_id: str) -> Optional[SessionState]:
        self._cleanup_expired()
        return self._sessions.get(session_id)

    def touch_started(self, session_id: str):
        s = self.get(session_id)
        if not s:
            return
        if s.started_at is None:
            s.started_at = time.time()

    def validate_and_count_chunk(
        self,
        session_id: str,
        n_frames: int,
        total_chunk_bytes: int,
        frame_sizes: List[int],
    ):
        s = self.get(session_id)
        if not s:
            raise ValueError("session_not_found_or_expired")
        if s.finished:
            raise ValueError("session_already_finished")

        if n_frames <= 0 or n_frames > s.max_chunk_size:
            raise ValueError("chunk_size_exceeded")

        for sz in frame_sizes:
            if sz > s.max_frame_bytes:
                raise ValueError("frame_too_large")

        # Session limits
        if s.frames_received + n_frames > s.max_frames:
            raise ValueError("max_frames_exceeded")

        max_bytes = int(s.max_bytes_mb * 1024 * 1024)
        if s.bytes_received + total_chunk_bytes > max_bytes:
            raise ValueError("max_bytes_exceeded")

        s.frames_received += n_frames
        s.bytes_received += total_chunk_bytes
        s.chunks_received += 1

    def ingest_chunk_base64(self, session_id: str, frames_b64: List[str]) -> Tuple[int, int]:
        """Ingest incoming base64 JPEG frames.

        In **mock_mode**, this function only validates/counts bytes and does not decode/store frames.
        In **real mode**, it decodes JPEG -> RGB numpy arrays (downscaled) when deps are available.

        Returns: (n_frames, total_bytes)
        """
        s = self.get(session_id)
        if not s:
            raise ValueError("session_not_found_or_expired")

        if not isinstance(frames_b64, list):
            raise ValueError("missing_frames")

        t0 = time.perf_counter()

        # Decode base64 first (to enforce max_frame_bytes based on raw bytes)
        jpegs: List[bytes] = []
        sizes: List[int] = []
        for f in frames_b64:
            if not isinstance(f, str):
                continue
            try:
                b = base64.b64decode(f)
            except Exception:
                continue
            jpegs.append(b)
            sizes.append(len(b))

        n = len(jpegs)
        total_bytes = int(sum(sizes))
        self.validate_and_count_chunk(session_id=session_id, n_frames=n, total_chunk_bytes=total_bytes, frame_sizes=sizes)

        # Mock mode: do not decode or store frames.
        if DEFAULTS.mock_mode:
            s.decode_ms_total += (time.perf_counter() - t0) * 1000.0
            return n, total_bytes

        # Real mode requires PIL + numpy.
        if Image is None or np is None:
            # Keep WS alive; finalization will return a poor result.
            s.decode_ms_total += (time.perf_counter() - t0) * 1000.0
            return n, total_bytes

        # Convert to RGB numpy and keep a smaller resolution to reduce memory.
        # 256x144 keeps face detector reasonably stable while staying light.
        target_w, target_h = 256, 144
        for jb in jpegs:
            try:
                im = Image.open(BytesIO(jb)).convert("RGB")
                im = im.resize((target_w, target_h), Image.BILINEAR)
                arr = np.asarray(im, dtype=np.uint8)
                s.frames_rgb.append(arr)
            except Exception:
                # Skip frames that fail decoding
                continue

        s.decode_ms_total += (time.perf_counter() - t0) * 1000.0
        return n, total_bytes

    def should_finalize(self, session_id: str) -> bool:
        s = self.get(session_id)
        if not s:
            return True
        if s.started_at is None:
            return False
        return (time.time() - s.started_at) >= s.capture_seconds

    def _mock_result(self, s: SessionState, duration: float) -> dict:
        # Stable pseudo-random bpm per session (no external deps).
        seed = int(uuid.UUID(s.session_id)) % 10_000
        bpm = 68 + (seed % 18)  # 68..85
        confidence = 0.6 if s.frames_received >= max(10, int(s.capture_seconds * s.target_fps * 0.6)) else 0.35
        quality = "good" if confidence >= 0.6 else "medium"

        return {
            "bpm": float(bpm),
            "confidence": float(confidence),
            "quality": quality,
            "message": "Medição simulada (mock_mode).",
            "duration_s": round(duration, 2),
            "frames_received": s.frames_received,
            "face_detect_rate": 1.0,
            "snr_db": 12.0 if quality == "good" else 6.0,
            "bpm_series": None,
        }

    def finalize_real(self, session_id: str) -> dict:
        """Build 2 finalization (real processing).

        Kept separate so we can keep imports lazy and allow the app to run without heavy deps.
        """
        s = self.get(session_id)
        if not s:
            raise ValueError("session_not_found_or_expired")

        s.finished = True
        now = time.time()
        duration = 0.0
        if s.started_at is not None:
            duration = max(0.0, now - s.started_at)

        # Default poor result fallback
        result = {
            "bpm": None,
            "confidence": 0.0,
            "quality": "poor",
            "message": "Qualidade insuficiente para estimar BPM.",
            "duration_s": round(duration, 2),
            "frames_received": s.frames_received,
            "face_detect_rate": 0.0,
            "snr_db": None,
            "bpm_series": None,
        }

        adapter_out: Optional[dict] = None
        processing_ms: Optional[float] = None

        try:
            # Lazy import: adapter has heavy deps (numpy/scipy/mediapipe + local pyVHR)
            from . import pyvhr_adapter

            # Ensure adapter uses the session ROI refresh interval (without changing its public signature)
            try:
                pyvhr_adapter._ROI_REFRESH_INTERVAL = int(max(1, s.roi_refresh_interval))
            except Exception:
                pass

            # Log accumulated decode time (base64->jpeg->rgb) for the session
            print(f"[RPPG] stage=decode elapsed={s.decode_ms_total:.0f} ms")

            t_proc0 = time.perf_counter()

            # fps comes from session parameters
            fps = float(s.target_fps)
            adapter_out = pyvhr_adapter.process_rppg_signal(
                frames=s.frames_rgb,
                fps=fps,
                winsize=5,
                stride=1,
            )

            processing_ms = (time.perf_counter() - t_proc0) * 1000.0

            # Adapter returns: bpm/confidence/quality/snr_score/face_detect_rate/bpm_series/message
            result["bpm"] = adapter_out.get("bpm")
            result["confidence"] = float(adapter_out.get("confidence", 0.0) or 0.0)
            result["quality"] = adapter_out.get("quality") or "poor"
            result["message"] = adapter_out.get("message")
            result["face_detect_rate"] = float(adapter_out.get("face_detect_rate", 0.0) or 0.0)
            result["bpm_series"] = adapter_out.get("bpm_series")

            # Prefer adapter snr_db (if available), else keep old derivation for backward compatibility
            if isinstance(adapter_out.get("snr_db"), (int, float)):
                result["snr_db"] = float(adapter_out.get("snr_db"))
            else:
                # Derive snr_db from snr_score mapping used in adapter (-5..15 dB)
                snr_score = float(adapter_out.get("snr_score", 0.0) or 0.0)
                if snr_score > 0.0:
                    result["snr_db"] = float(snr_score * 20.0 - 5.0)
                else:
                    result["snr_db"] = None

        except Exception:
            # Defensive fallback
            result["quality"] = "poor"
            result["bpm"] = None
            if not result.get("message"):
                result["message"] = "Falha no processamento rPPG."

        finally:
            # Emit one consolidated per-session metrics line (for cost/bottleneck measurement)
            try:
                timings = {}
                if isinstance(adapter_out, dict):
                    timings = adapter_out.get("timings_ms") or {}

                snr_score = None
                if isinstance(adapter_out, dict) and isinstance(adapter_out.get("snr_score"), (int, float)):
                    snr_score = float(adapter_out.get("snr_score"))

                metrics = {
                    "session_id": s.session_id,
                    "frames_received": int(s.frames_received),
                    "chunks_received": int(s.chunks_received),
                    "bytes_received": int(s.bytes_received),
                    "elapsed_total_ms": int(round(duration * 1000.0)),
                    "quality": result.get("quality"),
                    "face_detect_rate": float(result.get("face_detect_rate") or 0.0),
                    "snr_score": snr_score,
                    "snr_db": result.get("snr_db"),
                    "decode_ms_total": float(s.decode_ms_total),
                    "processing_ms": float(processing_ms) if processing_ms is not None else None,
                    "timings_ms": {
                        "roi": float(timings.get("roi") or 0.0),
                        "pos": float(timings.get("pos") or 0.0),
                        "welch": float(timings.get("welch") or 0.0),
                        "total": float(timings.get("total") or 0.0),
                    },
                }
                print("[SESSION_METRICS] " + json.dumps(metrics, separators=(",", ":"), ensure_ascii=False))
            except Exception:
                pass

            # Cleanup memory regardless of success/failure
            try:
                s.frames_rgb.clear()
            except Exception:
                pass

        return result

    def finalize_session(self, session_id: str) -> dict:
        """Finalize a session and return a dict compatible with the WS contract."""
        s = self.get(session_id)
        if not s:
            raise ValueError("session_not_found_or_expired")

        s.finished = True
        now = time.time()
        duration = 0.0
        if s.started_at is not None:
            duration = max(0.0, now - s.started_at)

        if DEFAULTS.mock_mode:
            # In mock mode we don't need any heavy deps.
            out = self._mock_result(s, duration)
            try:
                print(
                    "[SESSION_METRICS] "
                    + json.dumps(
                        {
                            "session_id": s.session_id,
                            "frames_received": int(s.frames_received),
                            "chunks_received": int(s.chunks_received),
                            "bytes_received": int(s.bytes_received),
                            "elapsed_total_ms": int(round(duration * 1000.0)),
                            "quality": out.get("quality"),
                            "mock_mode": True,
                        },
                        separators=(",", ":"),
                        ensure_ascii=False,
                    )
                )
            except Exception:
                pass
            try:
                s.frames_rgb.clear()
            except Exception:
                pass
            return out

        return self.finalize_real(session_id)

    # Backwards-compatible alias (older callers)
    def finalize_mock(self, session_id: str) -> dict:
        return self.finalize_session(session_id)

    def _rate_limit_ip(self, client_ip: str):
        # Naive limiter: max 10 starts / minute / IP
        now = time.time()
        count, since = self._ip_counter.get(client_ip, (0, now))
        if now - since > 60:
            count, since = 0, now
        count += 1
        if count > 10:
            raise ValueError("rate_limited")
        self._ip_counter[client_ip] = (count, since)


SESSION_MANAGER = SessionManager()


def decode_base64_frames(frames_b64: List[str]) -> List[bytes]:
    # Backwards compatible helper (kept, but no longer used by the main ingestion path)
    out = []
    for f in frames_b64:
        out.append(base64.b64decode(f))
    return out