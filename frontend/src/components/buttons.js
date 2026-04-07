import React, { useState } from 'react';
import { useTheme } from './Layout';
import { useLanguage } from '../LanguageContext';

const PRIMARY_ENABLED_STYLE = {
  background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%)',
  color: '#fff',
  cursor: 'pointer',
  boxShadow: 'var(--shadow-strong)',
};

const PRIMARY_DISABLED_STYLE = {
  background: '#e5e7eb',
  color: '#94a3b8',
  cursor: 'not-allowed',
  boxShadow: 'none',
};

const PRIMARY_DISABLED_DARK_STYLE = {
  background: '#162338',
  color: '#64748b',
  cursor: 'not-allowed',
  boxShadow: 'none',
};

export function PrimaryButton({
  type = 'button',
  disabled = false,
  style,
  children,
  ...props
}) {
  const { isDark } = useTheme();
  const disabledStyle = disabled
    ? (isDark ? PRIMARY_DISABLED_DARK_STYLE : PRIMARY_DISABLED_STYLE)
    : PRIMARY_ENABLED_STYLE;

  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        width: '100%',
        padding: 14,
        border: 'none',
        borderRadius: 100,
        fontSize: 15,
        fontWeight: 700,
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
        ...disabledStyle,
        ...style,
      }}
      onMouseEnter={(event) => {
        if (disabled) return;
        event.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function BackButton({
  onClick,
  label,
  variant = 'inline',
  style,
}) {
  const [hovered, setHovered] = useState(false);
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const isPill = variant === 'pill';
  const finalLabel = label ?? t('back');

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isPill
          ? hovered
            ? isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.92)'
            : 'transparent'
          : 'transparent',
        border: isPill ? `1.5px solid ${isDark ? 'rgba(148,163,184,0.25)' : 'rgba(15,23,42,0.1)'}` : 'none',
        color: hovered ? 'var(--brand)' : isPill ? (isDark ? '#dbe5f0' : '#334155') : 'var(--text-muted)',
        borderRadius: isPill ? 50 : 0,
        padding: isPill ? '8px 20px 8px 14px' : 0,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        width: 'fit-content',
        marginBottom: 16,
        ...style,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {finalLabel}
    </button>
  );
}
