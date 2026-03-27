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


def predict_next_day(
    csv_path: str = "TASI_Historical_Data.csv",
    model_path: str = "models/TASI_Model_v3.keras",
    scaler_path: str = "models/TASI_Scaler_v3.pkl",
    lookback: int = 60,
) -> float:
    """Predict the next trading day's closing price.

    Returns the predicted price in SAR.
    """
    # 1. Load data
    das = DataAcquisitionService(csv_path=csv_path)
    df = das.load_all()

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

    return pred_price


def main():
    parser = argparse.ArgumentParser(description="Predict next-day TASI closing price")
    parser.add_argument("--csv", default="TASI_Historical_Data.csv",
                        help="Path to TASI_Historical_Data.csv")
    parser.add_argument("--model", default="models/TASI_Model_v3.keras",
                        help="Path to trained model")
    parser.add_argument("--scaler", default="models/TASI_Scaler_v3.pkl",
                        help="Path to fitted scaler")
    parser.add_argument("--lookback", type=int, default=60)
    args = parser.parse_args()

    # Validate files exist
    for label, path in [("Model", args.model), ("Scaler", args.scaler)]:
        if not Path(path).exists():
            print(f"[ERROR] {label} not found at '{path}'. Run train_model.py first.")
            sys.exit(1)

    try:
        price = predict_next_day(
            csv_path=args.csv,
            model_path=args.model,
            scaler_path=args.scaler,
            lookback=args.lookback,
        )
        print("\n" + "=" * 50)
        print(f"  Predicted Next-Day TASI Close: {price:,.2f} SAR")
        print("=" * 50)
    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Prediction failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
