# `prediction/` — model engines

Two model families live here. Both are invoked from
[`train_model.py`](../train_model.py), [`train_linear.py`](../train_linear.py),
[`predict.py`](../predict.py), and [`evaluate.py`](../evaluate.py).

## CNN-BiLSTM-Attention (this directory)

- `engine.py` — `PredictionEngine` class:
  `Conv1D → MaxPool → Conv1D → MaxPool → BiLSTM(64) → MultiHeadAttention(4 heads)
  → BiLSTM(32) → Dense(32) → Dense(16) → Dense(1)`. ~151 K trainable params.
  Loss: Huber(δ=1.0). Optimizer: Adam(lr=1e-3, clipnorm=1.0). Trained against
  next-day **return** (not price) on a 60-day lookback window of 19 features.

## Linear (`prediction/linear/`)

A second-opinion ElasticNetCV regressor on a hand-engineered 48-feature space.
See [linear/README.md](linear/README.md).

## Neither file lives here

- The training pipeline (preprocessing, split, scaler) is in
  [`preprocessing/engine.py`](../preprocessing/engine.py).
- The CLI orchestration is in [`train_model.py`](../train_model.py) and
  [`train_linear.py`](../train_linear.py).
