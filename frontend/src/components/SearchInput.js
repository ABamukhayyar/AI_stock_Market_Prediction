import React, { useState } from 'react';

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  minWidth = 220,
  theme = 'light',
}) {
  const [focused, setFocused] = useState(false);
  const isGlass = theme === 'glass';
  const isDark = theme === 'dark';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: focused
          ? isDark
            ? '#0c1729'
            : '#ffffff'
          : isGlass
            ? 'rgba(255,255,255,0.78)'
            : isDark
              ? 'rgba(12,23,40,0.92)'
            : 'rgba(255,255,255,0.78)',
        border: `1.5px solid ${
          focused
            ? 'var(--brand)'
            : isGlass
              ? 'rgba(255,255,255,0.45)'
              : isDark
                ? 'rgba(148,163,184,0.24)'
              : 'rgba(15,23,42,0.08)'
        }`,
        borderRadius: 50,
        padding: '9px 16px',
        transition: 'all 0.2s',
        backdropFilter: 'blur(16px)',
        boxShadow: focused
          ? isDark
            ? '0 0 0 4px rgba(16,185,129,0.14)'
            : '0 0 0 4px rgba(11,99,67,0.08)'
          : 'var(--shadow-soft)',
        minWidth,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={focused ? 'var(--brand)' : isDark ? '#94a3b8' : '#64748b'}
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 13,
          color: isDark ? '#e2e8f0' : '#334155',
          width: '100%',
        }}
      />
    </div>
  );
}
