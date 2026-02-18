export type LabelLevel = 'Bom' | 'Normal' | 'Atenção';

export type MetricLabel = {
  label: LabelLevel;
  color: string;
  marker: number; // 0..1
  hint?: string;
};

const COLORS = {
  good: '#16A34A',
  normal: '#64748B',
  attention: '#F59E0B',
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function markerFromRange(v: number, min: number, max: number) {
  return clamp((v - min) / (max - min), 0, 1);
}

export function labelBpm(bpm: number | null | undefined): MetricLabel | null {
  if (bpm == null || !Number.isFinite(bpm)) return null;

  let label: LabelLevel;
  if (bpm < 55 || bpm > 100) label = 'Atenção';
  else if ((bpm >= 55 && bpm <= 59) || (bpm >= 91 && bpm <= 100)) label = 'Normal';
  else label = 'Bom'; // 60..90

  const color = label === 'Bom' ? COLORS.good : label === 'Normal' ? COLORS.normal : COLORS.attention;

  return { label, color, marker: markerFromRange(bpm, 40, 140) };
}

export function labelRr(rr: number | null | undefined): MetricLabel | null {
  if (rr == null || !Number.isFinite(rr)) return null;

  let label: LabelLevel;
  if (rr < 8 || rr > 20) label = 'Atenção';
  else if ((rr >= 8 && rr <= 11) || (rr >= 19 && rr <= 20)) label = 'Normal';
  else label = 'Bom'; // 12..18

  const color = label === 'Bom' ? COLORS.good : label === 'Normal' ? COLORS.normal : COLORS.attention;

  return { label, color, marker: markerFromRange(rr, 6, 26) };
}

export function labelPrq(prq: number | null | undefined): MetricLabel | null {
  if (prq == null || !Number.isFinite(prq)) return null;

  let label: LabelLevel;
  if (prq < 3 || prq > 7) label = 'Atenção';
  else if ((prq >= 3 && prq <= 3.4) || (prq >= 5.6 && prq <= 7)) label = 'Normal';
  else label = 'Bom'; // 3.5..5.5

  const color = label === 'Bom' ? COLORS.good : label === 'Normal' ? COLORS.normal : COLORS.attention;

  const marker = markerFromRange(clamp(prq, 2, 10), 2, 10);
  const hint = prq > 10 ? 'Certifique-se de estar em repouso e com a câmera estável.' : undefined;

  return { label, color, marker, hint };
}

export function labelHrv(sdnnMs: number | null | undefined): MetricLabel | null {
  if (sdnnMs == null || !Number.isFinite(sdnnMs)) return null;

  let label: LabelLevel;
  if (sdnnMs < 30) label = 'Atenção';
  else if (sdnnMs >= 30 && sdnnMs <= 49) label = 'Normal';
  else label = 'Bom'; // >= 50

  const color = label === 'Bom' ? COLORS.good : label === 'Normal' ? COLORS.normal : COLORS.attention;

  return { label, color, marker: markerFromRange(sdnnMs, 20, 120) };
}

export function labelStress(stress: number | null | undefined): MetricLabel | null {
  if (stress == null || !Number.isFinite(stress)) return null;

  let label: LabelLevel;
  if (stress >= 21) label = 'Atenção';
  else if (stress >= 11 && stress <= 20) label = 'Normal';
  else label = 'Bom'; // 1..10

  const color = label === 'Bom' ? COLORS.good : label === 'Normal' ? COLORS.normal : COLORS.attention;

  return { label, color, marker: clamp(stress / 30, 0, 1) };
}
