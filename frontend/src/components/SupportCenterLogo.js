import React from 'react';

const CONFIG = {
  help: {
    accent: '#2dd4bf',
    accentStrong: '#0f766e',
    glow: 'rgba(45,212,191,0.24)',
    panel: 'rgba(15,118,110,0.18)',
  },
  support: {
    accent: '#38bdf8',
    accentStrong: '#0369a1',
    glow: 'rgba(56,189,248,0.22)',
    panel: 'rgba(8,145,178,0.18)',
  },
  terms: {
    accent: '#a78bfa',
    accentStrong: '#5b21b6',
    glow: 'rgba(167,139,250,0.22)',
    panel: 'rgba(91,33,182,0.16)',
  },
  about: {
    accent: '#34d399',
    accentStrong: '#065f46',
    glow: 'rgba(52,211,153,0.22)',
    panel: 'rgba(6,95,70,0.16)',
  },
};

function HelpIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a8 8 0 0 1 16 0" />
      <path d="M4 11v3a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H4z" />
      <path d="M20 11v3a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3z" />
      <path d="M18 16v1a3 3 0 0 1-3 3h-1" />
      <circle cx="12" cy="20" r="1" />
    </svg>
  );
}

function AboutIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function TermsIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export default function SupportCenterLogo({ variant = 'help', title, subtitle, points = [], eyebrowLabel }) {
  const palette = CONFIG[variant] || CONFIG.help;
  const Icon = variant === 'about' ? AboutIcon : variant === 'terms' ? TermsIcon : variant === 'support' ? SupportIcon : HelpIcon;

  return (
    <div
      style={{
        position: 'relative',
        minHeight: 280,
        borderRadius: 28,
        padding: '24px 22px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 100%)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        overflow: 'hidden',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -24,
          right: -18,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: palette.glow,
          filter: 'blur(26px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -48,
          left: -36,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          filter: 'blur(24px)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
          <div
            style={{
              width: 82,
              height: 82,
              borderRadius: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${palette.accentStrong}, ${palette.accent})`,
              boxShadow: `0 20px 40px ${palette.glow}`,
              flexShrink: 0,
            }}
          >
            <Icon />
          </div>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              {eyebrowLabel || 'Insight'}
            </p>
            <h3 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.5px' }}>
              {title}
            </h3>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: 'rgba(255,255,255,0.74)' }}>
              {subtitle}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {points.map((point) => (
            <div
              key={point}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 18,
                background: palette.panel,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: palette.accent,
                  boxShadow: `0 0 0 6px ${palette.glow}`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{point}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
