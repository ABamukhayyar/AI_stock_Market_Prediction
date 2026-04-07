import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout, { MarketStatus, useTheme } from '../components/Layout';
import { BackButton, PrimaryButton } from '../components/buttons';
import SupportCenterLogo from '../components/SupportCenterLogo';
import { useLanguage } from '../LanguageContext';
import useSmartBack from '../hooks/useSmartBack';
import { buildUtilityRouteState } from '../utils/navigation';

function ChannelCard({ eyebrow, value, body, icon, accent, isDark }) {
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
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: accent.bg,
          color: accent.color,
          marginBottom: 14,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {eyebrow}
      </div>
      <h3 style={{ margin: '8px 0 8px', fontSize: 19, fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.3px' }}>
        {value}
      </h3>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-muted)' }}>{body}</p>
    </article>
  );
}

// eslint-disable-next-line no-unused-vars
function LegacyChecklistItem({ children }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--brand-soft)',
          color: 'var(--brand)',
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 800,
          marginTop: 1,
        }}
      >
        ✓
      </span>
      <span style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-muted)' }}>{children}</span>
    </div>
  );
}

function ChecklistItem({ children }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--brand-soft)',
          color: 'var(--brand)',
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 800,
          marginTop: 1,
        }}
      >
        {'\u2713'}
      </span>
      <span style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-muted)' }}>{children}</span>
    </div>
  );
}

function FlowStep({ index, title, body, isDark }) {
  return (
    <div
      style={{
        background: 'var(--surface-strong)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        padding: '22px 20px',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--brand-soft)',
          color: 'var(--brand)',
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 14,
        }}
      >
        {String(index).padStart(2, '0')}
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.3px' }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-muted)' }}>{body}</p>
    </div>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22Z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
    </svg>
  );
}

