"""Integration tests for the FastAPI endpoints (mocking LiteLLM)."""
import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app, DocumentFieldsUpdate, PartyUpdate, ChatResponse


@pytest.fixture
def client(tmp_path):
    """TestClient with DB path redirected to a temp directory."""
    import main as m
    original_db = m.DB_PATH
    m.DB_PATH = tmp_path / "test.db"
    with TestClient(app) as c:
        yield c
    m.DB_PATH = original_db


def make_mock_completion(message: str, doc_type=None, fields=None, is_complete=False):
    """Build a mock LiteLLM completion response."""
    fields = fields or DocumentFieldsUpdate()
    response_obj = ChatResponse(
        message=message,
        documentType=doc_type,
        fields=fields,
        isComplete=is_complete,
    )
    mock_response = MagicMock()
    mock_response.choices[0].message.content = response_obj.model_dump_json()
    return mock_response


def register_user(client, name="Alice", email="alice@example.com", password="password123"):
    """Helper: register a user and return the auth token."""
    resp = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["token"]


# ---------------------------------------------------------------------------
# Health & Catalog
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    def test_health_ok(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestCatalogEndpoint:
    def test_catalog_returns_list(self, client):
        resp = client.get("/api/catalog")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_catalog_has_mutual_nda(self, client):
        resp = client.get("/api/catalog")
        names = [item["name"] for item in resp.json()]
        assert "Mutual Non-Disclosure Agreement" in names


# ---------------------------------------------------------------------------
# Auth: Register
# ---------------------------------------------------------------------------


class TestRegister:
    def test_register_success(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"name": "Alice", "email": "alice@example.com", "password": "password123"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == "alice@example.com"
        assert data["user"]["name"] == "Alice"

    def test_register_duplicate_email(self, client):
        payload = {"name": "Alice", "email": "alice@example.com", "password": "password123"}
        client.post("/api/auth/register", json=payload)
        resp = client.post("/api/auth/register", json=payload)
        assert resp.status_code == 409

    def test_register_short_password(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"name": "Alice", "email": "alice@example.com", "password": "short"},
        )
        assert resp.status_code == 400
        assert "8 characters" in resp.json()["detail"]

    def test_register_returns_jwt(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"name": "Bob", "email": "bob@example.com", "password": "password123"},
        )
        token = resp.json()["token"]
        # JWT has three dot-separated parts
        assert len(token.split(".")) == 3


# ---------------------------------------------------------------------------
# Auth: Login
# ---------------------------------------------------------------------------


