import React, { useMemo } from 'react';

export type VitalCardProps = {
  title: string;
  value: string;
  unit?: string;
  icon?: React.ReactNode;
  helpHref?: string;
  severity?: 'good' | 'medium' | 'poor';
  // 0..1 marker position
  marker?: number | null;
  gradient?: 'risk' | 'good';
  compact?: boolean;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function severityColor(sev: VitalCardProps['severity']) {
  if (sev === 'good') return '#16a34a';
  if (sev === 'medium') return '#f59e0b';
  return '#ef4444';
}

export default function VitalCard({
  title,
  value,
  unit,
  icon,
  helpHref,
  severity = 'good',
  marker = null,
  gradient = 'risk',
  compact,
}: VitalCardProps) {
  const markerPct = useMemo(() => {
    if (marker == null || Number.isNaN(marker)) return null;
    return clamp(marker, 0, 1) * 100;
  }, [marker]);

  const bar = gradient === 'good' ? 'var(--bar-good)' : 'var(--bar-risk)';

  return (
    <div className={compact ? 'vitalCard compact' : 'vitalCard'}>
      <div className="vitalHeader">
        <div className="vitalTitle">
          {icon ? <span className="vitalIcon">{icon}</span> : null}
          <span>{title}</span>
        </div>
        {helpHref ? (
          <a className="vitalHelp" href={helpHref} target="_blank" rel="noreferrer">
            Saiba mais
          </a>
        ) : null}
      </div>

      <div className="vitalBody">
        <div className="vitalValue">
          <span className="vitalNumber">{value}</span>
          {unit ? <span className="vitalUnit">{unit}</span> : null}
        </div>
      </div>

      <div className="vitalBar" style={{ backgroundImage: bar }} aria-label="faixa de referência">
        {markerPct != null ? (
          <div
            className="vitalMarker"
            style={{ left: `${markerPct}%`, borderTopColor: severityColor(severity) }}
          />
        ) : null}
      </div>
    </div>
  );
}
