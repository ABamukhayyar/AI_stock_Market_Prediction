import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout, { MarketStatus, useTheme } from './components/Layout';
import { BackButton } from './components/buttons';
import { useLanguage } from './LanguageContext';
import useSmartBack from './hooks/useSmartBack';
import useWatchlist from './hooks/useWatchlist';
import { getStoredUser } from './utils/auth';

function formatMemberSince(value, lang) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function Avatar({ name, size = 80, isDark }) {
  const initials = (name || '?')
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%)',
        boxShadow: 'var(--shadow-strong)',
      }}
    >
      <span style={{ fontSize: size * 0.35, fontWeight: 800, color: '#fff', fontFamily: "'DM Serif Display', serif" }}>
        {initials}
      </span>
      <span
        style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'var(--brand)',
          border: `2px solid ${isDark ? '#08111f' : '#fff'}`,
        }}
      />
    </div>
  );
}

function StatCard({ label, value, icon, isDark, onClick, ctaLabel }) {
  const Container = onClick ? 'button' : 'div';

  return (
    <Container
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        background: 'var(--surface-strong)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '18px 20px',
        boxShadow: 'var(--shadow-soft)',
        textAlign: 'inherit',
        cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'transform 0.18s ease, border-color 0.18s ease' : undefined,
      }}
      onMouseEnter={(event) => {
        if (!onClick) return;
        event.currentTarget.style.transform = 'translateY(-2px)';
        event.currentTarget.style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={(event) => {
        if (!onClick) return;
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: 'var(--brand)', textTransform: 'uppercase' }}>
        {icon}
      </span>
      <div
        style={{
          marginTop: 10,
          fontSize: 26,
          fontWeight: 800,
          color: isDark ? '#e2e8f0' : '#111827',
          fontFamily: "'DM Serif Display', serif",
          letterSpacing: '-0.5px',
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </div>
      {ctaLabel ? (
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>
          {ctaLabel}
        </div>
      ) : null}
    </Container>
  );
}

function ReadOnlyField({ label, value, isDark }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 700,
          color: isDark ? '#64748b' : '#9ca3af',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 7,
        }}
      >
        {label}
      </label>
      <p
        style={{
          margin: 0,
          padding: '10px 0',
          fontSize: 15,
          fontWeight: 600,
          color: isDark ? '#e2e8f0' : '#111827',
          borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#f1f5f9'}`,
        }}
      >
        {value || '—'}
      </p>
    </div>
  );
}

export default function Profile() {
  const { isDark } = useTheme();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const goBack = useSmartBack('/dashboard');
  const { watchlistCount } = useWatchlist();
  const [mounted, setMounted] = useState(false);
  const currentUser = getStoredUser();

  // Real user object from /api/auth/login or /api/auth/signup populates these
  // fields. We never invent values -- if the field is missing we show "—".
  const fullName = currentUser?.fullName || currentUser?.name || '';
  const email = currentUser?.email || '';
  const memberSince = formatMemberSince(currentUser?.created_at, lang);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(id);
  }, []);

  return (
    <Layout headerCenter={<MarketStatus />}>
      <style>{`
        .profile-fade { opacity: 0; transform: translateY(16px); transition: opacity 0.5s ease, transform 0.5s ease; }
        .profile-fade.in { opacity: 1; transform: translateY(0); }
      `}</style>

      <div style={{ padding: '36px 24px 60px', maxWidth: 780, width: '100%', margin: '0 auto' }}>
        <BackButton onClick={goBack} variant="pill" label={t('back')} style={{ marginBottom: 20 }} />

        <div
          className={`profile-fade${mounted ? ' in' : ''}`}
          style={{
            background: 'linear-gradient(130deg, #0c6f4d 0%, #0b6343 42%, #145f47 100%)',
            borderRadius: 24,
            padding: '32px 32px 28px',
            marginBottom: 24,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-strong)',
          }}
        >
          <div style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(28px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
            <Avatar name={fullName} isDark={isDark} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 5px', fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {t('myProfile')}
              </p>
              <h1 style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 800, color: '#fff', fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                {fullName || '—'}
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{email || '—'}</p>
            </div>
            {memberSince ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {t('memberSince')}
                </span>
                <span style={{ fontSize: 14, color: '#fff', fontWeight: 700 }}>{memberSince}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={`profile-fade${mounted ? ' in' : ''}`}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24, transitionDelay: '0.1s' }}
        >
          <StatCard
            label={t('favoriteStocks')}
            value={watchlistCount}
            icon="WL"
            isDark={isDark}
            onClick={() => navigate('/watchlist')}
            ctaLabel={t('openWatchlist')}
          />
        </div>

        <div
          className={`profile-fade${mounted ? ' in' : ''}`}
          style={{
            background: 'var(--surface-strong)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '28px 32px',
            boxShadow: 'var(--shadow-soft)',
            transitionDelay: '0.14s',
          }}
        >
          <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.3px' }}>
            {t('personalInfo')}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0 28px' }}>
            <ReadOnlyField label={t('fullName')} value={fullName} isDark={isDark} />
            <ReadOnlyField label={t('email')} value={email} isDark={isDark} />
            {memberSince ? (
              <ReadOnlyField label={t('memberSince')} value={memberSince} isDark={isDark} />
            ) : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}
