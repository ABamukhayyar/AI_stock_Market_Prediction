"""Single source of truth mapping symbol → tickers + model paths.

Used by train_model.py and predict.py so a `--symbol SABIC` invocation
resolves to the right yfinance ticker, Supabase symbol, and model file
paths without duplicating the mapping in every entry point.
"""

from typing import Dict


STOCK_REGISTRY: Dict[str, Dict[str, str]] = {
    "TASI": {
        "yfinance_ticker":   "^TASI.SR",
        "csv_path":          "TASI_Historical_Data.csv",
        "cnn_model_path":    "models/TASI_Model_v4.keras",
        "cnn_scaler_path":   "models/TASI_Scaler_v4.pkl",
        "linear_model_path": "models/tasi_linear_model.pkl",
        "linear_scaler_path":"models/tasi_linear_scaler.pkl",
        "model_label_cnn":   "TASI_CNN_BiLSTM_Attention",
        "model_label_linear":"TASI_Linear_v1",
    },
    "ARAMCO": {
        "yfinance_ticker":   "2222.SR",
        "cnn_model_path":    "models/ARAMCO_Model_v1.keras",
        "cnn_scaler_path":   "models/ARAMCO_Scaler_v1.pkl",
        "linear_model_path": "models/aramco_linear_model.pkl",
        "linear_scaler_path":"models/aramco_linear_scaler.pkl",
        "model_label_cnn":   "ARAMCO_CNN_BiLSTM_Attention",
        "model_label_linear":"ARAMCO_Linear_v1",
    },
    "RAJHI": {
        "yfinance_ticker":   "1120.SR",
        "cnn_model_path":    "models/RAJHI_Model_v1.keras",
        "cnn_scaler_path":   "models/RAJHI_Scaler_v1.pkl",
        "linear_model_path": "models/rajhi_linear_model.pkl",
        "linear_scaler_path":"models/rajhi_linear_scaler.pkl",
        "model_label_cnn":   "RAJHI_CNN_BiLSTM_Attention",
        "model_label_linear":"RAJHI_Linear_v1",
    },
    "SABIC": {
        "yfinance_ticker":   "2010.SR",
        "cnn_model_path":    "models/SABIC_Model_v1.keras",
        "cnn_scaler_path":   "models/SABIC_Scaler_v1.pkl",
        "linear_model_path": "models/sabic_linear_model.pkl",
        "linear_scaler_path":"models/sabic_linear_scaler.pkl",
        "model_label_cnn":   "SABIC_CNN_BiLSTM_Attention",
        "model_label_linear":"SABIC_Linear_v1",
    },
    "STC": {
        "yfinance_ticker":   "7010.SR",
        "cnn_model_path":    "models/STC_Model_v1.keras",
        "cnn_scaler_path":   "models/STC_Scaler_v1.pkl",
        "linear_model_path": "models/stc_linear_model.pkl",
        "linear_scaler_path":"models/stc_linear_scaler.pkl",
        "model_label_cnn":   "STC_CNN_BiLSTM_Attention",
        "model_label_linear":"STC_Linear_v1",
    },
    "SECO": {
        "yfinance_ticker":   "5110.SR",
        "cnn_model_path":    "models/SECO_Model_v1.keras",
        "cnn_scaler_path":   "models/SECO_Scaler_v1.pkl",
        "linear_model_path": "models/seco_linear_model.pkl",
        "linear_scaler_path":"models/seco_linear_scaler.pkl",
        "model_label_cnn":   "SECO_CNN_BiLSTM_Attention",
        "model_label_linear":"SECO_Linear_v1",
    },
}


def get_stock_info(symbol: str) -> Dict[str, str]:
    """Return registry entry for `symbol`, raising a clear error if unknown."""
    if symbol not in STOCK_REGISTRY:
        valid = ", ".join(STOCK_REGISTRY.keys())
        raise ValueError(f"Unknown symbol '{symbol}'. Valid: {valid}")
    return STOCK_REGISTRY[symbol]
