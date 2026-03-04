export type PremiumStartParams = {
  cpf?: string;
  modules?: string[];
  // optionally include a server-generated session id if we create one
  premium_session_id?: string;
};

export type PremiumResult = {
  provider: 'binah';
  // core
  bpm?: number | null;
  rr_bpm?: number | null;
  // Mayla
  prq?: number | null;
  hrv_sdnn_ms?: number | null;
  stress_level?: number | null;
  // blood
  spo2_pct?: number | null;
  bp_systolic_mmHg?: number | null;
  bp_diastolic_mmHg?: number | null;
  // meta
  confidence?: number | null;
  quality?: 'good' | 'medium' | 'poor' | null;
  duration_s?: number | null;
  raw?: any;
};

declare global {
  interface Window {
    // iOS WKWebView
    webkit?: any;
    // Android WebView JS interface
    Android?: { startPremiumMeasurement?: (json: string) => void };

    // callbacks invoked by native
    onPremiumMeasurementResult?: (json: string) => void;
    onPremiumMeasurementError?: (json: string) => void;
  }
}

export function isIOSNative(): boolean {
  return !!window.webkit?.messageHandlers?.startPremiumMeasurement;
}

export function isAndroidNative(): boolean {
  return typeof window.Android?.startPremiumMeasurement === 'function';
}

export function isNativeContainer(): boolean {
  return isIOSNative() || isAndroidNative();
}

export function startPremiumMeasurement(params: PremiumStartParams) {
  const payload = JSON.stringify({
    provider: 'binah',
    modules: params.modules ?? ['ALL'],
    cpf: params.cpf,
    premium_session_id: params.premium_session_id,
  });

  if (isIOSNative()) {
    window.webkit.messageHandlers.startPremiumMeasurement.postMessage(payload);
    return;
  }

  if (isAndroidNative()) {
    window.Android!.startPremiumMeasurement!(payload);
    return;
  }

  throw new Error('native_container_unavailable');
}

export function installPremiumResultHandlers(opts: {
  onResult: (r: PremiumResult) => void;
  onError: (e: { code?: string; message?: string; raw?: any }) => void;
}) {
  window.onPremiumMeasurementResult = (json: string) => {
    try {
      const parsed = JSON.parse(json);
      opts.onResult({ provider: 'binah', ...(parsed || {}), raw: parsed });
    } catch (e: any) {
      opts.onError({ code: 'invalid_result_json', message: e?.message ?? 'Invalid JSON', raw: json });
    }
  };

  window.onPremiumMeasurementError = (json: string) => {
    try {
      const parsed = JSON.parse(json);
      opts.onError({ ...parsed, raw: parsed });
    } catch (e: any) {
      opts.onError({ code: 'invalid_error_json', message: e?.message ?? 'Invalid JSON', raw: json });
    }
  };
}
