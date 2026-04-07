import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logoImg from '../insight-logo.png';
import { TASI_ALL_STOCKS_BY_ID } from '../data/tasiAllStocks';
import { PrimaryButton } from '../components/buttons';
import { useTheme } from '../components/Layout';
import { useLanguage } from '../LanguageContext';
import { createDemoUser, setStoredUser } from '../utils/auth';
import ThemeToggleButton from '../components/ThemeToggleButton';

const TICKER_ALIAS = {
  '1120': 'ALRAJHI',
  '7010': 'STC',
  '2010': 'SABIC',
  '2082': 'ACWA POWER',
  '1211': 'MAADEN',
  '1180': 'SNB',
  '1150': 'ALINMA',
  '2222': 'ARAMCO',
};

const LOGIN_TICKER_IDS = ['1120', '7010', '2010', '2082', '1211', '1180', '1150', '2222'];

const TASI_TICKERS = LOGIN_TICKER_IDS.map((id, idx) => ({
  id,
  sym: TICKER_ALIAS[id] || TASI_ALL_STOCKS_BY_ID[id]?.name || id,
  val: idx % 3 === 0 ? '+0.82%' : idx % 2 === 0 ? '+0.31%' : '-0.27%',
  up: idx % 2 === 0,
}));

const FOOTER_LINKS = [
  { key: 'privacyPolicy', href: '/privacy' },
  { key: 'termsOfUse', href: '/terms' },
  { key: 'about', href: '/about' },
  { key: 'contactSupport', href: '/support' },
];


function StockLine({ style }) {
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
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {[150, 270, 330, 550, 670, 730].map((x, i) => (
          <circle key={i} cx={x} cy={i % 2 === 0 ? 30 : 15} r="2.5" fill="rgba(255,255,255,0.22)" />
        ))}
      </svg>
    </div>
  );
}

function FloatingInput({ id, type, label, value, onChange, isPassword, showPassword, onToggleShow, isDark, isRTL, showLabel, hideLabel }) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;

  return (
    <div style={{ position: 'relative', marginBottom: 18 }}>
      <label
        htmlFor={id}
        style={{
          position: 'absolute',
          ...(isRTL ? { right: 16 } : { left: 16 }),
          top: active ? 8 : '50%',
          transform: active ? 'none' : 'translateY(-50%)',
          fontSize: active ? 10 : 14,
          fontWeight: active ? 600 : 400,
          color: focused ? 'var(--brand)' : isDark ? '#94a3b8' : '#9ca3af',
          pointerEvents: 'none',
          transition: 'all 0.18s ease',
          letterSpacing: active ? 0.4 : 0,
          textTransform: active ? 'uppercase' : 'none',
        }}
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={id === 'email' ? 'email' : 'current-password'}
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          width: '100%',
          padding: active
            ? (isRTL ? '22px 16px 8px 48px' : '22px 48px 8px 16px')
            : (isRTL ? '14px 16px 14px 48px' : '14px 48px 14px 16px'),
          borderRadius: 12,
          border: `1.5px solid ${focused ? 'var(--brand)' : isDark ? 'rgba(148,163,184,0.2)' : '#e5e7eb'}`,
          outline: 'none',
          fontSize: 15,
          background: focused ? (isDark ? '#0c1729' : '#fff') : (isDark ? '#111827' : '#f9fafb'),
          transition: 'all 0.2s ease',
          boxShadow: focused ? (isDark ? '0 0 0 4px rgba(16,185,129,0.12)' : '0 0 0 4px rgba(11,99,67,0.08)') : 'none',
          color: isDark ? '#e2e8f0' : '#111',
          fontFamily: isPassword && !showPassword ? 'monospace' : 'inherit',
          letterSpacing: isPassword && !showPassword && value.length > 0 ? 4 : 'normal',
          textAlign: isRTL ? 'right' : 'left',
        }}
      />

      {isPassword && (
        <button
          type="button"
          onClick={onToggleShow}
          style={{
            position: 'absolute',
            ...(isRTL ? { left: 14 } : { right: 14 }),
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: isDark ? '#94a3b8' : '#9ca3af',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 6px',
            letterSpacing: 0.3,
          }}
        >
          {showPassword ? (hideLabel || 'HIDE') : (showLabel || 'SHOW')}
        </button>
      )}
    </div>
  );
}

function Checkbox({ checked, onChange, label, isDark }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 7 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          flexShrink: 0,
          border: `1.5px solid ${checked ? 'var(--brand)' : isDark ? 'rgba(148,163,184,0.3)' : '#d1d5db'}`,
          background: checked ? 'var(--brand)' : isDark ? '#0f172a' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6b7280' }}>{label}</span>
    </label>
  );
}


function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 18,
        height: 18,
        border: '2.5px solid rgba(255,255,255,0.3)',
        borderTop: '2.5px solid #fff',
        borderRadius: '50%',
        animation: 'spin 0.65s linear infinite',
      }}
    />
  );
}

