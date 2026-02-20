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
- **Config:** API keys and provider config in env/localStorage; no per-tenant or per-integration store.

---

## 3. Backend Choice: NestJS + Prisma vs Python (FastAPI)

**Clarification:** Prisma is an ORM, not a backend framework. The choice is:

- **Option A:** **NestJS (Node/TypeScript) + Prisma** – backend framework + ORM.
- **Option B:** **Python (FastAPI) + SQLAlchemy or Tortoise** – keep current stack, add ORM + DB.

### 3.1 Recommendation: **NestJS + Prisma**

Reasons for an **AI Voice Calling** product:

1. **Single language (TypeScript)**  
   Next.js (frontend) + NestJS (backend) share types and contracts; easier to keep call/agent/contact DTOs in sync.

2. **Modular structure for many voice providers**  
   One module per provider: `VapiModule`, later `BlandModule`, `RetellModule`, `TwilioModule`. Each owns config, API client, and webhook handling. Fits “Vapi now, Bland and others later.”

3. **Voice-first abstraction**  
   `VoiceProvider` interface (e.g. `scheduleOutbound`, `getCallStatus`, `handleInbound`, optional `testConnection`). `VoiceService` selects provider by config and delegates. Call and contact modules stay provider-agnostic.

4. **Real-time and queues**  
   NestJS ecosystem (WebSockets, Bull/BullMQ) aligns with call events, webhooks, and scheduled jobs.

5. **Prisma**  
   Type-safe schema and migrations for calls, contacts, agents, numbers, and later tenants and API keys.

6. **Ecosystem and hiring**  
   One TypeScript codebase; voice/integration work is mostly HTTP and events, not ML-in-process – Node is a good fit.

**When to choose FastAPI:**  
Keep or migrate to FastAPI if the team is Python-first or if you need heavy ML/audio pipelines in the same process.

**Conclusion:**  
For a scalable **AI Voice Calling** platform with multiple voice providers and a Next.js frontend, **NestJS + Prisma (TypeScript)** is recommended. Database: **PostgreSQL** (production); SQLite optional for local dev.

---

## 4. Frontend Stack (decided)

- **Framework:** Next.js (App Router).
- **Language:** TypeScript.
- **UI:** Shadcn/ui + Tailwind CSS.
- **State:** React state + server state (e.g. TanStack Query) as needed.

---

## 5. Authentication (SaaS)

User-facing auth (registration, login, session) is required for a solid SaaS. API keys remain for programmatic access (n8n, Zapier) and are scoped to the authenticated user or their organization.

### 5.1 Auth scope

| Concern | Purpose |
|--------|---------|
| **User registration** | Sign up with email + password; create user and default org/workspace. |
| **Login** | Sign in with email + password; issue session (access + refresh tokens). |
| **Session management** | Access token (short-lived) + refresh token (long-lived, stored securely); logout and refresh flows. |
| **Password reset** | Forgot password: request reset link; reset: set new password with time-limited token. |
| **Email verification** (recommended) | Optional: verify email after signup; optional “verified” gate before sensitive actions. |
| **API keys** | Created by logged-in user (or org admin); used for REST API and webhooks (Bearer). |
| **Multi-tenant** | User belongs to one or more organizations; all data (contacts, calls, config) scoped by org. |

### 5.2 Backend auth (NestJS)

**Auth module responsibilities**

- **Register** – `POST /auth/register`: email, password, optional name. Validate; hash password (bcrypt or argon2); create `User` and default `Organization`; optionally send verification email; return tokens or require email verification first.
- **Login** – `POST /auth/login`: email, password. Verify credentials; issue access token (JWT, short-lived, e.g. 15 min) and refresh token (opaque or JWT, e.g. 7 days); store refresh token in DB (RefreshToken or Session table) linked to user.
- **Refresh** – `POST /auth/refresh`: body or cookie with refresh token. Validate; rotate refresh token (optional); issue new access token (and optionally new refresh token).
- **Logout** – `POST /auth/logout`: invalidate refresh token (and optionally current access token in a blocklist if needed).
- **Forgot password** – `POST /auth/forgot-password`: email. If user exists, create time-limited reset token (e.g. 1h), store hash in DB, send email with link (e.g. `https://app.example.com/reset-password?token=...`).
- **Reset password** – `POST /auth/reset-password`: token, newPassword. Validate token; update password; invalidate token.
- **Email verification** (optional) – `POST /auth/verify-email`: token. Mark user as verified. Send verification email from register or a resend endpoint.
- **Me** – `GET /auth/me`: return current user (and org membership) from access token. Used by frontend to restore session and show user/org in UI.

