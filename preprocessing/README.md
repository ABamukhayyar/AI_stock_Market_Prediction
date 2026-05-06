# `preprocessing/` — leakage-safe feature pipeline

Wavelet denoising, returns conversion, IQR outlier clipping, scaling, and
sliding-window sequencing — all done **per slice** so test/val data never
informs training preprocessing parameters. This is the module that fixes the
two classic time-series leakage patterns that the audit found.

## File

- `engine.py` — the `PreprocessingEngine` class. The key entry point is
  `prepare_data(df, feature_columns, ...)` which:
  1. Splits chronologically (70 / 15 / 15 by default).
  2. **Per slice**, wavelet-denoises the price columns then converts them to
     percentage returns. Wavelet basis is *signal-derived*, so doing it
     per-slice keeps future samples out of past denoised values.
  3. Fits IQR clipping bounds on the **train slice only** and applies them to
     val and test (`fit_outlier_bounds()` + `apply_outlier_bounds()`).
  4. Fits the `RobustScaler` on the train slice only, transforms all three.
  5. Builds 60-day sliding-window sequences.
  6. Returns `prev_closes` aligned with each slice's predictions for the
     return → price reconstruction during evaluation.

## Persistence

`save_scaler(path)` and `load_scaler(path)` round-trip both the scaler **and**
the fitted IQR bounds in one bundled file (e.g. `models/TASI_Scaler_v4.pkl`).
Backwards-compatible: legacy bare-scaler files load with empty bounds.

## Why it matters

Before this rewrite the wavelet denoiser ran on the full series before the
split — an extremely common bug in published deep-learning-on-stocks papers.
Section 9 of [PRESENTATION_GUIDE.md](../PRESENTATION_GUIDE.md) walks through
the methodology in defense-ready language.
