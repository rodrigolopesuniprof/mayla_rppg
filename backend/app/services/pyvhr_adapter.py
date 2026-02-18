from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# MediaPipe is used only for face ROI detection; this module is otherwise independent of FastAPI.
import mediapipe as mp

from scipy.signal import butter, filtfilt, welch
from scipy.stats import median_abs_deviation

# pyVHR methods (local package in this repo)
from pyVHR.BVP.methods import cpu_CHROM, cpu_POS


@dataclass
class _Roi:
    x1: int
    y1: int
    x2: int
    y2: int

    def clamp_to(self, w: int, h: int) -> Optional["_Roi"]:
        x1 = max(0, min(self.x1, w - 1))
        x2 = max(0, min(self.x2, w))
        y1 = max(0, min(self.y1, h - 1))
        y2 = max(0, min(self.y2, h))
        if x2 <= x1 or y2 <= y1:
            return None
        return _Roi(x1=x1, y1=y1, x2=x2, y2=y2)

    def area(self) -> int:
        return max(0, self.x2 - self.x1) * max(0, self.y2 - self.y1)


# Default: refresh ROI every N frames (can be tuned later by the caller via config
# if we decide to extend the signature).
_ROI_REFRESH_INTERVAL = 3


def _bandpass_bvp(bvp: np.ndarray, fps: float, min_hz: float = 0.65, max_hz: float = 4.0, order: int = 4) -> np.ndarray:
    # bvp: (T,)
    if bvp.size < 10 or fps <= 0:
        return bvp
    nyq = fps / 2.0
    lo = max(1e-6, min_hz / nyq)
    hi = min(0.999, max_hz / nyq)
    if hi <= lo:
        return bvp
    b, a = butter(order, [lo, hi], btype="band")
    return filtfilt(b, a, bvp).astype(np.float32)


def _snr_from_psd(freqs_hz: np.ndarray, psd: np.ndarray, f_peak_hz: float) -> Tuple[float, float]:
    """Return (snr_db, snr_score in [0,1]).

    Simple PSD-based SNR:
    - signal band: +/- 0.10 Hz around peak (approx +/- 6 BPM)
    - noise band: remaining power in [0.65, 4.0] Hz

    This is not a clinical SNR; it's a robust heuristic for gating/confidence.
    """
    if psd.size == 0 or freqs_hz.size != psd.size:
        return 0.0, 0.0

    band_mask = (freqs_hz >= 0.65) & (freqs_hz <= 4.0)
    if not np.any(band_mask):
        return 0.0, 0.0

    freqs = freqs_hz[band_mask]
    p = psd[band_mask]

    if not np.isfinite(p).all() or np.sum(p) <= 0:
        return 0.0, 0.0

    sig_mask = (freqs >= f_peak_hz - 0.10) & (freqs <= f_peak_hz + 0.10)
    sig_power = float(np.sum(p[sig_mask]))
    noise_power = float(np.sum(p[~sig_mask]))

    if noise_power <= 1e-12 or sig_power <= 1e-12:
        return 0.0, 0.0

    snr_lin = sig_power / noise_power
    snr_db = 10.0 * math.log10(snr_lin)

    # Map snr_db into [0,1] (tunable):
    # -5 dB -> 0
    # 15 dB -> 1
    snr_score = (snr_db + 5.0) / 20.0
    snr_score = float(max(0.0, min(1.0, snr_score)))
    return float(snr_db), snr_score


def _estimate_bpm_series(bvp: np.ndarray, fps: float, winsize: int, stride: int) -> List[float]:
    if fps <= 0:
        return []
    if bvp.size < int(winsize * fps):
        return []

    win_len = int(round(winsize * fps))
    hop = int(round(stride * fps))
    hop = max(1, hop)

    out: List[float] = []
    for start in range(0, bvp.size - win_len + 1, hop):
        seg = bvp[start : start + win_len]
        if not np.isfinite(seg).all():
            continue
        # Welch PSD
        nperseg = min(256, seg.size)
        noverlap = int(0.8 * nperseg)
        freqs, psd = welch(seg, fs=fps, nperseg=nperseg, noverlap=noverlap, nfft=2048)
        # Find peak in HR band
        band = (freqs >= 0.65) & (freqs <= 4.0)
        if not np.any(band):
            continue
        freqs_b = freqs[band]
        psd_b = psd[band]
        if psd_b.size == 0 or np.sum(psd_b) <= 0:
            continue
        peak_i = int(np.argmax(psd_b))
        f_peak_hz = float(freqs_b[peak_i])
        bpm = f_peak_hz * 60.0
        if 40.0 <= bpm <= 200.0:
            out.append(float(bpm))
    return out