**Token strategy**

- **Access token:** JWT, signed (e.g. HS256 or RS256), payload: `sub` (userId), `email`, `orgId` (or `orgIds`), `exp`, `iat`. Short expiry (e.g. 15 min) to limit exposure. Sent in `Authorization: Bearer <token>` or in httpOnly cookie (if same-site web only).
- **Refresh token:** Opaque token stored in DB (RefreshToken table: id, userId, tokenHash, expiresAt, revoked). Or signed JWT with long expiry and jti stored for revocation. Sent in httpOnly cookie (recommended for web) or body. Used only to obtain new access tokens; never used for API calls.
- **Password reset token:** Opaque or JWT, single-use, short expiry (e.g. 1h), stored hashed in DB until consumed.

**Guards and scoping**

- **JwtAuthGuard** – validates access token on protected routes; attaches user (and org) to request. All dashboard and API routes that need “current user” use this.
- **OptionalJwtAuthGuard** – for routes that work with or without login (e.g. some webhooks). If valid token present, attach user; else continue without user.
- **API key auth** – for `Authorization: Bearer <api_key>`. Validate key hash against ApiKey table; resolve user/org from key; attach to request. Used by n8n, Zapier, external scripts. Prefer scoping API keys to org so data isolation is clear.

**Security**

- Passwords: hash with bcrypt (cost 10+) or argon2id; never log or return passwords.
- Rate limiting: on register, login, forgot-password (e.g. per IP or per email) to prevent abuse.
- Refresh token rotation: issue new refresh token on each refresh; revoke previous one to detect reuse (optional but recommended).
- CORS and cookies: if using cookie-based refresh, set `SameSite=Strict` or `Lax`, `Secure` in production, correct domain/path.
- Config: JWT secret, token expiry, refresh expiry, email provider (e.g. Resend, SendGrid) in env; no hardcoding.

### 5.3 Frontend auth (Next.js)

**Routes and middleware**

- **Public routes:** `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` (if used). No session required.
- **Protected routes:** everything under `(dashboard)/` and `/settings` etc. Require valid session; redirect to `/login` if not authenticated.
- **Middleware:** Next.js middleware runs on each request. Read session (e.g. from httpOnly cookie or validate JWT in cookie). If protected path and no valid session, redirect to `/login?redirect=<current>`.

**Session on the client**

- **Option A (recommended for web):** Access token in memory or short-lived cookie; refresh token in httpOnly cookie. On load, call `GET /auth/me` with credentials; if 401, try refresh; if refresh fails, redirect to login. No token in localStorage to reduce XSS impact.
- **Option B:** Access + refresh in httpOnly cookies only; backend sets cookies on login/refresh; frontend just sends credentials on fetch. Same security; session “just works” for same-origin API.
- **React Native (later):** Use secure storage for refresh token; access token in memory; same refresh flow.

**Pages and flows**

- **Register:** Form (email, password, confirm password, optional name). Submit to `POST /auth/register`. On success: either auto-login (set cookies / return tokens) and redirect to dashboard, or redirect to “Check your email to verify” and then login after verification.
- **Login:** Form (email, password). Submit to `POST /auth/login`. On success: store session (cookies or tokens per strategy); redirect to `redirect` query or dashboard.
- **Logout:** Call `POST /auth/logout`; clear session; redirect to `/login`.
- **Forgot password:** Form (email). Submit to `POST /auth/forgot-password`; show “If an account exists, we sent a reset link.”
- **Reset password:** Page with `token` in query. Form (new password, confirm). Submit to `POST /auth/reset-password` with token; on success redirect to login.
- **Protected layout:** In dashboard layout, ensure session is present (middleware + optional `GET /auth/me` in layout). Show user menu (email, logout); pass user/org to children if needed.

**Libraries (optional)**

- NextAuth.js can handle OAuth and session; for email/password + JWT + custom backend, a thin custom layer (fetch to NestJS auth endpoints + cookie/session handling) is often enough and keeps control. If you add “Sign in with Google” later, NextAuth or similar can sit alongside or replace the custom login page for OAuth only.

