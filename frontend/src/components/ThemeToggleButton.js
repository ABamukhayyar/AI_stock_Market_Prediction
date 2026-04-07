import React from 'react';

export default function ThemeToggleButton({
  isDark,
  onClick,
  lightLabel,
  darkLabel,
  compact = false,
  inverted = false,
}) {
  const label = isDark ? darkLabel : lightLabel;
  const borderColor = inverted ? 'rgba(255,255,255,0.18)' : 'var(--border)';
  const background = inverted ? 'rgba(255,255,255,0.08)' : 'var(--surface)';
  const textColor = inverted ? '#fff' : 'var(--text-soft)';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: compact ? '9px 12px' : '9px 14px',
        borderRadius: 999,
        border: `1px solid ${borderColor}`,
        background,
        color: textColor,
        cursor: 'pointer',
        fontSize: 12.5,
        fontWeight: 700,
        transition: 'transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease',
        backdropFilter: 'blur(12px)',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-1px)';
        event.currentTarget.style.backgroundColor = inverted ? 'rgba(255,255,255,0.14)' : 'var(--brand-soft)';
        event.currentTarget.style.borderColor = inverted ? 'rgba(255,255,255,0.28)' : 'var(--border-strong)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.backgroundColor = background;
        event.currentTarget.style.borderColor = borderColor;
      }}
    >
      <span
        style={{
          width: 34,
          height: 20,
          borderRadius: 999,
          position: 'relative',
          flexShrink: 0,
          background: isDark ? 'linear-gradient(135deg, #0f172a, #334155)' : 'linear-gradient(135deg, #dbeafe, #fef3c7)',
          border: `1px solid ${inverted ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.08)'}`,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 1,
            left: isDark ? 17 : 1,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            transition: 'left 0.18s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isDark ? (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
            </svg>
          )}
        </span>
      </span>
      {!compact && <span>{label}</span>}
    </button>
  );
}
