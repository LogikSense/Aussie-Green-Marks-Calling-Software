# AI Voice Calling Platform – Product & Technical Plan

This product is an **AI Voice Calling platform** (inbound and outbound), in the same space as Bland, Vapi, Retell, and similar. Users configure voice agents, manage phone numbers, run outbound and inbound calls, and consume call results. CRM, Excel, and other sources are **contact/lead sources** to determine who to call, not the product core.

This document analyzes the current demo, defines target architecture, and specifies backend/frontend structure, repository layout, and integration strategy for a production SaaS.

---

## 1. Product Identity

- **What it is:** SaaS for AI-powered voice calls – outbound (scheduled or triggered) and inbound (e.g. number-based routing to agents). Users set up voice agents, connect phone numbers, import or sync contacts, schedule or receive calls, and get results (recordings, transcripts, outcomes).
- **What it is not:** A CRM or “CRM verification tool.” CRM is one possible **data source** for contacts to call.
- **Peers / competitors:** Bland, Vapi, Retell, Twilio (voice AI), and similar AI voice calling platforms.

---

## 2. Demo Analysis (Voice-Calling Lens)

### 2.1 Core: Voice & Calls

| Area | Feature | Backend | Frontend |
|------|---------|---------|----------|
| **Voice provider** | Connect and use a voice AI provider (Vapi) | `POST /api/vapi/test-connection`, proxy to Vapi for assistants | API Settings: Vapi API key, phone number ID, assistant ID |
| **Outbound calls** | Schedule calls at date/time (timezone-aware) | `POST /api/calls/schedule` – calls Vapi API to create call with `assistantId`, `phoneNumberId`, `schedulePlan.earliestAt` | Schedule tab: date, time, timezone, max retries, batch selection |
| **Call status** | Check call state from provider | `GET /api/calls/{id}/status` – proxy to Vapi | Implicit via results / webhooks |
| **Webhooks** | Receive call lifecycle from provider | `POST /api/webhook/vapi`, `POST /api/v1/webhooks/vapi`, `POST /api/v1/webhooks/custom` | Configurable webhook URL when scheduling |
| **Call results** | List completed calls, outcomes, stats | In-memory `calls_db` / `completed_calls_db`; `GET /api/v1/calls`, `GET /api/v1/calls/results/completed`, `GET /api/v1/stats` | Results tab: outcomes, verified/failed fields, export, stats cards |
| **Verification config** | Which fields the agent verifies (use-case specific) | Not persisted in backend today | Verification Config tab (UI only) – can drive agent config later |

### 2.2 Contact / Lead Sources (Data for Who to Call)

| Area | Feature | Backend | Frontend |
|------|---------|---------|----------|
| **External API (e.g. CRM)** | Pull contacts from a REST API | `POST /api/crm/test-connection`, `POST /api/customers/import-crm` | Test CRM, “Import from CRM” |
| **File upload** | Import contacts from Excel/CSV | `POST /api/customers/import-excel`, `POST /api/customers/import-batch` | File upload, column mapping modal |
| **Contacts CRUD** | Store and list contacts used for calling | `POST/GET /api/v1/customers` (API key optional for some routes) | Table, select-all, use in Schedule |

### 2.3 Platform & Access

| Area | Feature | Backend | Frontend |
|------|---------|---------|----------|
| **Auth** | API key for programmatic access | `API_KEYS` env, Bearer, `verify_api_key`, `optional_api_key` | Settings: current key, generate, list |
| **Automation** | n8n, Zapier, Make | Public REST API v1 + API key; webhooks for inbound events | API Documentation tab, Swagger/ReDoc |

### 2.4 Integrations (Voice-First View)

- **Voice providers (core):**  
  - **Vapi (current):** Outbound scheduling, assistant, phone number, webhooks. Backend proxies `api.vapi.ai`.  
  - **Future:** Bland, Retell, Twilio Voice, or others – each as a pluggable provider (inbound/outbound, numbers, agents).

