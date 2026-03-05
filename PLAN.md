# Prelegal — Autonomous Build Plan

This document describes how I would build the Prelegal project from scratch using my full
autonomous capabilities: agentic subprocesses, MCP servers, and skills.

---

## Capabilities Available

### Skills
| Skill | Purpose |
|---|---|
| `feature-dev:feature-dev` | Structured 7-phase feature development (explore → clarify → architect → implement → review → summarise) |
| `code-review:code-review` | Dedicated PR review with bug, quality, and convention passes |
| `simplify` | Post-implementation code simplification and DRY pass |
| `cerebras` | LiteLLM via OpenRouter to `openrouter/openai/gpt-oss-120b` with Cerebras inference |

### MCP Servers
| Server | Tools Used |
|---|---|
| **GitHub** (`mcp__github__*`) | Create/read issues, branches, PRs; push files; request Copilot reviews; search code |
| **Atlassian** (`mcp__atlassian__*`) | Read Jira tickets (feature specs), update issue status, add comments; search Confluence for design docs |
| **IDE** (`mcp__ide__*`) | Get real-time TypeScript/Python diagnostics without running a build; execute notebook cells for data exploration |

### Agent Types (via `Agent` tool)
| Agent | Purpose |
|---|---|
| `feature-dev:code-explorer` | Deep codebase tracing — abstractions, data flow, conventions |
| `feature-dev:code-architect` | Generate and compare implementation approaches |
| `feature-dev:code-reviewer` | Post-implementation review (bugs, DRY, project conventions) |
| `Explore` | Fast keyword/file searches across the repo |
| `Plan` | Design architecture when a task is complex but doesn't warrant a full feature-dev cycle |
| `general-purpose` | Parallel research tasks — documentation lookups, multi-file analysis |

---

## Phase-by-Phase Build Plan

### Phase 0 — Project Bootstrap
**Goal:** Scaffold repo structure, tooling, and CI skeleton before any feature work begins.

**Actions:**
1. Create GitHub repo via `mcp__github__create_repository`
2. Push initial scaffold (monorepo layout: `backend/`, `frontend/`, `scripts/`, `templates/`) via `mcp__github__push_files`
3. Configure branch protection on `main`
4. Write `CLAUDE.md` with project conventions, colour scheme, and technical design constraints
5. Write `catalog.json` with all 11 document types

**No skill invocation needed** — pure file and GitHub tool operations.

---

### Phase 1 — Infrastructure (PL-4 equivalent)
**Goal:** Docker + FastAPI backend + Next.js static export + SQLite + start/stop scripts.

**Workflow:**
1. Read Jira ticket via `mcp__atlassian__getJiraIssue`
2. Invoke **`feature-dev:feature-dev`** skill:
   - **Explore phase:** Launch 2 `code-explorer` agents in parallel — one mapping the FastAPI+uv project conventions, one tracing Next.js static export patterns
   - **Architect phase:** Launch 2 `code-architect` agents — (a) minimal: single Dockerfile multi-stage, (b) clean: separate compose services. Choose (a) for simplicity.
   - **Implement:** Write `Dockerfile`, `docker-compose.yml`, `backend/pyproject.toml`, `backend/main.py` (skeleton), Next.js config (`output: 'export'`), platform scripts
   - **Review phase:** Launch 3 `code-reviewer` agents (simplicity, correctness, conventions); fix issues
3. Build frontend locally to verify static export
4. Submit PR via `mcp__github__create_pull_request`
5. Request Copilot review via `mcp__github__request_copilot_review`
6. Transition Jira ticket to Done via `mcp__atlassian__transitionJiraIssue`

---

### Phase 2 — Document Templates + Catalog (PL-3 equivalent)
**Goal:** Mutual NDA form with live preview and PDF download.

**Workflow:**
1. Read Jira ticket
2. Invoke **`feature-dev:feature-dev`**:
   - **Explore:** `code-explorer` agent traces `@react-pdf/renderer` patterns; note known limitations (no `border` shorthand, no `gap`, no `paddingVertical`)
   - **Implement:** `NDAPreview`, `NDAFormPDF`, `GenericDocumentPreview`, `GenericDocumentPDF`, `DocumentCatalogPanel`, unified `DocumentFieldsUpdate` TypeScript + Pydantic types
   - **Review:** `code-reviewer` agents — pay special attention to react-pdf CSS compatibility
3. Use `mcp__ide__getDiagnostics` to catch TypeScript errors without running a full build
4. PR + Jira transition

---

### Phase 3 — AI Chat Interface (PL-5 / PL-6 equivalent)
**Goal:** Two-phase AI chat (document type detection → field collection) for all 11 document types.

**Workflow:**
1. Read Jira ticket
2. Invoke **`feature-dev:feature-dev`**:
   - **Explore:** 3 parallel `code-explorer` agents:
     - Agent A: trace `POST /api/chat` contract and LiteLLM integration patterns
     - Agent B: map `DocumentFieldsUpdate` field coverage per document type
     - Agent C: analyse AI prompt design — "STILL MISSING" list, always-ask-a-question rule
   - **Clarify:** Confirm structured output schema, per-document system prompts, field merge strategy
   - **Architect:** `code-architect` agent designs the two-phase state machine (detect type → collect fields → mark complete)
   - **Implement:**
     - Backend: `POST /api/chat` with LiteLLM → **`cerebras` skill** (OpenRouter, `openrouter/openai/gpt-oss-120b`, Pydantic structured outputs)
     - Frontend: `DocumentChat` component, `mergeDocumentFields` helper, live preview wiring
   - **Review:** 3 `code-reviewer` agents; run `mcp__ide__getDiagnostics` for TS errors
