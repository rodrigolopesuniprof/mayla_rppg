import React, { useMemo } from 'react';
import type { SessionResult } from './ResultCard';
import VitalCard from './VitalCard';
import RadarDerived from './RadarDerived';
import { vitalsFromSessionResult } from '../utils/vitals';

function fmt(n: number | null, digits = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  const m = digits === 0 ? Math.round(n) : Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);
  return String(m);
}

function markerFromRange(v: number | null, min: number, max: number) {
  if (v == null || !Number.isFinite(v)) return null;
  const t = (v - min) / (max - min);
  return Math.max(0, Math.min(1, t));
}

export default function ResultsVitals({
  result,
  mockMode,
}: {
  result: SessionResult | null;
  mockMode: boolean;
}) {
  const vitals = useMemo(() => {
    return vitalsFromSessionResult({
      bpm: result?.bpm ?? null,
      confidence: result?.confidence ?? 0,
      snrDb: result?.snr_db ?? null,
      mockMode,
    });
  }, [mockMode, result?.bpm, result?.confidence, result?.snr_db]);

  if (!result) {
    return (
      <div className="card">
        <div style={{ fontWeight: 800 }}>Resultados da medição</div>
        <div style={{ marginTop: 10 }}>
          <small className="muted">Faça uma medição para ver seus valores.</small>
        </div>
      </div>
    );
  }

  const quality = result.quality;

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div>
            <div style={{ fontWeight: 900 }}>Resultados da medição</div>
            <div style={{ marginTop: 4 }}>
              <small className="muted">
                Duração: {result.duration_s.toFixed(1)}s · Frames: {result.frames_received}
              </small>
            </div>
          </div>
          <span className="badge">qualidade: {quality}</span>
        </div>
        {result.message ? (
          <div style={{ marginTop: 10 }} className={quality === 'poor' ? 'error' : undefined}>
            <small className="muted">{result.message}</small>
          </div>
        ) : null}
      </div>

      <div className="vitalsSectionTitle">Sinais vitais</div>
      <div className="vitalsList">
        <VitalCard
          title="Heart Rate"
          value={fmt(vitals.heartRateBpm)}
          unit="bpm"
          icon={<span style={{ color: '#ef4444' }}>♥</span>}
          severity={quality}
          marker={markerFromRange(vitals.heartRateBpm, 45, 140)}
          helpHref="#"
        />
        <VitalCard
          title="Breathing Rate"
          value={fmt(vitals.breathingRateBrpm)}
          unit="brpm"
          icon={<span style={{ color: '#16a34a' }}>❦</span>}
          severity={quality}
          marker={markerFromRange(vitals.breathingRateBrpm, 8, 24)}
          helpHref="#"
        />
        <VitalCard
          title="PRQ"
          value={fmt(vitals.prq, 1)}
          unit=""
          icon={<span style={{ color: '#16a34a' }}>⌁</span>}
          severity={quality}
          marker={markerFromRange(vitals.prq, 2.5, 10)}
          helpHref="#"
        />
      </div>

      <div className="vitalsSectionTitle">Sangue</div>
      <div className="vitalsList">
        <VitalCard
          title="Oxygen Saturation"
          value={fmt(vitals.spo2Pct)}
          unit="%"
          icon={<span style={{ color: '#3b82f6' }}>💧</span>}
          severity={mockMode ? 'good' : 'poor'}
          marker={markerFromRange(vitals.spo2Pct, 90, 100)}
          gradient="good"
          helpHref="#"
        />
        <VitalCard
          title="Blood Pressure"
          value={
            vitals.systolicMmHg == null || vitals.diastolicMmHg == null
              ? '—'
              : `${Math.round(vitals.systolicMmHg)}/${Math.round(vitals.diastolicMmHg)}`
          }
          unit=""
          icon={<span style={{ color: '#ef4444' }}>滴</span>}
          severity={mockMode ? 'good' : 'poor'}
          marker={markerFromRange(vitals.systolicMmHg, 90, 150)}
          helpHref="#"
        />
        {!mockMode ? (
          <div style={{ marginTop: 2 }}>
            <small className="muted">
              Observação: SpO₂ e pressão arterial aparecem apenas no modo simulado (mock) nesta versão.
            </small>
          </div>
        ) : null}
      </div>

      <div className="vitalsSectionTitle">Nível de estresse</div>
      <div className="vitalsList">
        <VitalCard
          title="Stress Level"
          value={fmt(vitals.stressLevel)}
          unit=""
          icon={<span>☺</span>}
          severity={quality}
          marker={markerFromRange(vitals.stressLevel, 1, 30)}
          gradient="good"
          helpHref="#"
        />
      </div>

      <div className="vitalsSectionTitle">Variabilidade da frequência cardíaca</div>
      <div className="vitalsList">
        <VitalCard
          title="HRV-SDNN"
          value={fmt(vitals.hrvSdnnMs)}
          unit="ms"
          icon={<span style={{ color: '#16a34a' }}>↟</span>}
          severity={quality}
          marker={markerFromRange(vitals.hrvSdnnMs, 20, 120)}
          gradient="good"
          helpHref="#"
        />
      </div>

      {vitals.derived ? (
        <div style={{ marginTop: 12 }}>
          <RadarDerived values={vitals.derived} />
        </div>
      ) : null}
    </div>
  );
}
