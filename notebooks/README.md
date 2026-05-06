# `notebooks/`

## Production EDA

- `01_eda.ipynb` — the canonical exploratory data analysis: data overview,
  price history, daily-return distributions, ADF stationarity tests, and
  cross-stock correlations with TASI. Covers all 6 supported symbols.
  Outputs are saved to `eda_outputs/` (CSV summaries + PNG plots) and the
  notebook itself is intended to be dropped into the thesis appendix.

## Helpers

- `_build_eda.py` — programmatically (re)generates `01_eda.ipynb` from a
  Python source via `nbformat`. Useful when you want to edit the EDA in plain
  Python and re-emit a fresh notebook.
- `_run_eda.py` — executes `01_eda.ipynb` in-place via
  `nbconvert.ExecutePreprocessor`. Avoids the Windows-path quirks in the
  `jupyter nbconvert` CLI.

## Common workflow

```powershell
# Edit the EDA in _build_eda.py, then:
python notebooks/_build_eda.py     # regenerate the .ipynb file
python notebooks/_run_eda.py       # execute it and refresh outputs
```

## Outputs (gitignored)

- `eda_outputs/01_data_overview.csv`
- `eda_outputs/02_price_history.png`
- `eda_outputs/03a_returns_line.png`, `03b_returns_distribution.png`, `03_return_stats.csv`
- `eda_outputs/04_adf_stationarity.csv`
- `eda_outputs/05_correlation_with_tasi.csv`, `05_correlation_bar.png`
