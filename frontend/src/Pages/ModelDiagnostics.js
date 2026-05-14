import React, { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout, { useTheme } from '../components/Layout';
import { BackButton } from '../components/buttons';
import {
  MODEL_COLORS,
  fetchStock,
  fetchEvalMetrics,
  formatTargetDate,
} from '../StockData';
import { useLanguage } from '../LanguageContext';

// ── Numeric tile ────────────────────────────────────────────────────────
function Tile({ label, value, sub, accent, isDark }) {
  return (
    <div
      style={{
        background: isDark ? '#1e293b' : '#fff',
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e5e7eb'}`,
        borderRadius: 12,
        padding: '14px 16px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: isDark ? '#94a3b8' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: 0.7,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: accent || (isDark ? '#f8fafc' : '#0f172a'),
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#9ca3af', marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────
function rollingMean(arr, window) {
  const out = new Array(arr.length).fill(null);
  let sum = 0;
  const q = [];
  for (let i = 0; i < arr.length; i++) {
    q.push(arr[i]);
    sum += arr[i];
    if (q.length > window) sum -= q.shift();
    if (q.length === window) out[i] = sum / window;
  }
  return out;
}

function sampleDateLabels(dates, count) {
  if (!dates || dates.length === 0) return [];
  const n = dates.length;
  const idx = Array.from({ length: count }, (_, k) =>
    Math.round((k / (count - 1)) * (n - 1)),
  );
  return idx.map((i) => ({ i, text: dates[i] }));
}

function fmtNum(v, digits = 2) {
  if (v == null || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// ── Chart 1: Equity Curve ───────────────────────────────────────────────
function EquityCurveChart({ dates, strategy, buyhold, isDark }) {
  const chartId = useId().replace(/:/g, '');
  if (!strategy || !buyhold || strategy.length < 2) return null;

  const W = 800;
  const H = 300;
  const padL = 56, padR = 28, padT = 16, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const allY = [...strategy, ...buyhold];
  const yMin = Math.min(...allY, 1);
  const yMax = Math.max(...allY);
  const yPad = (yMax - yMin) * 0.08 || 0.05;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  const xAt = (i) => padL + (i / (strategy.length - 1)) * innerW;
  const yAt = (v) => padT + (1 - (v - yLo) / (yHi - yLo)) * innerH;

  const path = (data) =>
    data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, k) =>
    yLo + (k / (yTicks - 1)) * (yHi - yLo),
  );

  const xLabels = sampleDateLabels(dates.slice(0, strategy.length), 5);

  const stratColor = '#3b82f6';
  const buyColor = isDark ? '#94a3b8' : '#64748b';
  const axisColor = isDark ? '#334155' : '#e5e7eb';
  const textColor = isDark ? '#94a3b8' : '#6b7280';

  const stratEnd = strategy[strategy.length - 1];
  const buyEnd = buyhold[buyhold.length - 1];

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      {/* Y gridlines + labels */}
      {yTickValues.map((v, k) => (
        <g key={`yt-${k}`}>
          <line
            x1={padL} x2={W - padR}
            y1={yAt(v)} y2={yAt(v)}
            stroke={axisColor} strokeWidth={1}
            strokeDasharray={Math.abs(v - 1) < 1e-6 ? '0' : '3 4'}
            opacity={Math.abs(v - 1) < 1e-6 ? 0.7 : 0.4}
          />
          <text
            x={padL - 8} y={yAt(v) + 3.5}
            textAnchor="end"
            style={{ fontSize: 11, fill: textColor, fontFamily: "'DM Sans', sans-serif" }}
          >
            {v.toFixed(2)}×
          </text>
        </g>
      ))}
      {/* X labels */}
      {xLabels.map(({ i, text }, k) => (
        <text
          key={`xl-${k}`}
          x={xAt(i)} y={H - 12}
          textAnchor={k === 0 ? 'start' : k === xLabels.length - 1 ? 'end' : 'middle'}
          style={{ fontSize: 11, fill: textColor, fontFamily: "'DM Sans', sans-serif" }}
        >
          {text}
        </text>
      ))}

      {/* Buy & hold underneath */}
      <path d={path(buyhold)} fill="none" stroke={buyColor} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      {/* Strategy on top */}
      <path d={path(strategy)} fill="none" stroke={stratColor} strokeWidth={2.4}
            strokeLinecap="round" strokeLinejoin="round" />

      {/* End-of-line labels */}
      <text x={W - padR + 4} y={yAt(stratEnd) + 4}
            style={{ fontSize: 12, fontWeight: 700, fill: stratColor, fontFamily: "'DM Sans', sans-serif" }}>
        {stratEnd.toFixed(2)}×
      </text>
      <text x={W - padR + 4} y={yAt(buyEnd) + 4}
            style={{ fontSize: 11, fontWeight: 600, fill: buyColor, fontFamily: "'DM Sans', sans-serif" }}>
        {buyEnd.toFixed(2)}×
      </text>

      {/* Legend */}
      <g transform={`translate(${padL + 8}, ${padT + 8})`}>
        <rect width={170} height={42} rx={6}
              fill={isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.85)'}
              stroke={axisColor} />
        <line x1={10} x2={26} y1={15} y2={15} stroke={stratColor} strokeWidth={2.4} />
        <text x={32} y={18} style={{ fontSize: 11, fontWeight: 600, fill: isDark ? '#f1f5f9' : '#111827' }}>
          Strategy (long when up)
        </text>
        <line x1={10} x2={26} y1={32} y2={32} stroke={buyColor} strokeWidth={2} />
        <text x={32} y={35} style={{ fontSize: 11, fontWeight: 600, fill: isDark ? '#f1f5f9' : '#111827' }}>
          Buy &amp; Hold
        </text>
      </g>
      <defs />
      <title>{`Equity curve, ID ${chartId}`}</title>
    </svg>
  );
}

// ── Chart 2: Predicted vs Actual Scatter ────────────────────────────────
function ScatterChart({ predicted, actual, isDark }) {
  if (!predicted || predicted.length < 2) return null;

  const W = 460;
  const H = 360;
  const padL = 54, padR = 22, padT = 18, padB = 38;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const all = [...predicted, ...actual];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.05;
  const lo = min - pad;
  const hi = max + pad;

  const xAt = (v) => padL + ((v - lo) / (hi - lo)) * innerW;
  const yAt = (v) => padT + (1 - (v - lo) / (hi - lo)) * innerH;

  const ticks = 5;
  const tickValues = Array.from({ length: ticks }, (_, k) =>
    lo + (k / (ticks - 1)) * (hi - lo),
  );

  const axisColor = isDark ? '#334155' : '#e5e7eb';
  const textColor = isDark ? '#94a3b8' : '#6b7280';
  const dotColor = '#3b82f6';

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         style={{ display: 'block' }}>
      {/* Gridlines */}
      {tickValues.map((v, k) => (
        <g key={`g-${k}`}>
          <line x1={xAt(v)} x2={xAt(v)} y1={padT} y2={H - padB}
                stroke={axisColor} strokeWidth={1} strokeDasharray="3 4" opacity={0.4} />
          <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)}
                stroke={axisColor} strokeWidth={1} strokeDasharray="3 4" opacity={0.4} />
        </g>
      ))}
      {/* Diagonal y=x reference line */}
      <line
        x1={xAt(lo)} y1={yAt(lo)} x2={xAt(hi)} y2={yAt(hi)}
        stroke={isDark ? '#94a3b8' : '#64748b'} strokeWidth={1.5} strokeDasharray="6 5" opacity={0.7}
      />
      {/* Points */}
      {predicted.map((p, i) => (
        <circle key={`pt-${i}`} cx={xAt(p)} cy={yAt(actual[i])} r={2.2}
                fill={dotColor} fillOpacity={0.4} />
      ))}
      {/* Tick labels (axis numbers, sparser) */}
      {tickValues.map((v, k) => (
        <g key={`l-${k}`}>
          <text x={xAt(v)} y={H - padB + 16}
                textAnchor="middle"
                style={{ fontSize: 11, fill: textColor, fontFamily: "'DM Sans', sans-serif" }}>
            {Math.round(v)}
          </text>
          <text x={padL - 8} y={yAt(v) + 4}
                textAnchor="end"
                style={{ fontSize: 11, fill: textColor, fontFamily: "'DM Sans', sans-serif" }}>
            {Math.round(v)}
          </text>
        </g>
      ))}
      {/* Axis titles */}
      <text x={(padL + W - padR) / 2} y={H - 6} textAnchor="middle"
            style={{ fontSize: 11, fontWeight: 700, fill: textColor }}>
        Predicted close (SAR)
      </text>
      <text x={14} y={(padT + H - padB) / 2} textAnchor="middle"
            transform={`rotate(-90, 14, ${(padT + H - padB) / 2})`}
            style={{ fontSize: 11, fontWeight: 700, fill: textColor }}>
        Actual close (SAR)
      </text>
    </svg>
  );
}

// ── Chart 3: Rolling MAPE ───────────────────────────────────────────────
function RollingMapeChart({ dates, errorPct, window = 30, isDark }) {
  const series = useMemo(() => rollingMean(errorPct, window), [errorPct, window]);
  const points = useMemo(
    () => series.map((v, i) => (v == null ? null : [i, v])).filter(Boolean),
    [series],
  );

  if (points.length < 2) return null;

  const W = 460;
  const H = 280;
  const padL = 50, padR = 22, padT = 16, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const allY = points.map(([, v]) => v);
  const yMin = 0;
  const yMax = Math.max(...allY) * 1.1 || 1;

  const xAt = (i) => padL + (i / (errorPct.length - 1)) * innerW;
  const yAt = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const pathD = points
    .map(([i, v], k) => `${k === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
    .join(' ');

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks }, (_, k) =>
    yMin + (k / (yTicks - 1)) * (yMax - yMin),
  );
  const xLabels = sampleDateLabels(dates, 4);

  const lineColor = '#e89a1f';
  const axisColor = isDark ? '#334155' : '#e5e7eb';
  const textColor = isDark ? '#94a3b8' : '#6b7280';

  // Overall MAPE line (mean of error_pct)
  const overall = errorPct.reduce((a, b) => a + b, 0) / errorPct.length;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         style={{ display: 'block' }}>
      {yTickValues.map((v, k) => (
        <g key={`y-${k}`}>
          <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)}
                stroke={axisColor} strokeWidth={1} strokeDasharray="3 4" opacity={0.4} />
          <text x={padL - 8} y={yAt(v) + 4} textAnchor="end"
                style={{ fontSize: 11, fill: textColor }}>
            {v.toFixed(2)}%
          </text>
        </g>
      ))}
      {xLabels.map(({ i, text }, k) => (
        <text key={`x-${k}`} x={xAt(i)} y={H - 12}
              textAnchor={k === 0 ? 'start' : k === xLabels.length - 1 ? 'end' : 'middle'}
              style={{ fontSize: 11, fill: textColor }}>
          {text}
        </text>
      ))}
      {/* Overall MAPE reference line */}
      <line x1={padL} x2={W - padR} y1={yAt(overall)} y2={yAt(overall)}
            stroke={isDark ? '#94a3b8' : '#64748b'} strokeWidth={1.5} strokeDasharray="6 5" />
      <text x={W - padR - 4} y={yAt(overall) - 5}
            textAnchor="end"
            style={{ fontSize: 10.5, fontWeight: 600, fill: isDark ? '#cbd5e1' : '#475569' }}>
        Overall {overall.toFixed(2)}%
      </text>
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2.2}
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Page ────────────────────────────────────────────────────────────────
export default function ModelDiagnostics() {
  const { isDark } = useTheme();
  const { t, lang } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();

  const [stock, setStock] = useState(null);
  const [activeModelIdx, setActiveModelIdx] = useState(0);
  const [evalData, setEvalData] = useState(null);
  const [evalState, setEvalState] = useState('loading'); // 'loading' | 'ok' | 'missing' | 'error'

  useEffect(() => {
    fetchStock(id).then(setStock).catch(() => setStock(null));
  }, [id]);

  const modelPredictions = stock?.model_predictions || [];
  const activeModel = modelPredictions[activeModelIdx] || null;

  useEffect(() => {
    if (!activeModel) return undefined;
    let cancelled = false;
    setEvalState('loading');
    fetchEvalMetrics(id, activeModel.model_id).then((data) => {
      if (cancelled) return;
      if (!data) {
        setEvalData(null);
        setEvalState('missing');
        return;
      }
      setEvalData(data);
      setEvalState('ok');
    });
    return () => { cancelled = true; };
  }, [id, activeModel]);

  if (!stock) {
    return (
      <Layout>
        <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#94a3b8' }}>Loading…</p>
        </div>
      </Layout>
    );
  }

  const cfg = MODEL_COLORS[activeModel?.model_name] || { bg: '#eef2f6', color: '#64748b' };
  const m = evalData?.metrics || {};
  const s = evalData?.series || {};

  return (
    <Layout>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 28px 60px' }}>
        <BackButton onClick={() => navigate(`/stock/${id}`)} label={t('back')} variant="pill" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                      marginTop: 8, marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: isDark ? '#94a3b8' : '#6b7280',
                           textTransform: 'uppercase', letterSpacing: 1.2 }}>
              {stock.id} · {stock.name}
            </span>
            <h1 style={{ fontSize: 34, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a',
                         fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.5px',
                         marginTop: 6 }}>
              Model Diagnostics
            </h1>
            <p style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#6b7280', marginTop: 4 }}>
              Offline holdout evaluation (frozen test split). Refreshes only when the model is re-evaluated.
            </p>
          </div>
        </div>

        {/* Model selector chips */}
        {modelPredictions.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {modelPredictions.map((mp, idx) => {
              const isActive = idx === activeModelIdx;
              const c = MODEL_COLORS[mp.model_name] || { bg: '#eef2f6', color: '#64748b' };
              return (
                <button key={mp.model_id}
                        type="button"
                        onClick={() => setActiveModelIdx(idx)}
                        style={{
                          background: isActive ? c.bg : (isDark ? '#1e293b' : '#fff'),
                          border: `1.5px solid ${isActive ? c.color : (isDark ? 'rgba(148,163,184,0.2)' : '#e5e7eb')}`,
                          color: isActive ? c.color : (isDark ? '#cbd5e1' : '#4b5563'),
                          borderRadius: 10,
                          padding: '8px 14px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 12.5,
                        }}>
                  {mp.model_name}
                </button>
              );
            })}
          </div>
        )}

        {evalState === 'loading' && (
          <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading offline metrics…</p>
        )}
        {evalState === 'missing' && (
          <div style={{ padding: 18, borderRadius: 12,
                        background: isDark ? '#1e293b' : '#fff',
                        border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : '#e5e7eb'}` }}>
            <p style={{ color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: 600, marginBottom: 6 }}>
              No offline evaluation data for this model yet.
            </p>
            <p style={{ color: isDark ? '#94a3b8' : '#6b7280', fontSize: 13 }}>
              Run <code style={{ fontFamily: 'monospace' }}>
                python evaluate.py --symbol {stock.id} --model-type{' '}
                {activeModel?.model_name?.includes('CNN') ? 'cnn' : 'linear'} --output-dir models/eval_v4
              </code> to populate it.
            </p>
          </div>
        )}

        {evalState === 'ok' && evalData && (
          <>
            {/* Numeric tiles */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}>
              <Tile label="MAPE" value={`${fmtNum(m.MAPE, 3)}%`}
                    sub="Mean abs. % error"
                    accent={m.MAPE < 1 ? '#22c55e' : m.MAPE < 3 ? '#e89a1f' : '#ef4444'}
                    isDark={isDark} />
              <Tile label="R²" value={fmtNum(m.R2, 4)} sub="Closer to 1 is better" isDark={isDark} />
              <Tile label="Direction Accuracy"
                    value={`${fmtNum(m.Direction_Accuracy, 1)}%`}
                    sub="Got up/down call right"
                    accent={m.Direction_Accuracy >= 60 ? '#22c55e' :
                            m.Direction_Accuracy >= 50 ? '#e89a1f' : '#ef4444'}
                    isDark={isDark} />
              <Tile label="Sharpe Ratio"
                    value={fmtNum(m.strategy_sharpe, 2)}
                    sub={`vs Buy & Hold ${fmtNum(m.buyhold_sharpe, 2)}`}
                    accent={m.strategy_sharpe > m.buyhold_sharpe ? '#22c55e' : '#ef4444'}
                    isDark={isDark} />
              <Tile label="Max Drawdown"
                    value={`${fmtNum(m.strategy_max_drawdown_pct, 2)}%`}
                    sub={`vs B&H ${fmtNum(m.buyhold_max_drawdown_pct, 2)}%`}
                    accent="#ef4444"
                    isDark={isDark} />
              <Tile label="Total Return"
                    value={`${fmtNum(m.strategy_total_return_pct, 2)}%`}
                    sub={`vs B&H ${fmtNum(m.buyhold_total_return_pct, 2)}%`}
                    accent={m.strategy_total_return_pct > 0 ? '#22c55e' : '#ef4444'}
                    isDark={isDark} />
            </div>

            {/* Equity Curve */}
            <div style={{
              background: isDark ? '#1e293b' : '#fff',
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e5e7eb'}`,
              borderRadius: 12,
              padding: 20,
              marginBottom: 18,
            }}>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a',
                             textTransform: 'uppercase', letterSpacing: 0.7 }}>
                  Equity Curve
                </h3>
                <p style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6b7280', marginTop: 3 }}>
                  $1 invested at the start of the test period. Strategy goes long when the model predicts up, flat otherwise. No transaction costs.
                </p>
              </div>
              <EquityCurveChart
                dates={s.test_dates}
                strategy={s.strategy_equity}
                buyhold={s.buyhold_equity}
                isDark={isDark}
              />
              <div style={{ marginTop: 8, display: 'flex', gap: 18, flexWrap: 'wrap',
                            fontSize: 12, color: isDark ? '#cbd5e1' : '#475569' }}>
                <span>Period: <b>{s.test_dates?.[0]} → {s.test_dates?.[s.test_dates.length - 1]}</b></span>
                <span>Trades: <b>{m.n_trades}</b></span>
                <span>Days in market: <b>{fmtNum(m.pct_days_in_market, 1)}%</b></span>
                <span>Hit rate (traded): <b>{fmtNum(m.hit_rate_traded_pct, 1)}%</b></span>
              </div>
            </div>

            {/* Two-column row: scatter + rolling MAPE */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 18,
            }}>
              <div style={{
                background: isDark ? '#1e293b' : '#fff',
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e5e7eb'}`,
                borderRadius: 12,
                padding: 20,
              }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a',
                             textTransform: 'uppercase', letterSpacing: 0.7 }}>
                  Predicted vs Actual
                </h3>
                <p style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6b7280', marginTop: 3, marginBottom: 10 }}>
                  Each dot is one test-set day. Tight cluster along the diagonal = good calibration.
                </p>
                <ScatterChart
                  predicted={s.predicted_close}
                  actual={s.actual_close}
                  isDark={isDark}
                />
              </div>

              <div style={{
                background: isDark ? '#1e293b' : '#fff',
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#e5e7eb'}`,
                borderRadius: 12,
                padding: 20,
              }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a',
                             textTransform: 'uppercase', letterSpacing: 0.7 }}>
                  Rolling 30-day MAPE
                </h3>
                <p style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6b7280', marginTop: 3, marginBottom: 10 }}>
                  Mean absolute percentage error in a 30-day window. Flat/low line = the model isn't degrading over time.
                </p>
                <RollingMapeChart
                  dates={s.test_dates}
                  errorPct={s.error_pct}
                  window={30}
                  isDark={isDark}
                />
              </div>
            </div>

            {/* Footer caveat */}
            <p style={{ marginTop: 18, fontSize: 11.5, color: isDark ? '#64748b' : '#9ca3af',
                        lineHeight: 1.5 }}>
              n = <b>{evalData.n_test}</b> test days. Evaluated{' '}
              <b>{formatTargetDate(evalData.evaluated_at?.slice(0, 10), lang)}</b>.{' '}
              Trading simulation assumes zero transaction cost and perfect fills — real returns
              would be lower. Sharpe is annualised with rf = 0.
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}
