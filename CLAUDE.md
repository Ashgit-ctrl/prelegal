# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation has an AI chat interface (left panel) that guides the user through drafting any of the 11 supported legal documents, with a live preview (right panel) and PDF download, behind a real JWT-based login/signup screen, served via FastAPI in Docker. Documents are persisted per-user in SQLite and accessible from a collapsible "My Documents" sidebar.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation Status

### Completed (PL-3)
- Mutual NDA form with live preview and PDF download (`@react-pdf/renderer`)
- Next.js 16 frontend with Tailwind CSS and shadcn/ui components

### Completed (PL-4)
- Docker multi-stage build (Node 22 Alpine for frontend build, Python 3.12 slim for runtime)
- FastAPI backend (`backend/`) as a `uv` project with SQLite (fresh DB each container start, `users` table)
- Next.js static export (`output: 'export'`) served by FastAPI at localhost:8000
- Fake login screen — collects name + email, stored in `localStorage`, gates access to main app (no real auth)
- Start/stop scripts for Mac, Linux, and Windows

### Completed (PL-5)
- AI chat interface replaces the manual form (left panel)
- `POST /api/chat` backend endpoint using LiteLLM → OpenRouter → Cerebras (`openrouter/openai/gpt-oss-120b`) with Pydantic structured outputs
- AI greets the user on load, asks conversational questions, and populates the NDA preview in real-time
- `litellm` and `pydantic` added to backend deps; `env_file: .env` added to docker-compose

### Completed (PL-6)
- All 11 document types supported (see catalog.json)
- Two-phase AI chat: document-type detection → field collection with per-document system prompts
- `DocumentFieldsUpdate` unified field model covers all document types (TypeScript + Pydantic)
- `GenericDocumentPreview` live cover-page preview with yellow placeholders for missing fields
- `GenericDocumentPDF` PDF generation for all document types (`@react-pdf/renderer`)
  - NOTE: react-pdf does NOT support `border` shorthand or `gap` — always use individual `borderWidth`/`borderStyle`/`borderColor` and `marginRight`
- AI always asks a question after every response; immediately starts collecting fields after document type is detected
- `GET /api/catalog` endpoint returns catalog
- `POST /api/chat` updated: accepts `documentType`, returns `{ message, documentType, fields, isComplete }`

### Completed (PL-7)
- Real authentication: sign up (`POST /api/auth/register`), sign in (`POST /api/auth/login`), forgot/reset password via SMTP email (`POST /api/auth/forgot-password`, `POST /api/auth/reset-password`)
- JWT tokens (`python-jose`), bcrypt password hashing (used directly — NOT passlib, which is incompatible with bcrypt 4.x)
- Reset tokens: raw UUID sent in email, SHA-256 hash stored in DB
- Document persistence: SQLite `documents` table, per-user isolation, auto-saved on every AI turn
- `AuthProvider` context (`frontend/src/contexts/auth-context.tsx`) with JWT in `localStorage`; `authFetch` helper (`frontend/src/lib/api.ts`) adds `Authorization: Bearer` header
- Collapsible "My Documents" sidebar (280px) — list, open, delete, new document
- Draft disclaimer amber banner on all document previews
- Layout fixed to `h-screen` so chat panel scrolls internally without scrolling the page
- `python-jose[cryptography]`, `bcrypt>=4.0`, `aiosmtplib>=3.0` added to backend deps
- Docker volume `prelegal_data:/data` for persistent DB across container restarts
- New pages: `/signup`, `/forgot-password`, `/reset-password`

### Not Yet Implemented
- (nothing planned)

### Current API Endpoints
- `GET /api/health` - Health check
- `GET /api/catalog` - Returns list of supported documents
- `POST /api/chat` - AI chat; accepts `{ messages, currentData, documentType }`, returns `{ message, documentType, fields, isComplete }`
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in, returns JWT
- `POST /api/auth/forgot-password` - Send password reset email
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/documents` - List user's documents
- `POST /api/documents` - Create document
- `PUT /api/documents/{id}` - Update document
- `DELETE /api/documents/{id}` - Delete document