### 5.4 Prisma entities for auth

- **User** – id, email (unique), passwordHash, name?, emailVerifiedAt?, createdAt, updatedAt.
- **Organization** (tenant) – id, name, slug?, createdAt. One org per user at signup; later invite/add to more orgs.
- **OrganizationMember** – userId, organizationId, role (owner | admin | member). User can belong to multiple orgs.
- **RefreshToken** – id, userId, tokenHash, expiresAt, revokedAt?, createdAt. Or **Session** with same idea.
- **PasswordResetToken** – id, userId, tokenHash, expiresAt, usedAt?, createdAt.
- **ApiKey** – id, organizationId (or userId), keyHash, keyPrefix (e.g. first 8 chars for display), name?, scopes?, lastUsedAt?, createdAt. All API key operations (create, list, revoke) require JWT auth and scope to current user’s org.

Contact, Call, IntegrationConfig, etc. get **organizationId** (and optionally userId for audit). All queries filter by `organizationId` from the current user’s context.

### 5.5 Auth implementation order

1. **Prisma:** Add User, Organization, OrganizationMember, RefreshToken, PasswordResetToken (and ApiKey if not already). Run migrations.
2. **NestJS Auth module:** Register, login (issue access + refresh), refresh, logout; JwtAuthGuard and JWT strategy; optional forgot-password and reset-password (with token table and email sending stub or real provider).
3. **Next.js:** Login and register pages; middleware to protect dashboard; session handling (cookie or token); logout and redirect.
4. **API keys:** Move API key creation/list/revoke behind JWT auth; scope to org; store in DB. Public API continues to accept API key in Bearer header.
5. **Email (optional):** Wire Resend/SendGrid (or similar) for verification and password-reset emails; env-based config.
6. **OAuth (later):** Add “Sign in with Google” (or GitHub) if desired; same session model, additional provider in Auth module.

---

## 6. Repository Structure

### 6.1 Monorepo (recommended)

```
voice-calling-platform/
├── apps/
│   ├── web/                     # Next.js (Shadcn, Tailwind, TS)
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── package.json
│   └── api/                     # NestJS backend
│       ├── src/
│       │   ├── modules/
│       │   ├── prisma/
│       │   └── main.ts
│       ├── prisma/
│       └── package.json
├── packages/
│   └── types/                   # Shared DTOs: Call, Contact, Agent, ScheduleRequest, etc.
│       └── package.json
├── package.json
├── pnpm-workspace.yaml
└── docs/
```

