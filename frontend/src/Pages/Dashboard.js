import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODEL_COLORS, fetchPredictions } from '../StockData';
import Layout, { MarketStatus, useTheme } from '../components/Layout';
import SearchInput from '../components/SearchInput';
import { useLanguage } from '../LanguageContext';
import useWatchlist from '../hooks/useWatchlist';
import WatchlistButton from '../components/WatchlistButton';

// --- Helper components (only used in Dashboard) -------------------------------

function CountUp({ to, duration = 1200, decimals = 0, suffix = '' }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let frame, start;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(+(eased * to).toFixed(decimals));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, duration, decimals]);
  return <>{val.toFixed(decimals)}{suffix}</>;
}

function ConfidenceRing({ value, size = 56, animate = false, isDark = false }) {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!animate) { setDisplayed(value); return; }
    let frame, start;
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
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={isDark ? '#334155' : '#e8f0ec'} strokeWidth={4.5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4.5}
        strokeDasharray={strokeDash} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.04s linear' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fill={color}
        style={{ fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
          transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}>
        {displayed}%
      </text>
    </svg>
  );
}

function Sparkline({ up }) {
  const pts = up
    ? '0,20 10,18 20,15 30,16 40,11 50,12 60,8 70,10 80,5 90,7 100,3'
    : '0,3  10,5  20,8  30,6  40,11 50,10 60,14 70,12 80,17 90,16 100,20';
  const color = up ? '#0b6343' : '#d44';

  return (
    <svg width="86" height="22" viewBox="0 0 100 24" fill="none" style={{ flexShrink: 0 }}>
      <polyline
        points={pts}
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StockCard({ stock, delay, isDark, saved, onToggle }) {
  const [hovered, setHovered]     = useState(false);
  const [visible, setVisible]     = useState(false);
  const [tilt, setTilt]           = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  - 0.5;
    const cy = (e.clientY - rect.top)  / rect.height - 0.5;
    setTilt({ x: cy * -10, y: cx * 10 });
  }, []);

  const up     = stock.trend === 'up';
  const pctAbs = Math.abs(stock.change).toFixed(2);
  const model  = MODEL_COLORS[stock.model] || { bg: '#eee', color: '#555' };
  const glow   = up ? 'rgba(11,99,67,0.18)' : 'rgba(197,48,48,0.18)';
  const barColor = up ? 'linear-gradient(90deg,#0b6343,#22c55e)' : 'linear-gradient(90deg,#c53030,#ef4444)';

  return (
    <div
      className="dashboard-card"
      ref={cardRef}
      onClick={() => navigate(`/stock/${stock.id}`, { state: { from: '/dashboard' } })}
      onMouseEnter={() => { setHovered(true); }}
      onMouseLeave={() => { setHovered(false); setTilt({ x: 0, y: 0 }); }}
      onMouseMove={handleMouseMove}
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
        padding: '22px 22px 18px',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden', cursor: 'pointer', zIndex: hovered ? 2 : 1,
        transition: hovered
          ? 'box-shadow 0.2s ease, border-color 0.2s ease'
          : 'all 0.45s cubic-bezier(0.34,1.56,0.64,1)',
        transform: hovered
          ? `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-7px) scale(1.015)`
          : visible ? 'perspective(900px) rotateX(0) rotateY(0) translateY(0) scale(1)' : 'translateY(30px) scale(0.98)',
        opacity: visible ? 1 : 0,
        boxShadow: hovered
          ? isDark
            ? `0 22px 64px rgba(0,0,0,0.5), 0 0 0 1px ${up ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`
            : `0 22px 64px ${glow}, 0 6px 22px rgba(0,0,0,0.07)`
          : isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 14px rgba(0,0,0,0.05)',
        transformStyle: 'flat',
      }}
    >
      {/* Top color bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: barColor,
        opacity: hovered ? 1 : 0.3,
        transition: 'opacity 0.3s',
      }} />

      {/* Ambient glow blob */}
      <div style={{
        position: 'absolute', bottom: -40, right: -40,
        width: 140, height: 140, borderRadius: '50%',
        background: up ? 'rgba(11,99,67,0.07)' : 'rgba(197,48,48,0.07)',
        filter: 'blur(28px)',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.4s',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <span className="dashboard-card-muted" style={{ fontSize: 10, color: '#b0bac4', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            {stock.id}
          </span>
          <h3 className="dashboard-card-title" style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '3px 0 0', letterSpacing: '-0.3px' }}>
            {stock.name}
          </h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <WatchlistButton
            active={saved}
            compact
            onClick={(event) => {
              event.stopPropagation();
              onToggle(stock.id);
            }}
          />
          <ConfidenceRing value={stock.confidence} animate={visible} isDark={isDark} />
        </div>
      </div>

      <span className="dashboard-card-muted" style={{ fontSize: 9.5, color: '#b0bac4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 3 }}>
        {t('predictedClose')}
      </span>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
        <span className="dashboard-card-muted" style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', letterSpacing: 1 }}>SAR</span>
        <span className="dashboard-card-price" style={{
          fontSize: 34, fontWeight: 700, color: '#0f1923',
          fontFamily: "Georgia, 'Times New Roman', serif",
          letterSpacing: '-0.5px', lineHeight: 1,
          transition: 'text-shadow 0.35s',
          textShadow: hovered ? `0 0 28px ${up ? 'rgba(11,99,67,0.28)' : 'rgba(197,48,48,0.28)'}` : 'none',
        }}>
          {stock.predicted.toFixed(2)}
        </span>
      </div>

      {/* Change */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span className="dashboard-card-muted" style={{ fontSize: 9.5, color: '#b0bac4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, display: 'block', marginBottom: 3 }}>
            {t('predictedChange')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: up ? '#0b6343' : '#c53030', display: 'flex', alignItems: 'center', gap: 3 }}>
              {up ? '+' : '-'}{pctAbs}%
            </span>
            <span className="dashboard-card-muted" style={{ fontSize: 11, color: '#b0bac4', fontWeight: 500 }}>vs {stock.vs.toFixed(2)}</span>
          </div>
        </div>
        <Sparkline up={up} />
      </div>

      {/* Footer */}
      <div className="dashboard-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#f0f4f2'}` }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700,
          background: model.bg, color: model.color,
          padding: '3px 10px', borderRadius: 20, letterSpacing: 0.2,
        }}>
          {stock.model}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: hovered ? (up ? '#0b6343' : '#c53030') : '#b0bac4',
          transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: 3,
        }}>
          {t('details')} <span style={{ fontSize: 14, fontWeight: 400 }}>{'>'}</span>
        </span>
      </div>
    </div>
  );
}

