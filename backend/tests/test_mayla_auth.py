from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_proxy_patient_login_success(monkeypatch):
    app = create_app()
    client = TestClient(app)


    def fake_patient_login(payload):
        return {"access_token":"fake-token", "patient":{"id":"4d6f13f8-6508-4f72-844e-8f8dbbc37371",}}

    # Patch the mayla_api.patient_login function
    import backend.app.services.mayla_api as mayla_api

    monkeypatch.setattr(mayla_api, "patient_login", fake_patient_login)

    resp = client.post("/mayla/auth/patient/login", json={"user": "alvaroprestes@gmail.com", "password": "stroncho"})
    assert resp.status_code == 200
    assert resp.json() == {"access_token": "fake-token", "patient": {"id": "4d6f13f8-6508-4f72-844e-8f8dbbc37371"}}
    

def test_proxy_patient_login_upstream_error(monkeypatch):
    app = create_app()
    client = TestClient(app)

    import backend.app.services.mayla_api as mayla_api

    def fake_patient_login(payload):
        raise mayla_api.MaylaApiError(401, '{"error":"unauthorized"}')


    monkeypatch.setattr(mayla_api, "patient_login", fake_patient_login)

    resp = client.post("/mayla/auth/patient/login", json={"user": "alvaroprestes@gmail.com", "password": "stroncho"})
    assert resp.status_code == 502
    body = resp.json()
    assert body.get("detail")
    detail = body["detail"]
    assert detail["upstream"] == "mayla"
    assert detail["status"] == 401
