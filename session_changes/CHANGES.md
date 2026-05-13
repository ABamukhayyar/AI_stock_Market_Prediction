# Insight — Session Improvements

This document summarises the changes made in a single working session to
strengthen the evaluation methodology and close a gap in the user-facing
experience. Three areas were touched: the offline evaluation script, the
prediction-accuracy API endpoint, and the React stock-detail page.

All changes are additive: existing metrics, plots, stdout output, and UI
behaviour are preserved. Anything new can be ignored without breaking
upstream code.

---

## 1. Trading simulation added to `evaluate.py`

### Motivation

The existing metric set (`MAE`, `RMSE`, `MAPE`, `R²` in both price and return
space, plus direction accuracy and a lag-1 naive baseline) is methodologically
honest but answers only one question: *is the model accurate?* A reviewer or
end user will inevitably ask the second, harder question: *is the model
useful?* A model can have great MAPE and lose money if it is wrong on the
high-volatility days. Sharpe ratio and trading PnL answer that question
directly.

### What was added

A new section in `evaluate.py` with three additions:

| Symbol | Purpose |
|---|---|
| `trading_metrics(actual_returns, pred_returns, transaction_cost_bps=0)` | Simulates a long-when-predicted-up strategy on the test period. Returns a metrics dict plus the strategy and buy-and-hold equity curves. |
| `_print_trading_metrics(metrics)` | Pretty-prints a side-by-side "Strategy vs Buy & Hold" block and a verdict line that flags when the strategy fails to beat the baseline on Sharpe. |
| `_plot_equity_curves(strat_eq, buyh_eq, dates, output_dir, prefix)` | Writes a PNG showing both equity curves on the same axis. |

The simulation uses the simplest defensible strategy: long (+1) when the
model predicts a positive next-day return, flat (0) otherwise. No shorting,
no position sizing, no slippage beyond an optional bps-per-side cost.
Risk-free rate is assumed zero in the Sharpe calculation, which is
appropriate for a daily strategy and avoids pulling a SIBOR series that is
not already in the pipeline.

### Wiring

The new block runs inside both `run_cnn_evaluation` and `run_linear_evaluation`,
positioned after the existing walk-forward stats and before the price-vs-
predicted plots. The metrics it returns are merged into the existing `metrics`
dict so they flow naturally into:

1. The stdout block per model.
2. The two new PNGs: `eval_cnn_equity_curve.png` and `eval_linear_equity_curve.png`.
3. The side-by-side `MODEL COMPARISON` table at the end of `main()`, which has
   been extended with a third loop covering the trading metrics.

### Output keys

The metrics dict gains the following entries (each per model):

| Key | Meaning |
|---|---|
| `strategy_total_return_pct` | Cumulative percentage gain following the model's signals over the test period. |
| `strategy_annual_return_pct` | Same, annualised (geometric, 252 trading days). |
| `strategy_sharpe` | Return per unit of daily-return volatility, scaled by sqrt(252). Assumes rf = 0. |
| `strategy_max_drawdown_pct` | Worst peak-to-trough loss during the test period (negative number). |
| `buyhold_total_return_pct` | Same metric for the always-long baseline. |
| `buyhold_annual_return_pct` | … |
| `buyhold_sharpe` | … |
| `buyhold_max_drawdown_pct` | … |
| `hit_rate_traded_pct` | Of the days the strategy entered a long position, what fraction were up days. |
| `n_trades` | Number of position changes (proxy for turnover). |
| `pct_days_in_market` | Fraction of test days the strategy held a position. |
| `transaction_cost_bps` | Per-side cost in basis points (default 0). |

### How to run

```powershell
python evaluate.py --symbol TASI --model-type all --output-dir models/eval_v4
```

The new "TRADING SIMULATION" block appears in stdout, two new PNGs land in
`models/eval_v4/`, and (when `--model-type all`) the comparison table at the
bottom now shows trading metrics for CNN vs Linear side by side.

### How to defend it