export default function SupportPage() {
  const { isDark } = useTheme();
  const { lang, t, isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const goBack = useSmartBack('/dashboard');
  const utilityRouteState = buildUtilityRouteState(location);
  const pageContent = useMemo(() => {
    if (lang === 'ar') {
      return {
        eyebrow: 'تواصل احترافي',
        description: 'صفحة دعم أوضح وأكثر عملية للوصول إلى الفريق بسرعة، مع قنوات مساعدة منظمة وتوقع واضح لآلية المتابعة.',
        logoEyebrow: 'فريق دعم إنسايت',
        logoTitle: 'فريق دعم جاهز للمتابعة',
        logoSubtitle: 'للأسئلة المتعلقة بالحساب، الوصول، أو سلوك المنصة غير المتوقع، ابدأ من هنا وسنوجّه الطلب بشكل مناسب.',
        logoPoints: ['متابعة خلال 24 ساعة', 'دعم بالعربية والإنجليزية', 'تحويل واضح للحالات'],
        channels: [
          {
            eyebrow: 'البريد الإلكتروني',
            value: 'support@insight.ai',
            body: 'أفضل قناة لمشاكل الحساب، الوصول، أو الملاحظات التي تحتاج رداً مباشراً من الفريق.',
            icon: <MailIcon />,
            accent: { bg: 'rgba(11,99,67,0.12)', color: '#0b6343' },
          },
          {
            eyebrow: 'زمن الاستجابة',
            value: '24 ساعة',
            body: 'نراجع الطلبات خلال أيام العمل ونعطي الأولوية للحالات المرتبطة بالدخول أو الوصول.',
            icon: <ClockIcon />,
            accent: { bg: 'rgba(56,189,248,0.14)', color: '#0284c7' },
          },
          {
            eyebrow: 'مركز المساعدة',
            value: 'ابدأ بالشرح السريع',
            body: 'إذا كنت تبحث عن خطوات استخدام أو تفسير للواجهة، ستجد البداية الأسرع في صفحة المساعدة.',
            icon: <BookIcon />,
            accent: { bg: 'rgba(217,119,6,0.14)', color: '#d97706' },
          },
        ],
        checklistTitle: 'ماذا نحتاج منك؟',
        checklistItems: [
          'البريد الإلكتروني المستخدم في الحساب أو وصف واضح للمشكلة.',
          'لقطة شاشة أو اسم الصفحة التي ظهر فيها الخلل إن أمكن.',
          'تفاصيل مختصرة تساعدنا على إعادة المشكلة بسرعة.',
        ],
        flowTitle: 'كيف تتم المتابعة؟',
        flowSteps: [
          {
            title: 'استلام الطلب',
            body: 'نراجع الرسالة ونحدد نوع المشكلة: حساب، وصول، إعدادات، أو ملاحظات على المنتج.',
          },
          {
            title: 'التحقق والتشخيص',
            body: 'نراجع السياق ونحدد ما إذا كانت المشكلة تحتاج إرشاداً سريعاً أو متابعة تقنية أعمق.',
          },
          {
            title: 'الرد والحل',
            body: 'نعود إليك بخطوات واضحة أو تحديث على حالة الطلب حتى يتم إغلاقه بشكل سليم.',
          },
        ],
      };
    }

    return {
      eyebrow: 'Professional Support',
      description: 'A cleaner, more purposeful support page designed to get you to the right channel faster and set clear expectations for follow-up.',
      logoEyebrow: 'Insight Support Team',
      logoTitle: 'A support team built for follow-through',
      logoSubtitle: 'For account questions, access issues, or unexpected product behavior, start here and we will route the request clearly.',
      logoPoints: ['24-hour response target', 'Arabic and English support', 'Clear issue routing'],
      channels: [
        {
          eyebrow: 'Email',
          value: 'support@insight.ai',
          body: 'Best for account problems, access issues, or product feedback that needs a direct reply from the team.',
          icon: <MailIcon />,
          accent: { bg: 'rgba(11,99,67,0.12)', color: '#0b6343' },
        },
        {
          eyebrow: 'Response Time',
          value: '24 hours',
          body: 'We review requests during the work week and prioritize urgent sign-in or access issues first.',
          icon: <ClockIcon />,
          accent: { bg: 'rgba(56,189,248,0.14)', color: '#0284c7' },
        },
        {
          eyebrow: 'Help Center',
          value: 'Start with guided help',
          body: 'If you need workflow guidance or a clearer explanation of the interface, the Help page is the fastest first stop.',
          icon: <BookIcon />,
          accent: { bg: 'rgba(217,119,6,0.14)', color: '#d97706' },
        },
      ],
      checklistTitle: 'What helps us respond faster?',
      checklistItems: [
        'The email used for your account or a clear description of the issue.',
        'A screenshot or page name if something looked broken or unexpected.',
        'A short note on what you were trying to do before the issue happened.',
      ],
      flowTitle: 'How support moves forward',
      flowSteps: [
        {
          title: 'Review',
          body: 'We classify the request quickly so it reaches the right person without extra back-and-forth.',
        },
        {
          title: 'Investigate',
          body: 'We check the context and determine whether the issue needs quick guidance or deeper technical follow-up.',
        },
        {
          title: 'Resolve',
          body: 'You receive clear next steps, a fix, or a status update until the request is properly closed.',
        },
      ],
    };
  }, [lang]);

  return (
    <Layout headerCenter={<MarketStatus />}>
      <style>{`
        .support-hero-grid,
        .support-body-grid,
        .support-flow-grid {
          display: grid;
          gap: 22px;
        }
        .support-hero-grid {
          grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
        }
        .support-body-grid {
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
          align-items: start;
        }
        .support-flow-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        @media (max-width: 980px) {
          .support-hero-grid,
          .support-body-grid,
          .support-flow-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div dir={isRTL ? 'rtl' : 'ltr'} style={{ maxWidth: 1120, margin: '0 auto', padding: '34px 24px 56px' }}>
        <BackButton onClick={goBack} label={t('back')} variant="pill" />

        <section
          style={{
            marginTop: 12,
            borderRadius: 30,
            padding: '30px 28px',
            background:
              'linear-gradient(135deg, rgba(2,6,23,0.98) 0%, rgba(7,89,133,0.92) 44%, rgba(11,99,67,0.88) 100%)',
            color: '#fff',
            boxShadow: 'var(--shadow-strong)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: -100, left: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(30px)' }} />
          <div style={{ position: 'absolute', bottom: -100, right: -10, width: 240, height: 240, borderRadius: '50%', background: 'rgba(56,189,248,0.12)', filter: 'blur(34px)' }} />

          <div className="support-hero-grid" style={{ position: 'relative', zIndex: 1 }}>
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, fontWeight: 800, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {pageContent.eyebrow}
              </p>
              <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: '-1px', fontFamily: "'DM Serif Display', serif", lineHeight: 1.05 }}>
                {t('supportTitle')}
              </h1>
              <p style={{ margin: '14px 0 0', maxWidth: 700, fontSize: 14.5, lineHeight: 1.85, color: 'rgba(255,255,255,0.8)' }}>
                {pageContent.description}
              </p>

              <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <PrimaryButton
                  type="button"
                  style={{ width: 'auto', paddingInline: 28 }}
                  onClick={() => {
                    window.location.href = 'mailto:support@insight.ai?subject=Insight%20Support';
                  }}
                >
                  support@insight.ai
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => navigate('/help', { state: utilityRouteState, replace: true })}
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
            </div>

            <SupportCenterLogo
              variant="support"
              title={pageContent.logoTitle}
              subtitle={pageContent.logoSubtitle}
              points={pageContent.logoPoints}
              eyebrowLabel={pageContent.logoEyebrow}
            />
          </div>
        </section>

        <section className="support-body-grid" style={{ marginTop: 24 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            {pageContent.channels.map((item) => (
              <ChannelCard
                key={item.eyebrow}
                eyebrow={item.eyebrow}
                value={item.value}
                body={item.body}
                icon={item.icon}
                accent={item.accent}
                isDark={isDark}
              />
            ))}
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
            <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.3px' }}>
              {pageContent.checklistTitle}
            </h2>
            <div style={{ display: 'grid', gap: 14 }}>
              {pageContent.checklistItems.map((item) => (
                <ChecklistItem key={item}>{item}</ChecklistItem>
              ))}
            </div>

            <div
              style={{
                marginTop: 20,
                padding: '18px 18px 16px',
                borderRadius: 18,
                background: isDark ? 'rgba(15,23,42,0.48)' : 'rgba(11,99,67,0.06)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {t('contactUs')}
              </div>
              <div style={{ marginTop: 8, fontSize: 20, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.3px' }}>
                support@insight.ai
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.75, color: 'var(--text-muted)' }}>{t('responseTime')}</p>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
            {pageContent.flowTitle}
          </h2>
          <div className="support-flow-grid">
            {pageContent.flowSteps.map((step, index) => (
              <FlowStep key={step.title} index={index + 1} title={step.title} body={step.body} isDark={isDark} />
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
