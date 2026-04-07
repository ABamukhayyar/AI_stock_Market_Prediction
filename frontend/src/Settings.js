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

function ToggleSwitch({ checked, onChange, accent = 'var(--brand)', isDark = false }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 24,
        border: 'none',
        cursor: 'pointer',
        background: checked ? accent : isDark ? '#334155' : '#cbd5e1',
        position: 'relative',
        transition: 'background 0.2s ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      />
    </button>
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

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17H5l2-2v-4a5 5 0 1 1 10 0v4l2 2h-4" />
      <path d="M10 17a2 2 0 0 0 4 0" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3Z" />
      <path d="m9.5 12 1.7 1.7 3.3-3.3" />
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

function SettingsShowcase({ title, body, currentLanguageLabel, isDark, enabledAlertsCount, twoFactorEnabled, themeLabel, onLabel, offLabel, labels }) {
  const previewRows = [
    { label: labels.theme, value: themeLabel, accent: '#2dd4bf' },
    { label: labels.language, value: currentLanguageLabel, accent: '#38bdf8' },
    { label: labels.alerts, value: `${enabledAlertsCount}/4`, accent: '#f59e0b' },
    { label: labels.security, value: twoFactorEnabled ? onLabel : offLabel, accent: twoFactorEnabled ? '#10b981' : '#94a3b8' },
  ];

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
          top: -26,
          right: -22,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'rgba(245,158,11,0.22)',
          filter: 'blur(28px)',
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
          background: 'rgba(45,212,191,0.14)',
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
              background: 'linear-gradient(135deg, #f59e0b 0%, #0f766e 100%)',
              boxShadow: '0 20px 40px rgba(245,158,11,0.24)',
              flexShrink: 0,
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.54V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.7 1.7 0 0 0 .33-1.82 1.7 1.7 0 0 0-1.54-1H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.54-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.7 1.7 0 0 0 1.82.33h.01a1.7 1.7 0 0 0 1-1.54V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.7 1.7 0 0 0-.33 1.82v.01a1.7 1.7 0 0 0 1.54 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.54 1Z" />
            </svg>
          </div>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.58)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Insight Control Room
            </p>
            <h3 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.5px' }}>
              {title}
            </h3>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: 'rgba(255,255,255,0.74)' }}>
              {body}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {previewRows.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 18,
                background: isDark ? 'rgba(15,23,42,0.24)' : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: row.accent,
                    boxShadow: `0 0 0 6px ${row.accent}33`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{row.label}</span>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'rgba(255,255,255,0.84)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PasswordModal({ onClose, onSave, isDark, t }) {
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const canSave = values.current && values.next.length >= 6 && values.next === values.confirm;

  const updateField = (key) => (event) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--surface-strong)',
          borderRadius: 22,
          padding: 32,
          boxShadow: 'var(--shadow-strong)',
          border: '1px solid var(--border)',
        }}
      >
        <h3 style={{ margin: '0 0 22px', fontSize: 22, fontWeight: 800, color: isDark ? '#e2e8f0' : '#111827', fontFamily: "'DM Serif Display', serif" }}>
          {t('changePassword')}
        </h3>
        {[
          ['current', t('currentPassword')],
          ['next', t('newPassword')],
          ['confirm', t('confirmPassword')],
        ].map(([key, label]) => (
          <div key={key}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {label}
            </label>
            <input
              type="password"
              value={values[key]}
              onChange={updateField(key)}
              style={{
                width: '100%',
                padding: '11px 14px',
                marginBottom: 14,
                borderRadius: 12,
                fontSize: 14,
                border: '1.5px solid var(--brand)',
                outline: 'none',
                background: isDark ? '#0c1729' : '#fff',
                color: isDark ? '#e2e8f0' : '#111827',
                boxShadow: isDark ? '0 0 0 4px rgba(16,185,129,0.12)' : '0 0 0 4px rgba(11,99,67,0.08)',
              }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 50,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-soft)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => { onSave(); onClose(); }}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 50,
              border: 'none',
              background: canSave ? 'linear-gradient(135deg, var(--brand), var(--brand-strong))' : '#cbd5e1',
              color: '#fff',
              cursor: canSave ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              boxShadow: canSave ? 'var(--shadow-strong)' : 'none',
            }}
          >
            {t('saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { isDark, toggleDarkMode } = useTheme();
  const { t, lang, toggleLang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const navigateBack = useSmartBack('/dashboard');
  const [mounted, setMounted] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [prefs, setPrefs] = useState({
    emailNotifs: true,
    pushNotifs: false,
    marketAlerts: true,
    predictionAlerts: true,
    twoFactor: false,
  });
  const utilityRouteState = buildUtilityRouteState(location);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(id);
  }, []);

  const languageButtonLabel = lang === 'en' ? t('switchToArabic') : t('switchToEnglish');
  const currentLanguageLabel = lang === 'en' ? 'English' : 'العربية';
  const enabledAlertsCount = [prefs.emailNotifs, prefs.pushNotifs, prefs.marketAlerts, prefs.predictionAlerts].filter(Boolean).length;
  const pageContent = useMemo(() => {
    if (lang === 'ar') {
      return {
        heroEyebrow: 'لوحة التحكم',
        heroDescription: 'مساحة إعدادات أكثر أناقة ووضوحاً للتحكم بالمظهر والتنبيهات وحماية الحساب من مكان واحد منظم.',
        logoTitle: 'اضبط تجربتك بطريقتك',
        logoSubtitle: 'غير المظهر واللغة والتنبيهات وإعدادات الأمان من لوحة موحدة تشبه مركز التحكم.',
        logoPoints: ['مظهر ولغة أوضح', 'تنبيهات أكثر تنظيماً', 'خيارات أمان أسرع'],
        metrics: [
          { value: isDark ? t('themeDark') : t('themeLight'), label: t('appearance') },
          { value: `${enabledAlertsCount}/4`, label: t('notifications') },
          { value: prefs.twoFactor ? '2FA On' : '2FA Off', label: t('security') },
        ],
        appearanceEyebrow: 'المساحة',
        appearanceBody: 'خصص شكل المنصة والطريقة التي تريد أن تظهر بها الواجهة يومياً.',
        notificationsEyebrow: 'التنبيهات',
        notificationsBody: 'تحكم في الرسائل والإشعارات التي تصلك حتى تبقى المتابعة مركزة وغير مزعجة.',
        securityEyebrow: 'الحماية',
        securityBody: 'إعدادات أساسية للحفاظ على الحساب آمناً وتحديث الوصول عند الحاجة.',
        dangerEyebrow: 'إجراءات حساسة',
        dangerBody: 'هذه الأدوات تؤثر على بياناتك أو حسابك بشكل مباشر، لذلك تم فصلها بوضوح.',
        snapshotTitle: 'حالة الإعدادات',
        snapshotBody: 'نظرة سريعة على التفضيلات التي تشكل تجربتك الحالية داخل المنصة.',
        helpTitle: 'هل تحتاج مساعدة؟',
        helpBody: 'إذا كنت تريد شرحاً لاختيار التنبيهات المناسبة أو فهم إعدادات الأمان بشكل أفضل، فالمساعدة والدعم جاهزان.',
        onLabel: 'مفعل',
        offLabel: 'غير مفعل',
      };
    }

    return {
      heroEyebrow: 'Control Center',
      heroDescription: 'A more polished workspace for appearance, alerts, and account protection, all organized into one cleaner settings surface.',
      logoTitle: 'Tune the product your way',
      logoSubtitle: 'Adjust theme, language, notifications, and security from a more structured control room.',
      logoPoints: ['Cleaner appearance controls', 'More organized alerts', 'Faster security actions'],
      metrics: [
        { value: isDark ? t('themeDark') : t('themeLight'), label: t('appearance') },
        { value: `${enabledAlertsCount}/4`, label: t('notifications') },
        { value: prefs.twoFactor ? '2FA On' : '2FA Off', label: t('security') },
      ],
      appearanceEyebrow: 'Workspace',
      appearanceBody: 'Shape how the product looks and feels every time you come back to the app.',
      notificationsEyebrow: 'Signals',
      notificationsBody: 'Choose which updates deserve your attention so the product stays useful without feeling noisy.',
      securityEyebrow: 'Protection',
      securityBody: 'Keep account access secure and update important sign-in controls from one focused section.',
      dangerEyebrow: 'Critical Actions',
      dangerBody: 'These actions affect stored data and account access directly, so they live in a separated area.',
      snapshotTitle: 'Current Setup',
      snapshotBody: 'A quick overview of the preferences shaping your experience right now.',
      helpTitle: 'Need a hand?',
      helpBody: 'If you want help picking the right alerts or understanding security options, Help and Support are both one step away.',
      onLabel: 'On',
      offLabel: 'Off',
    };
  }, [enabledAlertsCount, isDark, lang, prefs.twoFactor, t]);

  const setPref = (key) => (value) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    if (key === 'twoFactor') {
      toast.success(value ? t('twoFactorEnabled') : t('twoFactorDisabled'));
    } else {
      toast.success(t('notificationUpdated'));
    }
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
          grid-template-columns: repeat(3, minmax(0, 1fr));
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

      {showPasswordModal && <PasswordModal onClose={() => setShowPasswordModal(false)} onSave={() => toast.success(t('passwordUpdated'))} isDark={isDark} t={t} />}

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
                {pageContent.metrics.map((metric) => (
                  <HeroMetric key={metric.label} value={metric.value} label={metric.label} />
                ))}
              </div>
            </div>

            <SettingsShowcase
              title={pageContent.logoTitle}
              body={pageContent.logoSubtitle}
              currentLanguageLabel={currentLanguageLabel}
              isDark={isDark}
              enabledAlertsCount={enabledAlertsCount}
              twoFactorEnabled={prefs.twoFactor}
              themeLabel={isDark ? t('themeDark') : t('themeLight')}
              onLabel={pageContent.onLabel}
              offLabel={pageContent.offLabel}
              labels={{
                theme: t('appearance'),
                language: t('language'),
                alerts: t('notifications'),
                security: t('security'),
              }}
            />
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
              eyebrow={pageContent.notificationsEyebrow}
              title={t('notifications')}
              description={pageContent.notificationsBody}
              icon={<BellIcon />}
              isDark={isDark}
            >
              <SettingRow label={t('emailNotifications')} description={t('receivePredictionsViaEmail')} isDark={isDark}>
                <ToggleSwitch checked={prefs.emailNotifs} onChange={setPref('emailNotifs')} isDark={isDark} />
              </SettingRow>
              <SettingRow label={t('pushNotifications')} description={t('browserPushNotifications')} isDark={isDark}>
                <ToggleSwitch checked={prefs.pushNotifs} onChange={setPref('pushNotifs')} isDark={isDark} />
              </SettingRow>
              <SettingRow label={t('marketAlerts')} description={t('alertsWhenMarketOpens')} isDark={isDark}>
                <ToggleSwitch checked={prefs.marketAlerts} onChange={setPref('marketAlerts')} isDark={isDark} />
              </SettingRow>
              <SettingRow label={t('predictionAlerts')} description={t('newAIPredictionAlerts')} isDark={isDark} noBorder>
                <ToggleSwitch checked={prefs.predictionAlerts} onChange={setPref('predictionAlerts')} isDark={isDark} />
              </SettingRow>
            </SectionShell>

            <SectionShell
              eyebrow={pageContent.securityEyebrow}
              title={t('security')}
              description={pageContent.securityBody}
              icon={<ShieldIcon />}
              isDark={isDark}
            >
              <SettingRow label={t('changePassword')} description={t('updatePasswordDesc')} isDark={isDark}>
                <ActionButton label={t('update')} onClick={() => setShowPasswordModal(true)} muted />
              </SettingRow>
              <SettingRow label={t('twoFactor')} description={t('addExtraSecurity')} isDark={isDark} noBorder>
                <ToggleSwitch checked={prefs.twoFactor} onChange={setPref('twoFactor')} accent="#8b5cf6" isDark={isDark} />
              </SettingRow>
            </SectionShell>

            <SectionShell
              eyebrow={pageContent.dangerEyebrow}
              title={t('dangerZone')}
              description={pageContent.dangerBody}
              icon={<AlertIcon />}
              isDark={isDark}
              danger
            >
              <SettingRow label={t('exportData')} description={t('exportDataDesc')} isDark={isDark}>
                <DangerButton label={t('export')} onClick={() => toast.success(t('exportStarted'))} />
              </SettingRow>
              <SettingRow label={t('deleteAccount')} description={t('deleteAccountDesc')} isDark={isDark} noBorder>
                <DangerButton
                  label={t('delete')}
                  onClick={() => {
                    if (window.confirm(t('areYouSureDelete'))) {
                      clearStoredUser();
                      navigate('/');
                    }
                  }}
                />
              </SettingRow>
            </SectionShell>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <SidePanel title={pageContent.snapshotTitle} body={pageContent.snapshotBody} isDark={isDark}>
              <InfoRow label={t('language')} value={currentLanguageLabel} />
              <InfoRow label={t('darkMode')} value={isDark ? t('themeDark') : t('themeLight')} strong />
              <InfoRow label={t('notifications')} value={`${enabledAlertsCount}/4`} />
              <InfoRow label={t('twoFactor')} value={prefs.twoFactor ? pageContent.onLabel : pageContent.offLabel} strong={prefs.twoFactor} />
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
              <PanelActionButton
                label={t('changePassword')}
                onClick={() => setShowPasswordModal(true)}
              />
            </SidePanel>
          </div>
        </div>
      </div>
    </Layout>
  );
}
