"""
predict.py — CLI entry point for making next-day TASI closing price predictions.

Usage:
    python predict.py
    python predict.py --csv TASI_Historical_Data.csv --model models/TASI_Model_v3.keras
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from data_acquisition.market_data import DataAcquisitionService
from technical_analysis.indicators import TechnicalAnalysisService
from preprocessing.engine import PreprocessingEngine
from prediction.engine import PredictionEngine
from train_model import FEATURE_COLUMNS, TARGET_COLUMN


def _get_live_sentiment() -> dict:
    """Fetch today's sentiment and store in Supabase."""
    try:
        from sentiment.analyzer import SentimentAnalyzer
        analyzer = SentimentAnalyzer()
        result = analyzer.analyze_and_store(symbol="TASI")
        return result
    except Exception as e:
        print(f"[WARN] Sentiment analysis failed: {e}")
        return {"score": 0, "confidence": 0, "sentiment_encoded": 0}


def _merge_sentiment_for_prediction(df: pd.DataFrame) -> pd.DataFrame:
    """Merge sentiment data into prediction DataFrame."""
    try:
        from db.supabase_client import get_sentiment
        sent_df = get_sentiment("TASI")
        if not sent_df.empty:
            sent_df = sent_df.rename(columns={
                "date": "Date",
                "sentiment_score": "Sentiment_Score",
                "confidence": "Sentiment_Confidence",
                "sentiment_encoded": "Sentiment_Encoded",
            })
            sent_df = sent_df[["Date", "Sentiment_Score", "Sentiment_Confidence",
                               "Sentiment_Encoded"]]
            df = pd.merge(df, sent_df, on="Date", how="left")
    except Exception as e:
        print(f"[WARN] Could not load sentiment from Supabase: {e}")

    for col, default in [("Sentiment_Score", 0), ("Sentiment_Confidence", 0),
                         ("Sentiment_Encoded", 0)]:
        if col not in df.columns:
            df[col] = default
        else:
            df[col] = df[col].ffill().fillna(default)
    return df


def predict_next_day(
    csv_path: str = "TASI_Historical_Data.csv",
    model_path: str = "models/TASI_Model_v3.keras",
    scaler_path: str = "models/TASI_Scaler_v3.pkl",
    lookback: int = 60,
    run_sentiment: bool = True,
) -> tuple[float, str, str]:
    """Predict the next trading day's closing price.

    Returns (predicted_price, target_date, last_data_date) as SAR price and date strings.
    """
    # 1. Load data — fetch latest from API, update Supabase, then use it
    das = DataAcquisitionService(csv_path=csv_path)
    df = das.load_all(source="auto")
    last_data_date = df["Date"].max().strftime("%Y-%m-%d")

    # 1b. Fetch live sentiment and merge
    if run_sentiment:
        print("[INFO] Running live sentiment analysis...")
        _get_live_sentiment()
    df = _merge_sentiment_for_prediction(df)

    # 2. Technical indicators
    df = TechnicalAnalysisService.add_all(df)

    # 3. Match training preprocessing: denoise → returns → outlier cap
    preproc_prep = PreprocessingEngine(lookback=lookback)
    denoise_cols = ["Close", "Open", "High", "Low", "Volume",
                    "Oil", "SP500", "Gold", "DXY", "Interest_Rate"]
    df = preproc_prep.denoise_dataframe(df, denoise_cols)

    # Save the last actual close price (before returns conversion)
    last_close = df["Close"].iloc[-1]

    # Convert non-stationary features to returns
    df = PreprocessingEngine.to_returns(df)

    # Cap outliers on returns
    numeric_cols = [c for c in FEATURE_COLUMNS if c in df.columns]
    df = PreprocessingEngine.cap_outliers(df, numeric_cols)

    # Drop NaN rows (indicator warm-up + returns)
    df.dropna(subset=FEATURE_COLUMNS, inplace=True)
    df.reset_index(drop=True, inplace=True)

    if len(df) < lookback:
        raise ValueError(
            f"Not enough data after preprocessing. Need at least {lookback} rows, "
            f"got {len(df)}."
        )

    # 6. Load scaler (fitted on training data)
    preproc = PreprocessingEngine(lookback=lookback)
    preproc.load_scaler(scaler_path)

    # 7. Take the last `lookback` days and scale
    recent = df[FEATURE_COLUMNS].iloc[-lookback:].values.astype(np.float64)
    recent_scaled = preproc.transform(recent)

    # Reshape to (1, lookback, n_features)
    X = recent_scaled.reshape(1, lookback, len(FEATURE_COLUMNS))

    # 8. Load model and predict return
    engine = PredictionEngine(lookback=lookback, n_features=len(FEATURE_COLUMNS))
    engine.load_model(model_path)

    pred_scaled = engine.predict(X)[0]

    # 9. Inverse-transform to get actual return
    target_idx = FEATURE_COLUMNS.index(TARGET_COLUMN)
    dummy = np.zeros((1, len(FEATURE_COLUMNS)))
    dummy[0, target_idx] = pred_scaled
    pred_return = preproc.inverse_transform(dummy)[0, target_idx]

    # 10. Convert return to price
    pred_price = last_close * (1 + pred_return)

    # 11. Determine target date (next trading day after last data date)
    # Saudi market trades Sun-Thu, so skip Fri/Sat
    from datetime import datetime, timedelta
    last_dt = datetime.strptime(last_data_date, "%Y-%m-%d")
    next_dt = last_dt + timedelta(days=1)
    while next_dt.weekday() in (4, 5):  # 4=Friday, 5=Saturday
        next_dt += timedelta(days=1)
    target_date = next_dt.strftime("%Y-%m-%d")

    return pred_price, target_date, last_data_date


def main():
    parser = argparse.ArgumentParser(description="Predict next-day TASI closing price")
    parser.add_argument("--csv", default="TASI_Historical_Data.csv",
                        help="Path to TASI_Historical_Data.csv")
    parser.add_argument("--model", default="models/TASI_Model_v3.keras",
                        help="Path to trained model")
    parser.add_argument("--scaler", default="models/TASI_Scaler_v3.pkl",
                        help="Path to fitted scaler")
    parser.add_argument("--lookback", type=int, default=60)
    parser.add_argument("--no-sentiment", action="store_true",
                        help="Skip live sentiment analysis")
    args = parser.parse_args()

    # Validate files exist
    for label, path in [("Model", args.model), ("Scaler", args.scaler)]:
        if not Path(path).exists():
            print(f"[ERROR] {label} not found at '{path}'. Run train_model.py first.")
            sys.exit(1)

    try:
        price, target_date, last_data_date = predict_next_day(
            csv_path=args.csv,
            model_path=args.model,
            scaler_path=args.scaler,
            lookback=args.lookback,
            run_sentiment=not args.no_sentiment,
        )
        print("\n" + "=" * 50)
        print(f"  Based on data up to: {last_data_date}")
        print(f"  Predicting for:      {target_date}")
        print(f"  Predicted TASI Close: {price:,.2f} SAR")
        print("=" * 50)

        # Store prediction in Supabase
        try:
            from db.supabase_client import insert_prediction
            insert_prediction(
                model_id=1,
                symbol="TASI",
                target_date=target_date,
                predicted_close=float(price),
                used_sentiment=not args.no_sentiment,
                used_technical=True,
                input_features=",".join(FEATURE_COLUMNS),
            )
            print(f"[INFO] Prediction stored in Supabase for {target_date}")
        except Exception as e:
            print(f"[WARN] Could not store prediction in Supabase: {e}")

    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Prediction failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
