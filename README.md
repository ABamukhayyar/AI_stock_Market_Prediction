# Insight — AI-Assisted Saudi Stock Market Prediction

CSC 496 graduation project, King Saud University. Predicts next-day closing
prices on the Saudi Tadawul (TASI) index and 5 sector-leading stocks using a
CNN-BiLSTM-Attention deep-learning model alongside an ElasticNetCV linear model
as a second-opinion baseline. Sentiment is scored daily from Arabic + English
news.

**Team:** Abdullah Bamukhayyar + 4 members &nbsp;·&nbsp;
**Supervisor:** Dr. Fawaz Alsulaiman

---

## Get started in 60 seconds

```powershell
# 1. Clone + enter the project root
cd Grap_Project_Insight

# 2. Set credentials
# Get the .env file from Abdullah (Supabase keys aren't in the repo) and drop it in the project root.

# 3. Backend deps
pip install -r requirements.txt

# 4. Frontend deps
cd frontend && npm install && cd ..

# 5. Run the demo (two terminals)
# Terminal 1 — backend
python -m uvicorn api.main:app --port 8000

# Terminal 2 — frontend
cd frontend && npm start
```

Open http://localhost:3000 — the dashboard shows the 6 supported stocks.

---

## Six supported symbols

| Symbol | Company | Sector | yfinance ticker |
|---|---|---|---|
| TASI   | Tadawul All-Share Index | Index | `^TASI.SR` |
| ARAMCO | Saudi Aramco | Energy | `2222.SR` |
| RAJHI  | Al Rajhi Bank | Financials | `1120.SR` |
| SABIC  | SABIC | Materials | `2010.SR` |
| STC    | STC | Communication Services | `7010.SR` |
| SECO   | Saudi Electricity | Utilities | `5110.SR` |

Source of truth: [data_acquisition/registry.py](data_acquisition/registry.py).

---

## CLI tools you will actually use

```powershell
# Predict tomorrow's close for any symbol (CNN by default)
python predict.py --symbol SABIC --no-sentiment

# Both models side-by-side
python predict.py --symbol TASI --model-type all

# Train (or re-train) a model from scratch
python train_model.py  --symbol SABIC          # CNN-BiLSTM-Attention
python train_linear.py --symbol SABIC          # ElasticNetCV linear

# Full evaluation with honest metrics (price-space + return-space + naive baseline)
python evaluate.py --symbol SABIC --model-type all
```

Every entry point seeds Python / NumPy / TensorFlow with seed 42, so two runs
produce identical numbers.

---

## Repository map

| Path | What it is |
|---|---|
| [api/](api) | FastAPI backend serving the React frontend |
| [data_acquisition/](data_acquisition) | OHLCV loaders (CSV / yfinance / Supabase) + symbol registry |
| [db/](db) | Supabase client wrapping every DB operation |
| [preprocessing/](preprocessing) | Leakage-safe per-slice pipeline (denoise → returns → IQR → scale → sequences) |
| [prediction/](prediction) | CNN-BiLSTM-Attention model. Linear sibling under `prediction/linear/`. |
| [sentiment/](sentiment) | Google News scrape → Arabic translation → FinBERT scoring |
| [technical_analysis/](technical_analysis) | RSI, MACD, ATR, Bollinger, SMA, EMA |
| [utils/](utils) | `set_seed(42)` reproducibility helper |
| [models/](models) | Trained model artefacts + cached NLP weights + plots |
| [notebooks/](notebooks) | EDA notebook (`01_eda.ipynb`) and helpers |
| [frontend/](frontend) | React (CRA) dashboard — see [frontend/README.md](frontend/README.md) |
| [docs/](docs) | Walkthroughs and known-issues lists |
| [PRESENTATION_GUIDE.md](PRESENTATION_GUIDE.md) | Defense rehearsal: demo flow, honest metrics, methodology, Q&A |
| [CLAUDE.md](CLAUDE.md) | Project memory file used by Claude Code |

Each folder above has its own `README.md` explaining the files inside.

---

## How honest are the metrics?

The headline test-set numbers are reported **two ways**, side by side, in
[evaluate.py](evaluate.py):

- **Price space** — MAE in SAR, MAPE, R² on prices. Useful for product UX, but
  R² here is dominated by `prev_close` autocorrelation. Always read it next to
  the *naive lag-1 baseline* that's printed in the same block.
- **Return space** — MAE/RMSE/R² on next-day returns. This is the honest
  predictive-signal metric.

For TASI, the corrected (leakage-fixed) v4 CNN reports MAE 21.72 SAR vs naive
68.70 SAR (3.2× better), and R²(returns) 0.49 vs naive 0.47 (a real but small
edge). Full breakdown in [PRESENTATION_GUIDE.md §9](PRESENTATION_GUIDE.md).

The "AI confidence" ring on the dashboard is a 0–100 *Signal Score*, not a
calibrated probability. Section 7 of the presentation guide explains the
formula in detail.

---

## What's where for further reading

- **First time on the codebase?** Open this README, then [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) for a deeper tour.
- **Demoing for the defense?** Read [PRESENTATION_GUIDE.md](PRESENTATION_GUIDE.md) cover-to-cover.
- **Understanding the data?** Run `python notebooks/_run_eda.py` and open [notebooks/01_eda.ipynb](notebooks/01_eda.ipynb).
- **Adding a new stock?** See [docs/MULTI_STOCK_BACKFILL.md](docs/MULTI_STOCK_BACKFILL.md).
- **Frontend gaps and TODOs?** [docs/FRONTEND_ISSUES.md](docs/FRONTEND_ISSUES.md).
