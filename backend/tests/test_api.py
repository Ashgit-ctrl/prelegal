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
