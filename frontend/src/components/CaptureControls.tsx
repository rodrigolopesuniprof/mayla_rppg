import React from 'react';

export type CaptureControlsProps = {
  isCapturing: boolean;
  secondsElapsed: number;
  captureSeconds: number;
  faceDetected?: boolean;
  lightingOk?: boolean;
  lastAckChunkSeq?: number;
  chunksSent?: number;
  framesSent?: number;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
};

function formatTime(s: number) {
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function CaptureControls(props: CaptureControlsProps) {
  const {
    isCapturing,
    secondsElapsed,
    captureSeconds,
    faceDetected,
    lightingOk,
    lastAckChunkSeq,
    chunksSent,
    framesSent,
    onStart,
    onStop,
    onRestart,
  } = props;

  const pct = Math.max(0, Math.min(1, secondsElapsed / Math.max(1, captureSeconds))) * 100;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Tempo</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{formatTime(secondsElapsed)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Meta</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{captureSeconds}s</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="progress" aria-label="progresso">
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <span className="badge">Face: {faceDetected ? 'detectada' : 'não detectada'}</span>
        <span className="badge">Iluminação: {lightingOk ? 'OK' : 'ruim'}</span>
        <span className="badge">Ack chunk: {lastAckChunkSeq ?? '-'}</span>
        <span className="badge">Chunks enviados: {chunksSent ?? 0}</span>
        <span className="badge">Frames enviados: {framesSent ?? 0}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        {!isCapturing ? (
          <button className="btn primary" onClick={onStart}>
            Iniciar Medição
          </button>
        ) : (
          <button className="btn danger" onClick={onStop}>
            Parar
          </button>
        )}
        <button className="btn" onClick={onRestart}>
          Recomeçar
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <small className="muted">
          Durante a captura, mantenha o rosto estável e com luz frontal.
        </small>
      </div>
    </div>
  );
}
