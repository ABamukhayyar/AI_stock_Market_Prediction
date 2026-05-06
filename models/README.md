# `models/` — trained artefacts and cached weights

Everything here is regenerable from source — most of it is `.gitignored`. If
you delete the cached HuggingFace folders the first run of `predict.py` will
re-download them (~600 MB).

## What's inside

### Trained per-symbol models (one CNN + one linear per symbol)

| Symbol | CNN | Linear |
|---|---|---|
| TASI   | `TASI_Model_v4.keras` + `TASI_Scaler_v4.pkl` | `tasi_linear_model.pkl` + `tasi_linear_scaler.pkl` |
| ARAMCO | `ARAMCO_Model_v1.keras` + `ARAMCO_Scaler_v1.pkl` | `aramco_linear_model.pkl` + `aramco_linear_scaler.pkl` |
| RAJHI  | `RAJHI_Model_v1.keras` + `RAJHI_Scaler_v1.pkl` | `rajhi_linear_model.pkl` + `rajhi_linear_scaler.pkl` |
| SABIC  | `SABIC_Model_v1.keras` + `SABIC_Scaler_v1.pkl` | `sabic_linear_model.pkl` + `sabic_linear_scaler.pkl` |
| STC    | `STC_Model_v1.keras` + `STC_Scaler_v1.pkl` | `stc_linear_model.pkl` + `stc_linear_scaler.pkl` |
| SECO   | `SECO_Model_v1.keras` + `SECO_Scaler_v1.pkl` | `seco_linear_model.pkl` + `seco_linear_scaler.pkl` |

The exact filenames above are hard-coded in
[`data_acquisition/registry.py`](../data_acquisition/registry.py). Don't
rename a model file without updating the registry.

The `.pkl` files are *bundles*: each one stores both the fitted scaler and the
train-only IQR clipping bounds (see [`preprocessing/README.md`](../preprocessing/README.md)).

### Cached NLP weights (auto-downloaded by [`sentiment/analyzer.py`](../sentiment/analyzer.py))

- `finbert/` — ProsusAI/finbert (English financial sentiment).
- `opus-mt-ar-en/` — Helsinki-NLP/opus-mt-ar-en (Arabic→English translation).

### Plots

- `eval_v4/` — current evaluation plots (CNN actual-vs-predicted, error analysis).
- `plots/` — most recent training curves + linear evaluation plots.

## Regenerating

| Want to regenerate... | Run |
|---|---|
| One CNN model | `python train_model.py --symbol SABIC` |
| One linear model | `python train_linear.py --symbol SABIC` |
| The eval plots | `python evaluate.py --symbol SABIC --model-type all` |
