import React, { useMemo, useState } from 'react';
import ConsentModal from '../components/ConsentModal';
import CaptureControls from '../components/CaptureControls';
import VideoPreview from '../components/VideoPreview';
import ResultCard, { SessionResult } from '../components/ResultCard';
import { useSessionParams } from '../hooks/useSessionParams';
import { useWebcam } from '../hooks/useWebcam';
import { parseResolution } from '../utils/image';
import { useRppgSession } from '../hooks/useRppgSession';

export default function App() {
  const [consentOpen, setConsentOpen] = useState(true);
  const [consented, setConsented] = useState(false);

  const { params, error: paramsError, loading: paramsLoading, startSession, clear: clearParams } =
    useSessionParams();

  const [result, setResult] = useState<SessionResult | null>(null);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);

  const effectiveParams = useMemo(() => {
    // Default if not started yet.
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
      setResult(r as any);
    },
    onFaceDetected: setFaceDetected,
  });

  const globalError = paramsError || webcam.error || rppg.error;

  async function handleStart() {
    setResult(null);

    if (!consented) {
      setConsentOpen(true);
      return;
    }

    try {
      const p = await startSession(true);
      await webcam.start();
      await new Promise((r) => setTimeout(r, 150));
      // Important: pass the freshly returned session_id to avoid React state timing issues
      await rppg.start(p.session_id);
    } catch {
      // errors are already set
    }
  }

  function handleStop() {
    rppg.stop();
    webcam.stop();
  }

  function handleRestart() {
    handleStop();
    rppg.reset();
    clearParams();
    setResult(null);
    setFaceDetected(false);
  }

  return (
    <div className="container">
      <h1 style={{ marginTop: 0 }}>mayla-rppg-web (MVP)</h1>
      <p style={{ marginTop: 6, color: '#6b7280' }}>
        Build atual: <b>{effectiveParams.mock_mode ? 'Build 1 (Mock)' : 'Build 2 (Real)'}</b>
      </p>

      {globalError ? (
        <div className="error" style={{ marginBottom: 12 }}>
          {globalError}
        </div>
      ) : null}

      <div className="row">
        <div style={{ flex: 1, minWidth: 320 }}>
          <CaptureControls
            isCapturing={rppg.isCapturing}
            secondsElapsed={rppg.secondsElapsed}
            captureSeconds={effectiveParams.capture_seconds}
            faceDetected={faceDetected}
            lightingOk={webcam.lightingOk}
            lastAckChunkSeq={rppg.lastAckChunkSeq ?? undefined}
            chunksSent={rppg.chunksSent}
            framesSent={rppg.framesSent}
            onStart={handleStart}
            onStop={handleStop}
            onRestart={handleRestart}
          />

          <div style={{ marginTop: 16 }}>
            <ResultCard result={result} />
          </div>
        </div>

        <div style={{ flex: 1.2, minWidth: 320 }}>
          <VideoPreview videoRef={webcam.videoRef} width={res.width} height={res.height} />
          <div style={{ marginTop: 12 }} className="card">
            <div style={{ fontWeight: 800 }}>Sessão</div>
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              <div className="badge">target_fps: {effectiveParams.target_fps}</div>
              <div className="badge">jpeg_quality: {effectiveParams.jpeg_quality}</div>
              <div className="badge">max_chunk_size: {effectiveParams.max_chunk_size}</div>
              <div className="badge">ttl_sec: {effectiveParams.ttl_sec}</div>
              <div className="badge">max_frames: {effectiveParams.max_frames}</div>
              <div className="badge">max_bytes_mb: {effectiveParams.max_bytes_mb}</div>
            </div>
            {paramsLoading ? (
              <div style={{ marginTop: 10 }}>
                <small className="muted">Iniciando sessão…</small>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ConsentModal
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        onAccept={() => {
          setConsented(true);
          setConsentOpen(false);
        }}
      />

      <div style={{ marginTop: 18 }}>
        <small className="muted">
          Privacidade: não armazenamos vídeo. A captura envia frames temporários para processamento.
        </small>
      </div>
    </div>
  );
}