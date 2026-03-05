import sqlite3
import os
import json
import uuid
import hashlib
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, List, Literal

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from litellm import completion
import bcrypt as _bcrypt
from jose import JWTError, jwt
import aiosmtplib
from email.message import EmailMessage

DB_PATH = Path(os.environ.get("DB_PATH", "/data/prelegal.db"))
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "out"
CATALOG_PATH = Path(__file__).parent.parent / "catalog.json"

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
RESET_TOKEN_EXPIRE_HOURS = 1
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:8000")

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(password.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            reset_token TEXT,
            reset_token_expires TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            document_type TEXT,
            fields_json TEXT NOT NULL DEFAULT '{}',
            is_complete INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )
    conn.commit()
    conn.close()


def load_catalog() -> list[dict]:
    if CATALOG_PATH.exists():
        with open(CATALOG_PATH) as f:
            return json.load(f)
    return []


CATALOG: list[dict] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global CATALOG
    init_db()
    CATALOG = load_catalog()
    yield


app = FastAPI(title="Prelegal API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[APP_BASE_URL, "http://localhost:8000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


def create_access_token(user_id: int, email: str, name: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "email": email, "name": name, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def send_reset_email(to_email: str, name: str, reset_link: str) -> None:
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")

    if not smtp_host or not smtp_user or not smtp_pass:
        raise ValueError("SMTP credentials not configured")

    msg = EmailMessage()
    msg["From"] = smtp_user
    msg["To"] = to_email
    msg["Subject"] = "Reset your Prelegal password"
    msg.set_content(
        f"""Hi {name},

You requested a password reset for your Prelegal account.
Click the link below to reset your password (expires in {RESET_TOKEN_EXPIRE_HOURS} hour):

{reset_link}

If you didn't request this, you can safely ignore this email.

— The Prelegal Team
"""
    )

    await aiosmtplib.send(
        msg,
        hostname=smtp_host,
        port=smtp_port,
        username=smtp_user,
        password=smtp_pass,
        start_tls=True,
    )


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


# --- Auth models ---


class UserInfo(BaseModel):
    id: int
    name: str
    email: str


class AuthResponse(BaseModel):
    token: str
    user: UserInfo


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# --- Document models ---


class SaveDocumentRequest(BaseModel):
    title: str
    documentType: Optional[str] = None
    fields: dict = {}
    isComplete: bool = False


class UpdateDocumentRequest(BaseModel):
    title: Optional[str] = None
    documentType: Optional[str] = None
    fields: Optional[dict] = None
    isComplete: Optional[bool] = None


class DocumentResponse(BaseModel):
    id: int
    title: str
    documentType: Optional[str] = None
    fields: dict = {}
    isComplete: bool = False
    createdAt: str
    updatedAt: str


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


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@app.post("/api/auth/register", response_model=AuthResponse, status_code=201)
async def register(request: RegisterRequest):
    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (request.email,)
        ).fetchone()
        if existing:
            raise HTTPException(
                status_code=409, detail="An account with this email already exists"
            )

        password_hash = hash_password(request.password)
        cursor = conn.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            (request.name, request.email, password_hash),
        )
        conn.commit()
        user_id = cursor.lastrowid
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {e}")
    finally:
        conn.close()

    user_info = UserInfo(id=user_id, name=request.name, email=request.email)
    token = create_access_token(user_id, request.email, request.name)
    return AuthResponse(token=token, user=user_info)


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, name, email, password_hash FROM users WHERE email = ?",
            (request.email,),
        ).fetchone()
    finally:
        conn.close()

    if not row or not verify_password(request.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_info = UserInfo(id=row["id"], name=row["name"], email=row["email"])
    token = create_access_token(row["id"], row["email"], row["name"])
    return AuthResponse(token=token, user=user_info)


@app.post("/api/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, name FROM users WHERE email = ?", (request.email,)
        ).fetchone()
        if row:
            raw_token = str(uuid.uuid4())
            token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
            expires = (
                datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
            ).isoformat()
            conn.execute(
                "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
                (token_hash, expires, row["id"]),
            )
            conn.commit()
            reset_link = f"{APP_BASE_URL}/reset-password?token={raw_token}"
            try:
                await send_reset_email(request.email, row["name"], reset_link)
            except Exception as e:
                print(f"Warning: failed to send reset email to {request.email}: {e}")
    finally:
        conn.close()

    # Always return success to prevent email enumeration
    return {
        "message": "If an account with this email exists, you will receive a password reset link shortly."
    }


@app.post("/api/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    now = datetime.now(timezone.utc).isoformat()
    token_hash = hashlib.sha256(request.token.encode()).hexdigest()
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?",
            (token_hash, now),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")

        password_hash = hash_password(request.new_password)
        conn.execute(
            "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
            (password_hash, row["id"]),
        )
        conn.commit()
    finally:
        conn.close()

    return {"message": "Password reset successfully"}


# ---------------------------------------------------------------------------
# Document endpoints
# ---------------------------------------------------------------------------


@app.get("/api/documents", response_model=List[DocumentResponse])
async def list_documents(current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, title, document_type, fields_json, is_complete, created_at, updated_at "
            "FROM documents WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
    finally:
        conn.close()

    return [
        DocumentResponse(
            id=row["id"],
            title=row["title"],
            documentType=row["document_type"],
            fields=json.loads(row["fields_json"]),
            isComplete=bool(row["is_complete"]),
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
        )
        for row in rows
    ]


@app.post("/api/documents", response_model=DocumentResponse, status_code=201)
async def create_document(
    request: SaveDocumentRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"])
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO documents (user_id, title, document_type, fields_json, is_complete, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                user_id,
                request.title,
                request.documentType,
                json.dumps(request.fields),
                int(request.isComplete),
                now,
                now,
            ),
        )
        conn.commit()
        doc_id = cursor.lastrowid
    finally:
        conn.close()

    return DocumentResponse(
        id=doc_id,
        title=request.title,
        documentType=request.documentType,
        fields=request.fields,
        isComplete=request.isComplete,
        createdAt=now,
        updatedAt=now,
    )


@app.put("/api/documents/{doc_id}", response_model=DocumentResponse)
async def update_document(
    doc_id: int,
    request: UpdateDocumentRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"])
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user_id),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        new_title = request.title if request.title is not None else row["title"]
        new_doc_type = request.documentType if request.documentType is not None else row["document_type"]
        new_fields_json = json.dumps(request.fields) if request.fields is not None else row["fields_json"]
        new_complete = int(request.isComplete) if request.isComplete is not None else row["is_complete"]

        conn.execute(
            "UPDATE documents SET title = ?, document_type = ?, fields_json = ?, is_complete = ?, updated_at = ? WHERE id = ?",
            (new_title, new_doc_type, new_fields_json, new_complete, now, doc_id),
        )
        conn.commit()
    finally:
        conn.close()

    return DocumentResponse(
        id=doc_id,
        title=new_title,
        documentType=new_doc_type,
        fields=json.loads(new_fields_json),
        isComplete=bool(new_complete),
        createdAt=row["created_at"],
        updatedAt=now,
    )


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user_id),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
    finally:
        conn.close()

    return {"message": "Document deleted"}


# ---------------------------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------------------------


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