- **Contact sources (inputs for calls):**  
  - **Generic REST (e.g. “CRM”):** Configurable base URL + API key, test connection, fetch contacts.  
  - **Excel/CSV:** Upload + column mapping, batch sync into platform contacts.  
  - **Future:** Salesforce, HubSpot, or other CRMs as optional adapters.

- **Automation / ecosystem:**  
  - REST API (create contacts, schedule calls, get results) and webhooks so n8n, Zapier, Make can drive or consume the platform.

### 2.5 Gaps and Future-Proofing

- **Persistence:** All state in memory; no DB or migrations.
- **Multi-tenancy:** No org/workspace/user model.
- **Auth:** No user login; only API keys for integrations.
- **Voice:** Single provider (Vapi); no abstraction for multiple providers (Bland, Retell, etc.).
- **Inbound:** Demo is outbound-only; inbound flows (e.g. number → agent) to be designed.
- **Webhooks:** Vapi webhook received but not fully driving call state (e.g. completed → stored results).
- **Frontend:** Single SPA, one large component; no Next.js, no shared design system beyond Tailwind.
- **Config:** API keys and provider config in env/localStorage; no per-tenant or per-in## 3. Backend Choice: Python (FastAPI) + SQLAlchemy

The platform uses a **Python (FastAPI) + SQLAlchemy + SQLite/PostgreSQL** architecture:

1. **High Performance & Developer Velocity**  
   FastAPI is built on ASGI (Starlette / Uvicorn), providing extremely fast asynchronous request handling, perfect for call webhooks and real-time events.

2. **Database Integration**  
   SQLAlchemy provides a powerful Object Relational Mapper (ORM) mapped to SQLite for local development (`crm_outcalling.db`) and PostgreSQL for production, managed with Alembic or schema synchronization.

3. **Twilio Telephony & Call Control**  
   Python has native, well-supported SDKs for Twilio Voice and Vapi. FastAPI routes handle warm call transfers, supervisor session controls (whisper, listen, barge, takeover), and spam reputation tracking.

4. **Background Task Execution**  
   FastAPI's built-in background tasks (or Celery/Redis for scaling) handle asynchronous actions like batch customer imports, webhook dispatches, and retries.

---

## 4. Frontend Stack

- **Framework:** React SPA bootstrapped with Vite.
- **Routing:** React Router v6.
- **Styling:** Tailwind CSS + Vanilla CSS custom components.
- **Icons:** Lucide React.
- **State Management:** React Context (Auth, Theme) + Local state hooks.

---

## 5. Authentication & Scoping (SaaS)

User-facing authentication, session management, and programmatic API keys are scoped by **Tenant** (Organization) to ensure data isolation.

### 5.1 Auth Scope

| Concern | Purpose |
|---|---|
| **User Registration** | Sign up with email + password; create user under default tenant. |
| **Login** | Verify credentials; issue access token (JWT) and refresh token (opaque string). |
| **Session Management** | Short-lived access token (JWT) verified in memory. Long-lived refresh token stored in database with rotation. |
| **Password Reset** | Request reset link (forgot-password) producing time-limited token; set new password. |
| **API Keys** | Database-backed API keys (`api_keys` table) scoped to user's tenant for third-party scripts/automation. |
| **Multi-Tenancy** | Every key object (Campaigns, Customers, Twilio Numbers) belongs to a `tenant_id` and queries filter by the requester's `tenant_id`. |

### 5.2 Backend Auth Implementation (FastAPI)