| Reviewer question | Answer surface |
|---|---|
| "Does the model add value over buy-and-hold?" | Strategy Sharpe vs buy-and-hold Sharpe, plus the verdict line. |
| "What about transaction costs?" | Re-run with `transaction_cost_bps=10` (one keyword change). |
| "What is the downside?" | Max drawdown numbers. |
| "How much does it trade?" | `n_trades` and `pct_days_in_market`. |

### What this does *not* cover

No portfolio construction, no risk parity or Kelly sizing, no intraday
execution model, no slippage beyond a flat bps cost. For an undergraduate
defence, the simple long-flat strategy is the right level — defensible,
reproducible, and it answers the financial-usefulness question without
overclaiming.

### Sanity test

A standalone test script `outputs/test_trading_metrics.py` exercises the
function against perfect-foresight, random, and inverse models, plus
transaction-cost and edge-case inputs. Run from the project root with:

```powershell
python outputs/test_trading_metrics.py
```

---

## 2. Accuracy endpoint bug fixed in `api/routes/predictions.py`

### What was wrong

The existing endpoint had a latent bug:

```python
@router.get("/accuracy")
def prediction_accuracy(symbol: str = Query(default="TASI")):
    logs = sb.table("model_accuracy_log").select(...).execute()
    # ... never used `symbol` again
```

`symbol` was accepted as a query parameter but never used to filter the
result. Every call returned the entire `model_accuracy_log` table across all
symbols. The response payload also did not include the symbol on each row,
so the frontend could not filter client-side either. This made the endpoint
unusable for a per-stock track record.

### Fix

The endpoint now actually filters by symbol when provided, returns the
symbol on each row, supports an optional `limit` parameter (default 50, max
500), and sorts rows most-recent-first by `target_date`. The query was also
restructured to a single `in_` against the joined prediction IDs rather than
a per-row roundtrip, which scales better as the accuracy log grows.

### New signature

```
GET /api/predictions/accuracy?symbol=TASI&limit=30
```

- `symbol` (optional): filter to one symbol. Omit for cross-symbol view.
- `limit` (optional, 1–500, default 50): max rows returned.

### New response shape

```json
[
  {
    "symbol": "TASI",
    "target_date": "2025-12-04",
    "predicted_close": 11842.50,
    "actual_close": 11801.20,
    "error_pct": 0.35,
    "model_id": 7
  }
]
```

### Verification

After restarting the FastAPI server:

```
curl "http://localhost:8000/api/predictions/accuracy?symbol=TASI&limit=10"
```

Should return only TASI rows, each with a `symbol` field, most-recent-first.

---

## 3. Past Predictions panel added to `StockDetail.js`

### Motivation

Before this change, the only model-performance signal visible to the user
was the "AI Confidence" ring — a 0–100 heuristic score that bundles signal
strength, sentiment alignment, and historical accuracy into a single opaque
number. The actual past-prediction track record was already stored in
Supabase and already exposed by `/api/predictions/accuracy`, but no UI page
called the endpoint. From the user's point of view, the project's claim of
accuracy was unverifiable.

### What was added

A new component `PastPredictionsPanel` in `frontend/src/pages/StockDetail.js`,
rendered between the "AI Signal Rationale" grid and the "Other Predictions"
panel. It calls `fetchAccuracy(symbol, 30)` on mount and renders the live
track record for that stock.

The panel has four explicit visual states:

1. **Loading**: muted message.
2. **Error**: red error message (does not crash the page).
3. **Empty** (no validated predictions yet — the expected state until
   `predict.py` runs and target dates pass): muted message explaining
   that rows will appear once predictions are validated.
4. **Populated**: three summary `StatBox` tiles followed by a 15-row table.

### Summary statistics

When data is present, the panel computes three numbers from the loaded rows:

- **Avg Error** — mean absolute error percentage across all validated
  predictions. Colour-coded green/amber/red on `<1%` / `<3%` / `>=3%`.
- **Best Call** — the prediction with the lowest |error| and its date.
- **Worst Call** — the prediction with the highest |error| and its date.

### Table