function TickerTape({ stocks }) {
  const items = [...stocks, ...stocks, ...stocks];
  return (
    <div style={{ overflow: 'hidden', background: 'rgba(0,0,0,0.18)', padding: '6px 0' }}>
      <div style={{ display: 'flex', animation: 'ticker 22s linear infinite', width: 'max-content' }}>
        {items.map((s, i) => {
          const up = s.change > 0;
          return (
            <span key={i} style={{
              padding: '0 22px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
              color: up ? '#6ee7b7' : '#fca5a5',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, letterSpacing: 1 }}>{s.id}</span>
              {s.name}
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10.5 }}>
                {up ? '+' : ''}{s.change.toFixed(2)}%
              </span>
              <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10 }}>|</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function StatPill({ label, value, sub, accent, icon, onClick, active, doCountUp, countTo }) {
  const [hovered, setHovered] = useState(false);
  const { t } = useLanguage();
  const clickable = !!onClick;
  const displayIcon = accent === '#22c55e' ? '\u25B2' : accent === '#ef4444' ? '\u25BC' : icon;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => clickable && setHovered(true)}
      onMouseLeave={() => clickable && setHovered(false)}
      style={{
        background: active ? 'rgba(255,255,255,0.18)' : hovered ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.07)',
        borderRadius: 12, padding: '11px 18px',
        borderLeft: `3px solid ${active ? '#fff' : accent}`,
        display: 'flex', flexDirection: 'column', gap: 1,
        minWidth: 168,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'all 0.18s ease',
        outline: active ? '1.5px solid rgba(255,255,255,0.22)' : 'none',
        transform: active ? 'translateY(-1px)' : 'none',
        boxShadow: active ? '0 6px 20px rgba(0,0,0,0.18)' : 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {displayIcon && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>{displayIcon}</span>}
        <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.55)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {label}
        </span>
        {clickable && (
          <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.28)', marginLeft: 'auto', letterSpacing: 0.3 }}>
            {active ? `x ${t('clear')}` : t('filter')}
          </span>
        )}
      </div>
      <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.35 }}>
        {doCountUp ? <CountUp to={countTo} suffix="%" /> : value}
      </span>
      {sub && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: 500, marginTop: 1 }}>{sub}</span>}
    </div>
  );
}

