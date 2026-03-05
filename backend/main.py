import sqlite3
import os
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, List, Literal

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from litellm import completion

DB_PATH = Path("/tmp/prelegal.db")
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "out"
CATALOG_PATH = Path(__file__).parent.parent / "catalog.json"

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}


def load_catalog() -> list[dict]:
    if CATALOG_PATH.exists():
        with open(CATALOG_PATH) as f:
            return json.load(f)
    return []


def init_db() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()


CATALOG: list[dict] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global CATALOG
    init_db()
    CATALOG = load_catalog()
    yield


app = FastAPI(title="Prelegal API", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class PartyUpdate(BaseModel):
    company: Optional[str] = None
    printName: Optional[str] = None
    title: Optional[str] = None
    noticeAddress: Optional[str] = None


class DocumentFieldsUpdate(BaseModel):
    # --- Common to all documents ---
    effectiveDate: Optional[str] = None
    governingLaw: Optional[str] = None
    jurisdiction: Optional[str] = None
    party1: Optional[PartyUpdate] = None
    party2: Optional[PartyUpdate] = None

    # --- NDA-specific ---
    purpose: Optional[str] = None
    mndaTermType: Optional[Literal["expires", "until-terminated"]] = None
    mndaTermYears: Optional[int] = None
    confidentialityTermType: Optional[Literal["years", "perpetuity"]] = None
    confidentialityTermYears: Optional[int] = None
    modifications: Optional[str] = None

    # --- Product / service name (CSA, SLA, Pilot, PSA, Software License, Design Partner) ---
    productName: Optional[str] = None

    # --- Agreement term / duration ---
    agreementTerm: Optional[str] = None

    # --- Fees & payment ---
    fees: Optional[str] = None
    paymentTerms: Optional[str] = None

    # --- Services / deliverables description ---
    servicesDescription: Optional[str] = None
    deliverables: Optional[str] = None

    # --- BAA-specific ---
    coveredEntityType: Optional[str] = None

    # --- DPA-specific ---
    processingPurposes: Optional[str] = None
    personalDataTypes: Optional[str] = None

    # --- Design Partner / Pilot ---
    pilotDuration: Optional[str] = None
    feedbackObligations: Optional[str] = None
    pilotScope: Optional[str] = None

    # --- Partnership ---
    partnershipScope: Optional[str] = None
    commissionTerms: Optional[str] = None

    # --- SLA ---
    uptimeCommitment: Optional[str] = None
    supportLevels: Optional[str] = None
    serviceCreditTerms: Optional[str] = None

    # --- Software License ---
    licenseScope: Optional[str] = None

    # --- AI Addendum ---
    aiTrainingRestrictions: Optional[str] = None
    baseAgreementRef: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    documentType: Optional[str] = None
    fields: DocumentFieldsUpdate
    isComplete: bool = False


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    currentData: dict
    documentType: Optional[str] = None


# ---------------------------------------------------------------------------
# Supported document names and required fields per type
# ---------------------------------------------------------------------------

SUPPORTED_DOCUMENTS = {
    "Mutual Non-Disclosure Agreement": {
        "aliases": ["NDA", "MNDA", "non-disclosure", "confidentiality agreement"],
        "description": "A bilateral confidentiality agreement for protecting sensitive information shared between two parties.",
        "party1Label": "First Party",
        "party2Label": "Second Party",
        "requiredFields": [
            "purpose",
            "effectiveDate",
            "mndaTermType",
            "confidentialityTermType",
            "governingLaw",
            "jurisdiction",
            "party1.company", "party1.printName", "party1.title", "party1.noticeAddress",
            "party2.company", "party2.printName", "party2.title", "party2.noticeAddress",
        ],
        "fieldDescriptions": """
- purpose: The business purpose for sharing confidential information
- effectiveDate: Agreement start date (YYYY-MM-DD format)
- mndaTermType: "expires" for a fixed term, or "until-terminated" for ongoing
- mndaTermYears: Number of years if mndaTermType is "expires"
- confidentialityTermType: "years" or "perpetuity"
- confidentialityTermYears: Number of years if confidentialityTermType is "years"
- governingLaw: US state whose laws govern (e.g., "Delaware")
- jurisdiction: Courts with jurisdiction (e.g., "courts located in New Castle County, Delaware")
- modifications: Any modifications to standard terms (or empty if none)
- party1.company, party1.printName, party1.title, party1.noticeAddress (First Party)
- party2.company, party2.printName, party2.title, party2.noticeAddress (Second Party)
""",
    },
    "AI Addendum": {
        "aliases": ["AI addendum", "artificial intelligence addendum", "AI supplement"],
        "description": "An addendum governing the use of AI services within a broader service agreement.",
        "party1Label": "Provider",
        "party2Label": "Customer",
        "requiredFields": [
            "baseAgreementRef",
            "effectiveDate",
            "aiTrainingRestrictions",
            "governingLaw",
            "jurisdiction",
            "party1.company", "party1.printName", "party1.title", "party1.noticeAddress",
            "party2.company", "party2.printName", "party2.title", "party2.noticeAddress",
        ],
        "fieldDescriptions": """
- baseAgreementRef: Name/reference of the main agreement this addendum supplements
- effectiveDate: Date the addendum becomes effective (YYYY-MM-DD)
- aiTrainingRestrictions: Whether/how the Provider may use Customer data to train AI models
- governingLaw: US state whose laws govern (e.g., "California")
- jurisdiction: Courts with jurisdiction
- party1.company, party1.printName, party1.title, party1.noticeAddress (Provider)
- party2.company, party2.printName, party2.title, party2.noticeAddress (Customer)
""",
    },
    "Business Associate Agreement": {
        "aliases": ["BAA", "HIPAA agreement", "business associate", "PHI agreement"],
        "description": "A HIPAA-compliant agreement governing the relationship between a covered entity and a business associate that handles protected health information.",
        "party1Label": "Provider (Business Associate)",
        "party2Label": "Covered Entity",
        "requiredFields": [
            "servicesDescription",
            "coveredEntityType",
            "effectiveDate",
            "governingLaw",
            "jurisdiction",
            "party1.company", "party1.printName", "party1.title", "party1.noticeAddress",
            "party2.company", "party2.printName", "party2.title", "party2.noticeAddress",
        ],
        "fieldDescriptions": """
- servicesDescription: Description of services the Provider performs involving PHI
- coveredEntityType: Type of covered entity (e.g., "healthcare provider", "health plan", "healthcare clearinghouse")
- effectiveDate: Agreement start date (YYYY-MM-DD)
- governingLaw: US state whose laws govern
- jurisdiction: Courts with jurisdiction
- party1.company, party1.printName, party1.title, party1.noticeAddress (Provider / Business Associate)
- party2.company, party2.printName, party2.title, party2.noticeAddress (Covered Entity / Company)
""",
    },
    "Cloud Service Agreement": {
        "aliases": ["CSA", "cloud services", "SaaS agreement", "cloud software agreement"],
        "description": "A comprehensive agreement for cloud-hosted software services.",
        "party1Label": "Provider",
        "party2Label": "Customer",
        "requiredFields": [
            "productName",
            "effectiveDate",
            "agreementTerm",
            "fees",
            "paymentTerms",
            "governingLaw",
            "jurisdiction",
            "party1.company", "party1.printName", "party1.title", "party1.noticeAddress",
            "party2.company", "party2.printName", "party2.title", "party2.noticeAddress",
        ],
        "fieldDescriptions": """
- productName: Name of the cloud service/product
- effectiveDate: Agreement start date (YYYY-MM-DD)
- agreementTerm: Length of the agreement (e.g., "1 year", "ongoing until terminated")
- fees: Pricing and fee structure
- paymentTerms: When and how payments are made
- governingLaw: US state whose laws govern
- jurisdiction: Courts with jurisdiction
- party1.company, party1.printName, party1.title, party1.noticeAddress (Provider)
- party2.company, party2.printName, party2.title, party2.noticeAddress (Customer)
""",
    },
    "Data Processing Agreement": {
        "aliases": ["DPA", "GDPR agreement", "data processing", "data protection agreement"],
        "description": "A GDPR-compliant agreement governing how a data processor handles personal data on behalf of a data controller.",
        "party1Label": "Processor (Provider)",
        "party2Label": "Controller (Customer)",
        "requiredFields": [
            "servicesDescription",
            "processingPurposes",
            "personalDataTypes",
            "effectiveDate",
            "governingLaw",
            "jurisdiction",
            "party1.company", "party1.printName", "party1.title", "party1.noticeAddress",
            "party2.company", "party2.printName", "party2.title", "party2.noticeAddress",
        ],
        "fieldDescriptions": """
- servicesDescription: Description of services involving personal data processing
- processingPurposes: The purposes for which personal data is processed
- personalDataTypes: Categories of personal data being processed
- effectiveDate: Agreement start date (YYYY-MM-DD)
- governingLaw: Governing jurisdiction/law
- jurisdiction: Courts with jurisdiction
- party1.company, party1.printName, party1.title, party1.noticeAddress (Processor / Provider)
- party2.company, party2.printName, party2.title, party2.noticeAddress (Controller / Customer)
""",
    },
    "Design Partner Agreement": {
        "aliases": ["design partner", "design partnership", "beta partner agreement"],
        "description": "An agreement for early-stage design partnerships where a customer provides feedback in exchange for early access.",
        "party1Label": "Provider",
        "party2Label": "Design Partner",
        "requiredFields": [
            "productName",
            "effectiveDate",
            "pilotDuration",
            "feedbackObligations",
            "governingLaw",
            "jurisdiction",
            "party1.company", "party1.printName", "party1.title", "party1.noticeAddress",
            "party2.company", "party2.printName", "party2.title", "party2.noticeAddress",
        ],
        "fieldDescriptions": """
- productName: Name of the product the partner will help design/test
- effectiveDate: Agreement start date (YYYY-MM-DD)
- pilotDuration: How long the design partnership lasts
- feedbackObligations: What feedback/participation is expected from the design partner
- governingLaw: US state whose laws govern
- jurisdiction: Courts with jurisdiction
- party1.company, party1.printName, party1.title, party1.noticeAddress (Provider)
- party2.company, party2.printName, party2.title, party2.noticeAddress (Design Partner)
""",
    },
    "Partnership Agreement": {
        "aliases": ["reseller agreement", "referral agreement", "partner agreement", "channel partner"],
        "description": "An agreement governing a reseller or referral partnership.",
        "party1Label": "Vendor / Provider",
        "party2Label": "Partner",
        "requiredFields": [
            "partnershipScope",
            "commissionTerms",
            "agreementTerm",
            "effectiveDate",
            "governingLaw",
            "jurisdiction",
            "party1.company", "party1.printName", "party1.title", "party1.noticeAddress",
            "party2.company", "party2.printName", "party2.title", "party2.noticeAddress",
        ],
        "fieldDescriptions": """
- partnershipScope: Scope of the partnership (e.g., geographic region, product lines, customer types)
- commissionTerms: Commission rates and payment structure for referrals/sales
- agreementTerm: Duration of the partnership agreement
- effectiveDate: Agreement start date (YYYY-MM-DD)
- governingLaw: US state whose laws govern
- jurisdiction: Courts with jurisdiction
- party1.company, party1.printName, party1.title, party1.noticeAddress (Vendor / Provider)
- party2.company, party2.printName, party2.title, party2.noticeAddress (Partner)
""",
    },
    "Pilot Agreement": {
        "aliases": ["pilot", "trial agreement", "proof of concept", "POC agreement", "evaluation agreement"],
        "description": "A short-term trial agreement allowing a customer to evaluate a provider's product.",
        "party1Label": "Provider",
        "party2Label": "Customer",
        "requiredFields": [
            "productName",
            "pilotScope",
            "pilotDuration",
            "effectiveDate",
            "governingLaw",
            "jurisdiction",
            "party1.company", "party1.printName", "party1.title", "party1.noticeAddress",
            "party2.company", "party2.printName", "party2.title", "party2.noticeAddress",
        ],
        "fieldDescriptions": """
- productName: Name of the product/service being evaluated
- pilotScope: What the customer will evaluate and any usage limits
- pilotDuration: How long the pilot/trial lasts
- effectiveDate: Pilot start date (YYYY-MM-DD)
- governingLaw: US state whose laws govern
- jurisdiction: Courts with jurisdiction
- party1.company, party1.printName, party1.title, party1.noticeAddress (Provider)
- party2.company, party2.printName, party2.title, party2.noticeAddress (Customer)
""",
    },
    "Professional Services Agreement": {
        "aliases": ["PSA", "consulting agreement", "services agreement", "statement of work"],
        "description": "An agreement governing the delivery of professional or consulting services.",
        "party1Label": "Service Provider",
        "party2Label": "Client",
        "requiredFields": [
            "servicesDescription",
            "deliverables",
            "fees",
            "paymentTerms",
            "effectiveDate",
            "governingLaw",
            "jurisdiction",
            "party1.company", "party1.printName", "party1.title", "party1.noticeAddress",
            "party2.company", "party2.printName", "party2.title", "party2.noticeAddress",
        ],
        "fieldDescriptions": """
- servicesDescription: Description of professional services to be provided
- deliverables: Specific outputs or deliverables the Provider will produce
- fees: Fee structure (hourly rate, fixed fee, etc.)
- paymentTerms: Payment schedule and terms
- effectiveDate: Agreement start date (YYYY-MM-DD)
- governingLaw: US state whose laws govern
- jurisdiction: Courts with jurisdiction
- party1.company, party1.printName, party1.title, party1.noticeAddress (Service Provider)
- party2.company, party2.printName, party2.title, party2.noticeAddress (Client)
""",
    },
    "Service Level Agreement": {
        "aliases": ["SLA", "service levels", "uptime agreement", "service quality agreement"],
        "description": "An agreement defining the service quality commitments for a cloud service.",
        "party1Label": "Provider",
        "party2Label": "Customer",
        "requiredFields": [
            "productName",
            "uptimeCommitment",
            "supportLevels",
            "serviceCreditTerms",
            "effectiveDate",
            "governingLaw",
            "jurisdiction",
            "party1.company", "party1.printName", "party1.title", "party1.noticeAddress",
            "party2.company", "party2.printName", "party2.title", "party2.noticeAddress",
        ],
        "fieldDescriptions": """
- productName: Name of the service covered by this SLA
- uptimeCommitment: Uptime guarantee percentage (e.g., "99.9%")
- supportLevels: Support tiers, response times, and escalation procedures
- serviceCreditTerms: What service credits are owed if SLA is breached
- effectiveDate: Agreement start date (YYYY-MM-DD)
- governingLaw: US state whose laws govern
- jurisdiction: Courts with jurisdiction
- party1.company, party1.printName, party1.title, party1.noticeAddress (Provider)
- party2.company, party2.printName, party2.title, party2.noticeAddress (Customer)
""",
    },
    "Software License Agreement": {
        "aliases": ["software license", "on-premise license", "perpetual license", "self-hosted software"],
        "description": "An agreement for on-premise or self-hosted software licensing.",
        "party1Label": "Licensor",
        "party2Label": "Licensee",
        "requiredFields": [
            "productName",
            "licenseScope",
            "fees",
            "paymentTerms",
            "effectiveDate",
            "governingLaw",
            "jurisdiction",
            "party1.company", "party1.printName", "party1.title", "party1.noticeAddress",
            "party2.company", "party2.printName", "party2.title", "party2.noticeAddress",
        ],
        "fieldDescriptions": """
- productName: Name of the software being licensed
- licenseScope: Type and scope of license (perpetual/subscription, number of users/seats, on-premise)
- fees: License fees and pricing
- paymentTerms: Payment schedule and terms
- effectiveDate: Agreement start date (YYYY-MM-DD)
- governingLaw: US state whose laws govern
- jurisdiction: Courts with jurisdiction
- party1.company, party1.printName, party1.title, party1.noticeAddress (Licensor)
- party2.company, party2.printName, party2.title, party2.noticeAddress (Licensee)
""",
    },
}

# Supported document names list for prompts
SUPPORTED_NAMES = list(SUPPORTED_DOCUMENTS.keys())
CATALOG_SUMMARY = "\n".join(
    f'- "{name}": {info["description"]}'
    for name, info in SUPPORTED_DOCUMENTS.items()
)

DETECTION_SYSTEM_PROMPT = f"""You are a friendly legal assistant for Prelegal. Your task is to identify what legal document the user needs, then immediately begin collecting information.

Supported documents:
{CATALOG_SUMMARY}

Instructions:
1. Greet the user warmly and ask what legal document they need.
2. If the user describes a document we support (including by common names or aliases), set documentType to the exact supported name AND immediately ask your first question about that document — do NOT just confirm and wait.
3. If the user asks for something we don't support, explain kindly that we can't generate that document, but suggest the closest supported alternative. Do NOT set documentType in that case — keep it null.
4. If the user accepts a suggested alternative, set documentType to that alternative AND immediately ask your first question.
5. CRITICAL: Your message MUST always end with a question. Never send a response that doesn't ask for something.

Current document state:
{{current_data}}

Return documentType as exactly one of: {json.dumps(SUPPORTED_NAMES)} or null if still determining.
"""


def build_document_system_prompt(doc_type: str, current_data: dict) -> str:
    info = SUPPORTED_DOCUMENTS.get(doc_type, {})
    party1_label = info.get("party1Label", "Party 1")
    party2_label = info.get("party2Label", "Party 2")
    field_descriptions = info.get("fieldDescriptions", "")
    required_fields = info.get("requiredFields", [])

    # Identify which required fields are still missing
    missing_fields = []
    for field in required_fields:
        if "." in field:
            parent, child = field.split(".", 1)
            parent_val = current_data.get(parent)
            val = parent_val.get(child) if isinstance(parent_val, dict) else None
        else:
            val = current_data.get(field)
        if not val:
            missing_fields.append(field)

    missing_summary = (
        "\n".join(f"  - {f}" for f in missing_fields)
        if missing_fields
        else "  (none — all required fields are filled!)"
    )

    return f"""You are a friendly legal assistant for Prelegal, helping the user draft a {doc_type}.

Your role:
- Have a natural, friendly conversation to gather ALL required information
- Ask about 1-2 related topics at a time to keep the conversation flowing
- Extract information the user provides and include it in the fields object
- CRITICAL: Your message MUST always end with a question about missing information — never send a response without asking something unless isComplete=true
- Keep asking until EVERY required field has a value. Do NOT stop or pause between questions.
- Only set isComplete=true when ALL required fields below are filled with non-null, non-empty values

Party 1 is: {party1_label}
Party 2 is: {party2_label}

Required fields for this {doc_type}:
{field_descriptions}

STILL MISSING (ask about these next):
{missing_summary}

Current document state:
{json.dumps(current_data, indent=2)}

Focus on the missing fields listed above. Ask about them in a natural, conversational way.
When ALL required fields are filled, congratulate the user and let them know the document is ready to download.
Only populate fields where you have learned the value from the conversation. Use null for anything not yet known."""


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/catalog")
async def get_catalog():
    return CATALOG


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    doc_type = request.documentType

    if not doc_type:
        # Phase 1: detect document type
        system_content = DETECTION_SYSTEM_PROMPT.replace(
            "{current_data}", json.dumps(request.currentData, indent=2)
        )
    else:
        # Phase 2: collect fields for the detected document type
        system_content = build_document_system_prompt(doc_type, request.currentData)

    messages = [{"role": "system", "content": system_content}]

    if not request.messages:
        messages.append({"role": "user", "content": "Hi"})
    else:
        messages.extend(
            [{"role": m.role, "content": m.content} for m in request.messages]
        )

    try:
        response = completion(
            model=MODEL,
            messages=messages,
            response_format=ChatResponse,
            extra_body=EXTRA_BODY,
            api_key=os.environ.get("OPENROUTER_API_KEY"),
        )
        content = response.choices[0].message.content
        return ChatResponse.model_validate_json(content)
    except (ValidationError, TypeError) as e:
        raise HTTPException(status_code=500, detail=f"Invalid AI response format: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service unavailable: {e}")


# Serve static frontend if the build directory exists
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