class TestLogin:
    def test_login_success(self, client):
        register_user(client)
        resp = client.post(
            "/api/auth/login",
            json={"email": "alice@example.com", "password": "password123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == "alice@example.com"

    def test_login_wrong_password(self, client):
        register_user(client)
        resp = client.post(
            "/api/auth/login",
            json={"email": "alice@example.com", "password": "wrongpassword"},
        )
        assert resp.status_code == 401

    def test_login_unknown_email(self, client):
        resp = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "password123"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Auth: Forgot / Reset password
# ---------------------------------------------------------------------------


class TestPasswordReset:
    def test_forgot_password_always_200(self, client):
        """Should return 200 regardless of whether email exists (prevent enumeration)."""
        resp = client.post(
            "/api/auth/forgot-password",
            json={"email": "anyone@example.com"},
        )
        assert resp.status_code == 200
        assert "message" in resp.json()

    def test_reset_password_invalid_token(self, client):
        resp = client.post(
            "/api/auth/reset-password",
            json={"token": "invalid-token", "new_password": "newpassword123"},
        )
        assert resp.status_code == 400

    def test_reset_password_short_password(self, client):
        resp = client.post(
            "/api/auth/reset-password",
            json={"token": "sometoken", "new_password": "short"},
        )
        assert resp.status_code == 400

    def test_reset_password_full_flow(self, client):
        """Register, set a valid reset token manually, then reset password."""
        import main as m
        import uuid
        from datetime import datetime, timedelta, timezone

        # Register user
        register_user(client)

        # Manually insert a reset token (hashed, matching production logic)
        import hashlib
        raw_token = str(uuid.uuid4())
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        conn = m.get_db()
        try:
            conn.execute(
                "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?",
                (token_hash, expires, "alice@example.com"),
            )
            conn.commit()
        finally:
            conn.close()
        token = raw_token

        # Reset password
        resp = client.post(
            "/api/auth/reset-password",
            json={"token": token, "new_password": "newpassword123"},
        )
        assert resp.status_code == 200

        # Login with new password
        resp = client.post(
            "/api/auth/login",
            json={"email": "alice@example.com", "password": "newpassword123"},
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


class TestDocuments:
    def test_list_documents_requires_auth(self, client):
        resp = client.get("/api/documents")
        assert resp.status_code == 401

    def test_create_document_requires_auth(self, client):
        resp = client.post("/api/documents", json={"title": "Test", "isComplete": False})
        assert resp.status_code == 401

    def test_list_documents_empty(self, client):
        token = register_user(client)
        resp = client.get(
            "/api/documents",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_and_list_document(self, client):
        token = register_user(client)
        headers = {"Authorization": f"Bearer {token}"}

        # Create
        resp = client.post(
            "/api/documents",
            headers=headers,
            json={
                "title": "Acme × Beta",
                "documentType": "Mutual Non-Disclosure Agreement",
                "fields": {"effectiveDate": "2026-01-01"},
                "isComplete": False,
            },
        )
        assert resp.status_code == 201
        doc = resp.json()
        assert doc["id"] is not None
        assert doc["title"] == "Acme × Beta"
        assert doc["documentType"] == "Mutual Non-Disclosure Agreement"

        # List
        resp = client.get("/api/documents", headers=headers)
        assert resp.status_code == 200
        docs = resp.json()
        assert len(docs) == 1
        assert docs[0]["title"] == "Acme × Beta"

    def test_update_document(self, client):
        token = register_user(client)
        headers = {"Authorization": f"Bearer {token}"}

        # Create
        create_resp = client.post(
            "/api/documents",
            headers=headers,
            json={"title": "Draft Doc", "isComplete": False},
        )
        doc_id = create_resp.json()["id"]

        # Update
        resp = client.put(
            f"/api/documents/{doc_id}",
            headers=headers,
            json={"title": "Final Doc", "isComplete": True},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Final Doc"
        assert data["isComplete"] is True

    def test_delete_document(self, client):
        token = register_user(client)
        headers = {"Authorization": f"Bearer {token}"}

        # Create
        create_resp = client.post(
            "/api/documents",
            headers=headers,
            json={"title": "To Delete", "isComplete": False},
        )
        doc_id = create_resp.json()["id"]

        # Delete
        resp = client.delete(f"/api/documents/{doc_id}", headers=headers)
        assert resp.status_code == 200

        # Verify gone
        list_resp = client.get("/api/documents", headers=headers)
        assert list_resp.json() == []

    def test_cannot_access_other_users_document(self, client):
        token1 = register_user(client, name="Alice", email="alice@example.com")
        token2 = register_user(client, name="Bob", email="bob@example.com")

        # Alice creates a document
        create_resp = client.post(
            "/api/documents",
            headers={"Authorization": f"Bearer {token1}"},
            json={"title": "Alice's Doc", "isComplete": False},
        )
        doc_id = create_resp.json()["id"]

        # Bob tries to update Alice's document
        resp = client.put(
            f"/api/documents/{doc_id}",
            headers={"Authorization": f"Bearer {token2}"},
            json={"title": "Hijacked"},
        )
        assert resp.status_code == 404

        # Bob tries to delete Alice's document
        resp = client.delete(
            f"/api/documents/{doc_id}",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert resp.status_code == 404

    def test_documents_isolated_per_user(self, client):
        token1 = register_user(client, name="Alice", email="alice@example.com")
        token2 = register_user(client, name="Bob", email="bob@example.com")

        # Alice creates a document
        client.post(
            "/api/documents",
            headers={"Authorization": f"Bearer {token1}"},
            json={"title": "Alice's Doc", "isComplete": False},
        )

        # Bob should see an empty list
        resp = client.get(
            "/api/documents",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert resp.json() == []

    def test_invalid_token_returns_401(self, client):
        resp = client.get(
            "/api/documents",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Chat (unchanged behaviour)
# ---------------------------------------------------------------------------


class TestChatEndpoint:
    def test_greeting_no_document_type(self, client):
        """First call with empty messages triggers document detection flow."""
        mock = make_mock_completion(
            "Hello! I'm here to help. What legal document do you need?"
        )
        with patch("main.completion", return_value=mock):
            resp = client.post(
                "/api/chat",
                json={"messages": [], "currentData": {}, "documentType": None},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
        assert "fields" in data
        assert "isComplete" in data

    def test_document_type_detection(self, client):
        """AI detects NDA from user message."""
        mock = make_mock_completion(
            "I'll help you draft a Mutual NDA!",
            doc_type="Mutual Non-Disclosure Agreement",
        )
        with patch("main.completion", return_value=mock):
            resp = client.post(
                "/api/chat",
                json={
                    "messages": [{"role": "user", "content": "I need an NDA"}],
                    "currentData": {},
                    "documentType": None,
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["documentType"] == "Mutual Non-Disclosure Agreement"

    def test_nda_field_collection(self, client):
        """With documentType set, AI collects NDA fields."""
        mock = make_mock_completion(
            "What is the purpose of this NDA?",
            doc_type="Mutual Non-Disclosure Agreement",
            fields=DocumentFieldsUpdate(purpose="Evaluating partnership"),
        )
        with patch("main.completion", return_value=mock):
            resp = client.post(
                "/api/chat",
                json={
                    "messages": [{"role": "user", "content": "Evaluating a business partnership"}],
                    "currentData": {},
                    "documentType": "Mutual Non-Disclosure Agreement",
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["fields"]["purpose"] == "Evaluating partnership"

    def test_sla_field_collection(self, client):
        """SLA document type collects SLA-specific fields."""
        mock = make_mock_completion(
            "What is the uptime commitment?",
            doc_type="Service Level Agreement",
            fields=DocumentFieldsUpdate(productName="CloudApp", uptimeCommitment="99.9%"),
        )
        with patch("main.completion", return_value=mock):
            resp = client.post(
                "/api/chat",
                json={
                    "messages": [{"role": "user", "content": "Our product is CloudApp with 99.9% uptime"}],
                    "currentData": {},
                    "documentType": "Service Level Agreement",
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["fields"]["productName"] == "CloudApp"
        assert data["fields"]["uptimeCommitment"] == "99.9%"

    def test_completion_flag(self, client):
        """Backend can signal isComplete=true."""
        mock = make_mock_completion(
            "Your document is ready!",
            doc_type="Pilot Agreement",
            fields=DocumentFieldsUpdate(
                productName="DemoApp",
                pilotDuration="30 days",
                pilotScope="Full feature access",
                effectiveDate="2026-03-04",
                governingLaw="California",
                jurisdiction="courts in San Francisco, California",
                party1=PartyUpdate(company="Acme", printName="Jane", title="CEO", noticeAddress="jane@acme.com"),
                party2=PartyUpdate(company="Beta Corp", printName="Bob", title="CTO", noticeAddress="bob@beta.com"),
            ),
            is_complete=True,
        )
        with patch("main.completion", return_value=mock):
            resp = client.post(
                "/api/chat",
                json={
                    "messages": [{"role": "user", "content": "That's everything"}],
                    "currentData": {},
                    "documentType": "Pilot Agreement",
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["isComplete"] is True

    def test_invalid_ai_response_returns_500(self, client):
        """Malformed AI response returns 500."""
        mock = MagicMock()
        mock.choices[0].message.content = "not valid json at all!!!"
        with patch("main.completion", return_value=mock):
            resp = client.post(
                "/api/chat",
                json={"messages": [], "currentData": {}, "documentType": None},
            )
        assert resp.status_code == 500

    def test_ai_service_error_returns_502(self, client):
        """AI service failure returns 502."""
        with patch("main.completion", side_effect=Exception("Connection refused")):
            resp = client.post(
                "/api/chat",
                json={"messages": [], "currentData": {}, "documentType": None},
            )
        assert resp.status_code == 502

    def test_all_document_types_accepted(self, client):
        """All supported document types can be used as documentType."""
        from main import SUPPORTED_NAMES

        mock = make_mock_completion("Let me help with that.")
        for doc_type in SUPPORTED_NAMES:
            with patch("main.completion", return_value=mock):
                resp = client.post(
                    "/api/chat",
                    json={
                        "messages": [{"role": "user", "content": "Hi"}],
                        "currentData": {},
                        "documentType": doc_type,
                    },
                )
            assert resp.status_code == 200, f"Failed for document type: {doc_type}"

    def test_party_fields_collected(self, client):
        """Party sub-fields are properly collected and returned."""
        mock = make_mock_completion(
            "Got it!",
            doc_type="Cloud Service Agreement",
            fields=DocumentFieldsUpdate(
                party1=PartyUpdate(
                    company="TechCorp",
                    printName="Alice Smith",
                    title="VP Engineering",
                    noticeAddress="alice@techcorp.com",
                )
            ),
        )
        with patch("main.completion", return_value=mock):
            resp = client.post(
                "/api/chat",
                json={
                    "messages": [{"role": "user", "content": "I'm Alice from TechCorp"}],
                    "currentData": {},
                    "documentType": "Cloud Service Agreement",
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["fields"]["party1"]["company"] == "TechCorp"
        assert data["fields"]["party1"]["printName"] == "Alice Smith"
