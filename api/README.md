# `api/` — FastAPI backend

The Python web server that the React dashboard talks to. Reads from Supabase
and returns JSON.

## Files

- `main.py` — app initialisation, CORS config, route mounting. Run with
  `uvicorn api.main:app --port 8000` from the project root.
- `routes/` — one Python module per route group. See [routes/README.md](routes/README.md).

## Run it

```powershell
python -m uvicorn api.main:app --port 8000
```

Then open http://localhost:8000/docs for auto-generated Swagger UI.

## How it fits in

Frontend (React) → HTTP → **this layer** → [`db/supabase_client.py`](../db/supabase_client.py) → Supabase. The backend does **not** run live model inference; predictions are precomputed by [`predict.py`](../predict.py) and read out of the `ai_predictions` table.