- **apps/web:** Dashboard, calls (schedule, results, history), voice agent / provider config, phone numbers, contact sources (import from CRM, Excel), settings, API docs.
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
│   │   │   ├── webhook.module.ts
│   │   │   ├── webhook.controller.ts      # POST /webhooks/vapi, /webhooks/bland, …
│   │   │   └── webhook.service.ts         # Route to provider handlers
│   │   ├── contact-source/     # Where contacts come from (CRM, file, API)
│   │   │   ├── contact-source.module.ts
│   │   │   ├── adapters/
│   │   │   │   ├── rest-api.adapter.ts     # Generic REST “CRM”
│   │   │   │   ├── excel.adapter.ts
│   │   │   │   └── (salesforce, hubspot later)
│   │   │   └── ...
│   │   └── auth/
│   │       ├── auth.module.ts
│   │       ├── auth.controller.ts       # register, login, refresh, logout, forgot-password, reset-password, me
│   │       ├── auth.service.ts
│   │       ├── strategies/               # jwt.strategy.ts, api-key.strategy.ts (optional)
│   │       ├── guards/                   # jwt-auth.guard.ts, api-key.guard.ts
│   │       └── dto/
│   └── prisma/
│       └── prisma.service.ts
├── test/
└── package.json
```

### 7.2 Voice provider abstraction (future-proof)

- **VoiceProvider interface** (per provider, e.g. Vapi, Bland, Retell):
  - `scheduleOutbound(contact, agentConfig, scheduleOptions)` → external call id
  - `getCallStatus(callId)` → status, duration, outcome
  - `testConnection(credentials)` → boolean / health
  - Optional: `registerInbound(numberId, agentId)` for inbound routing
- **VoiceService** holds provider registry; selects implementation by config (e.g. `provider: 'vapi' | 'bland'`) and delegates. Call and contact modules do not depend on a specific provider.
- **Webhooks:** `WebhookController` receives provider webhooks; dispatches by path or payload to `VapiWebhookHandler`, `BlandWebhookHandler`, etc. Handlers update `Call` and related result data.

### 7.3 Contact sources (not the product core)

- **ContactSource** or **ContactSourceAdapter**: “Fetch contacts from X.”
- Generic REST adapter: configurable URL + API key, test + fetch (current “CRM” behavior).
- Excel adapter: upload + column mapping, persist as contacts.
- Later: Salesforce, HubSpot, etc. as optional adapters. Platform remains **voice-calling first**; these are inputs for who to call.

### 7.4 Persistence (Prisma) – Call-Centric and Auth

Core entities (conceptual):

- **User** – id, email (unique), passwordHash, name?, emailVerifiedAt?, createdAt, updatedAt.
- **Organization** – id, name, slug?, createdAt. Tenant for data isolation.
- **OrganizationMember** – userId, organizationId, role (owner | admin | member).
- **RefreshToken** (or Session) – id, userId, tokenHash, expiresAt, revokedAt?, createdAt.
- **PasswordResetToken** – id, userId, tokenHash, expiresAt, usedAt?, createdAt.
- **Contact** – id, organizationId (FK), externalId, firstName, lastName, phone, email, … metadata, source (crm | excel | api), createdAt, updatedAt.
- **Call** – id, organizationId (FK), contactId (FK), voiceProvider (vapi | bland | …), externalCallId, direction (inbound | outbound), status, scheduledAt, startedAt, endedAt, outcome, metadata, createdAt.
- **CallResult** (or embedded JSON on Call) – recordingUrl, transcriptUrl, verifiedFields, confidence, etc.
- **IntegrationConfig** (later) – organizationId, type (voice | contact_source), provider (vapi | bland | rest_crm | …), encrypted credentials, webhookSecret.
- **ApiKey** – organizationId (FK), keyHash, keyPrefix, name?, scopes?, lastUsedAt?, createdAt. Created by authenticated user; used for REST API and webhooks (Bearer).

All contact/call/config data scoped by organizationId; auth entities (User, RefreshToken, etc.) support login and multi-tenant isolation.

---

## 8. Frontend Structure (Next.js) – Voice-Calling UX

### 8.1 App Router layout

```
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 # Dashboard: call stats, recent calls, quick actions
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Sidebar + header
│   │   ├── calls/               # List, schedule, results, history
│   │   │   ├── page.tsx
│   │   │   ├── schedule/
│   │   │   ├── results/
│   │   │   └── history/
│   │   ├── contacts/            # Contact list, import (CRM, Excel)
│   │   │   ├── page.tsx
│   │   │   └── import/
│   │   ├── agents/              # Voice agent / assistant config (per provider later)
│   │   ├── numbers/             # Phone numbers (when multi-number supported)
│   │   ├── settings/            # API keys, provider config (Vapi, etc.), webhooks
│   │   └── api-docs/
│   ├── (auth)/                  # Auth flows (public)
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   └── api/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── calls/
│   ├── contacts/
│   ├── agents/
│   ├── settings/
│   └── shared/
├── lib/
├── hooks/
├── types/
└── styles/
```

- **Calls** are the primary object: schedule outbound, view results, history. Contacts exist to support “who to call.”
- **Contacts:** List, import from CRM, import from Excel (current demo flows).
- **Agents / Numbers:** Voice agent and phone number configuration (today: Vapi assistant ID + phone number ID in settings; later can be first-class pages).
- **Settings:** API keys, voice provider credentials (Vapi now; Bland, etc. later), webhook URL. Design tokens in `global.css` per SKILL.
- **Auth:** Login, register, forgot-password, reset-password under `(auth)/`; middleware protects `(dashboard)/` and redirects unauthenticated users to login.

---

## 9. Integrations Roadmap (Voice-First)

| Priority | Integration | Purpose | Backend touch |
|----------|-------------|---------|----------------|
| Current | **Vapi** | Outbound voice, scheduling, status, webhooks | Keep; move into `VoiceModule` + `VapiProvider` |
| Current | **Webhooks** (Vapi + custom) | Call lifecycle, automation | Central `WebhookController` + provider handlers |
| Current | **Contact source: REST** | Fetch contacts (e.g. “CRM”) | `ContactSourceModule` + generic REST adapter |
| Current | **Contact source: Excel** | Upload contacts | Same module, Excel adapter |
| Next | **Persistence** | PostgreSQL via Prisma | Replace in-memory with Prisma |
| Next | **Auth (SaaS)** | User registration, login, session (JWT + refresh), password reset, email verification (optional) | Auth module: User, Org, RefreshToken, PasswordResetToken; JWT + API key guards |
| Next | **API keys** | Create/list/revoke scoped to org; Bearer for REST API | ApiKey model, scoped to organizationId |
| Later | **Bland / Retell / Twilio** | Additional voice providers | New `VoiceProvider` implementations; same Call/Contact model |
| Later | **Inbound** | Receive calls, route to agent | Provider-specific inbound config + webhook handling |
| Later | **Salesforce / HubSpot** | Optional contact sources | New contact-source adapters |
| Later | **Multi-tenant** | Orgs, workspaces, per-tenant config | TenantId in schema, config service |

---

## 10. Implementation Order (high level)

1. **Repo and workspace**  
   Monorepo: `apps/api` (NestJS), `apps/web` (Next.js + Shadcn + Tailwind + TS), `packages/types`.

2. **Backend core and auth schema**  
   Prisma schema: User, Organization, OrganizationMember, RefreshToken, PasswordResetToken, Contact, Call, ApiKey. Run migrations.

3. **Auth module (NestJS)**  
   Register, login (access + refresh tokens), refresh, logout, forgot-password, reset-password, me. JWT strategy and guard; password hashing (bcrypt/argon2). Optional: email verification and transactional email (env-configured).

4. **Protected API and API keys**  
   Apply JwtAuthGuard to dashboard API routes; scope Contact, Call, and config by organizationId. API key auth for programmatic access; create/list/revoke API keys behind JWT, scoped to org.

5. **Frontend auth**  
   Next.js: login, register, forgot-password, reset-password pages; middleware to protect `(dashboard)/`; session handling (e.g. httpOnly cookie for refresh, access token in cookie or memory); logout and redirect.

6. **Backend: voice and contacts**  
   VoiceModule + VapiProvider; Contact and Call modules with org scoping; contact-source adapters (REST, Excel). Webhook handler for Vapi updates Call status/result.

7. **Frontend: dashboard and features**  
   Dashboard (call-centric), calls (schedule, results, history), contacts (list, import), settings (providers, API keys), API docs. Shadcn + shared types. All behind auth.

8. **Later**  
   More voice providers (e.g. Bland), inbound, OAuth (e.g. Sign in with Google), React Native (reuse API), queues for scheduling.

---

## 11. Summary

- **Product:** **AI Voice Calling platform** (inbound + outbound), like Bland / Vapi / Retell. Voice agents, phone numbers, calls, and results are the core; CRM and Excel are **contact sources** for who to call.
- **Demo:** Voice provider (Vapi), outbound scheduling, webhooks, call results, contact import (CRM + Excel), API keys, automation-friendly API.
- **Authentication (SaaS):** **User registration** (email + password), **login** (access JWT + refresh token), **logout**, **password reset** (forgot-password + reset with time-limited token), optional **email verification**. All data scoped by **Organization** (multi-tenant). **API keys** for programmatic access, created by authenticated users and scoped to org. Config in env; no hardcoded secrets.
- **Backend:** **NestJS + Prisma (TypeScript)** with **Auth module** (register, login, refresh, JWT + API key guards) and **voice-provider abstraction** so Vapi, Bland, and others plug in without rewriting call/contact logic.
- **Frontend:** **Next.js + Shadcn + Tailwind + TypeScript** with **auth pages** (login, register, forgot-password, reset-password), **middleware-protected dashboard**, and **call-centric** layout (calls, contacts, agents, settings, API docs).
- **Repo:** **Monorepo** with `apps/web`, `apps/api`, and `packages/types`.
- **Integrations:** **Voice providers first** (Vapi now; Bland, Retell, Twilio later); **contact sources** second (REST, Excel, optional CRMs). Central webhook handling for all providers.

This plan aligns with the must-remember SKILL (voice agents, inbound/outbound, SaaS, no mocks, config-driven, clean code) and treats the product as an AI Voice Calling platform with solid SaaS authentication and multi-tenant readiness.
