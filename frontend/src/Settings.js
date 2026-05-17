import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import Layout, { MarketStatus, useTheme } from './components/Layout';
import { BackButton, PrimaryButton } from './components/buttons';
import { useLanguage } from './LanguageContext';
import ThemeToggleButton from './components/ThemeToggleButton';
import useSmartBack from './hooks/useSmartBack';
import { clearStoredUser } from './utils/auth';
import { buildUtilityRouteState } from './utils/navigation';

function SettingRow({ label, description, children, isDark, noBorder = false }) {
  return (
    <div
      className="settings-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '18px 0',
        borderBottom: noBorder ? 'none' : `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : '#f1f5f9'}`,
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: isDark ? '#e2e8f0' : '#111827' }}>{label}</p>
        {description && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.65 }}>{description}</p>}
      </div>
      <div className="settings-row-action" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {children}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, muted = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 112,
        padding: '10px 18px',
        borderRadius: 999,
        background: muted ? 'rgba(148,163,184,0.12)' : 'linear-gradient(135deg, rgba(11,99,67,0.12), rgba(11,99,67,0.18))',
        color: muted ? 'var(--text-soft)' : 'var(--brand)',
        border: `1px solid ${muted ? 'var(--border)' : 'var(--border-strong)'}`,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: muted ? 'none' : '0 10px 22px rgba(11,99,67,0.08)',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
      }}
    >
      {label}
    </button>
  );
}

function DangerButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 112,
        background: 'rgba(239,68,68,0.06)',
        color: 'var(--danger)',
        border: '1.5px solid rgba(239,68,68,0.28)',
        borderRadius: 50,
        padding: '10px 18px',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'transform 0.18s ease',
      }}
    >
      {label}
    </button>
  );
}

function HeroMetric({ value, label }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 18,
        background: 'rgba(255,255,255,0.09)',
        border: '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.4px' }}>
        {value}
      </div>
      <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {label}
      </div>
    </div>
  );
}

