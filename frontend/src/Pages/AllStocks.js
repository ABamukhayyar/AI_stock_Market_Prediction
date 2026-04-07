import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout, { MarketStatus, useTheme } from '../components/Layout';
import SearchInput from '../components/SearchInput';
import { BackButton } from '../components/buttons';
import { MODEL_COLORS, fetchStocks } from '../StockData';
import { useLanguage } from '../LanguageContext';
import useSmartBack from '../hooks/useSmartBack';
import useWatchlist from '../hooks/useWatchlist';
import WatchlistButton from '../components/WatchlistButton';

function MoverCard({ title, stock, up, active, onClick }) {
  if (!stock) return null;

  return (
    <button
      className="allstocks-mover-card"
      type="button"
      onClick={onClick}
      style={{
        background: up ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)',
        border: `1px solid ${
          active
            ? up
              ? 'rgba(134,239,172,0.9)'
              : 'rgba(252,165,165,0.9)'
            : up
              ? 'rgba(34,197,94,0.35)'
              : 'rgba(239,68,68,0.35)'
        }`,
        borderRadius: 16,
        padding: '14px 14px 12px',
        backdropFilter: 'blur(4px)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.62)',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          fontWeight: 700,
        }}
      >
        {title}
      </span>
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: 700 }}>{stock.id}</p>
          <p style={{ fontSize: 14, color: '#fff', fontWeight: 800, marginTop: 2 }}>{stock.name}</p>
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: up ? '#86efac' : '#fecaca' }}>
          {stock.change >= 0 ? '+' : ''}
          {stock.change.toFixed(2)}%
        </span>
      </div>
    </button>
  );
}

function SectorChip({ label, count, active, onClick, isDark }) {
  return (
    <button
      className="allstocks-sector-chip"
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        padding: '8px 13px',
        border: `1px solid ${active ? (isDark ? 'rgba(16,185,129,0.4)' : 'rgba(11,99,67,0.35)') : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.35)')}`,
        background: active ? (isDark ? 'rgba(16,185,129,0.15)' : 'rgba(11,99,67,0.1)') : (isDark ? '#1e293b' : '#fff'),
        color: active ? (isDark ? '#10b981' : '#0b6343') : (isDark ? '#cbd5e1' : '#4b5563'),
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        transition: 'all 0.18s ease',
      }}
    >
      {label}
      <span style={{ fontSize: 10, color: active ? (isDark ? '#10b981' : '#0b6343') : '#94a3b8' }}>{count}</span>
    </button>
  );
}

