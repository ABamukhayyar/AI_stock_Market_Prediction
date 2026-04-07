"""
LinearPredictionEngine — loads and runs the trained sklearn linear model.
"""

import numpy as np
import joblib
from sklearn.linear_model import BayesianRidge


class LinearPredictionEngine:
    """Wrapper for the sklearn linear model (ElasticNet / Ridge / BayesianRidge)."""

    def __init__(self):
        self.model = None
        self.scaler = None
        self.model_type = None

    def load_model(self, model_path: str, scaler_path: str) -> None:
        """Load the trained model and scaler from pkl files."""
        self.model = joblib.load(model_path)
        self.scaler = joblib.load(scaler_path)
        self.model_type = type(self.model).__name__

    def predict(self, X: np.ndarray) -> tuple:
        """Predict next-day return from a feature row.

        Args:
            X: Feature array of shape (1, n_features) — unscaled.

        Returns:
            (predicted_return, std_or_None)
            std is only provided for BayesianRidge models.
        """
        X_scaled = self.scaler.transform(X)

        if isinstance(self.model, BayesianRidge):
            pred, std = self.model.predict(X_scaled, return_std=True)
            return float(pred[0]), float(std[0])

        pred = self.model.predict(X_scaled)
        return float(pred[0]), None

    def predict_price(self, X: np.ndarray, last_close: float) -> dict:
        """Predict next-day closing price.

        Args:
            X: Feature array of shape (1, n_features) — unscaled.
            last_close: The most recent closing price.

        Returns:
            Dict with predicted_close, predicted_return, confidence_interval, etc.
        """
        predicted_return, pred_std = self.predict(X)
        predicted_close = last_close * (1 + predicted_return)

        result = {
            "predicted_close": predicted_close,
            "predicted_return": predicted_return,
            "model_type": self.model_type,
        }

        if pred_std is not None:
            ci_low = last_close * (1 + predicted_return - 1.96 * pred_std)
            ci_high = last_close * (1 + predicted_return + 1.96 * pred_std)
            result["ci_low"] = ci_low
            result["ci_high"] = ci_high
            result["pred_std"] = pred_std

        # Signal strength
        signal = abs(predicted_return)
        if signal > 0.005:
            result["confidence"] = "STRONG"
        elif signal > 0.002:
            result["confidence"] = "MODERATE"
        else:
            result["confidence"] = "WEAK"

        return result
