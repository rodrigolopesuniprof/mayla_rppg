from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Defaults:
    # Session parameters (controlled by backend)
    capture_seconds: int = 25
    target_fps: int = 8
    resolution: str = "640x360"
    jpeg_quality: float = 0.5
    roi_refresh_interval: int = 3

    # Guardrails
    ttl_sec: int = 180
    max_frames: int = 400
    max_bytes_mb: int = 20
    max_chunk_size: int = 10
    max_frame_bytes: int = 300_000  # ~300KB/frame

    # Quality thresholds
    face_detect_min: float = 0.7
    snr_good: float = 0.6
    snr_poor: float = 0.3

    # Feature toggles
    mock_mode: bool = True


DEFAULTS = Defaults()
