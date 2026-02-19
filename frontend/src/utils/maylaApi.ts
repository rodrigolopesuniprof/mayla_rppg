export type MaylaLoginResponse = any;
export type MaylaVitalSignsResponse = any;

export async function maylaPatientLogin(payload: Record<string, any>): Promise<MaylaLoginResponse> {
  const resp = await fetch('/mayla/auth/patient/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function maylaPostVitalSigns(
  bearerToken: string,
  payload: Record<string, any>,
): Promise<MaylaVitalSignsResponse> {
  const resp = await fetch('/mayla/vital-signs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}
