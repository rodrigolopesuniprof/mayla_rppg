export type VitalValue = number | null;

export type Vitals = {
  heartRateBpm: VitalValue;
  breathingRateBrpm: VitalValue;
  prq: VitalValue;
  spo2Pct: VitalValue;
  systolicMmHg: VitalValue;
  diastolicMmHg: VitalValue;
  stressLevel: VitalValue;
  hrvSdnnMs: VitalValue;

  derived?: {
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

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Heuristics used to populate the UX with *non-clinical* estimates.
 * - In mock mode: fill a broader set of metrics.
 * - In real mode: only compute what we can safely derive from BPM/quality signals.
 */
export function vitalsFromSessionResult(opts: {
  bpm: number | null;
  confidence: number;
  snrDb: number | null;
  mockMode: boolean;
}): Vitals {
  const { bpm, confidence, snrDb, mockMode } = opts;

  if (bpm == null) {
    return {
      heartRateBpm: null,
      breathingRateBrpm: null,
      prq: null,
      spo2Pct: null,
      systolicMmHg: null,
      diastolicMmHg: null,
      stressLevel: null,
      hrvSdnnMs: null,
    };
  }

  // “Breathing rate” proxy: keep in plausible adult range.
  const breathing = clamp(12 + ((Math.round(bpm) % 7) - 3) * 0.7, 10, 20);
  const prq = bpm / breathing;

  // HRV proxy: higher SNR/confidence => more stable => higher SDNN.
  const snrScore = snrDb == null ? 0.35 : clamp((snrDb + 5) / 20, 0, 1);
  const stability = clamp(0.5 * confidence + 0.5 * snrScore, 0, 1);
  const sdnn = clamp(35 + stability * 55 - (bpm - 70) * 0.25, 20, 120);

  // Stress proxy: inverse of SDNN + penalty for high HR.
  const stress = clamp(5 + (1 - stability) * 22 + clamp((bpm - 75) * 0.25, 0, 12), 1, 30);

  const out: Vitals = {
    heartRateBpm: round1(bpm),
    breathingRateBrpm: round1(breathing),
    prq: round1(prq),
    spo2Pct: null,
    systolicMmHg: null,
    diastolicMmHg: null,
    stressLevel: Math.round(stress),
    hrvSdnnMs: Math.round(sdnn),
  };

  if (!mockMode) return out;

  // Mock-only: populate blood metrics as *simulated*.
  const spo2 = clamp(97 - clamp((bpm - 72) * 0.06, -1.0, 2.0) + stability * 1.2, 94, 100);
  const systolic = clamp(118 + (bpm - 70) * 0.35 + (1 - stability) * 6, 95, 150);
  const diastolic = clamp(72 + (bpm - 70) * 0.15 + (1 - stability) * 4, 55, 100);

  const scoreFrom = (x: number) => clamp(x, 0, 100);
  const calmScore = scoreFrom(100 - stress * 3.2);
  const energyScore = scoreFrom(55 + (bpm - 65) * 0.9 - stress * 1.2);
  const sleepScore = scoreFrom(80 - (bpm - 65) * 0.8 - stress * 1.1);
  const immunityScore = scoreFrom(70 + stability * 25 - stress * 1.3);
  const metabolismScore = scoreFrom(60 + (bpm - 60) * 0.7);
  const healthScore = scoreFrom(0.35 * calmScore + 0.25 * immunityScore + 0.2 * sleepScore + 0.2 * energyScore);

  out.spo2Pct = round1(spo2);
  out.systolicMmHg = Math.round(systolic);
  out.diastolicMmHg = Math.round(diastolic);
  out.derived = {
    relaxation: calmScore,
    activity: energyScore,
    sleep: sleepScore,
    immunity: immunityScore,
    metabolism: metabolismScore,
    health: healthScore,
  };

  return out;
}