function ConfidenceRing({ value, size = 46, animate = false, isDark = false }) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!animate) {
      setDisplayed(value);
      return;
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
  }, [value, animate]);

  const color = value >= 90 ? '#0b6343' : value >= 80 ? '#1a8a5a' : value >= 70 ? '#e89a1f' : '#d44';
  const strokeDash = `${circ * (displayed / 100)} ${circ}`;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={isDark ? '#334155' : '#e8f0ec'} strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={strokeDash}
        strokeLinecap="round"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        style={{
          fontSize: 10,
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

function MiniSparkline({ up }) {
  const pts = up
    ? '0,20 10,18 20,15 30,16 40,11 50,12 60,8 70,10 80,5 90,7 100,3'
    : '0,3 10,5 20,8 30,6 40,11 50,10 60,14 70,12 80,17 90,16 100,20';
  const color = up ? '#0b6343' : '#d44';

  return (
    <svg width="86" height="22" viewBox="0 0 100 24" fill="none" style={{ flexShrink: 0 }}>
      <polyline points={pts} stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StockCard({ stock, onOpen, delay = 0, isDark, saved, onToggle }) {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();
  const up = stock.trend === 'up';
  const pctAbs = Math.abs(stock.change).toFixed(2);
  const glow = up ? 'rgba(11,99,67,0.18)' : 'rgba(197,48,48,0.18)';
  const barColor = up ? 'linear-gradient(90deg,#0b6343,#22c55e)' : 'linear-gradient(90deg,#c53030,#ef4444)';
  const model = MODEL_COLORS[stock.model] || { bg: '#eee', color: '#555' };

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className="allstocks-card"
      onClick={() => onOpen(stock.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isDark ? '#1e293b' : '#fff',
        borderRadius: 20,
        border: `1.5px solid ${
          hovered
            ? up
              ? isDark ? 'rgba(34,197,94,0.35)' : 'rgba(11,99,67,0.22)'
              : isDark ? 'rgba(239,68,68,0.35)' : 'rgba(197,48,48,0.22)'
            : isDark
              ? 'rgba(148,163,184,0.15)'
              : 'rgba(0,0,0,0.07)'
        }`,
        padding: '15px 15px 13px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: hovered
          ? 'box-shadow 0.2s ease, border-color 0.2s ease'
          : 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        transform: hovered ? 'translateY(-5px) scale(1.01)' : 'translateY(0)',
        boxShadow: hovered
          ? isDark
            ? `0 18px 44px rgba(0,0,0,0.5), 0 0 0 1px ${up ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}`
            : `0 18px 44px ${glow}, 0 6px 20px rgba(0,0,0,0.06)`
          : isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 14px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: barColor,
          opacity: hovered ? 1 : 0.4,
          transition: 'opacity 0.25s',
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: -38,
          right: -38,
          width: 125,
          height: 125,
          borderRadius: '50%',
          background: up ? 'rgba(11,99,67,0.08)' : 'rgba(197,48,48,0.08)',
          filter: 'blur(26px)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.3s',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <span
            style={{
              fontSize: 9,
              color: '#b0bac4',
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {stock.id}
          </span>
          <h3 className="allstocks-card-title" style={{ fontSize: 13.5, fontWeight: 800, color: isDark ? '#f1f5f9' : '#111827', letterSpacing: '-0.2px', marginTop: 3 }}>
            {stock.name}
          </h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <WatchlistButton
            active={saved}
            compact
            onClick={(event) => {
              event.stopPropagation();
              onToggle(stock.id);
            }}
          />
          <ConfidenceRing value={stock.confidence} size={44} animate={visible} isDark={isDark} />
        </div>
      </div>

      <span
        style={{
          fontSize: 9,
          color: '#b0bac4',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 3,
        }}
      >
        {t('predictedClose')}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 9 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: 1 }}>SAR</span>
        <span
          className="allstocks-card-price"
          style={{
            fontSize: 29,
            fontWeight: 700,
            color: isDark ? '#f8fafc' : '#0f1923',
            fontFamily: "Georgia, 'Times New Roman', serif",
            letterSpacing: '-0.5px',
            lineHeight: 1,
            transition: 'text-shadow 0.3s',
            textShadow: hovered
              ? `0 0 20px ${up ? 'rgba(11,99,67,0.24)' : 'rgba(197,48,48,0.24)'}`
              : 'none',
          }}
        >
          {stock.predicted.toFixed(2)}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <span
            style={{
              fontSize: 9,
              color: '#b0bac4',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.7,
              display: 'block',
              marginBottom: 2,
            }}
          >
            {t('predictedChange')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: up ? '#0b6343' : '#c53030' }}>{up ? '+' : '-'}{pctAbs}%</span>
            <span style={{ fontSize: 10.5, color: '#9aa6b2' }}>vs {stock.vs.toFixed(2)}</span>
          </div>
        </div>
        <MiniSparkline up={up} />
      </div>

      <div
        className="allstocks-card-footer"
        style={{
          marginTop: 'auto',
          paddingTop: 9,
          borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#f0f4f2'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 10.2,
            fontWeight: 700,
            color: model.color,
            background: model.bg,
            borderRadius: 20,
            padding: '3px 9px',
            letterSpacing: 0.2,
          }}
        >
          {stock.model}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: hovered ? (up ? '#0b6343' : '#c53030') : '#b0bac4' }}>
          {t('details')}
        </span>
      </div>
    </div>
  );
}

export default function AllStocks() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const goBack = useSmartBack('/dashboard');
  const { watchlistCount, isSaved, toggle } = useWatchlist();
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [activeSector, setActiveSector] = useState('All');
  const [sortMode, setSortMode] = useState('gainers');
  const sectorsRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const [enrichedStocks, setEnrichedStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStocks()
      .then(data => { setEnrichedStocks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sectors = useMemo(() => {
    const unique = Array.from(new Set(enrichedStocks.map((s) => s.sector || 'General'))).sort((a, b) =>
      a.localeCompare(b)
    );
    return ['All', ...unique];
  }, [enrichedStocks]);

  const sectorCounts = useMemo(() => {
    const counts = { All: enrichedStocks.length };
    enrichedStocks.forEach((s) => {
      const key = s.sector || 'General';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [enrichedStocks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrichedStocks
      .filter((s) => (activeSector === 'All' ? true : (s.sector || 'General') === activeSector))
      .filter((s) => {
        if (!q) return true;
        return (
          s.id.includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.sector || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortMode === 'gainers') return b.change - a.change;
        if (sortMode === 'losers') return a.change - b.change;
        return b.change - a.change;
      });
  }, [enrichedStocks, query, activeSector, sortMode]);

  const highestGainer = useMemo(() => [...enrichedStocks].sort((a, b) => b.change - a.change)[0], [enrichedStocks]);
  const biggestLoser = useMemo(() => [...enrichedStocks].sort((a, b) => a.change - b.change)[0], [enrichedStocks]);
  const orderingText =
    sortMode === 'gainers'
      ? t('orderingGainers')
      : t('orderingLosers');

  const scrollSectors = (direction) => {
    if (!sectorsRef.current) return;
    sectorsRef.current.scrollBy({
      left: direction * 260,
      behavior: 'smooth',
    });
  };

  return (
    <Layout headerCenter={<MarketStatus />}>
      <style>{`
        .fade-in { opacity: 0; transform: translateY(14px); transition: opacity 0.55s ease, transform 0.55s ease; }
        .fade-in.ready { opacity: 1; transform: translateY(0); }
        .stocks-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .movers-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .sector-row { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .sector-row::-webkit-scrollbar { display: none; }
        @media (max-width: 1050px) { .stocks-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 760px) { .movers-grid { grid-template-columns: 1fr; } }
        @media (max-width: 620px) { .stocks-grid { grid-template-columns: 1fr; } }

        body.dark-mode .allstocks-main { color: #cbd5e1; }
        body.dark-mode .allstocks-muted { color: #94a3b8 !important; }
      `}</style>

      <div className="allstocks-main" style={{ padding: '32px 36px 52px', maxWidth: 1180, width: '100%', margin: '0 auto' }}>
        <BackButton onClick={goBack} variant="pill" label={t('back')} style={{ marginBottom: 14 }} />
        <div
          className={`fade-in${mounted ? ' ready' : ''}`}
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 24,
            background: 'linear-gradient(130deg, #0c6f4d 0%, #0b6343 42%, #145f47 100%)',
            boxShadow: '0 18px 50px rgba(11,99,67,0.24)',
            padding: '22px 20px 20px',
            marginBottom: 22,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -70,
              right: -40,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              filter: 'blur(22px)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -90,
              left: -50,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              filter: 'blur(24px)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 14,
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: '#fff',
                  fontFamily: "'DM Serif Display', serif",
                  letterSpacing: '-0.6px',
                }}
              >
                {t('allTasiStocks')}
              </h2>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)' }}>
                {t('allTasiSubtitle')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <WatchlistButton
                active={watchlistCount > 0}
                label={watchlistCount > 0 ? `${t('watchlist')} (${watchlistCount})` : t('watchlist')}
                onClick={() => navigate('/watchlist')}
                inverted
              />
              <SearchInput
                value={query}
                onChange={setQuery}
                theme={isDark ? 'dark' : 'glass'}
                minWidth={260}
                placeholder={t('searchSymbol')}
              />
            </div>
          </div>

          <div className="movers-grid" style={{ position: 'relative', zIndex: 1 }}>
            <MoverCard
              title={t('highestGainer')}
              stock={highestGainer}
              up={true}
              active={sortMode === 'gainers'}
              onClick={() => setSortMode('gainers')}
            />
            <MoverCard
              title={t('biggestLoser')}
              stock={biggestLoser}
              up={false}
              active={sortMode === 'losers'}
              onClick={() => setSortMode('losers')}
            />
          </div>
          <div
            style={{
              marginTop: 10,
              position: 'relative',
              zIndex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.26)',
              borderRadius: 999,
              padding: '6px 12px',
            }}
          >
            <span style={{ fontSize: 12, color: '#fff', fontWeight: 800 }}>{sortMode === 'gainers' ? 'UP' : 'DN'}</span>
            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.92)', fontWeight: 700, letterSpacing: 0.2 }}>
              {orderingText}
            </span>
          </div>
        </div>

        <div className={`fade-in${mounted ? ' ready' : ''}`} style={{ marginBottom: 18, transitionDelay: '0.1s' }}>
            <p
              className="allstocks-muted"
              style={{
                fontSize: 12,
                color: '#8a9aaa',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 8,
            }}
          >
            {t('sortBySector')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="allstocks-sector-scroll"
              type="button"
              onClick={() => scrollSectors(-1)}
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.35)'}`,
                background: isDark ? '#1e293b' : '#fff',
                color: isDark ? '#cbd5e1' : '#4b5563',
                fontSize: 16,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.18s ease',
              }}
              aria-label="Scroll sectors left"
            >
              {'<'}
            </button>

            <div ref={sectorsRef} className="sector-row" style={{ flex: 1 }}>
              {sectors.map((sector) => (
                <SectorChip
                  key={sector}
                  label={sector === 'All' ? t('allSectors') : sector}
                  count={sectorCounts[sector] || 0}
                  active={sector === activeSector}
                  onClick={() => setActiveSector(sector)}
                  isDark={isDark}
                />
              ))}
            </div>

            <button
              className="allstocks-sector-scroll"
              type="button"
              onClick={() => scrollSectors(1)}
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.35)'}`,
                background: isDark ? '#1e293b' : '#fff',
                color: isDark ? '#cbd5e1' : '#4b5563',
                fontSize: 16,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.18s ease',
              }}
              aria-label="Scroll sectors right"
            >
              {'>'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '70px 0', color: '#a0aec0' }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Loading stocks...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="stocks-grid">
            {filtered.map((stock, i) => (
              <StockCard
                key={stock.id}
                stock={stock}
                isDark={isDark}
                delay={100 + i * 40}
                saved={isSaved(stock.id)}
                onToggle={toggle}
                onOpen={(id) => navigate(`/stock/${id}`, { state: { from: '/stocks' } })}
              />
            ))}
          </div>
        ) : (
          <div className="allstocks-muted" style={{ textAlign: 'center', padding: '70px 0', color: '#a0aec0' }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>{t('noResultsFor', { value: query })}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
