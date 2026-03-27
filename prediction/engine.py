"""
PredictionEngine — builds the CNN-BiLSTM-Attention model and exposes
build / train / predict / save / load methods.
"""

from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model


class PredictionEngine:
    """CNN-BiLSTM-Attention model for next-day closing price prediction."""

    def __init__(
        self,
        lookback: int = 60,
        n_features: int = 15,
        learning_rate: float = 1e-3,
    ):
        self.lookback = lookback
        self.n_features = n_features
        self.learning_rate = learning_rate
        self.model: Model | None = None

    # ------------------------------------------------------------------
    # Model architecture
    # ------------------------------------------------------------------

    def build_model(self) -> Model:
        """Build the CNN-BiLSTM-Attention architecture.

        Architecture:
            Input (lookback, n_features)
            -> Conv1D(32) -> MaxPool1D(2)
            -> Conv1D(64) -> MaxPool1D(2)
            -> BiLSTM(64, return_sequences=True) -> Dropout(0.4)
            -> MultiHeadAttention(4 heads, key_dim=16)
            -> BiLSTM(32) -> Dropout(0.4)
            -> Dense(32) -> BatchNorm -> Dense(16) -> Dense(1, linear)
        """
        reg = keras.regularizers.L2(1e-4)

        inputs = layers.Input(shape=(self.lookback, self.n_features), name="input")

        # --- CNN block ---
        x = layers.Conv1D(32, kernel_size=3, activation="relu", padding="same",
                          kernel_regularizer=reg)(inputs)
        x = layers.MaxPooling1D(pool_size=2)(x)

        x = layers.Conv1D(64, kernel_size=3, activation="relu", padding="same",
                          kernel_regularizer=reg)(x)
        x = layers.MaxPooling1D(pool_size=2)(x)

        # --- BiLSTM block 1 ---
        x = layers.Bidirectional(
            layers.LSTM(64, return_sequences=True,
                        kernel_regularizer=reg, recurrent_regularizer=reg)
        )(x)
        x = layers.Dropout(0.4)(x)

        # --- Multi-Head Attention ---
        attn_output = layers.MultiHeadAttention(
            num_heads=4, key_dim=16
        )(x, x)
        x = layers.Add()([x, attn_output])  # residual connection
        x = layers.LayerNormalization()(x)

        # --- BiLSTM block 2 ---
        x = layers.Bidirectional(
            layers.LSTM(32, return_sequences=False,
                        kernel_regularizer=reg, recurrent_regularizer=reg)
        )(x)
        x = layers.Dropout(0.4)(x)

        # --- Dense head ---
        x = layers.Dense(32, activation="relu", kernel_regularizer=reg)(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dense(16, activation="relu", kernel_regularizer=reg)(x)
        outputs = layers.Dense(1, activation="linear", name="price_output")(x)

        model = Model(inputs=inputs, outputs=outputs, name="CNN_BiLSTM_Attention")

        model.compile(
            optimizer=keras.optimizers.Adam(
                learning_rate=self.learning_rate, clipnorm=1.0
            ),
            loss=keras.losses.Huber(delta=1.0),
            metrics=["mae"],
        )

        self.model = model
        model.summary()
        return model

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def get_callbacks(
        self,
        model_path: str = "models/TASI_Model_v3.keras",
        patience_es: int = 25,
        patience_lr: int = 8,
    ) -> list:
        """Return standard training callbacks."""
        return [
            keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=patience_es,
                restore_best_weights=True,
                verbose=1,
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor="val_loss",
                factor=0.5,
                patience=patience_lr,
                min_lr=1e-6,
                verbose=1,
            ),
            keras.callbacks.ModelCheckpoint(
                filepath=model_path,
                monitor="val_loss",
                save_best_only=True,
                verbose=1,
            ),
        ]

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        epochs: int = 100,
        batch_size: int = 32,
        model_path: str = "models/TASI_Model_v3.keras",
    ) -> keras.callbacks.History:
        """Train the model with EarlyStopping and LR reduction."""
        if self.model is None:
            self.build_model()

        callbacks = self.get_callbacks(model_path=model_path)

        history = self.model.fit(
            X_train,
            y_train,
            validation_data=(X_val, y_val),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1,
        )
        return history

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Return raw model predictions (scaled space)."""
        if self.model is None:
            raise RuntimeError("Model not loaded. Call build_model() or load_model() first.")
        return self.model.predict(X, verbose=0).flatten()

    # ------------------------------------------------------------------
    # Save / Load
    # ------------------------------------------------------------------

    def save_model(self, path: str = "models/TASI_Model_v3.keras") -> None:
        if self.model is None:
            raise RuntimeError("No model to save.")
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.model.save(path)
        print(f"[INFO] Model saved to {path}")

    def load_model(self, path: str = "models/TASI_Model_v3.keras") -> None:
        self.model = keras.models.load_model(path)
        print(f"[INFO] Model loaded from {path}")
        self.model.summary()
