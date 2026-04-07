import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import ScrollToTop from 'react-scroll-to-top';
import { useLocalStorage, useMediaQuery } from 'usehooks-ts';
import logoImg from '../insight-logo.png';
import { useLanguage } from '../LanguageContext';
import ThemeToggleButton from './ThemeToggleButton';
import { clearStoredUser, isAuthenticated } from '../utils/auth';
import { buildUtilityRouteState } from '../utils/navigation';

const AST_OFFSET_MS = 3 * 60 * 60 * 1000;
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_STORAGE_KEY = 'themePreference';
const ThemeContext = createContext({ isDark: false, toggleDarkMode: () => {} });

function applyTheme(enabled) {
  if (typeof document === 'undefined') return;

  document.body.classList.toggle('dark-mode', enabled);
  document.body.classList.toggle('light-mode', !enabled);
  document.documentElement.dataset.theme = enabled ? 'dark' : 'light';
  document.documentElement.style.colorScheme = enabled ? 'dark' : 'light';
}

function getAstDate(date = new Date()) {
  return new Date(date.getTime() + AST_OFFSET_MS);
}

function isMarketOpen(date = new Date()) {
  const astTime = getAstDate(date);
  const astDay = astTime.getUTCDay();
  const astMinutes = astTime.getUTCHours() * 60 + astTime.getUTCMinutes();
  return astDay >= 0 && astDay <= 4 && astMinutes >= 10 * 60 && astMinutes < 15 * 60;
}

function useAstClock() {
  const [astDate, setAstDate] = useState(() => getAstDate());

  useEffect(() => {
    const id = window.setInterval(() => setAstDate(getAstDate()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return astDate;
}

function HeaderBackdrop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 140"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.9 }}
    >
      <defs>
        <linearGradient id="header-line-primary" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="35%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="65%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path
        d="M0,104 C120,92 180,60 300,54 C430,48 506,86 632,78 C760,70 810,26 930,24 C1050,22 1110,50 1200,44"
        fill="none"
        stroke="url(#header-line-primary)"
        strokeWidth="2"
      />
      <path
        d="M0,118 C120,110 202,88 334,84 C462,80 544,114 656,104 C782,94 840,64 970,62 C1082,60 1144,80 1200,74"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1.5"
      />
      {[
        [180, 62],
        [470, 82],
        [710, 58],
        [940, 42],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.5" fill="rgba(255,255,255,0.18)" />
      ))}
    </svg>
  );
}

function MovingStockLine({ style }) {
  return (
    <div style={{ ...style, overflow: 'hidden', pointerEvents: 'none', direction: 'ltr' }}>
      <svg
        style={{ width: '200%', height: '100%', animation: 'stockScroll 18s linear infinite' }}
        viewBox="0 0 800 80"
        preserveAspectRatio="none"
        fill="none"
      >
        <polyline
          points="0,60 30,55 60,58 90,45 120,50 150,30 180,35 210,20 240,28 270,15 300,22 330,10 360,18 400,5 430,55 460,58 490,45 520,50 550,30 580,35 610,20 640,28 670,15 700,22 730,10 760,18 800,5"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="0,70 40,65 80,68 110,58 150,62 190,50 220,55 260,40 300,45 340,35 400,30 440,65 480,68 510,58 550,62 590,50 620,55 660,40 700,45 740,35 800,30"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function MenuItem({ label, icon, onClick, danger = false, isRTL = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        color: danger ? 'var(--danger)' : 'var(--text-soft)',
        cursor: 'pointer',
        direction: isRTL ? 'rtl' : 'ltr',
        textAlign: isRTL ? 'right' : 'left',
        transition: 'background-color 0.18s ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.backgroundColor = 'var(--brand-soft)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {icon}
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function hasBrowserHistory() {
  if (typeof window === 'undefined') return false;
  return Number(window.history.state?.idx) > 0;
}

function AccountMenu({ onClose, position, anchorRef }) {
  const { t, isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const utilityRouteState = buildUtilityRouteState(location);

  const navigateToMainRoute = useCallback(
    (path) => {
      if (
        location.pathname !== path &&
        utilityRouteState.mainRoute === path &&
        hasBrowserHistory()
      ) {
        navigate(-1);
        onClose();
        return;
      }

      navigate(path, { state: utilityRouteState });
      onClose();
    },
    [location.pathname, navigate, onClose, utilityRouteState]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      if (anchorRef.current?.contains(event.target)) return;
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        overflow: 'hidden',
        borderRadius: 18,
        background: 'var(--surface-strong)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-soft)',
        zIndex: 99999,
        backdropFilter: 'blur(18px)',
        direction: isRTL ? 'rtl' : 'ltr',
        textAlign: isRTL ? 'right' : 'left',
        transformOrigin: isRTL ? 'top right' : 'top left',
      }}
    >
      <MenuItem
        label={t('profile')}
        onClick={() => navigateToMainRoute('/profile')}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        }
        isRTL={isRTL}
      />
      <MenuItem
        label={t('watchlist')}
        onClick={() => navigateToMainRoute('/watchlist')}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m12 17.3-6.2 3.7 1.7-7.1L2 9.2l7.2-.6L12 2l2.8 6.6 7.2.6-5.5 4.7 1.7 7.1z" />
          </svg>
        }
        isRTL={isRTL}
      />
      <MenuItem
        label={t('settings')}
        onClick={() => {
          navigate('/settings', { state: utilityRouteState });
          onClose();
        }}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.54V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.7 1.7 0 0 0 .33-1.82 1.7 1.7 0 0 0-1.54-1H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.54-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.7 1.7 0 0 0 1.82.33h.01a1.7 1.7 0 0 0 1-1.54V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.7 1.7 0 0 0-.33 1.82v.01a1.7 1.7 0 0 0 1.54 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.54 1Z" />
          </svg>
        }
        isRTL={isRTL}
      />
      <MenuItem
        label={t('help')}
        onClick={() => {
          navigate('/help', { state: utilityRouteState });
          onClose();
        }}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        }
        isRTL={isRTL}
      />
      <MenuItem
        label={t('contactSupport')}
        onClick={() => {
          navigate('/support', { state: utilityRouteState });
          onClose();
        }}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11a8 8 0 0 1 16 0" />
            <path d="M4 11v3a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H4z" />
            <path d="M20 11v3a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3z" />
            <path d="M18 16v1a3 3 0 0 1-3 3h-1" />
            <circle cx="12" cy="20" r="1" />
          </svg>
        }
        isRTL={isRTL}
      />
      <MenuItem
        label={t('aboutTitle')}
        onClick={() => {
          navigate('/about', { state: utilityRouteState });
          onClose();
        }}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        }
        isRTL={isRTL}
      />
      <div style={{ padding: 4 }}>
        <MenuItem
          label={t('signOut')}
          danger
          onClick={() => {
            clearStoredUser();
            navigate('/');
            onClose();
          }}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          }
          isRTL={isRTL}
        />
      </div>
    </div>,
    document.body
  );
}

