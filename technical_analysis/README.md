# `technical_analysis/` — indicators

Six trailing-window indicators used as model features. All implementations
delegate to the `ta` library so the formulas are battle-tested rather than
hand-rolled.

## File

- `indicators.py` — `TechnicalAnalysisService.add_all(df)` adds these columns
  to the input DataFrame:

| Indicator | Window | Library | Purpose |
|---|---|---|---|
| RSI            | 14 | `ta.momentum.RSIIndicator`           | Overbought / oversold |
| MACD           | 12/26/9 | `ta.trend.MACD`                 | Trend / momentum |
| ATR            | 14 | `ta.volatility.AverageTrueRange`     | True volatility (uses high/low/prev-close) |
| Bollinger Width| 20 | `ta.volatility.BollingerBands`       | Volatility expansion |
| SMA            | 50 | `ta.trend.SMAIndicator`              | Medium-term trend |
| EMA            | 20 | `ta.trend.EMAIndicator`              | Short-term trend |

## Important note

ATR is the **real** indicator (true range using high, low, previous close) —
not the `Price * 0.02` shortcut some legacy tutorials use. This is the only
non-obvious thing in the file and is the reason we depend on the `ta` library
rather than implementing the indicators ourselves.
