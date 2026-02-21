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



# Exemplo da requisição curl para login do paciente na API Mayla, e a resposta esperada.
#curl -X POST -H "Content-Type: application/json" \
#-d '{"user":"alvaroprestes@gmail.com","password":"stroncho"}' \
#https://dev.saudecomvc.com.br/api/auth/patient/login
#
#Resposta esperada:
#{
#    "access_token":"f5f7928d-fad0-43e1-8509-b449c8022d5c|AHax84ThennHuA8AUbUTr0LMuzB3MdEe7qcbGJvo12907f88",
#    "patient":{
#        "id":"4d6f13f8-6508-4f72-844e-8f8dbbc37371",
#        "name":"Alvaro Nunes Prestes ",
#        "email":"alvaroprestes@gmail.com",
#        "cpf":"93784783104",
#        "password":"$2y$12$tqP5JTIv3lPoiLk\/HmqdCeT2Q9bIc9AS8Tyw6ckasjEk9MWJfTSbq",
#        "is_active":true,
#        "user_id":"51e5b6a5-0c54-4252-9574-028f7f54cc1e",
#        "client_id":"1258c09e-8f78-4d19-87db-c4a3ded4e265",
#        "collect":true,
#        "created_at":"2025-07-14T00:50:12.000000Z",
#        "updated_at":"2026-02-21T17:37:58.000000Z",
#        "status":"critical",
#        "personal_info":{
#            "id":"e123207e-e1bd-4947-8552-3dcf1b2eef4c",
#            "patient_id":"4d6f13f8-6508-4f72-844e-8f8dbbc37371",
#            "weight":82,
#            "height":1.72,
#            "photo":null,
#            "susregistration":"000000000000000000000",
#            "date_birth":"1981-06-06",
#            "gender":"M",
#            "marital_status":"",
#            "nationality":"Brasil",
#            "city_birth":"PALMAS",
#            "birth_status":"TO",
#            "created_at":"2025-07-14T00:50:12.000000Z",
#            "updated_at":"2025-07-23T22:42:12.000000Z"
#        },
#        "address_contact":{
#            "id":"b0318775-c542-4165-8b04-7155b80dcd2f",
#            "patient_id":"4d6f13f8-6508-4f72-844e-8f8dbbc37371",
#            "street":"Quadra ARSO 62 Alameda 6",
#            "number":"13",
#            "complement":"",
#            "neighborhood":"Plano Diretor Sul",
#            "city":"Palmas",
#            "state":"TO",
#            "zip_code":"77016409",
#            "country":null,
#            "cellphone":"31000000000000000000",
#            "telephone":"63984139235",
#            "email":"alvaroprestes@gmail.com",
#            "emergency_contact_name":"TESTE",
#            "emergency_contact_phone":"71000000000",
#            "emergency_contact_relationship":"SEM CONTATO",
#            "created_at":"2025-07-14T00:50:12.000000Z",
#            "updated_at":"2025-07-23T22:42:12.000000Z"
#        }
#    }
#}
#