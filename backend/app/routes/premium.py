from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional


router = APIRouter(prefix="/premium", tags=["premium"])


class AccessCheckReq(BaseModel):
    cpf: str


@router.post("/access-check")
def access_check(req: AccessCheckReq, authorization: Optional[str] = Header(default=None, alias="Authorization")):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")

    # TODO: integrar com regras reais por plano no backend.
    # Por enquanto: se está autenticado (Bearer presente) consideramos elegível.
    # A regra final deve consultar a Mayla para validar plano/contratante.

    if not req.cpf or len(req.cpf) < 8:
        raise HTTPException(status_code=400, detail="invalid_cpf")

    return {"allowed": True, "reason": None}