def _quality_from_confidence_and_mad(confidence: float, mad_bpm: float) -> str:
    # Align with your spec:
    # good: confidence >= 0.6 and MAD <= 5
    # medium: confidence in [0.3, 0.6) OR MAD in (5, 10]
    # poor: confidence < 0.3 OR MAD > 10
    if confidence >= 0.6 and mad_bpm <= 5.0:
        return "good"
    if confidence >= 0.3 and mad_bpm <= 10.0:
        return "medium"
    return "poor"


def process_rppg_signal(
    frames: list,
    fps: float,
    winsize: int = 5,
    stride: int = 1,
) -> dict:
    """Process a sequence of RGB frames into rPPG metrics.

    Input:
      - frames: list of RGB numpy arrays (H,W,3), dtype uint8 preferred.
      - fps: sampling rate.

    Output (always returns a dict; never raises):
      {
        "bpm": float | None,
        "confidence": float,
        "quality": "good" | "medium" | "poor",
        "snr_score": float,
        "face_detect_rate": float,
        "bpm_series": list | None,
        "message": str | None,
      }

    Notes:
      - This function is intentionally isolated from FastAPI.
      - Defensive: internal try/except; never throws.
    """

    base_result: Dict[str, Any] = {
        "bpm": None,
        "confidence": 0.0,
        "quality": "poor",
        "snr_score": 0.0,
        "face_detect_rate": 0.0,
        "bpm_series": None,
        "message": "Medição indisponível.",
    }

    try:
        if not isinstance(frames, list) or len(frames) == 0:
            base_result["message"] = "Sem frames para processar."
            return base_result

        if fps is None or not np.isfinite(fps) or fps <= 0:
            base_result["message"] = "FPS inválido."
            return base_result

        # --- ROI detection (MediaPipe FaceDetection) ---
        mp_face = mp.solutions.face_detection
        face_detector = mp_face.FaceDetection(model_selection=0, min_detection_confidence=0.5)

        roi: Optional[_Roi] = None
        face_valid = 0
        rgb_means: List[np.ndarray] = []

        for i, frame in enumerate(frames):
            if frame is None:
                rgb_means.append(np.array([np.nan, np.nan, np.nan], dtype=np.float32))
                continue

            arr = np.asarray(frame)
            if arr.ndim != 3 or arr.shape[2] != 3:
                rgb_means.append(np.array([np.nan, np.nan, np.nan], dtype=np.float32))
                continue

            h, w, _ = arr.shape

            # Refresh ROI periodically
            do_refresh = (i % _ROI_REFRESH_INTERVAL) == 0 or roi is None
            if do_refresh:
                # MediaPipe expects RGB
                res = face_detector.process(arr)
                new_roi: Optional[_Roi] = None
                if res and res.detections:
                    det = res.detections[0]
                    bb = det.location_data.relative_bounding_box
                    x1 = int(bb.xmin * w)
                    y1 = int(bb.ymin * h)
                    x2 = int((bb.xmin + bb.width) * w)
                    y2 = int((bb.ymin + bb.height) * h)

                    # Small padding to include cheeks/forehead.
                    pad_x = int(0.05 * (x2 - x1))
                    pad_y = int(0.08 * (y2 - y1))
                    new_roi = _Roi(x1 - pad_x, y1 - pad_y, x2 + pad_x, y2 + pad_y).clamp_to(w, h)

                if new_roi is not None and new_roi.area() > 0:
                    roi = new_roi
                # else: keep previous roi (reuse)

            if roi is None or roi.area() <= 0:
                rgb_means.append(np.array([np.nan, np.nan, np.nan], dtype=np.float32))
                continue

            crop = arr[roi.y1 : roi.y2, roi.x1 : roi.x2, :]
            if crop.size == 0:
                rgb_means.append(np.array([np.nan, np.nan, np.nan], dtype=np.float32))
                continue

            mean_rgb = np.mean(crop.reshape(-1, 3), axis=0).astype(np.float32)
            rgb_means.append(mean_rgb)
            face_valid += 1

        face_detector.close()

        face_detect_rate = face_valid / max(1, len(frames))
        base_result["face_detect_rate"] = float(face_detect_rate)

        # Gating: face detect
        if face_detect_rate < 0.7:
            base_result["message"] = "Face pouco detectada. Repita com o rosto centralizado e estável."
            return base_result

        sig = np.vstack(rgb_means)  # (T, 3)
        # Replace NaNs defensively
        if np.isnan(sig).any():
            # forward fill then back fill
            for c in range(3):
                col = sig[:, c]
                mask = np.isfinite(col)
                if not np.any(mask):
                    base_result["message"] = "Sinal RGB inválido."
                    return base_result
                # forward fill
                last = col[np.argmax(mask)]
                for k in range(col.shape[0]):
                    if np.isfinite(col[k]):
                        last = col[k]
                    else:
                        col[k] = last
                # back fill
                last = col[np.argmax(mask)]
                for k in range(col.shape[0] - 1, -1, -1):
                    if np.isfinite(col[k]):
                        last = col[k]
                    else:
                        col[k] = last
                sig[:, c] = col

        # --- POS extraction (pyVHR) ---
        # Shape to [estimators=1, channels=3, frames=T]
        X = np.transpose(sig[np.newaxis, :, :], (0, 2, 1)).astype(np.float32)

        try:
            bvp = cpu_POS(X, fps=float(fps)).squeeze().astype(np.float32)
        except Exception:
            # Fallback CHROM
            bvp = cpu_CHROM(X).squeeze().astype(np.float32)

        if bvp.ndim != 1 or bvp.size < int(max(3, winsize) * fps):
            base_result["message"] = "Sinal BVP insuficiente."
            return base_result

        # Optional bandpass on BVP (stabilizes Welch)
        bvp_f = _bandpass_bvp(bvp, fps=float(fps), min_hz=0.65, max_hz=4.0, order=4)

        # --- BPM series by Welch over windows ---
        bpm_series = _estimate_bpm_series(bvp_f, fps=float(fps), winsize=winsize, stride=stride)
        if len(bpm_series) == 0:
            base_result["message"] = "Não foi possível estimar BPM com estabilidade."
            return base_result

        bpm_med = float(np.median(bpm_series))
        mad_bpm = float(median_abs_deviation(np.array(bpm_series), scale=1.0, nan_policy="omit"))

        # --- SNR (PSD/Welch) ---
        # Compute global PSD for SNR around peak
        nperseg = min(256, bvp_f.size)
        noverlap = int(0.8 * nperseg)
        freqs, psd = welch(bvp_f, fs=float(fps), nperseg=nperseg, noverlap=noverlap, nfft=2048)
        f_peak_hz = bpm_med / 60.0
        snr_db, snr_score = _snr_from_psd(freqs, psd, f_peak_hz=f_peak_hz)

        base_result["snr_score"] = float(snr_score)

        # Gating: snr
        if snr_score < 0.3:
            base_result["message"] = "Sinal com baixa qualidade (SNR baixo). Repita em melhor iluminação e com menos movimento."
            return base_result

        # --- Confidence + quality ---
        # Stability score: MAD <= 10 bpm -> [1..0]
        stability_score = float(max(0.0, min(1.0, 1.0 - (mad_bpm / 10.0))))
        confidence = float(max(0.0, min(1.0, 0.6 * snr_score + 0.4 * stability_score)))

        quality = _quality_from_confidence_and_mad(confidence=confidence, mad_bpm=mad_bpm)

        msg = None
        if quality == "poor":
            msg = "Qualidade baixa. Repita com melhor iluminação e menos movimento."

        return {
            "bpm": float(bpm_med),
            "confidence": confidence,
            "quality": quality,
            "snr_score": float(snr_score),
            "face_detect_rate": float(face_detect_rate),
            "bpm_series": [float(x) for x in bpm_series],
            "message": msg,
            # Note: snr_db and other audit fields are handled elsewhere in the backend result schema.
            # We keep the adapter output limited to the requested keys.
        }

    except Exception as e:
        # Defensive: never raise
        base_result["message"] = f"Falha no processamento rPPG: {type(e).__name__}"
        return base_result
