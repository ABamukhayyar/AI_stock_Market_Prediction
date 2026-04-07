import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout, { MarketStatus, useTheme } from '../components/Layout';
import { BackButton, PrimaryButton } from '../components/buttons';
import SupportCenterLogo from '../components/SupportCenterLogo';
import { useLanguage } from '../LanguageContext';
import useSmartBack from '../hooks/useSmartBack';
import { buildUtilityRouteState } from '../utils/navigation';

function MetricPill({ value, label }) {
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
      <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {label}
      </div>
    </div>
  );
}

function FaqCard({ index, title, body, isDark }) {
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
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.3px' }}>
            {title}
          </h3>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-muted)' }}>{body}</p>
        </div>
      </div>
    </article>
  );
}

function ResourceCard({ title, body, cta, onClick, isDark }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: '18px 18px 16px',
        borderRadius: 20,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: isDark ? '#f8fafc' : '#0f172a',
        textAlign: 'inherit',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-soft)',
        transition: 'transform 0.18s ease, border-color 0.18s ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-2px)';
        event.currentTarget.style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {cta}
      </div>
      <h3 style={{ margin: '8px 0 6px', fontSize: 16, fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.3px' }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: 'var(--text-muted)' }}>{body}</p>
    </button>
  );
}

export default function HelpPage() {
  const { isDark } = useTheme();
  const { lang, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const goBack = useSmartBack('/dashboard');
  const utilityRouteState = buildUtilityRouteState(location);

  const navigateToResource = (href) => {
    if (href === '/support' || href === '/settings' || href === '/privacy' || href === '/terms') {
      navigate(href, { state: utilityRouteState, replace: true });
      return;
    }

    navigate(href);
  };

  const pageContent = useMemo(() => {
    if (lang === 'ar') {
      return {
        eyebrow: 'مركز المساعدة',
        heroDescription: 'كل ما تحتاجه لفهم المنصة، إدارة الحساب، والوصول السريع إلى الدعم في مكان واحد واضح ومنظم.',
        heroMetrics: [
          { value: '24h', label: 'زمن الاستجابة' },
          { value: 'AR / EN', label: 'دعم ثنائي اللغة' },
        ],
        logoEyebrow: 'مكتب خدمة إنسايت',
        logoTitle: 'مساعدة منظمة وواضحة',
        logoSubtitle: 'دليل سريع للوصول إلى الإجابات والإعدادات والدعم المباشر عند الحاجة.',
        logoPoints: ['إرشادات خطوة بخطوة', 'إعدادات وحسابات', 'تحويل سريع إلى الدعم'],
        faqs: [
          {
            title: 'كيف يتم إنشاء التوقعات؟',
            body: 'تجمع المنصة بين نماذج السلاسل الزمنية، حركة السعر الحديثة، وأنماط القطاع لإنتاج قراءة قصيرة الأجل لكل سهم.',
          },
          {
            title: 'هل التوقعات مضمونة؟',
            body: 'لا. التوقعات مخصصة للإرشاد السريع فقط، ولا تمثل نصيحة استثمارية أو ضماناً للنتائج.',
          },
          {
            title: 'كيف أغير اللغة أو الوضع الداكن؟',
            body: 'يمكنك التبديل من الشريط العلوي أو من صفحة الإعدادات، وسيتم حفظ اختيارك تلقائياً.',
          },
        ],
        resourcesTitle: 'إجراءات شائعة',
        resources: [
          {
            title: 'الدعم المباشر',
            body: 'عند وجود مشكلة في الحساب أو الوصول أو أي سلوك غير متوقع داخل المنصة.',
            cta: 'افتح الدعم',
            href: '/support',
          },
          {
            title: 'إعدادات الحساب',
            body: 'إدارة اللغة، الوضع الداكن، التنبيهات، وخيارات الأمان من مكان واحد.',
            cta: 'افتح الإعدادات',
            href: '/settings',
          },
          {
            title: 'لوحة التحكم',
            body: 'ارجع إلى الأسهم والتوقعات وقائمة المراقبة لمتابعة السوق بسرعة.',
            cta: 'افتح اللوحة',
            href: '/dashboard',
          },
          {
            title: 'سياسة الخصوصية',
            body: 'راجع كيف يتم حفظ البيانات واستخدامها داخل تجربة المنتج.',
            cta: 'اقرأ السياسة',
            href: '/privacy',
          },
        ],
        contactTitle: 'هل تحتاج رداً بشرياً؟',
        contactBody: 'إذا لم تجد الإجابة هنا، انتقل مباشرة إلى صفحة الدعم وسنساعدك في أسرع وقت ممكن.',
      };
    }

    return {
      eyebrow: 'Support Center',
      heroDescription: 'Everything you need to understand the product, manage your account, and reach the team quickly in one cleaner support workspace.',
      heroMetrics: [
        { value: '24h', label: 'Response Target' },
        { value: 'EN / AR', label: 'Bilingual Help' },
      ],
      logoEyebrow: 'Insight Service Desk',
      logoTitle: 'Clear, guided product help',
      logoSubtitle: 'A faster path to answers, settings, and direct support when you need a real follow-up.',
      logoPoints: ['Step-by-step guidance', 'Account and settings help', 'Fast handoff to support'],
      faqs: [
        {
          title: 'How are predictions generated?',
          body: 'Insight blends time-series models, recent price action, and sector patterns to produce short-term stock outlooks.',
        },
        {
          title: 'Are predictions guaranteed?',
          body: 'No. Predictions are directional guidance only and should support research, not replace investment judgment.',
        },
        {
          title: 'How do I change language or theme?',
          body: 'You can switch both from the top app bar or from the Settings page. Your preference is saved automatically.',
        },
      ],
      resourcesTitle: 'Popular Actions',
      resources: [
        {
          title: 'Direct Support',
          body: 'Use this when you need help with access, account issues, or anything that needs a response from the team.',
          cta: 'Open Support',
          href: '/support',
        },
        {
          title: 'Account Settings',
          body: 'Manage language, dark mode, notifications, and security preferences from one place.',
          cta: 'Open Settings',
          href: '/settings',
        },
        {
          title: 'Dashboard',
          body: 'Return to your market overview, favorites, and stock predictions without extra navigation.',
          cta: 'Open Dashboard',
          href: '/dashboard',
        },
        {
          title: 'Privacy Policy',
          body: 'Review how account data is stored, used, and protected across the product.',
          cta: 'Read Policy',
          href: '/privacy',
        },
      ],
      contactTitle: 'Need a human response?',
      contactBody: 'If the answer is not here, move straight into Support and we will help you from there.',
    };
  }, [lang]);

  return (
    <Layout headerCenter={<MarketStatus />}>
      <style>{`
        .help-hero-grid,
        .help-body-grid {
          display: grid;
          gap: 22px;
        }
        .help-hero-grid {
          grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
        }
        .help-body-grid {
          grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.9fr);
          align-items: start;
        }
        .help-metric-grid,
        .help-resource-grid {
          display: grid;
          gap: 12px;
        }
        .help-metric-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .help-resource-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (max-width: 980px) {
          .help-hero-grid,
          .help-body-grid,
          .help-resource-grid,
          .help-metric-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '34px 24px 56px' }}>
        <BackButton onClick={goBack} label={t('back')} variant="pill" />

        <section
          style={{
            marginTop: 10,
            borderRadius: 30,
            padding: '30px 28px',
            background:
              'linear-gradient(135deg, rgba(7,52,47,0.98) 0%, rgba(11,99,67,0.96) 42%, rgba(17,94,89,0.9) 100%)',
            color: '#fff',
            boxShadow: 'var(--shadow-strong)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: -120, right: -40, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(28px)' }} />

          <div className="help-hero-grid" style={{ position: 'relative', zIndex: 1 }}>
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, fontWeight: 800, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {pageContent.eyebrow}
              </p>
              <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: '-1px', fontFamily: "'DM Serif Display', serif", lineHeight: 1.05 }}>
                {t('helpTitle')}
              </h1>
              <p style={{ margin: '14px 0 0', maxWidth: 680, fontSize: 14.5, lineHeight: 1.85, color: 'rgba(255,255,255,0.8)' }}>
                {pageContent.heroDescription}
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
                <PrimaryButton type="button" style={{ width: 'auto', paddingInline: 26 }} onClick={() => navigate('/support', { state: utilityRouteState, replace: true })}>
                  {t('contactSupport')}
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => navigate('/settings', { state: utilityRouteState, replace: true })}
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
                  {t('settings')}
                </button>
              </div>

              <div className="help-metric-grid" style={{ marginTop: 22 }}>
                {pageContent.heroMetrics.map((metric) => (
                  <MetricPill key={metric.label} value={metric.value} label={metric.label} />
                ))}
              </div>
            </div>

            <SupportCenterLogo
              variant="help"
              title={pageContent.logoTitle}
              subtitle={pageContent.logoSubtitle}
              points={pageContent.logoPoints}
              eyebrowLabel={pageContent.logoEyebrow}
            />
          </div>
        </section>

        <section className="help-body-grid" style={{ marginTop: 24 }}>
          <div>
            <h2 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
              {t('faq')}
            </h2>
            <div style={{ display: 'grid', gap: 16 }}>
              {pageContent.faqs.map((item, index) => (
                <FaqCard key={item.title} index={index + 1} title={item.title} body={item.body} isDark={isDark} />
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <div
              style={{
                background: 'var(--surface-strong)',
                border: '1px solid var(--border)',
                borderRadius: 24,
                padding: '22px 20px',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <h2 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                {pageContent.resourcesTitle}
              </h2>
              <div className="help-resource-grid">
                {pageContent.resources.map((item) => (
                  <ResourceCard
                    key={item.title}
                    title={item.title}
                    body={item.body}
                    cta={item.cta}
                    isDark={isDark}
                    onClick={() => navigateToResource(item.href)}
                  />
                ))}
              </div>
            </div>

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
                {pageContent.contactTitle}
              </h3>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-muted)' }}>
                {pageContent.contactBody}
              </p>
              <div
                style={{
                  marginTop: 16,
                  padding: '16px 18px',
                  borderRadius: 18,
                  background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(11,99,67,0.06)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {t('contactUs')}
                </div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>support@insight.ai</div>
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>{t('responseTime')}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