3. PR + Jira transition

---

### Phase 4 — Real Authentication & Document Persistence (PL-7 equivalent)
**Goal:** JWT sign-up/sign-in, password reset via SMTP, per-user document CRUD, My Documents sidebar.

**Workflow:**
1. Read Jira ticket via `mcp__atlassian__getJiraIssue`; search Confluence for any auth design docs via `mcp__atlassian__searchConfluenceUsingCql`
2. Invoke **`feature-dev:feature-dev`**:
   - **Explore:** 3 parallel `code-explorer` agents:
     - Agent A: existing auth surface (login page, localStorage usage) and what needs replacing
     - Agent B: FastAPI auth patterns — JWT middleware, dependency injection, CORS
     - Agent C: frontend state management — AuthProvider pattern, authFetch helper
   - **Clarify:** Password reset delivery (SMTP generic), document editing UX (reload chat with pre-filled fields), sidebar placement, auto-save trigger
   - **Architect:** 3 `code-architect` agents — (a) minimal patches, (b) clean separation with auth middleware, (c) pragmatic balance. Choose (b).
   - **Implement:**
     - Backend: `hash_password`/`verify_password` with `bcrypt` directly (NOT passlib — incompatible with bcrypt 4.x), JWT via `python-jose`, SMTP via `aiosmtplib`, SHA-256 hashed reset tokens, `documents` table, all auth + CRUD endpoints
     - Frontend: `AuthProvider`, `authFetch`, login/signup/forgot-password/reset-password pages (Next.js App Router + Suspense for `useSearchParams`), `MyDocumentsSidebar`, auto-save `useEffect`, draft disclaimer banner
     - Layout: change root div from `min-h-screen` → `h-screen` so `overflow-hidden` flex chain is properly bounded and the chat panel scrolls internally
   - **Review:** 3 `code-reviewer` agents (bugs, DRY/simplicity, project conventions)
   - **Test:** Backend: pytest with `TestRegister`, `TestLogin`, `TestPasswordReset`, `TestDocuments` classes (57 tests). Frontend: `npm run build` + `mcp__ide__getDiagnostics`.
3. Invoke **`simplify`** skill on recently modified files
4. PR via `mcp__github__create_pull_request`; request Copilot review
5. Transition Jira ticket; add completion comment via `mcp__atlassian__addCommentToJiraIssue`

---

## Parallel Execution Strategy

Where Jira tickets are independent, I would launch multiple **`feature-dev:feature-dev`** invocations
(or `general-purpose` agents) in parallel using background mode, collecting results before merging.
For example, document templates (Phase 2) and infrastructure hardening could run concurrently.

GitHub operations — creating branches, pushing files, opening PRs — are always sequential per ticket
to avoid merge conflicts.

---

## Quality Gates (applied at every phase)

| Gate | Tool |
|---|---|
| TypeScript errors | `mcp__ide__getDiagnostics` (no build needed) |
| Python errors | `mcp__ide__getDiagnostics` + pytest |
| Code quality | 3 parallel `code-reviewer` agents |
| Simplicity/DRY | `simplify` skill post-implementation |
| PR review | `mcp__github__request_copilot_review` |
| Spec compliance | Re-read Jira ticket via `mcp__atlassian__getJiraIssue`; verify all acceptance criteria |

---

## Known Gotchas (learned during build)

- **react-pdf:** No `border` shorthand, no `gap`, no `paddingVertical`/`paddingHorizontal` — always use individual properties
- **bcrypt 4.x:** Do NOT use `passlib` — it reads `bcrypt.__about__.__version__` which no longer exists. Use `bcrypt.hashpw` / `bcrypt.checkpw` directly.
- **Next.js static export + `useSearchParams`:** Must wrap in `<Suspense>` or build fails
- **Flex height chains:** Use `h-screen` (not `min-h-screen`) on the root layout div so nested `overflow-hidden` / `overflow-y-auto` containers are properly bounded
- **Auto-save stale closures:** Avoid `useCallback` + suppressed deps for save logic; use a single inline `useEffect` that captures all values from the current render
- **SQLite in Docker:** Mount a named volume at `/data` so the DB survives container restarts; keep DB path in an env var

---

## Summary

The entire project — from blank repo to deployed Docker container with AI-powered legal document
drafting, real authentication, and document persistence — can be built autonomously by combining:

- **Atlassian MCP** to read specs and update ticket status
- **GitHub MCP** to manage branches, commits, PRs, and code reviews
- **`feature-dev:feature-dev` skill** for structured, high-quality feature development
- **`cerebras` skill** for LLM integration (OpenRouter + Cerebras inference)
- **`code-review:code-review` and `simplify` skills** for quality assurance
- **`mcp__ide__getDiagnostics`** for fast type-checking without manual build steps
- **Parallel `Agent` invocations** to explore, architect, and review independently at each phase
