# Backend (FastAPI)

## Run

From `backend/` with venv activated:

```bash
# Without reload (stable)
python main.py
```

```bash
# With reload (development). Exclude venv so changes inside venv do not trigger restarts.
uvicorn main:app --reload --host 0.0.0.0 --port 8000 --reload-exclude 'venv'
```

Without `--reload-exclude 'venv'`, WatchFiles watches the whole directory including `venv`, so any change under venv (e.g. `.pyc` or package metadata) triggers a restart and a new default API key each time.

## Env

Copy `.env.example` to `.env`. Set `JWT_SECRET` and optionally `API_KEYS`, `DATABASE_URL`.
