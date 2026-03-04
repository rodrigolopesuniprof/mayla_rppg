from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Optional, Tuple


MAYLA_API_BASE = os.getenv("MAYLA_API_BASE", "https://dev.saudecomvc.com.br").rstrip("/")


class MaylaApiError(RuntimeError):
    def __init__(self, status_code: Optional[int], body: str):
        super().__init__(f"mayla_api_error status={status_code} body={body[:500]}")
        self.status_code = status_code
        self.body = body


def _http_json(
    method: str,
    url: str,
    payload: Optional[dict] = None,
    headers: Optional[dict] = None,
    timeout_s: float = 15.0,
) -> Tuple[int, str, Optional[dict]]:
    hdrs = {"Accept": "application/json"}
    if headers:
        hdrs.update(headers)

    data: Optional[bytes] = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")

    req = urllib.request.Request(url=url, data=data, headers=hdrs, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            status = int(resp.status)
            body = resp.read().decode("utf-8") if resp is not None else ""
    except urllib.error.HTTPError as e:
        status = int(getattr(e, "code", 0) or 0)
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = str(e)
        return status, body, None
    except Exception as e:
        raise MaylaApiError(None, str(e))

    parsed: Optional[dict] = None
    if body:
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = None

    return status, body, parsed


def patient_login(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Proxy to Mayla patient login.

    Endpoint: POST /api/auth/patient/login

    We forward payload as-is to stay compatible with the official contract.
    """
    url = f"{MAYLA_API_BASE}/api/auth/patient/login"
    status, body, parsed = _http_json("POST", url, payload=payload)
    if status >= 400:
        raise MaylaApiError(status, body)
    return parsed if isinstance(parsed, dict) else {"raw": body}


def post_vital_signs(payload: Dict[str, Any], bearer_token: str) -> Dict[str, Any]:
    """Proxy to Mayla vital-signs.

    Endpoint: POST /api/vital-signs
    Auth: Bearer token.

    We forward payload as-is to stay compatible with the official contract.
    """
    url = f"{MAYLA_API_BASE}/api/vital-signs"
    status, body, parsed = _http_json(
        "POST",
        url,
        payload=payload,
        headers={"Authorization": f"Bearer {bearer_token}"},
    )
    if status >= 400:
        raise MaylaApiError(status, body)
    return parsed if isinstance(parsed, dict) else {"raw": body}
