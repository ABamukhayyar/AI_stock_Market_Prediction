import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { PrimaryButton } from '../components/buttons';
import { useLanguage } from '../LanguageContext';

export default function NotFoundPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <Layout hideAccount>
      <div
        style={{
          minHeight: 'calc(100vh - 170px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 560,
            textAlign: 'center',
            background: 'var(--surface-strong)',
            border: '1px solid var(--border)',
            borderRadius: 28,
            padding: '44px 32px',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: 2, color: 'var(--brand)', textTransform: 'uppercase' }}>
            404
          </p>
          <h1
            style={{
              margin: '14px 0 10px',
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: '-0.8px',
              color: 'var(--text-strong)',
              fontFamily: "'DM Serif Display', serif",
            }}
          >
            {t('pageNotFound')}
          </h1>
          <p style={{ margin: '0 auto 24px', maxWidth: 420, fontSize: 14, lineHeight: 1.8, color: 'var(--text-muted)' }}>
            {t('helpSubtitle')}
          </p>
          <PrimaryButton type="button" style={{ maxWidth: 220, margin: '0 auto' }} onClick={() => navigate('/')}>
            {t('signIn')}
          </PrimaryButton>
        </div>
      </div>
    </Layout>
  );
}