function HoverLink({ href = '#', style, hoverStyle, onClick, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...style, ...(hovered ? hoverStyle : {}) }}
    >
      {children}
    </a>
  );
}

export default function LoginPage() {
  const { isDark, toggleDarkMode } = useTheme();
  const { t, lang, toggleLang } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tickers, setTickers] = useState(TASI_TICKERS);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/dashboard';

  useEffect(() => {
    const timeout = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setTickers((prev) =>
        prev.map((item) => {
          if (Math.random() >= 0.4) return item;
          const abs = (Math.random() * 3.99 + 0.01).toFixed(2);
          const up = Math.random() > 0.4;
          return { ...item, val: `${up ? '+' : '-'}${abs}%`, up };
        })
      );
    }, 2000);
    return () => clearInterval(id);
  }, []);


  const isRTL = lang === 'ar';
  const isReady = email.trim().length > 0 && password.length > 0;
  const fu = (...cls) => ['fade-up', ...cls, mounted && 'visible'].filter(Boolean).join(' ');

  const handleLogin = useCallback(
    (event) => {
      event.preventDefault();
      if (!isReady || loading) return;
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setSuccess(true);
        setStoredUser(
          createDemoUser({
            email: email.trim() || 'ahmed@example.com',
          })
        );
        setTimeout(() => navigate(redirectTo), 600);
      }, 1800);
    },
    [email, isReady, loading, navigate, redirectTo]
  );

  const handleCreateAccount = useCallback(() => navigate('/signup'), [navigate]);
  const handleForgotPassword = useCallback(
    (event) => {
      event.preventDefault();
      navigate('/forgot-password');
    },
    [navigate]
  );
  const handleFooterLink = useCallback((event, href) => {
    event.preventDefault();
    navigate(href);
  }, [navigate]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }

        .fade-up { opacity: 0; transform: translateY(18px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .fade-up.visible { opacity: 1; transform: translateY(0); }
        .delay-1 { transition-delay: 0.05s; }
        .delay-2 { transition-delay: 0.15s; }
        .delay-3 { transition-delay: 0.25s; }
        .delay-4 { transition-delay: 0.35s; }
        .delay-5 { transition-delay: 0.45s; }

        .ticker-track { display: flex; animation: ticker-scroll 28s linear infinite; width: max-content; }
        .create-btn:hover { background: rgba(255,255,255,0.12) !important; border-color: rgba(255,255,255,0.8) !important; }
        .utility-btn:hover { background: rgba(255,255,255,0.12) !important; border-color: rgba(255,255,255,0.8) !important; }

        @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes stockScroll   { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes spin          { to   { transform: rotate(360deg); } }
        @keyframes logoFloat {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(-5px); }
        }
        @keyframes successPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.02); box-shadow: 0 6px 32px rgba(11,99,67,0.5); }
          100% { transform: scale(1); }
        }
        .logo-ring { animation: logoFloat 4s ease-in-out infinite; }
      `}</style>

      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: isDark
            ? 'linear-gradient(145deg, #07111f 0%, #0c1729 55%, #111f36 100%)'
            : 'linear-gradient(145deg, #f0faf6 0%, #eaf4ee 55%, #f5f9ff 100%)',
        }}
      >
        <header
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #020617 0%, #0b2539 58%, #083b34 100%)'
              : 'linear-gradient(135deg, #0b6343 0%, #094f36 60%, #073d28 100%)',
            color: '#fff',
            padding: '22px 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <StockLine style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.5px', margin: 0 }}>
              {t('appName')}
            </h1>
            <p style={{ fontSize: 12, marginTop: 3, opacity: 0.75, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {t('appTagline')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              className="utility-btn"
              onClick={toggleLang}
              style={{
                background: 'transparent',
                border: '1.5px solid rgba(255,255,255,0.45)',
                color: '#fff',
                padding: '9px 16px',
                borderRadius: 100,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {lang === 'en' ? t('switchToArabic') : t('switchToEnglish')}
            </button>
            <ThemeToggleButton
              isDark={isDark}
              onClick={toggleDarkMode}
              lightLabel={t('themeLight')}
              darkLabel={t('themeDark')}
              compact
              inverted
            />
            <button
              className="create-btn"
              onClick={handleCreateAccount}
              style={{
                background: 'transparent',
                border: '1.5px solid rgba(255,255,255,0.45)',
                color: '#fff',
                padding: '9px 22px',
                borderRadius: 100,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {t('createAccountCta')}
            </button>
          </div>
        </header>

        <main
          style={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 24px 40px',
          }}
        >
          <div
            className={fu('delay-1')}
            style={{
              background: isDark ? 'rgba(15, 27, 48, 0.94)' : '#fff',
              borderRadius: 24,
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.06)'}`,
              boxShadow: isDark
                ? '0 24px 56px rgba(2,6,23,0.48)'
                : '0 8px 48px rgba(11,99,67,0.10), 0 2px 12px rgba(0,0,0,0.06)',
              width: '100%',
              maxWidth: 440,
              padding: '56px 48px 40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              position: 'relative',
            }}
          >
            <div
              className="logo-ring"
              style={{
                position: 'absolute',
                top: -52,
                left: '50%',
                width: 96,
                height: 96,
                borderRadius: '50%',
                background: isDark ? '#0f1b30' : '#fff',
                boxShadow: isDark
                  ? '0 4px 24px rgba(2,6,23,0.4), 0 0 0 4px #0f1b30'
                  : '0 4px 24px rgba(11,99,67,0.18), 0 0 0 4px #fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <img src={logoImg} alt="Insight Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
              <h2
                className={fu('delay-2')}
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: 26,
                  color: isDark ? '#f8fafc' : '#1a202c',
                  textAlign: 'center',
                  marginBottom: 28,
                  marginTop: 8,
                }}
              >
                {t('welcomeBack')}
              </h2>

              <form onSubmit={handleLogin} noValidate style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className={fu('delay-2')}>
                  <FloatingInput id="email" type="email" label={t('emailAddress')} value={email} onChange={(e) => setEmail(e.target.value)} isDark={isDark} isRTL={isRTL} />
                </div>

                <div className={fu('delay-3')}>
                  <FloatingInput
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    label={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    isPassword
                    showPassword={showPassword}
                    onToggleShow={() => setShowPassword((prev) => !prev)}
                    isDark={isDark}
                    isRTL={isRTL}
                    showLabel={t('showPassword')}
                    hideLabel={t('hidePassword')}
                  />
                </div>

                <div
                  className={fu('delay-3')}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}
                >
                  <Checkbox checked={remember} onChange={setRemember} label={t('rememberMe')} isDark={isDark} />
                  <HoverLink
                    onClick={handleForgotPassword}
                    style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6b7280', textDecoration: 'underline', transition: 'color 0.15s' }}
                    hoverStyle={{ color: 'var(--brand)' }}
                  >
                    {t('forgotPassword')}
                  </HoverLink>
                </div>

                <div className={fu('delay-4')} style={{ marginTop: 'auto' }}>
                  <PrimaryButton
                    type="submit"
                    disabled={!isReady || loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      minHeight: 48,
                      animation: success ? 'successPop 0.5s ease' : 'none',
                      boxShadow: isReady ? '0 4px 20px rgba(11,99,67,0.35)' : 'none',
                    }}
                  >
                    {success ? (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {t('signingIn')}
                      </>
                    ) : loading ? (
                      <Spinner />
                    ) : (
                      t('logIn')
                    )}
                  </PrimaryButton>
                </div>

                <p className={fu('delay-4')} style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: isDark ? '#94a3b8' : '#6b7280' }}>
                  {t('dontHaveAccount')}{' '}
                  <HoverLink
                    onClick={(e) => { e.preventDefault(); handleCreateAccount(); }}
                    style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none', transition: 'color 0.15s' }}
                    hoverStyle={{ textDecoration: 'underline' }}
                  >
                    {t('createAccountCta')}
                  </HoverLink>
                </p>
              </form>


              <div
                className={fu('delay-5')}
                style={{ marginTop: 20, overflow: 'hidden', borderRadius: 8, background: isDark ? 'rgba(15,23,42,0.75)' : '#f0f7f4', padding: '7px 0', direction: 'ltr' }}
              >
                <div className="ticker-track">
                  {[...tickers, ...tickers].map((ticker, idx) => (
                    <span
                      key={`${ticker.id}-${idx}`}
                      style={{
                        fontSize: 10.5,
                        padding: '0 14px',
                        fontWeight: 600,
                        color: ticker.up ? '#0b6343' : '#c53030',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ticker.sym}{' '}
                      <span style={{ fontWeight: 400, opacity: 0.75 }}>{ticker.val}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </main>

        <footer
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #020617 0%, #0b2539 58%, #083b34 100%)'
              : 'linear-gradient(135deg, #0b6343 0%, #094f36 100%)',
            color: 'rgba(255,255,255,0.75)',
            padding: '28px 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11.5,
            gap: 16,
            flexWrap: 'wrap',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <StockLine style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, height: '100%', opacity: 0.72 }} />

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative', zIndex: 1 }}>
            {FOOTER_LINKS.map((item) => (
              <HoverLink
                key={item.key}
                onClick={(event) => handleFooterLink(event, item.href)}
                style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', transition: 'color 0.15s' }}
                hoverStyle={{ color: '#fff' }}
              >
                {t(item.key)}
              </HoverLink>
            ))}
          </nav>

          <p style={{ maxWidth: 380, textAlign: 'center', lineHeight: 1.6, opacity: 0.7, position: 'relative', zIndex: 1 }}>
            {t('disclaimer')}
          </p>

          <p style={{ opacity: 0.6, position: 'relative', zIndex: 1 }}>
            {t('copyright')}
          </p>
        </footer>
      </div>
    </>
  );
}