function UtilityPill({ label, icon, onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: compact ? '10px 12px' : '10px 14px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.16)',
        background: 'rgba(255,255,255,0.08)',
        color: '#fff',
        cursor: 'pointer',
        transition: 'transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease',
        backdropFilter: 'blur(12px)',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-1px)';
        event.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.14)';
        event.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
        event.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)';
      }}
    >
      {icon}
      {!compact && <span style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</span>}
    </button>
  );
}

function AccountButton() {
  const { t, isRTL } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({
    top: 76,
    left: 12,
    width: 250,
  });
  const buttonRef = useRef(null);

  const calculateMenuPosition = useCallback(() => {
    if (!buttonRef.current) {
      return {
        top: 76,
        left: 12,
        width: 250,
      };
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const menuWidth = Math.min(250, Math.max(180, window.innerWidth - viewportPadding * 2));
    const nextLeft = isRTL
      ? Math.max(
          viewportPadding,
          Math.min(rect.left, window.innerWidth - menuWidth - viewportPadding)
        )
      : Math.min(
          window.innerWidth - menuWidth - viewportPadding,
          Math.max(viewportPadding, rect.right - menuWidth)
        );

    return {
      top: rect.bottom + 10,
      left: nextLeft,
      width: menuWidth,
    };
  }, [isRTL]);

  useEffect(() => {
    setMenuOpen(false);
  }, [isRTL]);

  useEffect(() => {
    if (!menuOpen || !buttonRef.current) return;

    const updatePosition = () => setMenuPos(calculateMenuPosition());
    const closeMenu = () => setMenuOpen(false);

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [calculateMenuPosition, menuOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t('openMenu')}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => {
          if (!menuOpen) {
            setMenuPos(calculateMenuPosition());
          }

          setMenuOpen((value) => !value);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 14px 9px 10px',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(255,255,255,0.08)',
          color: '#fff',
          cursor: 'pointer',
          direction: isRTL ? 'rtl' : 'ltr',
          transition: 'transform 0.18s ease, background-color 0.18s ease',
          backdropFilter: 'blur(12px)',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.transform = 'translateY(-1px)';
          event.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.14)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.transform = 'translateY(0)';
          event.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.18)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t('account')}</span>
      </button>
      {menuOpen && <AccountMenu onClose={() => setMenuOpen(false)} position={menuPos} anchorRef={buttonRef} />}
    </>
  );
}

