import React, { useState, useEffect, useRef, useId } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { MODEL_COLORS, fetchStock } from '../StockData';
import Layout, { MarketStatus, useTheme } from '../components/Layout';
import { BackButton } from '../components/buttons';
import { useLanguage } from '../LanguageContext';
import useSmartBack from '../hooks/useSmartBack';
import useWatchlist from '../hooks/useWatchlist';
import WatchlistButton from '../components/WatchlistButton';

function ConfidenceRing({ value, size = 72, isDark = false }) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let frame;
    let start;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / 1200, 1);
      setDisplayed(Math.round((1 - Math.pow(1 - progress, 3)) * value));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const color = value >= 90 ? '#0b6343' : value >= 80 ? '#1a8a5a' : value >= 70 ? '#e89a1f' : '#d44';

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isDark ? '#334155' : '#e0e7e3'}
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${circumference * (displayed / 100)} ${circumference}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.04s linear' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={isDark ? '#e2e8f0' : '#1a2e3a'}
        style={{
          fontSize: 14,
          fontWeight: 800,
          fontFamily: "'DM Sans', sans-serif",
          transform: 'rotate(90deg)',
          transformOrigin: `${size / 2}px ${size / 2}px`,
        }}
      >
        {displayed}%
      </text>
    </svg>
  );
}

function PriceChart({ history, up, isDark = false }) {
  const [progress, setProgress] = useState(0);
  const [totalLength, setTotalLength] = useState(0);
  const pathRef = useRef(null);
  const chartId = useId().replace(/:/g, '');
  const fillId = `${chartId}-fill`;
  const clipId = `${chartId}-clip`;

  const series = Array.isArray(history) && history.length > 1 ? history : [history?.[0] ?? 0, history?.[0] ?? 0];

  const width = 600;
  const height = 160;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const spread = max - min;
  const pad = spread === 0 ? Math.max(Math.abs(max) * 0.02, 1) : spread * 0.12;
  const denom = spread + pad * 2;

  const points = series.map((value, idx) => {
    const x = (idx / (series.length - 1)) * width;
    const y = height - ((value - (min - pad)) / denom) * height;
    return [x, y];
  });

  const pathD = points
    .map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const areaD = `${pathD} L${width},${height} L0,${height} Z`;

  const color = up ? '#22c55e' : '#ef4444';
  const areaColor = up ? 'rgba(34,197,94,' : 'rgba(239,68,68,';

  useEffect(() => {
    if (!pathRef.current) return;
    const len = pathRef.current.getTotalLength();
    setTotalLength(len);
    setProgress(0);

    let frame;
    let start;
    const tick = (timestamp) => {
      if (!start) start = timestamp;
      const p = Math.min((timestamp - start) / 1400, 1);
      const eased = 1 - Math.pow(1 - p, 2);
      setProgress(eased * len);
      if (p < 1) frame = requestAnimationFrame(tick);
      else setProgress(len);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [history]);

  const safeLength = totalLength || 1;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`${areaColor}0.2)`} />
          <stop offset="100%" stopColor={`${areaColor}0)`} />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={progress} height={height} />
        </clipPath>
      </defs>

      {[0.25, 0.5, 0.75].map((fraction) => (
        <line
          key={fraction}
          x1="0"
          y1={height * fraction}
          x2={width}
          y2={height * fraction}
          stroke={isDark ? '#334155' : '#ccc'}
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.5"
        />
      ))}

      <path d={areaD} fill={`url(#${fillId})`} clipPath={`url(#${clipId})`} />
      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={safeLength}
        strokeDashoffset={Math.max(0, safeLength - progress)}
      />

      {points.length > 0 && progress >= safeLength * 0.9 && (
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="5" fill={color} stroke="white" strokeWidth="2" />
      )}
    </svg>
  );
}

function StatBox({ label, value, sub, accent, isDark = false }) {
  return (
    <div
      className="stockdetail-stat"
      style={{
        background: isDark ? '#111827' : '#f9fafb',
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.22)' : '#eef2f6'}`,
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        className="stockdetail-muted"
        style={{
          fontSize: 10,
          color: isDark ? '#94a3b8' : '#6b7280',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        {label}
      </span>
      <span
        className="stockdetail-stat-value"
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: accent || (isDark ? '#f8fafc' : '#111827'),
          letterSpacing: '-0.3px',
          fontFamily: 'Georgia, serif',
        }}
      >
        {value}
      </span>
      {sub && (
        <span className="stockdetail-muted" style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#9ca3af' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function PriceLabel({ label, value, isDark = false }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#eef2f6'}`,
      }}
    >
      <span
        className="stockdetail-muted"
        style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
      >
        {label}
      </span>
      <span
        className="stockdetail-surface-title"
        style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#111827', fontFamily: 'Georgia, serif' }}
      >
        {value}
      </span>
    </div>
  );
}

function ModelBadge({ model }) {
  const cfg = MODEL_COLORS[model] || { bg: '#eee', color: '#555' };
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        background: cfg.bg,
        color: cfg.color,
        padding: '4px 12px',
        borderRadius: 20,
        border: `1px solid ${cfg.color}30`,
      }}
    >
      {model}
    </span>
  );
}