function AmbientDots() {
  const dots = Array.from({ length: 28 }, (_, i) => ({
    x: (i * 137.5) % 100, y: (i * 97.3) % 100,
    r: 1 + (i % 3) * 0.5,
    delay: (i * 0.28) % 4, dur: 3 + (i % 5),
  }));
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}
      preserveAspectRatio="xMidYMid slice" viewBox="0 0 100 100">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="rgba(11,99,67,0.1)"
          style={{ animation: `dotFloat ${d.dur}s ${d.delay}s ease-in-out infinite alternate` }}
        />
      ))}
    </svg>
  );
}

// --- Dashboard ----------------------------------------------------------------
export default function Dashboard() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { watchlistCount, isSaved, toggle } = useWatchlist();
  const [search, setSearch]             = useState('');
  const [activeFilter, setActiveFilter] = useState(null);
  const [mounted, setMounted]           = useState(false);
  const [btnHover, setBtnHover]         = useState(false);
  const [predictions, setPredictions]   = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetchPredictions()
      .then(data => { setPredictions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const PREDICTIONS = predictions;
  const avgConf   = PREDICTIONS.length ? Math.round(PREDICTIONS.reduce((a, b) => a + b.confidence, 0) / PREDICTIONS.length) : 0;
  const topGainer = PREDICTIONS.length ? [...PREDICTIONS].sort((a, b) => b.change - a.change)[0] : { name: '—', change: 0, predicted: 0 };
  const topLoser  = PREDICTIONS.length ? [...PREDICTIONS].sort((a, b) => a.change - b.change)[0] : { name: '—', change: 0, predicted: 0 };

  const baseList = activeFilter === 'gainers'
    ? [...PREDICTIONS].sort((a, b) => b.change - a.change)
    : activeFilter === 'losers'
    ? [...PREDICTIONS].sort((a, b) => a.change - b.change)
    : PREDICTIONS;

  const filtered = baseList.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search)
  );

  return (
    <Layout headerCenter={<MarketStatus />}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .fade-in { opacity: 0; transform: translateY(14px); transition: opacity 0.55s ease, transform 0.55s ease; }
        .fade-in.ready { opacity: 1; transform: translateY(0); }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }
        @keyframes dotFloat { from { transform: translateY(0); opacity: 0.4; } to { transform: translateY(-8px); opacity: 1; } }
        .card-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
          position: relative;
          z-index: 1;
        }
        @media (max-width: 900px) { .card-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .card-grid { grid-template-columns: 1fr; } }

        body.dark-mode .dashboard-main { color: #cbd5e1; }
        body.dark-mode .dashboard-card {
          background: #1e293b !important;
          border-color: rgba(148,163,184,0.15) !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
        }
        body.dark-mode .dashboard-card:hover {
          box-shadow: 0 16px 48px rgba(0,0,0,0.4) !important;
        }
        body.dark-mode .dashboard-card-title { color: #f1f5f9 !important; }
        body.dark-mode .dashboard-card-price { color: #f8fafc !important; }
        body.dark-mode .dashboard-card-muted { color: #94a3b8 !important; }
        body.dark-mode .dashboard-card-footer { border-top-color: rgba(148,163,184,0.12) !important; }
        body.dark-mode .dashboard-title { color: #f1f5f9 !important; }
        body.dark-mode .dashboard-subtitle { color: #94a3b8 !important; }
        body.dark-mode .dashboard-empty { color: #94a3b8 !important; }
      `}</style>

      {/* Stats bar */}
      <div
        className={`fade-in${mounted ? ' ready' : ''}`}
        style={{
          background: 'linear-gradient(135deg, #0d7a52 0%, #0b6343 100%)',
          transitionDelay: '0.06s',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 36px', display: 'flex', gap: 12, overflowX: 'auto', alignItems: 'center' }}>
          <StatPill label={t('topGainer')} icon="↑" accent="#22c55e"
            value={topGainer.name}
            sub={`+${topGainer.change.toFixed(2)}% - SAR ${topGainer.predicted.toFixed(2)}`}
            active={activeFilter === 'gainers'}
            onClick={() => setActiveFilter(f => f === 'gainers' ? null : 'gainers')}
          />
          <StatPill label={t('topLoser')} icon="↓" accent="#ef4444"
            value={topLoser.name}
            sub={`${topLoser.change.toFixed(2)}% - SAR ${topLoser.predicted.toFixed(2)}`}
            active={activeFilter === 'losers'}
            onClick={() => setActiveFilter(f => f === 'losers' ? null : 'losers')}
          />
          <StatPill label={t('avgConfidence')} icon="AI" accent="#e89a1f"
            value={`${avgConf}%`}
            sub={t('acrossAllPredictions')}
            doCountUp={mounted} countTo={avgConf}
          />
          <StatPill label={t('marketHours')} icon="AST" accent="#a78bfa"
            value={t('marketHoursValue')}
            sub={t('marketHoursSub')}
          />
        </div>
        <TickerTape stocks={PREDICTIONS} />
      </div>

      {/* Main content area */}
      <div className="dashboard-main" style={{ padding: '36px 36px 52px', maxWidth: 1100, width: '100%', margin: '0 auto', position: 'relative' }}>
        <AmbientDots />

        {/* Section header */}
        <div className={`fade-in${mounted ? ' ready' : ''}`}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, transitionDelay: '0.13s', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <h2 className="dashboard-title" style={{ fontSize: 28, fontWeight: 800, color: '#0f1923', fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.6px' }}>
                {activeFilter === 'gainers' ? t('topGainers') : activeFilter === 'losers' ? t('topLosers') : t('mostPopular')}
              </h2>
              {activeFilter && (
                <button onClick={() => setActiveFilter(null)} style={{
                  background: activeFilter === 'gainers' ? 'rgba(11,99,67,0.1)' : 'rgba(197,48,48,0.1)',
                  color: activeFilter === 'gainers' ? '#0b6343' : '#c53030',
                  border: 'none', borderRadius: 20, padding: '4px 11px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {activeFilter === 'gainers' ? t('gainers') : t('losers')} x
                </button>
              )}
            </div>
            <p className="dashboard-subtitle" style={{ fontSize: 13, color: '#8a9aaa' }}>
              {activeFilter === 'gainers' ? t('sortedByGain')
                : activeFilter === 'losers' ? t('sortedByLoss')
                : t('topPicksByAI')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <WatchlistButton
              active={watchlistCount > 0}
              label={watchlistCount > 0 ? `${t('watchlist')} (${watchlistCount})` : t('watchlist')}
              onClick={() => navigate('/watchlist')}
            />
            <SearchInput value={search} onChange={setSearch} placeholder={t('searchStock')} minWidth={220} theme={isDark ? 'dark' : 'light'} />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '70px 0', color: '#a0aec0', position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Loading predictions...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="card-grid">
            {filtered.map((stock, i) => (
              <StockCard
                key={stock.id}
                stock={stock}
                delay={190 + i * 75}
                isDark={isDark}
                saved={isSaved(stock.id)}
                onToggle={toggle}
              />
            ))}
          </div>
        ) : (
          <div className="dashboard-empty" style={{ textAlign: 'center', padding: '70px 0', color: '#a0aec0', position: 'relative', zIndex: 1 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p style={{ fontSize: 15, fontWeight: 600 }}>{t('noResultsFor', { value: search })}</p>
          </div>
        )}

        {/* CTA */}
        <div className={`fade-in${mounted ? ' ready' : ''}`}
          style={{ display: 'flex', justifyContent: 'center', marginTop: 48, transitionDelay: '0.68s', position: 'relative', zIndex: 1 }}>
          <button
            onClick={() => navigate('/stocks')}
            onMouseEnter={() => setBtnHover(true)} onMouseLeave={() => setBtnHover(false)}
            style={{
              background: btnHover
                ? 'linear-gradient(135deg, #0b6343, #0d7a52)'
                : isDark
                  ? '#111827'
                  : '#fff',
              color: btnHover ? '#fff' : isDark ? '#10b981' : '#0b6343',
              border: `2px solid ${isDark ? '#10b981' : '#0b6343'}`, borderRadius: 50,
              padding: '14px 50px', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', transition: 'all 0.25s ease',
              boxShadow: btnHover ? '0 12px 36px rgba(11,99,67,0.32)' : '0 2px 14px rgba(11,99,67,0.1)',
              transform: btnHover ? 'translateY(-3px)' : 'none',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            {t('showAllStocks')}
          </button>
        </div>
      </div>
    </Layout>
  );
}