A 15-row table (date, predicted, actual, error %) sorted most-recent-first.
The error column is colour-coded with the same green/amber/red bands so the
overall accuracy is readable at a glance without parsing the numbers.

### Supporting changes

- **`frontend/src/StockData.js`** — `fetchAccuracy()` now accepts
  `(symbol, limit=50)` and constructs the query string via `URLSearchParams`.
- **`frontend/src/LanguageContext.js`** — 11 new translation keys added in
  both English and Arabic blocks:
  `pastPredictions`, `pastPredictionsSubtitle`, `pastPredictionsEmpty`,
  `pastPredictionsLoading`, `pastPredictionsError`, `avgError`, `bestCall`,
  `worstCall`, `pastPredictionsCount`, and the four column headers
  `colDate`, `colPredicted`, `colActual`, `colError`. The `{count}`
  placeholder uses the existing generic substitution that already powers
  `predictedCloseVs` and `noResultsFor`.

### Theme handling

The panel uses the existing `stockdetail-surface` and `stockdetail-muted`
CSS classes, so dark-mode styling falls out of the existing theme rules
without additional CSS.

### How to verify locally

1. Restart the FastAPI server so the route change takes effect:

   ```powershell
   python -m uvicorn api.main:app --port 8000
   ```

2. Restart the React dev server:

   ```powershell
   cd frontend
   npm start
   ```

3. Open any stock detail page (e.g. `http://localhost:3000/stock/TASI`).
   The new "Past Predictions" panel appears between "AI Signal Rationale"
   and "Other Predictions."

4. Until you have validated predictions in `model_accuracy_log`, the panel
   shows the empty-state message. Once `predict.py` has run for several
   days and target dates have passed, the table populates automatically.

---

## Files changed

| File | Type of change |
|---|---|
| `evaluate.py` | Added `trading_metrics`, `_print_trading_metrics`, `_plot_equity_curves`; wired into both evaluation paths and the comparison table. |
| `api/routes/predictions.py` | Fixed `/accuracy` endpoint to actually filter by symbol, include symbol in response, support `limit`, and sort by date. |
| `frontend/src/StockData.js` | `fetchAccuracy` now accepts `(symbol, limit)`. |
| `frontend/src/LanguageContext.js` | 11 new translation keys in EN and AR. |
| `frontend/src/pages/StockDetail.js` | Imported `fetchAccuracy`, added `PastPredictionsPanel` component, rendered it on the detail page. |
| `outputs/test_trading_metrics.py` *(new, outside repo)* | Standalone sanity-test for the trading-metrics function. |

---

## What is still outstanding

These items were identified during the session but not implemented:

- **Confidence ring tooltip / breakdown.** The Signal Score is currently a
  single opaque number. A tooltip showing the additive components
  (`50 base + signal X + sentiment Y + history Z = total`) would make the
  ring defensible without changing the underlying calculation.
- **Removing hard-coded confidence values** in `frontend/src/data/StockData.js`
  (92, 85, 80, 94, 77, 88). If the API call fails or a page hits the fallback,
  the user currently sees fabricated numbers indistinguishable from real ones.
- **Disclaimer rendering.** The string is defined in `LanguageContext.js`
  (`disclaimer`) but it should be confirmed that it is actually rendered
  somewhere visible — dashboard footer at minimum.
- **`metrics.json` / `metrics.csv` persistence.** Evaluation output is still
  stdout-only. A small patch to dump the metrics dict to disk next to the
  PNGs would make the numbers survive the run.
- **Bootstrap confidence intervals.** A reviewer asking "is 53% direction
  accuracy statistically different from 50%?" can only be answered with a
  CI. A 30-line addition to `evaluate.py` covers this.
- **De-duplicate `_compute_confidence`.** The function exists in two places
  (`predict.py` and `api/routes/predictions.py`) and has already drifted.
  One source of truth — perhaps `prediction/confidence.py` — is the
  long-term fix.

The trading-PnL addition and the accuracy panel are the highest-impact items
on the original punch list; the remaining items are polish that strengthens
defence answers but is not load-bearing.