function FooterLink({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'rgba(255,255,255,0.72)',
        cursor: 'pointer',
        padding: 0,
        fontSize: 12,
        fontWeight: 600,
        transition: 'color 0.18s ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.color = '#ffffff';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.color = 'rgba(255,255,255,0.72)';
      }}
    >
      {label}
    </button>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  const prefersDarkMode = useMediaQuery(SYSTEM_DARK_QUERY, {
    defaultValue: false,
    initializeWithValue: true,
  });
  const [storedTheme, setStoredTheme] = useLocalStorage(THEME_STORAGE_KEY, null);
  const isDarkMode = storedTheme ?? prefersDarkMode;

  const toggleDarkMode = useCallback(() => {
    setStoredTheme((value) => !(value ?? prefersDarkMode));
  }, [prefersDarkMode, setStoredTheme]);

  useEffect(() => {
    applyTheme(isDarkMode);
  }, [isDarkMode]);

  const value = useMemo(
    () => ({
      isDark: isDarkMode,
      toggleDarkMode,
    }),
    [isDarkMode, toggleDarkMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function MarketStatus() {
  const { t } = useLanguage();
  const astDate = useAstClock();
  const marketOpenNow = isMarketOpen(astDate);
  const h = astDate.getUTCHours().toString().padStart(2, '0');
  const m = astDate.getUTCMinutes().toString().padStart(2, '0');
  const s = astDate.getUTCSeconds().toString().padStart(2, '0');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: marketOpenNow ? '#4ade80' : '#f87171',
            boxShadow: marketOpenNow
              ? '0 0 0 5px rgba(74,222,128,0.16)'
              : '0 0 0 5px rgba(248,113,113,0.16)',
          }}
        />
        <span style={{ color: '#ffffff', fontSize: 13.5, fontWeight: 800 }}>
          {marketOpenNow ? t('marketOpen') : t('marketClosed')}
        </span>
      </div>
      <span
        style={{
          color: 'rgba(255,255,255,0.55)',
          fontSize: 11,
          letterSpacing: 1.6,
          fontFamily: "'Courier New', monospace",
        }}
      >
        {h}:{m}:{s}
      </span>
    </div>
  );
}

