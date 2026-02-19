from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional

from ..services import mayla_api

router = APIRouter(prefix="/mayla", tags=["mayla"])


class MaylaLoginReq(BaseModel):
    # Keep flexible to match the official API contract; user can send extra fields.
    cpf: Optional[str] = None
    password: Optional[str] = None

    # allow arbitrary extra fields
    model_config = {"extra": "allow"}


class MaylaVitalSignsReq(BaseModel):
    # Forward as-is; we only require it to be JSON.
    model_config = {"extra": "allow"}


@router.post("/auth/patient/login")
def proxy_patient_login(body: Dict[str, Any]):
    try:
        return mayla_api.patient_login(body)
    except mayla_api.MaylaApiError as e:
        raise HTTPException(status_code=502, detail={"upstream": "mayla", "status": e.status_code, "body": e.body})


@router.post("/vital-signs")
def proxy_vital_signs(
    body: Dict[str, Any],
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")

    try:
        return mayla_api.post_vital_signs(body, bearer_token=token)
    except mayla_api.MaylaApiError as e:
        raise HTTPException(status_code=502, detail={"upstream": "mayla", "status": e.status_code, "body": e.body})