- **Register/Login** (`/auth/register`, `/auth/login`): Hash password using bcrypt. Generate access token (JWT, short lifespan) and refresh token (cryptographically secure opaque string). Store refresh token hash and expiry in the database.
- **Token Refresh** (`/auth/refresh`): Validate incoming refresh token against database. Issue new access token and rotated refresh token (revoking the old one).
- **Password Reset** (`/auth/forgot-password`, `/auth/reset-password`): Generate single-use tokens stored in `password_reset_tokens`. In production, trigger reset emails; in local testing, output the reset link to console logs.
- **API Keys** (`/api/v1/api-keys/*`): Programmatic access via `Authorization: Bearer <key>`. Validate key hash against database `ApiKey` table to identify user and scope.

### 5.3 Database Entities for Auth (SQLAlchemy)

- **User:** `id`, `email`, `password_hash`, `full_name`, `role`, `tenant_id`, `is_active`, `created_at`.
- **Tenant:** `id`, `name`, `domain`, `white_label_config`, `created_at`.
- **RefreshToken:** `id`, `user_id`, `token_hash`, `created_at`, `expires_at`, `revoked_at`.
- **PasswordResetToken:** `id`, `user_id`, `token_hash`, `created_at`, `expires_at`, `used_at`.
- **ApiKey:** `id`, `user_id`, `name`, `key_hash`, `key_prefix`, `created_at`, `expires_at`, `last_used_at`, `is_active`, `tenant_id`.

---

## 6. Repository Structure

```
calling-software/
├── backend/                  # FastAPI Backend
│   ├── routers/              # Sub-routers (auth, twilio, telephony, chatwoot, spam)
│   ├── auth.py               # Cryptography, JWT verification, API key guards
│   ├── database.py           # SQLite connection & engine
│   ├── models.py             # SQLAlchemy schemas
│   ├── main.py               # Main entrypoint & lifespan
│   └── requirements.txt      # Python dependencies
├── src/                      # React Frontend (Vite)
│   ├── components/           # UI and layout components
│   ├── context/              # Context (AuthContext, ThemeContext)
│   ├── pages/                # Views (Dashboard, Settings, Campaigns, ManualDialer)
│   └── App.jsx               # React Router configurations
├── package.json              # Vite scripts & node dependencies
└── docs/                     # Product plans and markdown docs
```

--- contact sources (import from CRM, Excel), settings, API docs.
- **apps/api:** REST API + webhooks; voice provider abstraction; contact and call lifecycle.
- **packages/types:** Shared types for calls, contacts, agents, and provider-specific payloads.

---

## 7. Backend Structure (NestJS + Prisma) – Voice-First

### 7.1 High-level layout

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/                  # Guards, decorators, filters, pipes
│   ├── config/
│   ├── modules/
│   │   ├── call/               # Call lifecycle, list, results, stats
│   │   │   ├── call.module.ts
│   │   │   ├── call.controller.ts
│   │   │   ├── call.service.ts
│   │   │   └── dto/
│   │   ├── contact/            # Contacts (who to call) – replaces “customer” naming
│   │   │   ├── contact.module.ts
│   │   │   ├── contact.controller.ts
│   │   │   ├── contact.service.ts
│   │   │   └── dto/
│   │   ├── voice/              # Voice provider abstraction
│   │   │   ├── voice.module.ts
│   │   │   ├── voice.service.ts           # Dispatches to provider by config
│   │   │   ├── providers/
│   │   │   │   ├── voice-provider.interface.ts
│   │   │   │   ├── vapi/
│   │   │   │   │   ├── vapi.provider.ts
│   │   │   │   │   └── vapi.types.ts
│   │   │   │   ├── bland/                 # Future
│   │   │   │   │   └── bland.provider.ts
│   │   │   │   └── (retell, twilio, …)
│   │   │   └── dto/
│   │   ├── webhook/
---

### 7.1 Backend Structure & Routing (FastAPI)

