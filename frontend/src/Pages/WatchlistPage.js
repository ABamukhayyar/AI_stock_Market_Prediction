import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout, { MarketStatus, useTheme } from '../components/Layout';
import { BackButton, PrimaryButton } from '../components/buttons';
import SearchInput from '../components/SearchInput';
import { MODEL_COLORS, fetchBatchStocks } from '../StockData';
import { useLanguage } from '../LanguageContext';
import useSmartBack from '../hooks/useSmartBack';
import useWatchlist from '../hooks/useWatchlist';
import WatchlistButton from '../components/WatchlistButton';

function ConfidenceRing({ value, size = 56, animate = true, isDark = false }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!animate) {
      setDisplayed(value);
      return undefined;
    }

    let frame;
    let start;

    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1100, 1);
      setDisplayed(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [animate, value]);

  const color = value >= 90 ? '#0b6343' : value >= 80 ? '#1a8a5a' : value >= 70 ? '#e89a1f' : '#d44';
  const strokeDash = `${circ * (displayed / 100)} ${circ}`;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={isDark ? '#334155' : '#e8f0ec'} strokeWidth={4.5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4.5}
        strokeDasharray={strokeDash}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.04s linear' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        style={{
          fontSize: 11,
          fontWeight: 700,
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

function WatchlistCard({ stock, onOpen, onToggle, isDark, saveLabel, detailsLabel }) {
  const up = stock.trend === 'up';
  const model = MODEL_COLORS[stock.model] || { bg: '#eee', color: '#555' };

  return (
    <div
      style={{
        background: 'var(--surface-strong)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '18px 18px 16px',
        boxShadow: 'var(--shadow-soft)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 3,
          background: up ? 'linear-gradient(90deg, #0b6343, #22c55e)' : 'linear-gradient(90deg, #c53030, #ef4444)',
          opacity: 0.7,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>{stock.id}</div>
          <h3 style={{ margin: '6px 0 4px', fontSize: 16, fontWeight: 800, color: isDark ? '#f8fafc' : '#111827', letterSpacing: '-0.3px' }}>
            {stock.name}
          </h3>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>{stock.sector || '-'}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <WatchlistButton active onClick={(event) => { event.stopPropagation(); onToggle(stock.id); }} label={saveLabel} compact />
          <ConfidenceRing value={stock.confidence} isDark={isDark} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'baseline', marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>SAR</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'Georgia, serif', letterSpacing: '-0.6px' }}>
            {stock.predicted.toFixed(2)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: up ? '#16a34a' : '#dc2626' }}>
            {up ? '+' : '-'}{Math.abs(stock.change).toFixed(2)}%
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>vs {stock.vs.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 12 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            background: model.bg,
            color: model.color,
            padding: '4px 10px',
            borderRadius: 999,
          }}
        >
          {stock.model}
        </span>
        <button
          type="button"
          onClick={() => onOpen(stock.id)}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--brand)',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {detailsLabel}
        </button>
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const goBack = useSmartBack('/dashboard');
  const { watchlistIds, toggle } = useWatchlist();
  const [query, setQuery] = useState('');

  const [savedStocks, setSavedStocks] = useState([]);

  useEffect(() => {
    if (watchlistIds.length > 0) {
      fetchBatchStocks(watchlistIds)
        .then(setSavedStocks)
        .catch(() => setSavedStocks([]));
    } else {
      setSavedStocks([]);
    }
  }, [watchlistIds]);

  const filteredStocks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return savedStocks;

    return savedStocks.filter((stock) => {
      return (
        stock.id.includes(normalized) ||
        stock.name.toLowerCase().includes(normalized) ||
        (stock.sector || '').toLowerCase().includes(normalized)
      );
    });
  }, [query, savedStocks]);

  return (
    <Layout headerCenter={<MarketStatus />}>
      <div style={{ maxWidth: 1120, width: '100%', margin: '0 auto', padding: '34px 24px 56px' }}>
        <BackButton onClick={goBack} variant="pill" label={t('back')} style={{ marginBottom: 16 }} />

        <section
          style={{
            borderRadius: 28,
            padding: '28px 28px 24px',
            background: 'linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(8,71,49,0.94) 48%, rgba(180,83,9,0.86) 100%)',
            color: '#fff',
            boxShadow: 'var(--shadow-strong)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.8px', fontFamily: "'DM Serif Display', serif" }}>
                {t('myWatchlist')}
              </h1>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.8, color: 'rgba(255,255,255,0.82)', maxWidth: 660 }}>
                {t('watchlistSubtitle')}
              </p>
            </div>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t('searchSymbol')}
              theme={isDark ? 'dark' : 'glass'}
              minWidth={280}
            />
          </div>
        </section>

        {filteredStocks.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, marginTop: 24 }}>
            {filteredStocks.map((stock) => (
              <WatchlistCard
                key={stock.id}
                stock={stock}
                isDark={isDark}
                saveLabel={t('removeFromWatchlist')}
                detailsLabel={t('details')}
                onToggle={toggle}
                onOpen={(id) => navigate(`/stock/${id}`, { state: { from: '/watchlist' } })}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              marginTop: 24,
              background: 'var(--surface-strong)',
              border: '1px solid var(--border)',
              borderRadius: 24,
              padding: '42px 28px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: "'DM Serif Display', serif" }}>
              {t('watchlistEmpty')}
            </h2>
            <p style={{ margin: '12px auto 24px', maxWidth: 540, fontSize: 14, lineHeight: 1.8, color: 'var(--text-muted)' }}>
              {t('addStocksToWatchlist')}
            </p>
            <PrimaryButton type="button" style={{ maxWidth: 240, margin: '0 auto' }} onClick={() => navigate('/stocks')}>
              {t('showAllStocks')}
            </PrimaryButton>
          </div>
        )}
      </div>
    </Layout>
  );
}
