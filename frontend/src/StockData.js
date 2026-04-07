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

export async function fetchAccuracy() {
  const res = await fetch(`${API_BASE}/predictions/accuracy`);
  if (!res.ok) throw new Error('Failed to fetch accuracy');
  return res.json();
}
