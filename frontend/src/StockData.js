// ─── Shared constants & API helper ────────────────────────────────────────────

export const MODEL_COLORS = {
  'CNN-BiLSTM-Attention':  { bg: 'rgba(11,99,67,0.1)',   color: '#0b6343' },
  'Linear':                { bg: 'rgba(220,104,28,0.1)', color: '#c96a1a' },
  'Linear (ElasticNetCV)': { bg: 'rgba(220,104,28,0.1)', color: '#c96a1a' },
  // Fallbacks for any future models
  'LSTM v2':               { bg: 'rgba(11,99,67,0.1)',   color: '#0b6343' },
  'GRU v3':                { bg: 'rgba(220,104,28,0.1)', color: '#c96a1a' },
  'Transformer v1':        { bg: 'rgba(99,60,180,0.1)',  color: '#6b3fb5' },
};

const API_BASE = '/api';

/**
 * Single source of truth for the AI Confidence ring color.
 * Thresholds calibrated against the real distribution of confidence scores
 * (most predictions land 50-70 because non-TASI stocks have no validated
 * history yet) so we don't alarm-red the entire dashboard.
 */
export function confidenceColor(value) {
  if (value >= 90) return '#0b6343';   // dark green: strong (history + signal + sentiment)
  if (value >= 75) return '#22c55e';   // bright green: good
  if (value >= 60) return '#e89a1f';   // amber: moderate
  if (value >= 45) return '#64748b';   // slate: neutral (no evidence either way)
  return '#dc6e6e';                    // muted red: genuinely weak
}

/** Format an ISO date string (YYYY-MM-DD) as "May 15, 2026" / "15 مايو 2026". */
export function formatTargetDate(iso, lang = 'en') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  try {
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

/** Shorter form: "May 15" / "15 مايو" for compact card labels. */
export function formatTargetDateShort(iso, lang = 'en') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  try {
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export async function fetchStocks() {
  const res = await fetch(`${API_BASE}/stocks`);
  if (!res.ok) throw new Error('Failed to fetch stocks');
  return res.json();
}

export async function fetchStock(id) {
  const res = await fetch(`${API_BASE}/stocks/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch stock ${id}`);
  return res.json();
}

export async function fetchStockHistory(id, days = 60) {
  const res = await fetch(`${API_BASE}/stocks/${id}/history?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch history for ${id}`);
  return res.json();
}

export async function fetchPredictions() {
  const res = await fetch(`${API_BASE}/predictions/latest`);
  if (!res.ok) throw new Error('Failed to fetch predictions');
  return res.json();
}

export async function fetchBatchStocks(ids) {
  if (!ids.length) return [];
  const res = await fetch(`${API_BASE}/stocks/batch?ids=${ids.join(',')}`);
  if (!res.ok) throw new Error('Failed to fetch batch stocks');
  return res.json();
}

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/predictions/models`);
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json();
}

export async function fetchAccuracy(symbol, limit = 50) {
  const params = new URLSearchParams();
  if (symbol) params.set('symbol', symbol);
  params.set('limit', String(limit));
  const res = await fetch(`${API_BASE}/predictions/accuracy?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch accuracy');
  return res.json();
}

export async function fetchModelMetrics(symbol, modelId) {
  if (!symbol || modelId == null) return null;
  const params = new URLSearchParams();
  params.set('symbol', symbol);
  params.set('model_id', String(modelId));
  try {
    const res = await fetch(`${API_BASE}/predictions/model-metrics?${params.toString()}`);
    if (!res.ok) return null;
    return res.json();
  } catch (_e) {
    return null;
  }
}

/** Offline holdout evaluation metrics + arrays for the Diagnostics page. */
export async function fetchEvalMetrics(symbol, modelId) {
  if (!symbol || modelId == null) return null;
  const params = new URLSearchParams();
  params.set('symbol', symbol);
  params.set('model_id', String(modelId));
  try {
    const res = await fetch(`${API_BASE}/predictions/eval-metrics?${params.toString()}`);
    if (!res.ok) return null;
    return res.json();
  } catch (_e) {
    return null;
  }
}
