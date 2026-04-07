"""
predict.py — CLI entry point for making next-day TASI closing price predictions.

Supports both the CNN-BiLSTM-Attention model and the Linear model.

Usage:
    python predict.py                              # CNN model (default)
    python predict.py --model-type linear           # Linear model
    python predict.py --model-type all              # Both models
    python predict.py --csv TASI_Historical_Data.csv --model models/TASI_Model_v3.keras
"""

import argparse
import sys
from datetime import datetime, timedelta
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
        return {"score": 0, "confidence": 0, "sentiment_encoded": 0,
                "sentiment_label": "Neutral", "data_quality": "Low"}


def _apply_sentiment_adjustment(model_price: float, sentiment: dict,
                                max_impact_pct: float = 0.02) -> tuple[float, float]:
    """Adjust model prediction based on sentiment score.

    Uses sentiment score (-100 to +100) and confidence to nudge the
    predicted price up or down.  max_impact_pct caps the maximum
    adjustment (default 2% of price at extreme sentiment + high confidence).

    Returns (adjusted_price, adjustment_amount).
    """
    score = sentiment.get("score", 0)            # -100 to +100
    confidence = sentiment.get("confidence", 0)  # 0 to 100

    # Normalise to [-1, +1] and [0, 1]
    score_norm = score / 100.0
    conf_norm = confidence / 100.0

    # Adjustment = direction * magnitude * confidence * max_impact
    adjustment_pct = score_norm * conf_norm * max_impact_pct
    adjustment_amount = model_price * adjustment_pct

    return model_price + adjustment_amount, adjustment_amount


def _check_past_predictions_accuracy() -> None:
    """Check past predictions whose target_date has passed, log accuracy."""
    try:
        from db.supabase_client import get_client, log_accuracy
        sb = get_client()

        # Get predictions that haven't been logged yet
        preds = sb.table("ai_predictions").select("*").execute().data
        if not preds:
            return

        logged = sb.table("model_accuracy_log").select("prediction_id").execute().data
        logged_ids = {r["prediction_id"] for r in logged} if logged else set()

        for pred in preds:
            if pred["prediction_id"] in logged_ids:
                continue

            # Check if we have actual market data for the target date
            actual = sb.table("market_data").select("close").eq(
                "symbol", pred["symbol"]
            ).eq("date", pred["target_date"]).execute().data

            if not actual:
                continue

            actual_close = actual[0]["close"]
            predicted_close = pred["predicted_close"]
            error_pct = abs(actual_close - predicted_close) / actual_close * 100

            log_accuracy(
                prediction_id=pred["prediction_id"],
                actual_close=actual_close,
                error_percentage=round(error_pct, 4),
            )
            print(f"[INFO] Accuracy logged for {pred['target_date']}: "
                  f"predicted={predicted_close:,.2f}, actual={actual_close:,.2f}, "
                  f"error={error_pct:.2f}%")
    except Exception as e:
        print(f"[WARN] Could not check prediction accuracy: {e}")


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


def _get_target_date(last_data_date: str) -> str:
    """Compute next trading day (Saudi market: Sun-Thu, skip Fri/Sat)."""
    last_dt = datetime.strptime(last_data_date, "%Y-%m-%d")
    next_dt = last_dt + timedelta(days=1)
    while next_dt.weekday() in (4, 5):  # 4=Friday, 5=Saturday
        next_dt += timedelta(days=1)
    return next_dt.strftime("%Y-%m-%d")


# ======================================================================
# CNN Prediction
# ======================================================================

