# Deploying to Render (with DB and Auth)

Backend and frontend are already created on Render. Configure env and database so the new auth and PostgreSQL work in production.

---

## 1. PostgreSQL on Render

1. In Render dashboard: **New > PostgreSQL**.
2. Create a database (e.g. `crm_outcalling`), same region as backend (e.g. Singapore).
3. After creation, open the DB and copy the **Internal Database URL** (use Internal for backend in the same region).
4. If the URL starts with `postgres://`, change it to `postgresql://` for SQLAlchemy.

---

## 2. Backend: crm-verification-backend

**Service:** [https://dashboard.render.com](https://dashboard.render.com) → crm-verification-backend → **Environment**.

Add:


| Key            | Value                                                                            | Required |
| -------------- | -------------------------------------------------------------------------------- | -------- |
| `DATABASE_URL` | Internal Database URL from step 1 (e.g. `postgresql://user:pass@dpg-xxx/dbname`) | Yes      |
| `JWT_SECRET`   | Random secret, e.g. `openssl rand -hex 32`                                       | Yes      |
| `API_KEYS`     | Optional; comma-separated keys for API access                                    | No       |


- **Build Command:** `pip install -r requirements.txt` (runs in Root Directory `backend`).
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Tables (e.g. `users`) are created on first startup via `init_db()`.

---

## 3. Frontend: crm-verification

**Service:** [https://dashboard.render.com](https://dashboard.render.com) → crm-verification → **Environment**.

Add (so the built app talks to your backend):


| Key            | Value                                           |
| -------------- | ----------------------------------------------- |
| `VITE_API_URL` | `https://crm-verification-backend.onrender.com` |


Vite bakes this in at **build time**, so redeploy the frontend after adding it.

- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`

---

## 4. After saving env

- **Backend:** Save env → Render redeploys. Check Logs for "Application startup complete" and any DB errors.
- **Frontend:** Save env → Render redeploys so the new build includes `VITE_API_URL`.

---

## 5. Quick check

- Backend: [https://crm-verification-backend.onrender.com/docs](https://crm-verification-backend.onrender.com/docs)
- Frontend: [https://crm-verification.onrender.com](https://crm-verification.onrender.com) → Register/Login should hit the backend and work with the Postgres DB.

