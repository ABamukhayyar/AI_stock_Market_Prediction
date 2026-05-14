import React from 'react';

// Shared numeric tile used on Stock Detail and Model Diagnostics so the
// two pages render identical-looking metric cards. Previously this lived
// inside StockDetail.js, and ModelDiagnostics had its own near-duplicate
// `Tile` component with slightly different padding / radius / font size --
// extracted here so there's a single source of truth.
export default function StatBox({ label, value, sub, accent, isDark = false }) {
  return (
    <div
      className="stockdetail-stat"
      style={{
        background: isDark ? '#111827' : '#f9fafb',
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.22)' : '#eef2f6'}`,
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        className="stockdetail-muted"
        style={{
          fontSize: 10,
          color: isDark ? '#94a3b8' : '#6b7280',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        {label}
      </span>
      <span
        className="stockdetail-stat-value"
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: accent || (isDark ? '#f8fafc' : '#111827'),
          letterSpacing: '-0.3px',
          fontFamily: 'Georgia, serif',
        }}
      >
        {value}
      </span>
      {sub && (
        <span className="stockdetail-muted" style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#9ca3af' }}>
          {sub}
        </span>
      )}
    </div>
  );
}