def predict_cnn(
    csv_path: str = "TASI_Historical_Data.csv",
    model_path: str = "models/TASI_Model_v3.keras",
    scaler_path: str = "models/TASI_Scaler_v3.pkl",
    lookback: int = 60,
    run_sentiment: bool = True,
) -> dict:
    """Predict next-day close using the CNN-BiLSTM-Attention model."""
    # 1. Load data
    das = DataAcquisitionService(csv_path=csv_path)
    df = das.load_all(source="auto")
    last_data_date = df["Date"].max().strftime("%Y-%m-%d")

    # 1b. Fetch live sentiment and merge
    sentiment = {"score": 0, "confidence": 0, "sentiment_label": "Neutral",
                 "sentiment_encoded": 0, "data_quality": "Low"}
    if run_sentiment:
        print("[INFO] Running live sentiment analysis...")
        sentiment = _get_live_sentiment()
    df = _merge_sentiment_for_prediction(df)

    # 2. Technical indicators
    df = TechnicalAnalysisService.add_all(df)

    # 2b. Store technical indicators in Supabase
    try:
        from db.supabase_client import upsert_technical_indicators
        upsert_technical_indicators(df.tail(5), symbol="TASI")
    except Exception as e:
        print(f"[WARN] Could not store technical indicators: {e}")

    # 3. Preprocessing: denoise -> returns -> outlier cap
    preproc_prep = PreprocessingEngine(lookback=lookback)
    denoise_cols = ["Close", "Open", "High", "Low", "Volume",
                    "Oil", "SP500", "Gold", "DXY", "Interest_Rate"]
    df = preproc_prep.denoise_dataframe(df, denoise_cols)

    last_close = df["Close"].iloc[-1]
    df = PreprocessingEngine.to_returns(df)

    numeric_cols = [c for c in FEATURE_COLUMNS if c in df.columns]
    df = PreprocessingEngine.cap_outliers(df, numeric_cols)

    df.dropna(subset=FEATURE_COLUMNS, inplace=True)
    df.reset_index(drop=True, inplace=True)

    if len(df) < lookback:
        raise ValueError(
            f"Not enough data after preprocessing. Need at least {lookback} rows, "
            f"got {len(df)}."
        )

    # 6. Load scaler and scale
    preproc = PreprocessingEngine(lookback=lookback)
    preproc.load_scaler(scaler_path)

    recent = df[FEATURE_COLUMNS].iloc[-lookback:].values.astype(np.float64)
    recent_scaled = preproc.transform(recent)
    X = recent_scaled.reshape(1, lookback, len(FEATURE_COLUMNS))

    # 8. Load model and predict
    engine = PredictionEngine(lookback=lookback, n_features=len(FEATURE_COLUMNS))
    engine.load_model(model_path)

    pred_scaled = engine.predict(X)[0]

    # 9. Inverse-transform
    target_idx = FEATURE_COLUMNS.index(TARGET_COLUMN)
    dummy = np.zeros((1, len(FEATURE_COLUMNS)))
    dummy[0, target_idx] = pred_scaled
    pred_return = preproc.inverse_transform(dummy)[0, target_idx]

    model_price = last_close * (1 + pred_return)

    # 11. Sentiment adjustment
    if run_sentiment:
        final_price, adjustment = _apply_sentiment_adjustment(model_price, sentiment)
    else:
        final_price, adjustment = model_price, 0.0

    target_date = _get_target_date(last_data_date)

    return {
        "model_price": model_price,
        "final_price": final_price,
        "vs": last_close,
        "sentiment_adjustment": adjustment,
        "sentiment": sentiment,
        "target_date": target_date,
        "last_data_date": last_data_date,
        "model_name": "TASI_CNN_v3",
        "model_label": "CNN-BiLSTM-Attention",
    }


# ======================================================================
# Linear Prediction
# ======================================================================