export default function StockDetail() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  const { isSaved, toggle } = useWatchlist();
  const fromPage =
    location.state?.from === '/dashboard'
      ? '/dashboard'
      : location.state?.from === '/watchlist'
        ? '/watchlist'
        : '/stocks';
  const goBack = useSmartBack(fromPage);

  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModelIdx, setActiveModelIdx] = useState(0);

  useEffect(() => {
    setLoading(true);
    setActiveModelIdx(0);
    fetchStock(id)
      .then(data => { setStock(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  // Get the active model's prediction (if multiple models available)
  const modelPredictions = stock?.model_predictions || [];
  const activeModel = modelPredictions[activeModelIdx] || null;
  // Override stock display with selected model's prediction
  const displayStock = stock ? {
    ...stock,
    ...(activeModel ? {
      predicted: activeModel.predicted_close,
      change: activeModel.change,
      trend: activeModel.trend,
      model: activeModel.model_name,
      confidence: activeModel.confidence,
    } : {}),
  } : null;

  const otherStocks = [];

  useEffect(() => {
    const timeout = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(timeout);
  }, []);

  if (loading) {
    return (
      <Layout headerCenter={<MarketStatus />}>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#6b7280' }}>Loading stock data...</p>
        </div>
      </Layout>
    );
  }

  if (!stock) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0b6343, #073d28)',
          color: '#fff',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 700 }}>{t('stockNotFound')}</p>
        <button
          onClick={goBack}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            borderRadius: 50,
            padding: '10px 24px',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          {'<-'} {t('back')}
        </button>
      </div>
    );
  }

  const s = displayStock;
  const up = s.trend === 'up';
  const pctAbs = Math.abs(s.change).toFixed(2);
  const trendColor = up ? '#22c55e' : '#ef4444';

  return (
    <Layout headerCenter={<MarketStatus />}>
      <style>{`
        .slide-up { opacity: 0; transform: translateY(20px); transition: opacity 0.55s ease, transform 0.55s ease; }
        .slide-up.in { opacity: 1; transform: translateY(0); }
        .d1 { transition-delay: 0.05s; } .d2 { transition-delay: 0.12s; }
        .d3 { transition-delay: 0.2s;  } .d4 { transition-delay: 0.28s; }
        .d5 { transition-delay: 0.36s; } .d6 { transition-delay: 0.44s; }
        .stock-nav-btn:hover { background: #f3f4f6 !important; }

        body.dark-mode .stockdetail-main { color: #cbd5e1; }
        body.dark-mode .stockdetail-title { color: #f8fafc !important; }
        body.dark-mode .stockdetail-muted { color: #94a3b8 !important; }
        body.dark-mode .stockdetail-price { color: #f8fafc !important; }
        body.dark-mode .stockdetail-timeframe-btn {
          border-color: rgba(148,163,184,0.4) !important;
          color: #cbd5e1 !important;
        }
        body.dark-mode .stockdetail-timeframe-btn.active {
          background: #0b6343 !important;
          color: #fff !important;
          border-color: rgba(34,197,94,0.5) !important;
        }
        body.dark-mode .stockdetail-surface {
          background: #0f172a !important;
          border-color: rgba(148,163,184,0.22) !important;
          box-shadow: 0 8px 24px rgba(2,6,23,0.45) !important;
        }
        body.dark-mode .stockdetail-stat {
          background: #111827 !important;
          border-color: rgba(148,163,184,0.2) !important;
        }
        body.dark-mode .stockdetail-stat-value { color: #f8fafc !important; }
        body.dark-mode .stockdetail-surface-title { color: #e2e8f0 !important; }
        body.dark-mode .stockdetail-nav-name { color: #e2e8f0 !important; }
        body.dark-mode .stockdetail-rationale { color: #cbd5e1 !important; }
        body.dark-mode .stockdetail-nav-btn {
          border-color: rgba(148,163,184,0.22) !important;
        }
        body.dark-mode .stock-nav-btn:hover { background: #334155 !important; }
      `}</style>

      <div className="stockdetail-main" style={{ padding: '36px 24px 52px', maxWidth: 1000, width: '100%', margin: '0 auto' }}>
        <BackButton onClick={goBack} label={t('back')} variant="pill" />

        {/* Model Switcher */}
        {modelPredictions.length > 1 && (
          <div className={`slide-up d1${mounted ? ' in' : ''}`} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {modelPredictions.map((mp, idx) => {
              const isActive = idx === activeModelIdx;
              const mpUp = mp.trend === 'up';
              const cfg = MODEL_COLORS[mp.model_name] || { bg: '#eee', color: '#555' };
              return (
                <button
                  key={mp.model_id}
                  onClick={() => setActiveModelIdx(idx)}
                  style={{
                    background: isActive ? cfg.bg : (isDark ? '#1e293b' : '#f9fafb'),
                    border: `2px solid ${isActive ? cfg.color : (isDark ? 'rgba(148,163,184,0.2)' : '#e5e7eb')}`,
                    borderRadius: 14,
                    padding: '12px 18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    minWidth: 180,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{mp.model_name}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: isDark ? '#f8fafc' : '#111827', fontFamily: 'Georgia, serif' }}>
                    SAR {mp.predicted_close.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: mpUp ? '#22c55e' : '#ef4444' }}>
                    {mpUp ? '+' : ''}{mp.change.toFixed(2)}%
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className={`slide-up d1${mounted ? ' in' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <span
              className="stockdetail-muted"
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: 1.2,
                display: 'block',
                marginBottom: 8,
              }}
            >
              {s.id} | {s.sector}
            </span>
            <h1
              className="stockdetail-title"
              style={{
                fontSize: 42,
                fontWeight: 800,
                color: '#111827',
                fontFamily: "'DM Serif Display', serif",
                letterSpacing: '-1px',
                lineHeight: 1,
                marginBottom: 12,
              }}
            >
              {s.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 700, letterSpacing: 1 }}>SAR</span>
                <span
                  className="stockdetail-price"
                  style={{
                    fontSize: 52,
                    fontWeight: 700,
                    color: '#111827',
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    letterSpacing: '-2px',
                    lineHeight: 1,
                  }}
                >
                  {(s.predicted ?? 0).toFixed(2)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: up ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${up ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  borderRadius: 50,
                  padding: '5px 12px',
                }}
              >
                <span style={{ fontSize: 11, color: trendColor }}>{up ? '+' : '-'}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: trendColor }}>
                  {up ? '+' : '-'}
                  {pctAbs}%
                </span>
              </div>
            </div>
            <p className="stockdetail-muted" style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
              {t('predictedCloseVs', { value: (s.vs ?? 0).toFixed(2) })}
            </p>
            <div style={{ marginTop: 16 }}>
              <WatchlistButton
                active={isSaved(s.id)}
                onClick={() => toggle(s.id)}
                label={isSaved(s.id) ? t('removeFromWatchlist') : t('saveToWatchlist')}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <ConfidenceRing value={s.confidence} isDark={isDark} />
            <span className="stockdetail-muted" style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('aiConfidence')}
            </span>
            <ModelBadge model={s.model} />
          </div>
        </div>

        <div
          className={`slide-up d2 stockdetail-surface${mounted ? ' in' : ''}`}
          style={{
            background: isDark ? '#1e293b' : '#fff',
            border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#eef2f6'}`,
            borderRadius: 20,
            padding: '24px 24px 16px',
            marginBottom: 24,
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="stockdetail-surface-title" style={{ fontSize: 12, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 }}>
              {t('priceHistory')}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {['1W', '2W', '1M'].map((timeframe, idx) => (
                <button
                  key={timeframe}
                  className={`stockdetail-timeframe-btn${idx === 1 ? ' active' : ''}`}
                  style={{
                    background: idx === 1 ? '#0b6343' : 'transparent',
                    border: `1px solid ${idx === 1 ? (isDark ? 'rgba(34,197,94,0.5)' : '#0b6343') : (isDark ? 'rgba(148,163,184,0.3)' : '#d1d5db')}`,
                    color: idx === 1 ? '#fff' : (isDark ? '#cbd5e1' : '#4b5563'),
                    borderRadius: 20,
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {timeframe}
                </button>
              ))}
            </div>
          </div>
          <PriceChart history={s.history} up={up} isDark={isDark} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '0 4px' }}>
            <span className="stockdetail-muted" style={{ fontSize: 10.5, color: '#9ca3af' }}>
              {t('daysAgo14')}
            </span>
            <span className="stockdetail-muted" style={{ fontSize: 10.5, color: '#9ca3af' }}>
              {t('todayPredicted')}
            </span>
          </div>
        </div>

        <div className={`slide-up d3${mounted ? ' in' : ''}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
          <StatBox label={t('todayOpen')} value={(s.open ?? 0).toFixed(2)} sub="SAR" isDark={isDark} />
          <StatBox label={t('dayHigh')} value={(s.high ?? 0).toFixed(2)} sub="SAR" accent={up ? '#22c55e' : undefined} isDark={isDark} />
          <StatBox label={t('dayLow')} value={(s.low ?? 0).toFixed(2)} sub="SAR" accent={!up ? '#ef4444' : undefined} isDark={isDark} />
          <StatBox label={t('volume')} value={s.volume || 'N/A'} sub={t('sharesTraded')} isDark={isDark} />
          <StatBox label={t('marketCap')} value={`SAR ${s.marketCap || 'N/A'}`} sub={t('totalValue')} isDark={isDark} />
          <StatBox label={t('peRatio')} value={s.pe != null ? s.pe.toFixed(1) : 'N/A'} sub={t('priceEarnings')} isDark={isDark} />
          <StatBox label={t('week52High')} value={(s.week52High ?? 0).toFixed(2)} sub="SAR" isDark={isDark} />
          <StatBox label={t('week52Low')} value={(s.week52Low ?? 0).toFixed(2)} sub="SAR" isDark={isDark} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div
            className={`slide-up d4 stockdetail-surface${mounted ? ' in' : ''}`}
            style={{
              background: isDark ? '#1e293b' : '#fff',
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#eef2f6'}`,
              borderRadius: 20,
              padding: 24,
              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.02)',
            }}
          >
            <h3 className="stockdetail-surface-title" style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 16 }}>
              {t('keyPriceLevels')}
            </h3>
            <PriceLabel label={t('predictedCloseLabel')} value={`SAR ${(s.predicted ?? 0).toFixed(2)}`} isDark={isDark} />
            <PriceLabel label={t('currentPrice')} value={`SAR ${(s.vs ?? 0).toFixed(2)}`} isDark={isDark} />
            <PriceLabel label={t('expectedMove')} value={`${up ? '+' : '-'}${pctAbs}%`} isDark={isDark} />
            <PriceLabel label={t('dayHigh')} value={`SAR ${(s.high ?? 0).toFixed(2)}`} isDark={isDark} />
            <PriceLabel label={t('dayLow')} value={`SAR ${(s.low ?? 0).toFixed(2)}`} isDark={isDark} />
            <PriceLabel label={t('week52High')} value={`SAR ${(s.week52High ?? 0).toFixed(2)}`} isDark={isDark} />
          </div>

          <div
            className={`slide-up d5 stockdetail-surface${mounted ? ' in' : ''}`}
            style={{
              background: isDark ? '#1e293b' : '#fff',
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#eef2f6'}`,
              borderRadius: 20,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.02)',
            }}
          >
            <div>
              <h3 className="stockdetail-surface-title" style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>
                {t('aiSignalRationale')}
              </h3>
              <div
                className="stockdetail-rationale"
                style={{
                  background: up ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${up ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 13.5,
                  color: isDark ? '#cbd5e1' : '#374151',
                  lineHeight: 1.65,
                  fontStyle: 'italic',
                }}
              >
                "{s.modelRationale}"
              </div>
            </div>
            <div>
              <h3 className="stockdetail-surface-title" style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>
                {t('about')} {s.name}
              </h3>
              <p className="stockdetail-muted" style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.65 }}>
                {s.description}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`slide-up d6 stockdetail-surface${mounted ? ' in' : ''}`}
          style={{ background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#eef2f6'}`, borderRadius: 20, padding: 24, boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.02)' }}
        >
          <h3 className="stockdetail-surface-title" style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 16 }}>
            {t('otherPredictions')}
          </h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {otherStocks.map((item) => {
              const isUp = item.trend === 'up';
              return (
                <button
                  key={item.id}
                  className="stock-nav-btn stockdetail-nav-btn"
                  onClick={() => navigate(`/stock/${item.id}`, { state: { from: fromPage } })}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : '#eef2f6'}`,
                    borderRadius: 12,
                    padding: '10px 16px',
                    cursor: 'pointer',
                    transition: 'background 0.18s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    alignItems: 'flex-start',
                  }}
                >
                  <span className="stockdetail-muted" style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, letterSpacing: 0.8 }}>
                    {item.id}
                  </span>
                  <span className="stockdetail-nav-name" style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isUp ? '#22c55e' : '#ef4444' }}>
                    {isUp ? '+' : '-'}
                    {Math.abs(item.change).toFixed(2)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
