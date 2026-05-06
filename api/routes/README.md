# `api/routes/` — REST route handlers

One file per concern. All routes are mounted under `/api/...` by
[`api/main.py`](../main.py).

| File | Mounts | Purpose |
|---|---|---|
| `stocks.py`      | `/api/stocks`, `/api/stocks/{id}`, `/api/stocks/list`, `/api/stocks/batch`, `/api/stocks/{id}/history` | Stock listings, detail pages with model switcher, search universe, watchlist batch fetch, OHLCV history |
| `predictions.py` | `/api/predictions/...` | Latest predictions, accuracy log, model registry, on-demand prediction trigger |
| `auth.py`        | `/api/auth/signup`, `/api/auth/login` | User accounts (Supabase auth) |
| `watchlist.py`   | `/api/watchlist/...` | Per-user watchlist CRUD |

## Adding a new route

1. Create or extend the relevant file with a `@router.get(...)` / `@router.post(...)` handler.
2. The file is auto-mounted by `main.py`'s `include_router` calls.
3. Test via http://localhost:8000/docs.