def predict_linear(
    csv_path: str = "TASI_Historical_Data.csv",
    model_path: str = "models/tasi_linear_model.pkl",
    scaler_path: str = "models/tasi_linear_scaler.pkl",
    run_sentiment: bool = True,
) -> dict:
    """Predict next-day close using the Linear model."""
    from prediction.linear.engine import LinearPredictionEngine
    from prediction.linear.features import (
        FEATURES, build_linear_features, enrich_macro_for_linear,
    )

    # 1. Load data via our existing pipeline
    das = DataAcquisitionService(csv_path=csv_path)
    df = das.load_all(source="auto")
    last_data_date = df["Date"].max().strftime("%Y-%m-%d")

    # 1b. Sentiment (for post-prediction adjustment, not a model feature)
    sentiment = {"score": 0, "confidence": 0, "sentiment_label": "Neutral",
                 "sentiment_encoded": 0, "data_quality": "Low"}
    if run_sentiment:
        print("[INFO] Running live sentiment analysis...")
        sentiment = _get_live_sentiment()

    # 2. Enrich with VIX + futures (needed by linear model)
    df = enrich_macro_for_linear(df)

    # 3. Compute all 48 features
    df = build_linear_features(df)
    df = df.dropna(subset=FEATURES).reset_index(drop=True)

    if len(df) < 1:
        raise ValueError("Not enough data after feature engineering for linear model.")

    # 4. Drop incomplete candle if market still open
    now_riyadh = datetime.utcnow() + timedelta(hours=3)
    today = now_riyadh.date()
    last_date = pd.Timestamp(df["Date"].iloc[-1]).date()
    if last_date == today and now_riyadh.hour < 15:
        print(f"[WARN] Market still open — dropping today's incomplete candle ({today})")
        df = df.iloc[:-1].reset_index(drop=True)

    # 5. Predict
    latest = df.iloc[[-1]]
    last_close = latest["Close"].values[0]
    X_latest = latest[FEATURES].values

    engine = LinearPredictionEngine()
    engine.load_model(model_path, scaler_path)
    result = engine.predict_price(X_latest, last_close)

    model_price = result["predicted_close"]

    # 6. Sentiment adjustment
    if run_sentiment:
        final_price, adjustment = _apply_sentiment_adjustment(model_price, sentiment)
    else:
        final_price, adjustment = model_price, 0.0

    target_date = _get_target_date(last_data_date)

    return {
        "model_price": model_price,
        "final_price": final_price,
        "vs": last_close,
        "predicted_return": result["predicted_return"],
        "sentiment_adjustment": adjustment,
        "sentiment": sentiment,
        "target_date": target_date,
        "last_data_date": last_data_date,
        "model_name": "TASI_Linear_v1",
        "model_label": f"Linear ({result['model_type']})",
        "signal_strength": result.get("confidence", "N/A"),
        "ci_low": result.get("ci_low"),
        "ci_high": result.get("ci_high"),
    }


# ======================================================================
# Output + Supabase Storage
# ======================================================================

def _print_result(result: dict, no_sentiment: bool = False) -> None:
    """Pretty-print a prediction result."""
    sent = result["sentiment"]
    adj = result["sentiment_adjustment"]

    print(f"\n  [{result['model_label']}]")
    print(f"  Based on data up to: {result['last_data_date']}")
    print(f"  Predicting for:      {result['target_date']}")
    print("-" * 50)
    print(f"  Model Prediction:    {result['model_price']:,.2f} SAR")
    if not no_sentiment:
        direction = "+" if adj >= 0 else ""
        print(f"  Sentiment:           {sent.get('sentiment_label', 'N/A')} "
              f"(score: {sent.get('score', 0)}, "
              f"confidence: {sent.get('confidence', 0)}%)")
        print(f"  Sentiment Adjust:    {direction}{adj:,.2f} SAR")
    if result.get("predicted_return") is not None:
        print(f"  Predicted Return:    {result['predicted_return'] * 100:+.4f}%")
    if result.get("signal_strength"):
        print(f"  Signal Strength:     {result['signal_strength']}")
    if result.get("ci_low") is not None:
        print(f"  95% CI:              {result['ci_low']:,.2f} — {result['ci_high']:,.2f}")
    print("-" * 50)
    print(f"  Final Prediction:    {result['final_price']:,.2f} SAR")


def _compute_confidence(result: dict) -> float:
    """Compute a confidence score (0-100) for a prediction.

    Based on signal strength, sentiment alignment, and model type.
    """
    score = 50.0  # base

    # Signal strength: bigger predicted move = more decisive
    model_price = result.get("model_price", 0)
    final_price = result.get("final_price", model_price)
    last_close = result.get("vs", model_price)
    if last_close and last_close > 0:
        change_pct = abs((model_price - last_close) / last_close * 100)
        if change_pct > 2:
            score += 15
        elif change_pct > 1:
            score += 10
        elif change_pct > 0.3:
            score += 5

    # Sentiment alignment
    sent = result.get("sentiment", {})
    sent_score = sent.get("score", 0)
    sent_conf = sent.get("confidence", 0)
    if sent_conf > 50:
        pred_up = model_price > last_close if last_close else True
        sent_up = sent_score > 0
        if pred_up == sent_up:
            score += 10
        else:
            score -= 5

    # Model type bonus: CNN is more accurate historically
    if "CNN" in result.get("model_name", ""):
        score += 10

    # Check historical accuracy
    try:
        from db.supabase_client import get_client
        sb = get_client()
        logs = sb.table("model_accuracy_log").select("error_percentage").execute()
        if logs.data:
            avg_error = sum(l["error_percentage"] for l in logs.data) / len(logs.data)
            if avg_error < 2:
                score += 15
            elif avg_error < 5:
                score += 8
    except Exception:
        pass

    return max(0, min(100, round(score)))