export default function Layout({ children, headerCenter = null, hideAccount = false }) {
  const { isDark, toggleDarkMode } = useTheme();
  const { t, lang, toggleLang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const utilityRouteState = buildUtilityRouteState(location);

  return (
    <>
      <style>{`
        @keyframes layoutGlow {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -10px, 0) scale(1.05); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes stockScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .layout-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(circle at 12% 12%, rgba(16, 185, 129, 0.12), transparent 24%),
            radial-gradient(circle at 82% 0%, rgba(14, 165, 233, 0.08), transparent 22%),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0)),
            linear-gradient(180deg, var(--bg-canvas) 0%, var(--bg-canvas-alt) 100%);
        }
        .layout-header {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 18px;
          min-height: 88px;
          padding: 18px 28px;
          background:
            linear-gradient(120deg, rgba(4, 23, 18, 0.94) 0%, rgba(8, 71, 49, 0.96) 48%, rgba(7, 40, 72, 0.92) 100%);
          color: #ffffff;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 16px 40px rgba(3, 7, 18, 0.18);
        }
        html[data-theme='dark'] .layout-header {
          background:
            linear-gradient(120deg, rgba(2, 6, 23, 0.98) 0%, rgba(8, 47, 73, 0.94) 52%, rgba(5, 46, 44, 0.96) 100%);
        }
        .layout-brand {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          position: relative;
          z-index: 1;
        }
        .layout-brand-mark {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          overflow: hidden;
          background: rgba(255,255,255,0.92);
          box-shadow: 0 12px 28px rgba(0,0,0,0.18);
          flex-shrink: 0;
        }
        .layout-header-center {
          position: relative;
          z-index: 1;
          justify-self: center;
        }
        .layout-header-actions {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          justify-self: end;
        }
        .layout-main {
          flex: 1;
          width: 100%;
        }
        .layout-footer {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 20px;
          align-items: center;
          padding: 24px 28px;
          color: rgba(255,255,255,0.72);
          background:
            linear-gradient(125deg, rgba(6, 26, 20, 0.94) 0%, rgba(8, 52, 38, 0.96) 44%, rgba(4, 27, 42, 0.92) 100%);
        }
        html[data-theme='dark'] .layout-footer {
          background:
            linear-gradient(125deg, rgba(2, 6, 23, 0.98) 0%, rgba(7, 25, 46, 0.96) 54%, rgba(5, 46, 44, 0.96) 100%);
        }
        .layout-footer::before {
          content: '';
          position: absolute;
          inset: auto -10% -65px auto;
          width: 240px;
          height: 240px;
          border-radius: 50%;
          background: rgba(16,185,129,0.09);
          filter: blur(20px);
          animation: layoutGlow 8s ease-in-out infinite;
        }
        .layout-footer-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
        }
        @media (max-width: 980px) {
          .layout-header {
            grid-template-columns: 1fr;
            justify-items: start;
          }
          .layout-header-center {
            justify-self: start;
          }
          .layout-header-actions {
            justify-self: start;
            flex-wrap: wrap;
          }
          .layout-footer {
            grid-template-columns: 1fr;
            text-align: start;
          }
        }
        @media (max-width: 640px) {
          .layout-header {
            padding: 18px 18px 20px;
          }
          .layout-footer {
            padding: 22px 18px;
          }
        }
      `}</style>

      <div className="layout-shell">
        <header className="layout-header">
          <HeaderBackdrop />
          <MovingStockLine style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, height: '100%', opacity: 0.95 }} />

          <div className="layout-brand">
            <div className="layout-brand-mark">
              <img src={logoImg} alt={t('appName')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: '-0.5px',
                  fontFamily: "'DM Serif Display', serif",
                }}
              >
                {t('appName')}
              </h1>
              <p style={{ margin: '5px 0 0', fontSize: 11, opacity: 0.64, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                {t('appTagline')}
              </p>
            </div>
          </div>

          {headerCenter ? <div className="layout-header-center">{headerCenter}</div> : <div />}

          <div className="layout-header-actions">
            <UtilityPill
              label={lang === 'en' ? t('switchToArabic') : t('switchToEnglish')}
              onClick={toggleLang}
              icon={
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>
                  {lang === 'en' ? 'AR' : 'EN'}
                </span>
              }
            />
            <ThemeToggleButton
              isDark={isDark}
              onClick={toggleDarkMode}
              lightLabel={t('themeLight')}
              darkLabel={t('themeDark')}
              compact
              inverted
            />
            {!hideAccount && isAuthenticated() && <AccountButton />}
          </div>
        </header>

        <main className="layout-main">{children}</main>

        <footer className="layout-footer">
          <MovingStockLine style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, height: '100%', opacity: 0.7 }} />
          <nav className="layout-footer-nav">
            <FooterLink label={t('privacyPolicy')} onClick={() => navigate('/privacy', { state: utilityRouteState })} />
            <FooterLink label={t('termsOfUse')} onClick={() => navigate('/terms', { state: utilityRouteState })} />
            <FooterLink label={t('about')} onClick={() => navigate('/about', { state: utilityRouteState })} />
            <FooterLink label={t('contactSupport')} onClick={() => navigate('/support', { state: utilityRouteState })} />
          </nav>

          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.8, textAlign: 'center', maxWidth: 520 }}>
            {t('disclaimer')}
          </p>

          <p
            style={{
              margin: 0,
              fontSize: 11,
              opacity: 0.7,
              direction: lang === 'ar' ? 'rtl' : 'ltr',
              unicodeBidi: 'isolate',
            }}
          >
            {t('copyright')}
          </p>
        </footer>

        <ScrollToTop
          smooth
          top={320}
          component={
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
            </span>
          }
          style={{
            background: 'linear-gradient(145deg, var(--brand) 0%, var(--brand-strong) 100%)',
            borderRadius: '50%',
            boxShadow: 'var(--shadow-strong)',
            right: 22,
            bottom: 22,
            width: 48,
            height: 48,
            zIndex: 9999,
          }}
        />
      </div>
    </>
  );
}
