import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout, { MarketStatus, useTheme } from '../components/Layout';
import { BackButton, PrimaryButton } from '../components/buttons';
import { useLanguage } from '../LanguageContext';
import useSmartBack from '../hooks/useSmartBack';
import { buildUtilityRouteState } from '../utils/navigation';
import logoImg from '../insight-logo.png';

const TEAM = [
  { name: 'Nasser Alsultan', nameAr: 'ناصر السلطان', linkedin: 'https://www.linkedin.com/in/nasseralsultan', photo: '/team/nasser.jpg' },
  { name: 'Abdullah Bamukhayyar', nameAr: 'عبدالله بامخير', linkedin: 'https://www.linkedin.com/in/abdullah-bamukhayyar-38a772280', photo: '/team/abdullah.jpg' },
  { name: 'Maan Almotlaq', nameAr: 'معن المطلق', linkedin: 'https://www.linkedin.com/in/maan-almotlaq', photo: '/team/maan.jpg' },
  { name: 'Faisal Almani', nameAr: 'فيصل ال مانع', linkedin: 'https://www.linkedin.com/in/faisal-a-a527bb381', photo: '/team/faisal.jpg' },
  { name: 'Abdulaziz Alaqeel', nameAr: 'عبدالعزيز العقيل', linkedin: 'https://www.linkedin.com/in/abdulaziz-al-ageel-46378925a', photo: '/team/abdulaziz.jpg' },
];

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

