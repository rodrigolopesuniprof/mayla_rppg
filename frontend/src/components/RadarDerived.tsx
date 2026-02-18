import React, { useMemo } from 'react';

type Props = {
  values: {
    relaxation: number;
    activity: number;
    sleep: number;
    immunity: number;
    metabolism: number;
    health: number;
  };
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function RadarDerived({ values }: Props) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 86;

  const axes = useMemo(
    () => [
      { k: 'activity', label: 'Atividade' },
      { k: 'sleep', label: 'Sono' },
      { k: 'immunity', label: 'Imunidade' },
      { k: 'metabolism', label: 'Metabolismo' },
      { k: 'health', label: 'Saúde' },
      { k: 'relaxation', label: 'Relaxamento' },
    ] as const,
    [],
  );

  const pts = axes.map((a, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const v = clamp((values as any)[a.k] ?? 0, 0, 100) / 100;
    const x = cx + Math.cos(angle) * r * v;
    const y = cy + Math.sin(angle) * r * v;
    return { x, y, angle, label: a.label };
  });

  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="card">
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Valores derivados</div>
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="radar">
          {/* rings */}
          {rings.map((t) => (
            <circle
              key={t}
              cx={cx}
              cy={cy}
              r={r * t}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={1}
            />
          ))}

          {/* axes */}
          {pts.map((p, i) => (
            <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(p.angle) * r} y2={cy + Math.sin(p.angle) * r} stroke="#e5e7eb" />
          ))}

          {/* polygon */}
          <polygon points={poly} fill="rgba(16,185,129,0.25)" stroke="#10b981" strokeWidth={2} />

          {/* labels */}
          {pts.map((p, i) => {
            const lx = cx + Math.cos(p.angle) * (r + 20);
            const ly = cy + Math.sin(p.angle) * (r + 20);
            const anchor = Math.abs(Math.cos(p.angle)) < 0.2 ? 'middle' : Math.cos(p.angle) > 0 ? 'start' : 'end';
            return (
              <text
                key={i}
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={11}
                fill="#6b7280"
              >
                {p.label}
              </text>
            );
          })}
        </svg>
      </div>
      <div style={{ marginTop: 8 }}>
        <small className="muted">Valores indicativos (não clínicos) para apoiar a experiência de leitura.</small>
      </div>
    </div>
  );
}
