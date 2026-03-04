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

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}


def init_db() -> None:
    """Create a fresh SQLite database with the users table."""
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Prelegal API", lifespan=lifespan)


# --- Chat models ---


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class PartyDetailsUpdate(BaseModel):
    company: Optional[str] = None
    printName: Optional[str] = None
    title: Optional[str] = None
    noticeAddress: Optional[str] = None


class NDAFieldsUpdate(BaseModel):
    purpose: Optional[str] = None
    effectiveDate: Optional[str] = None
    mndaTermType: Optional[Literal["expires", "until-terminated"]] = None
    mndaTermYears: Optional[int] = None
    confidentialityTermType: Optional[Literal["years", "perpetuity"]] = None
    confidentialityTermYears: Optional[int] = None
    governingLaw: Optional[str] = None
    jurisdiction: Optional[str] = None
    modifications: Optional[str] = None
    party1: Optional[PartyDetailsUpdate] = None
    party2: Optional[PartyDetailsUpdate] = None


class ChatResponse(BaseModel):
    message: str
    fields: NDAFieldsUpdate


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    currentData: dict


SYSTEM_PROMPT = """You are a friendly legal assistant for Prelegal, helping the user draft a Mutual Non-Disclosure Agreement (MNDA).

Your role:
- Have a natural, friendly conversation to gather all information needed for the MNDA
- Ask about 1-2 topics at a time — don't overwhelm the user with too many questions at once
- Extract information the user provides and include it in the fields object
- Once all required fields are gathered, congratulate the user and let them know the document is ready to download

The MNDA requires:
- purpose: Business purpose for sharing confidential information
- effectiveDate: Agreement effective date (YYYY-MM-DD format)
- mndaTermType: "expires" (fixed term) or "until-terminated" (ongoing until cancelled by either party)
- mndaTermYears: Number of years for the MNDA term (only needed if mndaTermType is "expires")
- confidentialityTermType: "years" (for N years) or "perpetuity" (forever)
- confidentialityTermYears: Number of years confidentiality obligations last (only needed if confidentialityTermType is "years")
- governingLaw: US state whose laws govern this agreement (e.g., "Delaware")
- jurisdiction: Courts with jurisdiction (e.g., "courts located in New Castle County, Delaware")
- modifications: Any specific modifications to the standard MNDA terms (can be blank if none)
- party1.company, party1.printName, party1.title, party1.noticeAddress: First party details
- party2.company, party2.printName, party2.title, party2.noticeAddress: Second party details

Current document state:
{current_data}

Only populate fields where you have learned the value from the conversation. Use null for anything not yet known."""


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    system_content = SYSTEM_PROMPT.format(
        current_data=json.dumps(request.currentData, indent=2)
    )

    messages = [{"role": "system", "content": system_content}]

    if not request.messages:
        # No history yet — trigger the AI to send the opening greeting
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
