import React from 'react';

export default function WatchlistButton({
  active,
  onClick,
  label,
  compact = false,
  inverted = false,
}) {
  const background = active
    ? inverted
      ? 'rgba(255,255,255,0.16)'
      : 'rgba(245,158,11,0.14)'
    : inverted
      ? 'rgba(255,255,255,0.08)'
      : 'var(--surface)';
  const color = active ? '#f59e0b' : inverted ? '#fff' : 'var(--text-soft)';
  const border = active
    ? 'rgba(245,158,11,0.35)'
    : inverted
      ? 'rgba(255,255,255,0.18)'
      : 'var(--border)';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: compact ? '8px 10px' : '8px 12px',
        borderRadius: 999,
        border: `1px solid ${border}`,
        background,
        color,
        cursor: 'pointer',
        fontSize: 12.5,
        fontWeight: 700,
        transition: 'transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease',
        backdropFilter: 'blur(12px)',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="m12 17.3-6.2 3.7 1.7-7.1L2 9.2l7.2-.6L12 2l2.8 6.6 7.2.6-5.5 4.7 1.7 7.1z" />
      </svg>
      {!compact && label && <span>{label}</span>}
    </button>
  );
}