def _store_prediction(result: dict, no_sentiment: bool = False) -> None:
    """Store prediction in Supabase with correct model_id."""
    try:
        from db.supabase_client import get_or_register_model, insert_prediction

        # Determine model registration details
        model_name = result["model_name"]
        if "CNN" in model_name:
            model_id = get_or_register_model(
                model_name="TASI_CNN_BiLSTM_Attention", version="v3",
                model_type="CNN-BiLSTM-Attention",
                description="CNN-BiLSTM-Attention with 19 features, 60-day lookback.",
            )
            input_features = ",".join(FEATURE_COLUMNS)
        else:
            from prediction.linear.features import FEATURES as LINEAR_FEATURES
            model_id = get_or_register_model(
                model_name=model_name, version="1.0",
                model_type=result.get("model_label", "Linear"),
                description="Linear model with 48 features. Walk-forward validated.",
            )
            input_features = ",".join(LINEAR_FEATURES)

        confidence = _compute_confidence(result)
        insert_prediction(
            model_id=model_id,
            symbol="TASI",
            target_date=result["target_date"],
            predicted_close=float(result["final_price"]),
            confidence_score=round(confidence / 100.0, 4),
            used_sentiment=not no_sentiment,
            used_technical=True,
            input_features=input_features,
        )
        print(f"[INFO] Prediction stored in Supabase for {result['target_date']} "
              f"(model_id={model_id})")
    except Exception as e:
        print(f"[WARN] Could not store prediction in Supabase: {e}")


# ======================================================================
# Main
# ======================================================================

def main():
    parser = argparse.ArgumentParser(description="Predict next-day TASI closing price")
    parser.add_argument("--csv", default="TASI_Historical_Data.csv",
                        help="Path to TASI_Historical_Data.csv")
    parser.add_argument("--model", default="models/TASI_Model_v3.keras",
                        help="Path to trained CNN model")
    parser.add_argument("--scaler", default="models/TASI_Scaler_v3.pkl",
                        help="Path to fitted CNN scaler")
    parser.add_argument("--linear-model", default="models/tasi_linear_model.pkl",
                        help="Path to trained linear model")
    parser.add_argument("--linear-scaler", default="models/tasi_linear_scaler.pkl",
                        help="Path to fitted linear scaler")
    parser.add_argument("--lookback", type=int, default=60)
    parser.add_argument("--no-sentiment", action="store_true",
                        help="Skip live sentiment analysis")
    parser.add_argument("--model-type", choices=["cnn", "linear", "all"],
                        default="cnn", help="Which model to use (default: cnn)")
    args = parser.parse_args()

    # Validate files exist based on model type
    if args.model_type in ("cnn", "all"):
        for label, path in [("CNN Model", args.model), ("CNN Scaler", args.scaler)]:
            if not Path(path).exists():
                print(f"[ERROR] {label} not found at '{path}'. Run train_model.py first.")
                sys.exit(1)
    if args.model_type in ("linear", "all"):
        for label, path in [("Linear Model", args.linear_model),
                            ("Linear Scaler", args.linear_scaler)]:
            if not Path(path).exists():
                print(f"[ERROR] {label} not found at '{path}'.")
                sys.exit(1)

    # Check accuracy of past predictions
    print("[INFO] Checking past prediction accuracy...")
    _check_past_predictions_accuracy()

    try:
        results = []

        if args.model_type in ("cnn", "all"):
            print("\n[INFO] Running CNN-BiLSTM-Attention prediction...")
            cnn_result = predict_cnn(
                csv_path=args.csv,
                model_path=args.model,
                scaler_path=args.scaler,
                lookback=args.lookback,
                run_sentiment=not args.no_sentiment,
            )
            results.append(cnn_result)

        if args.model_type in ("linear", "all"):
            print("\n[INFO] Running Linear model prediction...")
            linear_result = predict_linear(
                csv_path=args.csv,
                model_path=args.linear_model,
                scaler_path=args.linear_scaler,
                run_sentiment=not args.no_sentiment,
            )
            results.append(linear_result)

        # Display results
        print("\n" + "=" * 50)
        for result in results:
            _print_result(result, no_sentiment=args.no_sentiment)
        print("=" * 50)

        # Store all predictions in Supabase
        for result in results:
            _store_prediction(result, no_sentiment=args.no_sentiment)

    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Prediction failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
