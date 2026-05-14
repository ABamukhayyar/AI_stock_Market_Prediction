"""Single source of truth for the 0-100 AI Confidence ring.

Previously this logic existed in two places (`predict.py` and
`api/routes/predictions.py`) and had drifted: different historical-accuracy
boost tables, different scoping for the accuracy lookup (per-model vs
per-(model, symbol)), and different sentiment field names. The same
prediction could surface as one number on the Dashboard and a different
number on the Stock Detail page.

Both call sites now import `compute_confidence()` from this module.
"""

from __future__ import annotations

from typing import Optional


def compute_confidence(
    *,
    model_id: Optional[int],
    predicted_close: float,
    latest_close: float,
    sentiment_score: Optional[float] = None,
    sentiment_confidence: Optional[float] = None,
    symbol: Optional[str] = None,
) -> int:
    """0-100 heuristic confidence score for the AI Confidence ring.

    HEURISTIC, not a calibrated probability. Components:
      - Base 50 (neutral - confidence has to be earned with evidence)
      - Signal strength: bigger predicted move = more decisive
      - Sentiment alignment: today's news agrees with the prediction
        direction (only counted when sentiment is itself confident)
      - Per-(model_id, symbol) historical accuracy from
        `model_accuracy_log`: lower average error -> higher boost.
        New models with no validated history contribute 0 (the system
        refuses to claim confidence it has not earned).

    The accuracy lookup is scoped by both model_id AND symbol when symbol
    is provided. This prevents one stock's good track record from
    inflating another stock's confidence when they share a model_id.

    Parameters
    ----------
    model_id : the ai_models.model_id this prediction was registered under.
        When None, the historical-accuracy contribution is 0.
    predicted_close : the price the model predicts for target_date.
    latest_close : the most recent known close (the comparison baseline).
    sentiment_score : -100..+100. When None, sentiment is ignored.
    sentiment_confidence : 0..100. Sentiment contributes only when this is
        above 50; quiet news shouldn't move confidence in either direction.
    symbol : when provided, scope the historical-accuracy lookup to this
        (model_id, symbol) pair. When None, scope by model_id alone.

    Returns
    -------
    int in [0, 100].
    """
    score = 50.0

    # ---- Signal strength: decisive predictions are more confident ----
    if latest_close and latest_close > 0:
        change_pct = abs((predicted_close - latest_close) / latest_close * 100)
        if change_pct > 2:
            score += 15
        elif change_pct > 1:
            score += 10
        elif change_pct > 0.3:
            score += 5

    # ---- Sentiment alignment: only count when sentiment itself is confident ----
    if (
        sentiment_score is not None
        and sentiment_confidence is not None
        and sentiment_confidence > 50
    ):
        pred_up = predicted_close > latest_close if latest_close else True
        sent_up = sentiment_score > 0
        score += 10 if pred_up == sent_up else -5

    # ---- Per-(model_id, symbol) historical accuracy ----
    # New models with no validated rows -> 0 contribution.
    if model_id is not None:
        try:
            from db.supabase_client import get_client
            sb = get_client()
            pred_query = (
                sb.table("ai_predictions")
                .select("prediction_id")
                .eq("model_id", model_id)
            )
            if symbol:
                pred_query = pred_query.eq("symbol", symbol)
            preds = pred_query.execute()
            pred_ids = [p["prediction_id"] for p in (preds.data or [])]
            if pred_ids:
                logs = (
                    sb.table("model_accuracy_log")
                    .select("error_percentage")
                    .in_("prediction_id", pred_ids)
                    .execute()
                )
                rows = logs.data or []
                if rows:
                    avg_error = sum(r["error_percentage"] for r in rows) / len(rows)
                    if avg_error < 0.5:
                        score += 30
                    elif avg_error < 1:
                        score += 20
                    elif avg_error < 2:
                        score += 10
                    elif avg_error < 5:
                        score += 5
        except Exception:
            # DB unreachable or schema drift: historical contribution stays 0.
            pass

    return max(0, min(100, round(score)))
