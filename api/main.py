"""
FastAPI backend for the Insight frontend.

Serves stock data, predictions, sentiment, and user management
from the Supabase database and the Python prediction pipeline.

Run:
    uvicorn api.main:app --reload --port 8000
"""

import sys
from pathlib import Path

# Ensure project root is on the path so we can import our modules
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.routes import stocks, predictions, auth, watchlist

app = FastAPI(
    title="Insight API",
    description="AI-Assisted Saudi Stock Market Prediction System",
    version="1.0.0",
)

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount route groups
app.include_router(stocks.router, prefix="/api/stocks", tags=["Stocks"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(watchlist.router, prefix="/api/watchlist", tags=["Watchlist"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
