import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppBar from '../components/AppBar';
import { useSessionParams } from '../hooks/useSessionParams';
import { useWebcam } from '../hooks/useWebcam';
import { useRppgSession } from '../hooks/useRppgSession';
import { parseResolution } from '../utils/image';

const STORAGE_KEY = 'mayla:lastResult';

export default function ScreenCamera() {
  const navigate = useNavigate();

  const { params, startSession } = useSessionParams();

  const effectiveParams = useMemo(() => {
    return (
      params ?? {
        session_id: '',
        capture_seconds: 25,
        target_fps: 8,
        resolution: '640x360',
        jpeg_quality: 0.5,
        roi_refresh_interval: 3,
        ttl_sec: 180,
        max_frames: 400,
        max_bytes_mb: 20,
        max_chunk_size: 10,
        mock_mode: true,
      }
    );
  }, [params]);

  const res = useMemo(() => parseResolution(effectiveParams.resolution), [effectiveParams.resolution]);
  const webcam = useWebcam({ width: res.width, height: res.height });

  const [seconds, setSeconds] = useState<number>(effectiveParams.capture_seconds ?? 25);

  const rppg = useRppgSession({
    sessionId: effectiveParams.session_id,
    captureSeconds: effectiveParams.capture_seconds,
    targetFps: effectiveParams.target_fps,
    width: res.width,
    height: res.height,
    jpegQuality: effectiveParams.jpeg_quality,
    maxChunkSize: effectiveParams.max_chunk_size,
    videoRef: webcam.videoRef,
    workCanvas: webcam.workCanvas,
    onResult: (r) => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(r));
      } catch {
        // ignore
      }
      navigate('/relatorio');
    },
    onFaceDetected: () => {
      // optional
    },
  });

  // Start camera + session + capture on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await startSession(true);
        if (cancelled) return;

        setSeconds(p.capture_seconds ?? 25);

        await webcam.start();
        if (cancelled) return;

        await new Promise((r) => setTimeout(r, 150));
        if (cancelled) return;

        await rppg.start(p.session_id);
      } catch {
        // errors are surfaced below
      }
    })();

    return () => {
      cancelled = true;
      try {
        rppg.stop();
      } catch {
        // ignore
      }
      try {
        webcam.stop();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local timer just for the UI ring.
  useEffect(() => {
    if (!rppg.isCapturing) return;
    const startedAt = Date.now() - rppg.secondsElapsed * 1000;
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, effectiveParams.capture_seconds - elapsed);
      setSeconds(remaining);
    }, 250);
    return () => window.clearInterval(id);
  }, [effectiveParams.capture_seconds, rppg.isCapturing, rppg.secondsElapsed]);

  const progress = ((effectiveParams.capture_seconds - seconds) / Math.max(1, effectiveParams.capture_seconds)) * 100;
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const globalError = webcam.error || rppg.error;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#0F0B09' }}>
      <AppBar showBack dark />

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, #2a1e1a 0%, #0a0806 100%)' }}
        />

        {/* Camera */}
        <video
          ref={webcam.videoRef as any}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />

        {/* Face oval */}
        <div
          className="relative z-[2] w-[180px] h-[220px] rounded-full border-2 flex items-center justify-center"
          style={{
            borderColor: 'rgba(232,87,74,.7)',
            animation: 'pulse-border 2s ease-in-out infinite',
          }}
        >
          <div className="absolute -top-px -left-px w-6 h-6 border-rose border-t-[3px] border-l-[3px] rounded-tl" />
          <div className="absolute -top-px -right-px w-6 h-6 border-rose border-t-[3px] border-r-[3px] rounded-tr" />
          <div className="absolute -bottom-px -left-px w-6 h-6 border-rose border-b-[3px] border-l-[3px] rounded-bl" />
          <div className="absolute -bottom-px -right-px w-6 h-6 border-rose border-b-[3px] border-r-[3px] rounded-br" />

          <div
            className="absolute w-[140px] h-[1.5px] z-[3]"
            style={{
              background: 'linear-gradient(to right, transparent, hsl(var(--rose-lt)), transparent)',
              animation: 'scan 2.5s ease-in-out infinite',
            }}
          />
        </div>

        <p className="absolute bottom-6 left-0 right-0 text-center text-white/60 text-xs tracking-wide z-[4]">
          Mantenha o rosto enquadrado e imóvel
        </p>

        {globalError ? (
          <div className="absolute top-24 left-5 right-5 z-[5] bg-white/10 border border-white/20 text-white rounded-2xl p-3 text-sm">
            {globalError}
          </div>
        ) : null}
      </div>

      <div
        className="relative z-10 px-6 pt-4 pb-7"
        style={{ background: 'linear-gradient(to top, rgba(10,8,6,.98), transparent)' }}
      >
        <div className="flex justify-center mb-4">
          <div className="relative w-[68px] h-[68px]">
            <svg width="68" height="68" className="-rotate-90">
              <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="4" />
              <circle
                cx="34"
                cy="34"
                r="28"
                fill="none"
                stroke="hsl(var(--rose))"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold text-white">
              {seconds}s
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-5">
          <div className="text-center">
            <div className="font-display text-[22px] text-white font-medium">
              —<span className="text-sm text-white/60">bpm</span>
            </div>
            <div className="text-[10px] text-white/45 tracking-wider uppercase mt-0.5 flex items-center gap-1">
              ❤️ BPM
            </div>
          </div>
          <div className="w-px bg-white/10 self-stretch" />
          <div className="text-center">
            <div className="font-display text-[22px] text-white font-medium">
              —<span className="text-sm text-white/60">brpm</span>
            </div>
            <div className="text-[10px] text-white/45 tracking-wider uppercase mt-0.5 flex items-center gap-1">
              🫁 RR
            </div>
          </div>
          <div className="w-px bg-white/10 self-stretch" />
          <div className="text-center">
            <div className="font-display text-[22px] text-white font-medium">—</div>
            <div className="text-[10px] text-white/45 tracking-wider uppercase mt-0.5 flex items-center gap-1">
              💜 HRV
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-center">
          <button
            className="px-4 py-2 rounded-2xl bg-white/10 text-white/90 border border-white/15 text-sm"
            onClick={() => {
              rppg.stop();
              webcam.stop();
              navigate('/');
            }}
          >
            Parar
          </button>
        </div>
      </div>
    </div>
  );
}
