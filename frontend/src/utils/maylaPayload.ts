export type HeartRateStatus = 'low' | 'normal' | 'high';

export type SessionVitalsInput = {
  deviceId: string;
  timestamp: string; // ISO string

  bpm: number | null;
  prq?: number | null;
  hrvSdnnMs?: number | null;
  stressLevel?: number | null;

  quality?: 'good' | 'medium' | 'poor' | null;
  snrDb?: number | null;
  faceDetectRate?: number | null;
  framesCount?: number | null;
};

function heartRateStatus(bpm: number): HeartRateStatus {
  if (bpm < 60) return 'low';
  if (bpm > 100) return 'high';
  return 'normal';
}

export function buildMaylaVitalSignsPayload(input: SessionVitalsInput) {
  const rppgItem: any = {};

  if (input.bpm != null && Number.isFinite(input.bpm)) {
    const bpm = Math.round(input.bpm);
    rppgItem.heart_rate = {
      bpm,
      status: heartRateStatus(bpm),
      timestamp: input.timestamp,
    };
  }

  if (input.prq != null && Number.isFinite(input.prq)) {
    rppgItem.razao_prq = {
      value: input.prq,
      timestamp: input.timestamp,
    };
  }

  if (input.hrvSdnnMs != null && Number.isFinite(input.hrvSdnnMs)) {
    rppgItem.hrv = {
      value: input.hrvSdnnMs,
      unit: 'ms',
      timestamp: input.timestamp,
    };
  }

  if (input.stressLevel != null && Number.isFinite(input.stressLevel)) {
    rppgItem.stress_level = {
      value: input.stressLevel,
      scale: '1-30',
      timestamp: input.timestamp,
    };
  }

  const hasQualityFields =
    input.quality != null ||
    (input.snrDb != null && Number.isFinite(input.snrDb)) ||
    (input.faceDetectRate != null && Number.isFinite(input.faceDetectRate));
  if (hasQualityFields) {
    const qualidade_da_imagem: any = {
      value: input.quality ?? undefined,
      timestamp: input.timestamp,
    };

    if (input.snrDb != null && Number.isFinite(input.snrDb)) qualidade_da_imagem.snr_db = input.snrDb;
    if (input.faceDetectRate != null && Number.isFinite(input.faceDetectRate)) {
      qualidade_da_imagem.face_detect_rate = input.faceDetectRate;
    }

    Object.keys(qualidade_da_imagem).forEach((k) => {
      if (qualidade_da_imagem[k] === undefined) delete qualidade_da_imagem[k];
    });

    rppgItem.qualidade_da_imagem = qualidade_da_imagem;
  }

  if (input.framesCount != null && Number.isFinite(input.framesCount)) {
    rppgItem.frames = {
      count: input.framesCount,
      timestamp: input.timestamp,
    };
  }

  const rPPG = Object.keys(rppgItem).length ? [rppgItem] : [];

  return {
    device_id: input.deviceId,
    rPPG,
  };
}