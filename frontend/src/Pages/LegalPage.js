import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout, { MarketStatus, useTheme } from '../components/Layout';
import { BackButton, PrimaryButton } from '../components/buttons';
import SupportCenterLogo from '../components/SupportCenterLogo';
import { useLanguage } from '../LanguageContext';
import useSmartBack from '../hooks/useSmartBack';
import { buildUtilityRouteState } from '../utils/navigation';

function MetricCard({ value, label }) {
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

function LegalSectionCard({ index, title, body, isDark }) {
  return (
    <article
      style={{
        background: 'var(--surface-strong)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        padding: '22px 20px',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--brand-soft)',
            color: 'var(--brand)',
            fontSize: 13,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {String(index).padStart(2, '0')}
        </div>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.3px' }}>
            {title}
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.85, color: 'var(--text-muted)' }}>{body}</p>
        </div>
      </div>
    </article>
  );
}

function SidePanel({ title, body, actions, isDark }) {
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
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            style={{
              width: '100%',
              padding: '13px 14px',
              borderRadius: 16,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-strong)',
              cursor: 'pointer',
              textAlign: 'inherit',
              fontWeight: 700,
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LegalPage({ variant }) {
  const { isDark } = useTheme();
  const { lang, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const goBack = useSmartBack('/dashboard');
  const utilityRouteState = buildUtilityRouteState(location);

  const page = useMemo(() => {
    if (variant === 'terms') {
      if (lang === 'ar') {
        return {
          title: t('termsTitle'),
          subtitle: t('termsSubtitle'),
          eyebrow: 'إطار الاستخدام',
          heroDescription: 'عرض أوضح لحدود الاستخدام، مسؤوليات الحساب، وما الذي يمكن توقعه عند الاعتماد على المنصة كمصدر تحليلي.',
          metrics: [
            { value: '3', label: 'محاور رئيسية' },
            { value: 'User', label: 'مسؤولية القرار' },
            { value: 'AI', label: 'تحليل تجريبي' },
          ],
          logoVariant: 'terms',
          logoTitle: 'شروط استخدام واضحة',
          logoSubtitle: 'فهم سريع لكيفية استخدام المنصة وما الذي يبقى ضمن مسؤولية المستخدم النهائية.',
          logoPoints: ['مسؤولية الحساب', 'حدود الاعتماد على التوقعات', 'قواعد السلوك داخل المنصة'],
          supportTitle: 'هل تحتاج شرحاً أبسط؟',
          supportBody: 'إذا كنت تريد توضيحاً عملياً حول هذه البنود، يمكنك الانتقال إلى المساعدة أو التواصل مع الدعم مباشرة.',
          sections: [
            {
              title: 'استخدام المنصة',
              body: 'تم تصميم إنسايت لعرض رؤى تحليلية وتوقعات تجريبية للأسهم. يتحمل المستخدم مسؤولية قراراته الاستثمارية النهائية.',
            },
            {
              title: 'الحساب والسلوك',
              body: 'يجب الحفاظ على بيانات الدخول بشكل آمن وعدم إساءة استخدام المنصة أو محاولة الوصول غير المصرح به إلى الحسابات أو البيانات.',
            },
            {
              title: 'حدود المسؤولية',
              body: 'رغم سعينا لتحسين الدقة والاستقرار، قد تتأخر البيانات أو تختلف التوقعات عن حركة السوق الفعلية. لا نتحمل الخسائر الناتجة عن الاعتماد المباشر على هذه التوقعات.',
            },
          ],
        };
      }

      return {
        title: t('termsTitle'),
        subtitle: t('termsSubtitle'),
        eyebrow: 'Usage Framework',
        heroDescription: "A cleaner summary of platform usage boundaries, account responsibilities, and what remains under the user's final judgment.",
        metrics: [
          { value: '3', label: 'Core Rules' },
          { value: 'User', label: 'Decision Owner' },
          { value: 'AI', label: 'Experimental Layer' },
        ],
        logoVariant: 'terms',
        logoTitle: 'Clear terms for product use',
        logoSubtitle: 'A faster way to understand how the platform should be used and what still remains your responsibility.',
        logoPoints: ['Account responsibility', 'Forecast reliance limits', 'Expected conduct'],
        supportTitle: 'Need a simpler explanation?',
        supportBody: 'If you want practical clarification on any of these terms, jump into Help or contact Support directly.',
        sections: [
          {
            title: 'Using the Platform',
            body: 'Insight is built to surface analytical views and experimental stock forecasts. Users remain responsible for their own investment decisions.',
          },
          {
            title: 'Accounts and Conduct',
            body: 'Users should protect their credentials and must not misuse the product, attempt unauthorized access, or interfere with platform availability.',
          },
          {
            title: 'Limits of Liability',
            body: 'We work to improve reliability and clarity, but market data may lag and predictions may differ from real market outcomes. Insight is not liable for decisions made from direct reliance on forecasts.',
          },
        ],
      };
    }

    if (lang === 'ar') {
      return {
        title: t('privacyTitle'),
        subtitle: t('privacySubtitle'),
        eyebrow: 'وضوح البيانات',
        heroDescription: 'ملخص منظم لكيفية جمع بيانات الحساب، استخدام التفضيلات، وحماية المعلومات اللازمة لتقديم تجربة أكثر استقراراً.',
        metrics: [
          { value: '3', label: 'محاور الحماية' },
          { value: 'Saved', label: 'تفضيلات محفوظة' },
          { value: 'Secure', label: 'ممارسات معقولة' },
        ],
        logoVariant: 'help',
        logoTitle: 'سياسة خصوصية أوضح',
        logoSubtitle: 'عرض مبسط لكيفية تخزين التفضيلات واستخدام بيانات الحساب ضمن حدود تشغيلية واضحة.',
        logoPoints: ['جمع محدود للبيانات', 'استخدام لتحسين التجربة', 'احتفاظ وحماية بشكل معقول'],
        supportTitle: 'هل لديك سؤال عن البيانات؟',
        supportBody: 'إذا كنت تريد فهماً عملياً لما يتم حفظه أو كيف تستخدم تفضيلاتك داخل المنتج، يمكنك الرجوع إلى المساعدة أو الدعم.',
        sections: [
          {
            title: 'البيانات التي نجمعها',
            body: 'نحتفظ ببيانات الحساب الأساسية مثل البريد الإلكتروني وتفضيلات اللغة والمظهر وبعض إعدادات الاستخدام اللازمة لتحسين التجربة.',
          },
          {
            title: 'كيفية استخدام البيانات',
            body: 'تستخدم البيانات لتخصيص الواجهة وحفظ إعداداتك ودعم الأمان وتحسين الأداء العام للمنتج.',
          },
          {
            title: 'الاحتفاظ والحماية',
            body: 'نطبق ممارسات حماية معقولة ونحتفظ بالبيانات فقط للمدة اللازمة لتقديم الخدمة أو للالتزامات التشغيلية الأساسية.',
          },
        ],
      };
    }

    return {
      title: t('privacyTitle'),
      subtitle: t('privacySubtitle'),
      eyebrow: 'Data Clarity',
      heroDescription: 'A more structured summary of what account data is collected, how preferences are used, and how information is protected across the product.',
      metrics: [
        { value: '3', label: 'Policy Areas' },
        { value: 'Saved', label: 'Preferences' },
        { value: 'Secure', label: 'Reasonable Safeguards' },
      ],
      logoVariant: 'help',
      logoTitle: 'A clearer privacy overview',
      logoSubtitle: 'An easier way to understand how account preferences are stored and how core data supports the product experience.',
      logoPoints: ['Limited data collection', 'Preference-based personalization', 'Reasonable retention and protection'],
      supportTitle: 'Questions about your data?',
      supportBody: 'If you want a practical explanation of what is stored or how account preferences are used, Help and Support are both available.',
      sections: [
        {
          title: 'Data We Collect',
          body: 'We retain core account details such as email address, language preference, theme selection, and essential product settings needed to improve the experience.',
        },
        {
          title: 'How Data Is Used',
          body: 'Your data is used to personalize the interface, save preferences, support account security, and improve overall product quality.',
        },
        {
          title: 'Retention and Protection',
          body: 'We apply reasonable safeguards and keep data only as long as needed to operate the service or satisfy essential operational obligations.',
        },
      ],
    };
  }, [lang, t, variant]);

  return (
    <Layout hideAccount headerCenter={<MarketStatus />}>
      <style>{`
        .legal-hero-grid,
        .legal-body-grid,
        .legal-metric-grid {
          display: grid;
          gap: 22px;
        }
        .legal-hero-grid {
          grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
        }
        .legal-body-grid {
          grid-template-columns: minmax(0, 1.18fr) minmax(300px, 0.82fr);
          align-items: start;
        }
        .legal-metric-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        @media (max-width: 980px) {
          .legal-hero-grid,
          .legal-body-grid,
          .legal-metric-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '34px 24px 56px' }}>
        <BackButton onClick={goBack} label={t('back')} variant="pill" />

        <section
          style={{
            marginTop: 12,
            borderRadius: 30,
            padding: '30px 28px',
            background:
              variant === 'terms'
                ? 'linear-gradient(135deg, rgba(2,6,23,0.98) 0%, rgba(7,89,133,0.92) 44%, rgba(11,99,67,0.86) 100%)'
                : 'linear-gradient(135deg, rgba(7,52,47,0.98) 0%, rgba(11,99,67,0.96) 42%, rgba(17,94,89,0.9) 100%)',
            color: '#fff',
            boxShadow: 'var(--shadow-strong)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: -110, right: -20, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(30px)' }} />

          <div className="legal-hero-grid" style={{ position: 'relative', zIndex: 1 }}>
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, fontWeight: 800, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {page.eyebrow}
              </p>
              <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: '-1px', fontFamily: "'DM Serif Display', serif", lineHeight: 1.05 }}>
                {page.title}
              </h1>
              <p style={{ margin: '10px 0 0', maxWidth: 700, fontSize: 14.5, lineHeight: 1.8, color: 'rgba(255,255,255,0.82)' }}>
                {page.subtitle}
              </p>
              <p style={{ margin: '14px 0 0', maxWidth: 720, fontSize: 14.5, lineHeight: 1.85, color: 'rgba(255,255,255,0.78)' }}>
                {page.heroDescription}
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
                <PrimaryButton type="button" style={{ width: 'auto', paddingInline: 26 }} onClick={() => navigate('/support', { state: utilityRouteState })}>
                  {t('contactSupport')}
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => navigate('/help', { state: utilityRouteState })}
                  style={{
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.22)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    padding: '14px 24px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t('helpTitle')}
                </button>
              </div>

              <div className="legal-metric-grid" style={{ marginTop: 22 }}>
                {page.metrics.map((metric) => (
                  <MetricCard key={metric.label} value={metric.value} label={metric.label} />
                ))}
              </div>
            </div>

            <SupportCenterLogo
              variant={page.logoVariant}
              title={page.logoTitle}
              subtitle={page.logoSubtitle}
              points={page.logoPoints}
            />
          </div>
        </section>

        <section className="legal-body-grid" style={{ marginTop: 24 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            {page.sections.map((section, index) => (
              <LegalSectionCard key={section.title} index={index + 1} title={section.title} body={section.body} isDark={isDark} />
            ))}
          </div>

          <SidePanel
            title={page.supportTitle}
            body={page.supportBody}
            isDark={isDark}
            actions={[
              { label: t('contactSupport'), onClick: () => navigate('/support', { state: utilityRouteState }) },
              { label: t('helpTitle'), onClick: () => navigate('/help', { state: utilityRouteState }) },
              { label: t('settings'), onClick: () => navigate('/settings', { state: utilityRouteState }) },
            ]}
          />
        </section>
      </div>
    </Layout>
  );
}
