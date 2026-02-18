import React from 'react';

export type SessionResult = {
  bpm: number | null;
  confidence: number;
  quality: 'good' | 'medium' | 'poor';
  message?: string;
  duration_s: number;
  frames_received: number;
  face_detect_rate: number;
  snr_db: number | null;
  bpm_series?: number[];
};

export default function ResultCard({ result }: { result: SessionResult | null }) {
  if (!result) {
    return (
      <div className="card">
        <div style={{ fontWeight: 800 }}>Resultado</div>
        <div style={{ marginTop: 10 }}>
          <small className="muted">Nenhuma medição ainda.</small>
        </div>
      </div>
    );
  }

  const qualityColor =
    result.quality === 'good' ? '#065f46' : result.quality === 'medium' ? '#92400e' : '#991b1b';

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 800 }}>Resultado</div>
        <span className="badge" style={{ borderColor: qualityColor, color: qualityColor }}>
          quality: {result.quality}
        </span>
      </div>

      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>BPM</div>
          <div style={{ fontSize: 32, fontWeight: 900 }}>
            {result.bpm == null ? '—' : Math.round(result.bpm)}
          </div>
        </div>
        <div className="row">
          <div className="badge">confidence: {result.confidence.toFixed(2)}</div>
          <div className="badge">duração: {result.duration_s.toFixed(1)}s</div>
          <div className="badge">frames: {result.frames_received}</div>
          <div className="badge">face_detect_rate: {result.face_detect_rate.toFixed(2)}</div>
          <div className="badge">snr_db: {result.snr_db == null ? '—' : result.snr_db.toFixed(1)}</div>
        </div>

        {result.message ? (
          <div className="error" style={{ marginTop: 6 }}>
            {result.message}
          </div>
        ) : null}

        {result.quality === 'poor' ? (
          <div style={{ marginTop: 6 }}>
            <small className="muted">
              Sugestão: repita em melhor iluminação e com menos movimento.
            </small>
          </div>
        ) : null}
      </div>
    </div>
  );
}
