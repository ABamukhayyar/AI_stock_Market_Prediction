# Frontend Issues & Incompatibilities

Issues found when integrating the React frontend from main branch with the backend.

---

## CRITICAL — Must Fix for Integration

### 1. Model Names Mismatch
**Frontend** uses: `LSTM v2`, `GRU v3`, `Transformer v1`  
**Backend** has: `CNN-BiLSTM-Attention`, `Linear (ElasticNetCV)`  
**Files:** `StockData.js`, `Dashboard.js`  
**Impact:** Model colors, labels, and rationale text reference models that don't exist.  
`MODEL_COLORS` in StockData.js maps colors to `LSTM v2`, `GRU v3`, `Transformer v1` — needs updating.

### 2. Individual Stock Predictions Don't Exist Yet
**Frontend** shows predictions for 6 individual stocks: ARAMCO (2222), ADES (2382), SABIC (2010), EXTRA (4003), ALRAJHI (1120), SNB (1180).  
**Backend** only predicts the **TASI index** (Phase 3 for individual stocks is not done yet).  
**Files:** `StockData.js`, `Dashboard.js`, `AllStocks.js`, `WatchlistPage.js`  
**Impact:** Dashboard cards, stock detail pages, and watchlist all show fake data for stocks we can't actually predict yet.

### 3. All Data is Hardcoded / Synthetic
**Frontend** uses `StockData.js` with hardcoded mock data and `hashSeed()` for synthetic generation.  
**Backend** serves real data via API but only for TASI.  
**Files:** `StockData.js` (TODO comment says "DELETE this entire file once API is connected"), all Pages that import `STOCKS`.

### 4. Authentication is Demo-Only (localStorage)
**Frontend** auth (`auth.js`) uses `localStorage` — any email/password accepted, no real validation.  
No JWT tokens, no Supabase Auth integration.  
**Files:** `auth.js`, `LoginPage.js`, `SignUp.js`  
**Impact:** No real user accounts, no session persistence across devices.

### 5. Missing Package Dependencies (FIXED)
`zod`, `@hookform/resolvers`, `react-hook-form`, `usehooks-ts` were imported but not in package.json.  
**Status:** Fixed — added to package.json.

---

## MODERATE — Should Fix

### 6. Watchlist Not Synced to Backend
**Frontend** stores watchlist in `localStorage` only.  
**Backend** has a `user_watchlists` Supabase table and `/api/watchlist` endpoint ready.  
**Files:** `watchlist.js`, `useWatchlist.js`  
**Impact:** Watchlists lost on different devices/browsers.

### 7. stocks Table Only Has TASI
The `stocks` Supabase table only has one row: TASI (the index).  
Frontend's `tasiAllStocks.js` has 200+ stocks but these aren't in the database.  
**Impact:** `/api/stocks/list` returns only TASI. AllStocks page would be empty without fallback to local data.

### 8. Confidence Score Always 0
Backend predictions store `confidence_score: 0` because neither CNN nor Linear model outputs a confidence metric.  
**Frontend** prominently displays confidence rings (0-100%) — they'll show 0%.  
**Files:** `Dashboard.js` (ConfidenceRing component), `StockData.js`

### 9. Profile/Settings Changes Don't Persist
Profile edits, password changes, 2FA toggle, notification preferences — all UI-only.  
No backend endpoints for user profile management.  
**Files:** `Profile.js`, `Settings.js`

### 10. Market Status Component Has Hardcoded Hours
`Layout.js` has market hours as 10:00 AM - 3:00 PM AST, Sunday-Thursday.  
This is correct for TASI but the `MarketStatus` component doesn't use API data.

---

## MINOR — Nice to Fix

### 11. No Error Handling for API Calls
Frontend has no `fetch()` calls yet (all data is mocked). When API calls are added, error states, loading skeletons, and retry logic need to be implemented.

### 12. 200+ Stocks in tasiAllStocks.js Should Be Seeded to DB
The stock universe file has comprehensive TASI stock data that should be inserted into the `stocks` Supabase table for the API to serve.

### 13. Support Email Hardcoded
`support@insight.ai` appears in SupportPage.js and HelpPage.js — not a real email.

### 14. Team LinkedIn URLs in AboutPage.js
Hardcoded LinkedIn profile URLs — should verify they're correct.

### 15. No Real-Time Updates
No WebSocket or polling for live price updates. Frontend only gets data on page load.

### 16. CSS Case Sensitivity Issue
Frontend directory was `pages/` (lowercase) but App.js imports from `./Pages/` (capital P).  
Works on Windows (case-insensitive) but would break on Linux deployment.  
**Status:** Fixed — renamed to `Pages/`.