function SectionShell({ eyebrow, title, description, icon, children, isDark, danger = false }) {
  return (
    <section
      style={{
        background: 'var(--surface-strong)',
        border: `1px solid ${danger ? 'rgba(239,68,68,0.16)' : 'var(--border)'}`,
        borderRadius: 24,
        padding: '22px 24px 8px',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 8 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: danger ? 'rgba(239,68,68,0.1)' : 'var(--brand-soft)',
            color: danger ? 'var(--danger)' : 'var(--brand)',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {eyebrow}
          </div>
          <h2 style={{ margin: '8px 0 6px', fontSize: 21, fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.4px' }}>
            {title}
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-muted)' }}>{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function SidePanel({ title, body, children, isDark }) {
  return (
    <div
      style={{
        background: 'var(--surface-strong)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        padding: '22px 20px',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.3px' }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-muted)' }}>{body}</p>
      <div
        style={{
          marginTop: 18,
          padding: '16px 18px',
          borderRadius: 18,
          background: isDark ? 'rgba(15,23,42,0.48)' : 'rgba(11,99,67,0.06)',
          border: '1px solid var(--border)',
          display: 'grid',
          gap: 12,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PanelActionButton({ label, onClick, accent = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: '13px 14px',
        borderRadius: 16,
        border: `1px solid ${accent ? 'var(--border-strong)' : 'var(--border)'}`,
        background: accent ? 'var(--brand-soft)' : 'var(--surface)',
        color: accent ? 'var(--brand)' : 'var(--text-strong)',
        cursor: 'pointer',
        textAlign: 'inherit',
        fontWeight: 700,
        transition: 'transform 0.18s ease, border-color 0.18s ease',
      }}
    >
      {label}
    </button>
  );
}

function InfoRow({ label, value, strong = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: strong ? 'var(--brand)' : 'var(--text-strong)', fontWeight: 800, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function PaletteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 0 0 0 18h1.2a2.3 2.3 0 0 0 0-4.6H12a2 2 0 0 1 0-4h1.5A4.5 4.5 0 0 0 18 7.9 4.9 4.9 0 0 0 12 3Z" />
      <circle cx="6.5" cy="11.5" r="1" />
      <circle cx="9.5" cy="7.5" r="1" />
      <circle cx="14.5" cy="7.5" r="1" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export default function Settings() {
  const { isDark, toggleDarkMode } = useTheme();
  const { t, lang, toggleLang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const navigateBack = useSmartBack('/dashboard');
  const [mounted, setMounted] = useState(false);
  const utilityRouteState = buildUtilityRouteState(location);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(id);
  }, []);

  const languageButtonLabel = lang === 'en' ? t('switchToArabic') : t('switchToEnglish');
  const currentLanguageLabel = lang === 'en' ? 'English' : 'العربية';
  const themeLabel = isDark ? t('themeDark') : t('themeLight');

  const pageContent = useMemo(() => {
    if (lang === 'ar') {
      return {
        heroEyebrow: 'لوحة التحكم',
        heroDescription: 'مساحة إعدادات بسيطة للتحكم بالمظهر واللغة وحالة الحساب من مكان واحد.',
        appearanceEyebrow: 'المساحة',
        appearanceBody: 'خصص شكل المنصة والطريقة التي تريد أن تظهر بها الواجهة يومياً.',
        accountEyebrow: 'الحساب',
        accountBody: 'إدارة جلستك الحالية.',
        snapshotTitle: 'حالة الإعدادات',
        snapshotBody: 'نظرة سريعة على التفضيلات التي تشكل تجربتك الحالية.',
        helpTitle: 'هل تحتاج مساعدة؟',
        helpBody: 'إذا كنت تريد شرحاً للنظام أو فهم كيفية عمل التنبؤات بشكل أفضل، فالمساعدة والدعم جاهزان.',
      };
    }

    return {
      heroEyebrow: 'Control Center',
      heroDescription: 'A simple settings surface for appearance, language, and account state.',
      appearanceEyebrow: 'Workspace',
      appearanceBody: 'Shape how the product looks and feels every time you come back to the app.',
      accountEyebrow: 'Account',
      accountBody: 'Manage your current session.',
      snapshotTitle: 'Current Setup',
      snapshotBody: 'A quick overview of the preferences shaping your experience right now.',
      helpTitle: 'Need a hand?',
      helpBody: 'If you want help understanding how the predictions work, Help and Support are both one step away.',
    };
  }, [lang]);

  const handleLogOut = () => {
    clearStoredUser();
    navigate('/');
  };

  return (
    <Layout headerCenter={<MarketStatus />}>
      <Toaster position="top-center" toastOptions={{ duration: 2200, style: { borderRadius: 12, padding: '12px 18px', fontSize: 14, fontWeight: 600 } }} />
      <style>{`
        .settings-fade { opacity: 0; transform: translateY(16px); transition: opacity 0.5s ease, transform 0.5s ease; }
        .settings-fade.in { opacity: 1; transform: translateY(0); }
        .settings-hero-grid,
        .settings-body-grid,
        .settings-metrics-grid {
          display: grid;
          gap: 20px;
        }
        .settings-hero-grid {
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.95fr);
          align-items: start;
        }
        .settings-body-grid {
          grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
          align-items: start;
        }
        .settings-metrics-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (max-width: 980px) {
          .settings-hero-grid,
          .settings-body-grid,
          .settings-metrics-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .settings-row {
            flex-direction: column;
            align-items: stretch !important;
          }
          .settings-row-action {
            justify-content: flex-start !important;
          }
        }
      `}</style>

      <div style={{ padding: '34px 24px 60px', maxWidth: 1180, width: '100%', margin: '0 auto' }}>
        <section
          className={`settings-fade${mounted ? ' in' : ''}`}
          style={{
            borderRadius: 30,
            padding: '26px 28px',
            background: 'linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(8,71,49,0.94) 46%, rgba(180,83,9,0.86) 100%)',
            color: '#fff',
            boxShadow: 'var(--shadow-strong)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: -90, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(30px)' }} />
          <div style={{ position: 'absolute', bottom: -80, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(45,212,191,0.12)', filter: 'blur(28px)' }} />

          <div className="settings-hero-grid" style={{ position: 'relative', zIndex: 1 }}>
            <div>
              <BackButton onClick={navigateBack} variant="pill" label={t('back')} style={{ marginBottom: 18 }} />

              <p style={{ margin: '0 0 10px', fontSize: 11.5, fontWeight: 800, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {pageContent.heroEyebrow}
              </p>
              <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: '-1px', fontFamily: "'DM Serif Display', serif", lineHeight: 1.05 }}>
                {t('settingsTitle')}
              </h1>
              <p style={{ margin: '14px 0 0', fontSize: 14.5, lineHeight: 1.9, color: 'rgba(255,255,255,0.78)', maxWidth: 660 }}>
                {pageContent.heroDescription}
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
                <PrimaryButton type="button" style={{ width: 'auto', paddingInline: 26 }} onClick={() => navigate('/support', { state: utilityRouteState, replace: true })}>
                  {t('contactSupport')}
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => navigate('/help', { state: utilityRouteState, replace: true })}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t('help')}
                </button>
              </div>

              <div className="settings-metrics-grid" style={{ marginTop: 22 }}>
                <HeroMetric value={themeLabel} label={t('appearance')} />
                <HeroMetric value={currentLanguageLabel} label={t('language')} />
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                minHeight: 240,
                borderRadius: 28,
                padding: '28px 26px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 100%)',
                border: '1px solid rgba(255,255,255,0.14)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                overflow: 'hidden',
                backdropFilter: 'blur(18px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div style={{ position: 'absolute', top: -26, right: -22, width: 180, height: 180, borderRadius: '50%', background: 'rgba(245,158,11,0.22)', filter: 'blur(28px)' }} />
              <div style={{ position: 'absolute', bottom: -48, left: -36, width: 160, height: 160, borderRadius: '50%', background: 'rgba(45,212,191,0.14)', filter: 'blur(24px)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                  Insight
                </p>
                <h3 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.5px' }}>
                  {lang === 'ar' ? 'إعدادات بسيطة، شفافة' : 'Simple, honest settings'}
                </h3>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: 'rgba(255,255,255,0.74)' }}>
                  {lang === 'ar'
                    ? 'فقط ما يعمل فعلاً: مظهر، لغة، تسجيل خروج. لا توجد مفاتيح وهمية.'
                    : 'Only what actually works: appearance, language, log out. No fake toggles.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="settings-body-grid" style={{ marginTop: 24 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <SectionShell
              eyebrow={pageContent.appearanceEyebrow}
              title={t('appearance')}
              description={pageContent.appearanceBody}
              icon={<PaletteIcon />}
              isDark={isDark}
            >
              <SettingRow label={t('darkMode')} description={t('switchBetweenThemes')} isDark={isDark}>
                <ThemeToggleButton
                  isDark={isDark}
                  onClick={() => { toggleDarkMode(); toast.success(t('themeUpdated')); }}
                  lightLabel={t('themeLight')}
                  darkLabel={t('themeDark')}
                  compact
                />
              </SettingRow>
              <SettingRow label={t('language')} description={t('currentLanguage')} isDark={isDark} noBorder>
                <ActionButton label={languageButtonLabel} onClick={() => { toggleLang(); toast.success(t('languageUpdated')); }} />
              </SettingRow>
            </SectionShell>

            <SectionShell
              eyebrow={pageContent.accountEyebrow}
              title={t('account')}
              description={pageContent.accountBody}
              icon={<AlertIcon />}
              isDark={isDark}
              danger
            >
              <SettingRow label={t('signOut')} description={t('signOutDesc')} isDark={isDark} noBorder>
                <DangerButton label={t('signOut')} onClick={handleLogOut} />
              </SettingRow>
            </SectionShell>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <SidePanel title={pageContent.snapshotTitle} body={pageContent.snapshotBody} isDark={isDark}>
              <InfoRow label={t('language')} value={currentLanguageLabel} />
              <InfoRow label={t('darkMode')} value={themeLabel} strong />
            </SidePanel>

            <SidePanel title={pageContent.helpTitle} body={pageContent.helpBody} isDark={isDark}>
              <PanelActionButton
                label={t('help')}
                onClick={() => navigate('/help', { state: utilityRouteState, replace: true })}
              />
              <PanelActionButton
                label={t('contactSupport')}
                onClick={() => {
                  window.location.href = 'mailto:support@insight.ai?subject=Insight%20Support';
                }}
                accent
              />
            </SidePanel>
          </div>
        </div>
      </div>
    </Layout>
  );
}
