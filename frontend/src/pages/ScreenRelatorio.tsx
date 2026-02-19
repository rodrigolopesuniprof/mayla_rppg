import React, { useMemo, useState } from 'react';
import AppBar from '../components/AppBar';
import { Bell } from 'lucide-react';
import { labelBpm, labelHrv, labelPrq, labelRr, labelStress } from '../utils/labels';
import { maylaPostVitalSigns } from '../utils/maylaApi';

const STORAGE_KEY = 'mayla:lastResult';

type SessionResult = {
  bpm: number | null;
  confidence: number;
  quality: 'good' | 'medium' | 'poor';
  message?: string;
  duration_s: number;
  frames_received: number;
  face_detect_rate: number;
  snr_db: number | null;
  bpm_series?: number[];

  rr_bpm?: number | null;
  prq?: number | null;
  hrv_sdnn_ms?: number | null;
  stress_level?: number | null;
};

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null || !Number.isFinite(n)) return '—';
  const p = Math.pow(10, digits);
  const v = digits ? Math.round(n * p) / p : Math.round(n);
  return digits ? v.toFixed(digits) : String(v);
}

function VitalBox({
  icon,
  title,
  value,
  unit,
  badge,
  badgeColor,
  barGradient,
  marker,
  hint,
}: {
  icon: string;
  title: string;
  value: string;
  unit?: string;
  badge?: string;
  badgeColor?: { bg: string; text: string };
  barGradient?: string;
  marker?: number | null;
  hint?: string;
}) {
  return (
    <div className="bg-card rounded-[18px] p-4 relative shadow-[0_2px_8px_rgba(0,0,0,.05)]">
      <span className="text-base mb-2 block">{icon}</span>
      <div className="font-display text-[28px] font-bold text-ink leading-none">
        {value}
        {unit ? <span className="text-[11px] text-muted-foreground ml-0.5">{unit}</span> : null}
      </div>
      <div className="text-[10.5px] text-muted-foreground uppercase tracking-wider mt-1">{title}</div>

      {barGradient ? (
        <div className="h-[4px] rounded-full bg-sand mt-2.5 overflow-hidden relative">
          <div className="absolute inset-0" style={{ background: barGradient }} />
          {marker != null ? (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full border-2 border-white shadow"
              style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%`, background: 'rgba(17,24,39,.85)' }}
            />
          ) : null}
        </div>
      ) : null}

      {badge && badgeColor ? (
        <div
          className="absolute top-3 right-3 text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded-lg"
          style={{ background: badgeColor.bg, color: badgeColor.text }}
        >
          {badge}
        </div>
      ) : null}

      {hint ? <p className="text-xs text-bark leading-snug mt-2">{hint}</p> : null}
    </div>
  );
}

export default function ScreenRelatorio() {
  const today = new Date();
  const dateStr = today
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase();
  const timeStr = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const result: SessionResult | null = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const bpmL = labelBpm(result?.bpm);
  const rrL = labelRr(result?.rr_bpm);
  const prqL = labelPrq(result?.prq);
  const hrvL = labelHrv(result?.hrv_sdnn_ms);
  const stressL = labelStress(result?.stress_level);

  const labelStyle = (l: typeof bpmL) => {
    if (!l) return null;
    if (l.label === 'Bom') return { bg: 'rgba(76,175,125,.10)', text: 'hsl(var(--green))' };
    if (l.label === 'Normal') return { bg: 'rgba(100,116,139,.12)', text: '#475569' };
    return { bg: 'rgba(245,158,11,.14)', text: 'hsl(var(--amber))' };
  };

  const gradRisk = 'linear-gradient(90deg, #16A34A 0%, #F59E0B 55%, #EF4444 100%)';
  const gradHrv = 'linear-gradient(90deg, #EF4444 0%, #16A34A 100%)';
  const gradStress = 'linear-gradient(90deg, #16A34A 0%, #EF4444 100%)';

  const [sendStatus, setSendStatus] = useState<null | 'idle' | 'sending' | 'ok' | 'error'>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  async function handleSendToMayla() {
    // Token must come from the container app (WebView) or a login screen.
    // For now, read from sessionStorage (integration layer will set this).
    const token = sessionStorage.getItem('mayla:token') || '';
    const cpf = sessionStorage.getItem('mayla:cpf') || '';

    if (!token) {
      setSendStatus('error');
      setSendError('Token Mayla ausente (mayla:token).');
      return;
    }
    if (!cpf) {
      setSendStatus('error');
      setSendError('CPF ausente (mayla:cpf).');
      return;
    }
    if (!result) {
      setSendStatus('error');
      setSendError('Sem resultado para enviar.');
      return;
    }

    setSendStatus('sending');
    setSendError(null);

    const payload = {
      cpf,
      timestamp: new Date().toISOString(),
      source: 'webapp-rppg',
      metrics: {
        bpm: result.bpm,
        rr_bpm: result.rr_bpm,
        prq: result.prq,
        hrv_sdnn_ms: result.hrv_sdnn_ms,
        stress_level: result.stress_level,
        snr_db: result.snr_db,
        quality: result.quality,
        face_detect_rate: result.face_detect_rate,
        duration_s: result.duration_s,
        frames: result.frames_received,
      },
    };

    try {
      await maylaPostVitalSigns(token, payload);
      setSendStatus('ok');
    } catch (e: any) {
      setSendStatus('error');
      setSendError(e?.message ?? 'Falha ao enviar');
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[420px] mx-auto flex flex-col min-h-screen">
        <AppBar
          showBack
          rightIcon={
            <button className="w-9 h-9 rounded-full bg-sand flex items-center justify-center">
              <Bell size={16} className="text-bark" />
            </button>
          }
        />

        <div className="flex-1 overflow-y-auto px-5 pb-7">
          <p className="text-[11px] text-muted-foreground tracking-wider uppercase mb-1.5">
            {dateStr} · {timeStr}
          </p>
          <h2 className="font-display text-[22px] font-medium text-ink leading-tight mb-5">
            Seus <em className="text-rose italic">sinais</em>
            <br />vitais de hoje
          </h2>

          <div
            className="rounded-[22px] p-5 text-primary-foreground flex items-center gap-4 mb-3.5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(var(--rose)), #C0392B)' }}
          >
            <div
              className="absolute -top-8 -right-5 w-28 h-28 rounded-full"
              style={{ background: 'rgba(255,255,255,.08)' }}
            />
            <span className="text-3xl">❤️</span>
            <div>
              <div className="font-display text-[42px] font-bold leading-none tracking-tight">
                {fmt(result?.bpm)}
                <span className="text-sm opacity-75 ml-0.5">bpm</span>
              </div>
              <div className="text-xs opacity-75 tracking-wider uppercase mt-1">FREQUÊNCIA CARDÍACA</div>
            </div>
            <div
              className="ml-auto rounded-[20px] px-2.5 py-1 text-[11px] font-semibold tracking-wider"
              style={{ background: bpmL ? 'rgba(255,255,255,.20)' : 'rgba(255,255,255,.12)' }}
            >
              {bpmL?.label ?? '—'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-3.5">
            <VitalBox
              icon="💚"
              title="FREQ. RESPIRATÓRIA"
              value={fmt(result?.rr_bpm)}
              unit="brpm"
              badge={rrL?.label}
              badgeColor={labelStyle(rrL) ?? undefined}
              barGradient={gradRisk}
              marker={rrL?.marker ?? null}
            />

            <VitalBox
              icon="💛"
              title="RAZÃO P-R-Q"
              value={fmt(result?.prq, 1)}
              unit="PRQ"
              badge={prqL?.label}
              badgeColor={labelStyle(prqL) ?? undefined}
              barGradient={gradRisk}
              marker={prqL?.marker ?? null}
              hint={prqL?.hint}
            />
          </div>

          <VitalBox
            icon="⚡"
            title="HRV-SDNN · VARIABILIDADE"
            value={fmt(result?.hrv_sdnn_ms)}
            unit="ms"
            badge={hrvL?.label}
            badgeColor={labelStyle(hrvL) ?? undefined}
            barGradient={gradHrv}
            marker={hrvL?.marker ?? null}
          />

          <div className="mt-3.5">
            <VitalBox
              icon="🙏"
              title="NÍVEL DE ESTRESSE"
              value={fmt(result?.stress_level)}
              unit="/30"
              badge={stressL?.label}
              badgeColor={labelStyle(stressL) ?? undefined}
              barGradient={gradStress}
              marker={stressL?.marker ?? null}
            />
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <button
              className="w-full py-3 rounded-[18px] bg-sand text-bark font-body text-[14px] font-medium"
              onClick={handleSendToMayla}
              disabled={sendStatus === 'sending'}
            >
              {sendStatus === 'sending' ? 'Enviando…' : 'Enviar para Mayla Saúde'}
            </button>
            {sendStatus === 'ok' ? (
              <small className="text-xs text-mayla-green">Enviado com sucesso.</small>
            ) : sendStatus === 'error' ? (
              <small className="text-xs text-rose">Falha no envio: {sendError}</small>
            ) : null}
            <small className="text-xs text-muted-foreground">
              Integração: o token deve ser fornecido pelo app container (sessionStorage: mayla:token) e o CPF em
              sessionStorage: mayla:cpf.
            </small>
          </div>

          <div className="mt-5 bg-card rounded-[18px] p-4 shadow-[0_2px_8px_rgba(0,0,0,.05)]">
            <div className="text-[11px] text-muted-foreground tracking-wider uppercase mb-2">Qualidade</div>
            {!result ? (
              <p className="text-sm text-bark">Sem resultado ainda. Faça uma medição para ver seu relatório.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-[12px] text-bark">
                <div className="bg-sand rounded-xl px-3 py-2">
                  quality: <b className="text-ink">{result.quality}</b>
                </div>
                <div className="bg-sand rounded-xl px-3 py-2">
                  snr_db: <b className="text-ink">{result.snr_db == null ? '—' : result.snr_db.toFixed(1)}</b>
                </div>
                <div className="bg-sand rounded-xl px-3 py-2">
                  face_detect_rate: <b className="text-ink">{result.face_detect_rate?.toFixed?.(2) ?? '—'}</b>
                </div>
                <div className="bg-sand rounded-xl px-3 py-2">
                  duração: <b className="text-ink">{result.duration_s?.toFixed?.(1) ?? '—'}s</b>
                </div>
                <div className="bg-sand rounded-xl px-3 py-2">
                  frames: <b className="text-ink">{result.frames_received ?? '—'}</b>
                </div>
                <div className="bg-sand rounded-xl px-3 py-2">
                  confidence: <b className="text-ink">{result.confidence?.toFixed?.(2) ?? '—'}</b>
                </div>
              </div>
            )}

            {result?.message ? <p className="text-xs text-bark mt-3">{result.message}</p> : null}
            {result?.quality === 'poor' ? (
              <p className="text-xs text-bark mt-2">Sugestão: repita em melhor iluminação e com menos movimento.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
