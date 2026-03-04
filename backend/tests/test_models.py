"""Unit tests for Pydantic models and document routing logic."""
import json
import pytest
from pydantic import ValidationError

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from main import (
    DocumentFieldsUpdate,
    PartyUpdate,
    ChatResponse,
    ChatRequest,
    ChatMessage,
    SUPPORTED_DOCUMENTS,
    SUPPORTED_NAMES,
    build_document_system_prompt,
)


class TestDocumentFieldsUpdate:
    def test_all_fields_optional(self):
        """Model can be instantiated with no fields."""
        fields = DocumentFieldsUpdate()
        assert fields.effectiveDate is None
        assert fields.party1 is None
        assert fields.purpose is None

    def test_nda_fields(self):
        fields = DocumentFieldsUpdate(
            purpose="Evaluating a business partnership",
            effectiveDate="2026-03-04",
            mndaTermType="expires",
            mndaTermYears=2,
            confidentialityTermType="years",
            confidentialityTermYears=3,
            governingLaw="Delaware",
            jurisdiction="courts located in New Castle County, Delaware",
        )
        assert fields.purpose == "Evaluating a business partnership"
        assert fields.mndaTermType == "expires"
        assert fields.mndaTermYears == 2

    def test_invalid_mnda_term_type(self):
        with pytest.raises(ValidationError):
            DocumentFieldsUpdate(mndaTermType="invalid-value")

    def test_invalid_confidentiality_type(self):
        with pytest.raises(ValidationError):
            DocumentFieldsUpdate(confidentialityTermType="sometimes")

    def test_party_update(self):
        party = PartyUpdate(
            company="Acme Corp",
            printName="John Doe",
            title="CEO",
            noticeAddress="123 Main St",
        )
        assert party.company == "Acme Corp"
        assert party.printName == "John Doe"

    def test_party_partial(self):
        """Party update can set just one field."""
        party = PartyUpdate(company="Acme Corp")
        assert party.company == "Acme Corp"
        assert party.printName is None

    def test_generic_fields(self):
        fields = DocumentFieldsUpdate(
            productName="MyApp",
            agreementTerm="1 year",
            fees="$10,000/month",
            paymentTerms="Net 30",
        )
        assert fields.productName == "MyApp"
        assert fields.fees == "$10,000/month"

    def test_sla_fields(self):
        fields = DocumentFieldsUpdate(
            uptimeCommitment="99.9%",
            supportLevels="P1: 1hr, P2: 4hr",
            serviceCreditTerms="10% credit for each hour below SLA",
        )
        assert fields.uptimeCommitment == "99.9%"

    def test_dpa_fields(self):
        fields = DocumentFieldsUpdate(
            processingPurposes="Providing cloud services",
            personalDataTypes="Name, email, usage data",
        )
        assert fields.processingPurposes == "Providing cloud services"

    def test_ai_addendum_fields(self):
        fields = DocumentFieldsUpdate(
            baseAgreementRef="Cloud Service Agreement dated 2026-01-01",
            aiTrainingRestrictions="Provider may not use Customer data to train AI models",
        )
        assert fields.aiTrainingRestrictions is not None


class TestChatResponse:
    def test_defaults(self):
        resp = ChatResponse(message="Hello!", fields=DocumentFieldsUpdate())
        assert resp.documentType is None
        assert resp.isComplete is False
        assert resp.fields is not None

    def test_with_document_type(self):
        resp = ChatResponse(
            message="I'll help with that.",
            documentType="Mutual Non-Disclosure Agreement",
            fields=DocumentFieldsUpdate(purpose="Business evaluation"),
            isComplete=False,
        )
        assert resp.documentType == "Mutual Non-Disclosure Agreement"

    def test_complete(self):
        resp = ChatResponse(
            message="All done!",
            documentType="Pilot Agreement",
            fields=DocumentFieldsUpdate(),
            isComplete=True,
        )
        assert resp.isComplete is True

    def test_json_round_trip(self):
        resp = ChatResponse(
            message="Let me help.",
            documentType="Service Level Agreement",
            fields=DocumentFieldsUpdate(
                uptimeCommitment="99.9%",
                party1=PartyUpdate(company="Acme"),
            ),
            isComplete=False,
        )
        json_str = resp.model_dump_json()
        parsed = ChatResponse.model_validate_json(json_str)
        assert parsed.fields.uptimeCommitment == "99.9%"
        assert parsed.fields.party1.company == "Acme"


class TestChatRequest:
    def test_basic_request(self):
        req = ChatRequest(
            messages=[ChatMessage(role="user", content="Hello")],
            currentData={},
        )
        assert req.documentType is None
        assert len(req.messages) == 1

    def test_with_document_type(self):
        req = ChatRequest(
            messages=[],
            currentData={"effectiveDate": "2026-03-04"},
            documentType="Cloud Service Agreement",
        )
        assert req.documentType == "Cloud Service Agreement"


class TestSupportedDocuments:
    def test_all_11_types_present(self):
        expected = {
            "Mutual Non-Disclosure Agreement",
            "AI Addendum",
            "Business Associate Agreement",
            "Cloud Service Agreement",
            "Data Processing Agreement",
            "Design Partner Agreement",
            "Partnership Agreement",
            "Pilot Agreement",
            "Professional Services Agreement",
            "Service Level Agreement",
            "Software License Agreement",
        }
        assert set(SUPPORTED_NAMES) == expected

    def test_each_type_has_required_fields(self):
        for name, info in SUPPORTED_DOCUMENTS.items():
            assert "requiredFields" in info, f"{name} missing requiredFields"
            assert len(info["requiredFields"]) > 0, f"{name} has empty requiredFields"

    def test_each_type_has_party_labels(self):
        for name, info in SUPPORTED_DOCUMENTS.items():
            assert "party1Label" in info, f"{name} missing party1Label"
            assert "party2Label" in info, f"{name} missing party2Label"

    def test_each_type_has_field_descriptions(self):
        for name, info in SUPPORTED_DOCUMENTS.items():
            assert "fieldDescriptions" in info, f"{name} missing fieldDescriptions"
            assert len(info["fieldDescriptions"]) > 50, f"{name} fieldDescriptions too short"


class TestBuildDocumentSystemPrompt:
    def test_nda_prompt_contains_required_fields(self):
        prompt = build_document_system_prompt(
            "Mutual Non-Disclosure Agreement", {}
        )
        assert "purpose" in prompt
        assert "effectiveDate" in prompt
        assert "mndaTermType" in prompt
        assert "isComplete=true" in prompt

    def test_sla_prompt_contains_uptime(self):
        prompt = build_document_system_prompt("Service Level Agreement", {})
        assert "uptimeCommitment" in prompt
        assert "Service Level Agreement" in prompt

    def test_prompt_includes_current_data(self):
        current_data = {"effectiveDate": "2026-03-04", "productName": "MyApp"}
        prompt = build_document_system_prompt("Pilot Agreement", current_data)
        assert "2026-03-04" in prompt
        assert "MyApp" in prompt

    def test_prompt_instructs_keep_asking(self):
        prompt = build_document_system_prompt("Partnership Agreement", {})
        assert "Keep asking" in prompt or "keep asking" in prompt.lower()

    def test_unknown_document_type_returns_generic_prompt(self):
        """Should not crash on unknown doc type."""
        prompt = build_document_system_prompt("Unknown Document Type", {})
        assert len(prompt) > 0
