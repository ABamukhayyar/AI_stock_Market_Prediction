# `frontend/` — React dashboard

Create-React-App (CRA) project. Reads from the FastAPI backend at
`http://localhost:8000/api/...` and renders the dashboard, stock detail pages
(with model switcher), watchlist, and admin pages.

## Run it

```powershell
cd frontend
npm install
npm start
```

Opens at http://localhost:3000.

## Layout

| Path | Purpose |
|---|---|
| `src/Pages/` | One file per top-level route (Dashboard, AllStocks, StockDetail, LoginPage, SignUp, WatchlistPage, etc.) |
| `src/components/` | Shared bits: `Layout`, `SearchInput`, `WatchlistButton`, `ThemeToggleButton`, `buttons` |
| `src/StockData.js` | API helpers + colour mappings consumed across pages |
| `src/LanguageContext.js` | EN / AR i18n strings + RTL toggle |
| `src/data/` | Static data fixtures (e.g. fallback stock list) |
| `src/hooks/` | Custom React hooks |
| `public/` | Static assets bundled into the build |

## Known issues

Listed in [../docs/FRONTEND_ISSUES.md](../docs/FRONTEND_ISSUES.md). This file
does **not** describe a bug-free state — pulled from the original audit.

## Deployment

The build output goes to `frontend/build/` (gitignored). To produce a
production bundle:

```powershell
cd frontend
npm run build
```
