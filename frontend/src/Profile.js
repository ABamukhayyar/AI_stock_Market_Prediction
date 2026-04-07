import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout, { MarketStatus, useTheme } from './components/Layout';
import { BackButton } from './components/buttons';
import { useLanguage } from './LanguageContext';
import useSmartBack from './hooks/useSmartBack';
import useWatchlist from './hooks/useWatchlist';
import { getStoredUser, setStoredUser } from './utils/auth';

const MOCK_USER = {
  fullName: 'Nasser Alsultan',
  email: 'Nasser@example.com',
  phone: '+966 50 123 4567',
  memberSince: 'January 2026',
  stats: { watchlist: 18, lastLogin: 'Today, 9:42 AM' },
};

function Avatar({ name, size = 80, isDark }) {
  const initials = name
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

function Field({ label, value, editing, onChange, type = 'text', isDark }) {
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
      {editing ? (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 500,
            border: '1.5px solid var(--brand)',
            outline: 'none',
            background: isDark ? '#0c1729' : '#fff',
            color: isDark ? '#e2e8f0' : '#111827',
            boxShadow: isDark ? '0 0 0 4px rgba(16,185,129,0.12)' : '0 0 0 4px rgba(11,99,67,0.08)',
          }}
        />
      ) : (
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
          {value}
        </p>
      )}
    </div>
  );
}

export default function Profile() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const goBack = useSmartBack('/dashboard');
  const { watchlistCount } = useWatchlist();
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const currentUser = getStoredUser();
  const [form, setForm] = useState({
    fullName: currentUser?.fullName || MOCK_USER.fullName,
    email: currentUser?.email || MOCK_USER.email,
    phone: MOCK_USER.phone,
  });

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(id);
  }, []);

  const handleSave = () => {
    setStoredUser({
      ...(currentUser || {}),
      fullName: form.fullName,
      email: form.email,
    });
    setEditing(false);
  };

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
            <Avatar name={form.fullName} isDark={isDark} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 5px', fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {t('myProfile')}
              </p>
              <h1 style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 800, color: '#fff', fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                {form.fullName}
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{form.email}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {t('memberSince')}
              </span>
              <span style={{ fontSize: 14, color: '#fff', fontWeight: 700 }}>{MOCK_USER.memberSince}</span>
            </div>
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
          <StatCard label={t('lastLogin')} value={MOCK_USER.stats.lastLogin} icon="IN" isDark={isDark} />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 14, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.3px' }}>
              {t('personalInfo')}
            </h2>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                style={{
                  background: 'var(--brand-soft)',
                  color: 'var(--brand)',
                  border: '1.5px solid var(--border-strong)',
                  borderRadius: 50,
                  padding: '7px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('editProfile')}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setEditing(false)}
                  style={{
                    background: 'transparent',
                    color: isDark ? '#94a3b8' : '#6b7280',
                    border: `1px solid ${isDark ? 'rgba(148,163,184,0.3)' : '#e5e7eb'}`,
                    borderRadius: 50,
                    padding: '7px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleSave}
                  style={{
                    background: 'linear-gradient(135deg, var(--brand), var(--brand-strong))',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 50,
                    padding: '7px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-strong)',
                  }}
                >
                  {t('saveChanges')}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0 28px' }}>
            <Field label={t('fullName')} value={form.fullName} editing={editing} onChange={(value) => setForm((prev) => ({ ...prev, fullName: value }))} isDark={isDark} />
            <Field label={t('email')} value={form.email} editing={false} type="email" isDark={isDark} />
            <Field label={t('phone')} value={form.phone} editing={editing} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} isDark={isDark} />
            <Field label={t('memberSince')} value={MOCK_USER.memberSince} editing={false} isDark={isDark} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
