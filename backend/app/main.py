from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.sessions import router as sessions_router
from .routes.ws import router as ws_router
from .routes.mayla import router as mayla_router


def create_app() -> FastAPI:
    app = FastAPI(title="mayla-rppg-web backend", version="0.1.0")

    # Dev-friendly CORS; restrict in production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(sessions_router)
    app.include_router(ws_router)
    app.include_router(mayla_router)

    @app.get("/health")
    def health():
        return {"ok": True}

    return app


app = create_app()