function SectionCard({ index, title, body, isDark }) {
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

function TeamCard({ member, isDark, linkedInLabel, isAr }) {
  const displayName = isAr ? member.nameAr : member.name;
  const nameForInitials = isAr ? member.nameAr : member.name;
  const initials = nameForInitials.split(' ').map((n) => n[0]).join('').slice(0, 2);
  const [imgError, setImgError] = React.useState(false);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '20px 14px 16px',
        borderRadius: 20,
        background: isDark ? 'rgba(15,23,42,0.48)' : 'rgba(11,99,67,0.06)',
        border: '1px solid var(--border)',
        flex: '1 1 0',
        minWidth: 140,
      }}
    >
      {member.photo && !imgError ? (
        <img
          src={member.photo}
          alt={displayName}
          onError={() => setImgError(true)}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            objectFit: 'cover',
            boxShadow: '0 8px 20px rgba(16,185,129,0.18)',
            border: '2px solid var(--border)',
          }}
        />
      ) : (
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #065f46, #10b981)',
            color: '#fff',
            fontSize: 20,
            fontWeight: 800,
            boxShadow: '0 8px 20px rgba(16,185,129,0.18)',
          }}
        >
          {initials}
        </div>
      )}
      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', textAlign: 'center', lineHeight: 1.3 }}>
        {displayName}
      </span>
      <a
        href={member.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: '#0a66c2',
          fontSize: 11.5,
          fontWeight: 700,
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.18s ease',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="#0a66c2">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        {linkedInLabel}
      </a>
    </div>
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

export default function AboutPage() {
  const { isDark } = useTheme();
  const { lang, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useSmartBack('/dashboard');
  const utilityRouteState = buildUtilityRouteState(location);

  const isAr = lang === 'ar';

  const page = {
    eyebrow: isAr ? 'من نحن' : 'Who We Are',
    heroDescription: isAr
      ? 'منصة ذكية مبنية لتبسيط تحليل الأسهم وتوفير توقعات مدعومة بالذكاء الاصطناعي لسوق الأسهم السعودي.'
      : 'An intelligent platform built to simplify stock analysis and deliver AI-powered predictions for the Saudi stock market.',
    metrics: isAr
      ? [
          { value: 'AI', label: 'توقعات ذكية' },
          { value: '5', label: 'أعضاء الفريق' },
          { value: 'v1.0', label: 'الإصدار الحالي' },
        ]
      : [
          { value: 'AI', label: 'Smart Predictions' },
          { value: '5', label: 'Team Members' },
          { value: 'v1.0', label: 'Current Release' },
        ],
    logoTitle: isAr ? 'إنسايت — تحليل أذكى' : 'Insight — Smarter Analysis',
    logoSubtitle: isAr
      ? 'أداة تحليل أسهم مدعومة بالذكاء الاصطناعي لمساعدة المستثمرين في اتخاذ قرارات مبنية على البيانات.'
      : 'An AI-powered stock analysis tool helping investors make data-driven decisions.',
    logoPoints: isAr
      ? ['توقعات بالتعلم الآلي', 'بيانات السوق السعودي', 'دعم ثنائي اللغة']
      : ['Machine learning predictions', 'Saudi market data', 'Bilingual support'],
    supportTitle: isAr ? 'هل تحتاج مساعدة؟' : 'Need help?',
    supportBody: isAr
      ? 'إذا كنت تريد معرفة المزيد عن المنصة أو لديك أي استفسار، يمكنك الانتقال إلى المساعدة أو التواصل مع الدعم.'
      : 'If you want to learn more about the platform or have any questions, visit Help or contact Support.',
    sections: isAr
      ? [
          { title: t('aboutMission'), body: t('aboutMissionBody') },
          { title: t('aboutFeatures'), body: `${t('aboutFeature1')} • ${t('aboutFeature2')} • ${t('aboutFeature3')} • ${t('aboutFeature4')}` },
          { title: t('aboutTech'), body: t('aboutTechBody') },
        ]
      : [
          { title: t('aboutMission'), body: t('aboutMissionBody') },
          { title: t('aboutFeatures'), body: `${t('aboutFeature1')} • ${t('aboutFeature2')} • ${t('aboutFeature3')} • ${t('aboutFeature4')}` },
          { title: t('aboutTech'), body: t('aboutTechBody') },
        ],
  };

  return (
    <Layout headerCenter={<MarketStatus />}>
      <style>{`
        .about-hero-grid,
        .about-body-grid,
        .about-metric-grid {
          display: grid;
          gap: 22px;
        }
        .about-hero-grid {
          grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
        }
        .about-body-grid {
          grid-template-columns: minmax(0, 1.18fr) minmax(300px, 0.82fr);
          align-items: start;
        }
        .about-metric-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        @media (max-width: 980px) {
          .about-hero-grid,
          .about-body-grid,
          .about-metric-grid {
            grid-template-columns: 1fr;
          }
          .about-team-row {
            justify-content: center;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '34px 24px 56px' }}>
        <BackButton onClick={goBack} label={t('back')} variant="pill" />

        {/* Hero Section */}
        <section
          style={{
            marginTop: 12,
            borderRadius: 30,
            padding: '30px 28px',
            background: 'linear-gradient(135deg, rgba(7,52,47,0.98) 0%, rgba(11,99,67,0.96) 42%, rgba(17,94,89,0.9) 100%)',
            color: '#fff',
            boxShadow: 'var(--shadow-strong)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: -110, right: -20, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(30px)' }} />

          <div className="about-hero-grid" style={{ position: 'relative', zIndex: 1 }}>
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, fontWeight: 800, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {page.eyebrow}
              </p>
              <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: '-1px', fontFamily: "'DM Serif Display', serif", lineHeight: 1.05 }}>
                {t('aboutTitle')}
              </h1>
              <p style={{ margin: '10px 0 0', maxWidth: 700, fontSize: 14.5, lineHeight: 1.8, color: 'rgba(255,255,255,0.82)' }}>
                {t('aboutDescription')}
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

              <div className="about-metric-grid" style={{ marginTop: 22 }}>
                {page.metrics.map((metric) => (
                  <MetricCard key={metric.label} value={metric.value} label={metric.label} />
                ))}
              </div>
            </div>

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
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 18,
              }}
            >
              <div style={{ position: 'absolute', top: -24, right: -18, width: 180, height: 180, borderRadius: '50%', background: 'rgba(52,211,153,0.22)', filter: 'blur(26px)' }} />
              <div style={{ position: 'absolute', bottom: -48, left: -36, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(24px)' }} />
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <img
                  src={logoImg}
                  alt="Insight"
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 28,
                    objectFit: 'cover',
                    boxShadow: '0 20px 40px rgba(16,185,129,0.24)',
                  }}
                />
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.5px', textAlign: 'center' }}>
                  {page.logoTitle}
                </h3>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: 'rgba(255,255,255,0.74)', textAlign: 'center', maxWidth: 280 }}>
                  {page.logoSubtitle}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Body Section */}
        <section className="about-body-grid" style={{ marginTop: 24 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            {page.sections.map((section, index) => (
              <SectionCard key={section.title} index={index + 1} title={section.title} body={section.body} isDark={isDark} />
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

        {/* Team Section — Full Width */}
        <section
          style={{
            marginTop: 24,
            background: 'var(--surface-strong)',
            border: '1px solid var(--border)',
            borderRadius: 22,
            padding: '26px 24px',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.3px' }}>
            {t('aboutTeam')}
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 13.5, lineHeight: 1.85, color: 'var(--text-muted)' }}>
            {t('aboutTeamBody')}
          </p>
          <div className="about-team-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {TEAM.map((member) => (
              <TeamCard key={member.name} member={member} isDark={isDark} linkedInLabel={t('viewOnLinkedIn')} isAr={isAr} />
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