- **Authentication router (`backend/routers/auth_router.py`):** Register, login, refresh tokens, logout, forgot-password, reset-password, get current user (`/me`).
- **Twilio integration router (`backend/routers/twilio_router.py`):** Twilio access tokens for client softphone, phone number search, purchase, list, assignment.
- **Telephony router (`backend/routers/telephony_router.py`):** Blind transfers, warm transfers, supervisor sessions (listen, whisper, barge, takeover), agent queues.
- **Spam protection router (`backend/routers/spam_protection_router.py`):** Spam reputation dashboards, rotation, spare line management.
- **Chatwoot router (`backend/routers/chatwoot_router.py`):** Chatwoot webhook integrations and message synchronization.

### 7.2 Multi-Tenant Scoping (SQLAlchemy)

All operations on database entities (except globally system-defined tables) are scoped by `tenant_id`:
- **Campaigns, Customers, Twilio Phone Numbers, Queues:** Automatically query with a `.filter(Model.tenant_id == current_user.tenant_id)` clause.
- **Database inserts:** Assign the `tenant_id` of the authenticated user to the model's `tenant_id` attribute.

---

## 8. Frontend Structure (Vite React SPA)

- **Auth Context (`src/context/AuthContext.jsx`):** Exposes `user`, `token` (JWT access token), `isAuthenticated`, login, register, logout, and automatic access token refresh handling using the refresh token.
- **Settings View (`src/pages/SettingsView.jsx`):** Custom dashboard with sections for AI core config, system webhooks, and API key management (enabling users to generate, view, and revoke database-backed programmatic API keys).

---

## 9. Integrations Roadmap (SaaS Stack)

1. **Database-backed Sessions:** Opaque refresh token rotation in database table to enable secure session state.
2. **Persistent API Keys:** API keys stored as SHA-256 hashes in `api_keys` table. Programmatic endpoints validate these against the owner user and apply tenant filters.
3. **Password Resets:** Automated secure single-use forgot/reset tokens.
4. **Softphone & Supervisor Control:** Rich real-time call control (bridges, listen/whisper/barge, transfers).
5. **Spam Reputation & Health Checks:** Real-time spam complaints monitoring, dynamic replacement (spare line rotations).

---

## 10. Implementation Order

1. **Database Schema updates:** Add SQLAlchemy models for RefreshToken, PasswordResetToken, ApiKey in `backend/models.py`.
2. **Auth Service updates:** Implement verify and rotation helpers in `backend/auth.py`.
3. **Auth Router implementation:** Build `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password` endpoints in `backend/routers/auth_router.py`.
4. **API Key Persistent Endpoints:** Migrate key listing/revoking/generation in `backend/main.py` to use `ApiKey` table.
5. **Tenant Scoping:** Apply `tenant_id` filters to active campaigns, customer imports, and calls in `backend/main.py`.
6. **Frontend Integration:** Hook refresh token handling into `AuthContext.jsx`, and create the API key table/actions interface in `SettingsView.jsx`.

---

## 11. Summary

- **Product:** AI Voice Calling platform. Core contains outbound campaign managers, manual dialers, incoming line routing, and supervisor controls.
- **Backend:** Python FastAPI + SQLAlchemy + SQLite, modularized into routers (auth, twilio, telephony, chatwoot, spam). Secure session rotation, database-persisted API keys, and multi-tenant scoping.
- **Frontend:** Vite React SPA with Tailwind CSS styling, React Router routing, transparent token refreshers, and clean integrated dashboards.
- **Auth:** User registration (email + password), login (access JWT + refresh token), logout, password reset (forgot-password + reset with time-limited token). All data scoped by Tenant (multi-tenant). API keys for programmatic access, created by authenticated users and scoped to tenant. Config in env; no hardcoded secrets.
- **Repo:** Monorepo with `backend` (FastAPI) and `src` (React/Vite).
- **Integrations:** Voice providers first (Twilio, Vapi, etc.); contact sources second (REST, Excel, etc.). Centralized router logic for webhook handling.

This plan aligns with the must-remember SKILL (voice agents, inbound/outbound, SaaS, no mocks, config-driven, clean code) and treats the product as an AI Voice Calling platform with solid SaaS authentication and multi-tenant readiness.
