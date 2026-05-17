import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Layout, { useTheme } from '../components/Layout';
import { BackButton, PrimaryButton } from '../components/buttons';
import logoImg from '../insight-logo.png';
import { useLanguage } from '../LanguageContext';
import { setStoredUser } from '../utils/auth';

const signupSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm password is required'),
    terms: z.boolean().refine((v) => v === true, 'You must accept the terms'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

function FloatingInput({ id, type, label, value, onChange, onBlur, error, isDark }) {
  const [focused, setFocused] = useState(false);
  const active = focused || (value && value.length > 0);

  return (
    <div style={{ position: 'relative', marginBottom: 24 }}>
      <label
        htmlFor={id}
        style={{
          position: 'absolute',
          left: 16,
          top: active ? 8 : '50%',
          transform: active ? 'none' : 'translateY(-50%)',
          fontSize: active ? 10 : 14,
          fontWeight: active ? 600 : 400,
          color: error ? '#ef4444' : focused ? '#10b981' : (isDark ? '#64748b' : '#9ca3af'),
          pointerEvents: 'none',
          transition: 'all 0.18s ease',
          letterSpacing: active ? 0.4 : 0,
          textTransform: active ? 'uppercase' : 'none',
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={{
          width: '100%',
          padding: active ? '24px 16px 8px 16px' : '14px 16px',
          borderRadius: 12,
          border: `1.5px solid ${error ? '#ef4444' : focused ? '#10b981' : (isDark ? 'rgba(148,163,184,0.2)' : '#e5e7eb')}`,
          outline: 'none',
          fontSize: 15,
          background: focused ? (isDark ? '#1e293b' : '#fff') : (isDark ? '#111827' : '#f9fafb'),
          transition: 'all 0.2s ease',
          color: isDark ? '#e2e8f0' : '#111',
          lineHeight: 1.2,
        }}
      />
      {error && (
        <span style={{ position: 'absolute', left: 16, bottom: -18, fontSize: 11, color: '#ef4444', fontWeight: 500 }}>
          {error.message}
        </span>
      )}
    </div>
  );
}

function Checkbox({ label, checked, onChange, onBlur, error, isDark }) {
  const id = 'terms-chk';
  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 7 }}>
        <input type="checkbox" id={id} checked={checked} onChange={onChange} onBlur={onBlur}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            border: `1.5px solid ${error ? '#ef4444' : (isDark ? 'rgba(148,163,184,0.3)' : '#d1d5db')}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDark ? '#111827' : '#fff',
          }}
        >
          {checked && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="#0b6343" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span style={{ fontSize: 12, color: error ? '#ef4444' : (isDark ? '#94a3b8' : '#6b7280') }}>{label}</span>
      </label>
      {error && (
        <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 500, marginLeft: 23 }}>{error.message}</span>
      )}
    </div>
  );
}

export default function SignupPage() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  // serverError: { kind: 'email_taken' | 'server' | 'validation' }
  const [serverError, setServerError] = useState(null);

  const form = useForm({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  });

  const onSubmit = async (data) => {
    if (submitting) return;
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.fullName.trim(),
          email: data.email.trim(),
          password: data.password,
        }),
      });

      if (res.ok) {
        const user = await res.json();
        setStoredUser(user);
        navigate('/dashboard');
        return;
      }

      let detail = null;
      try {
        const body = await res.json();
        detail = body?.detail;
      } catch {
        // ignore
      }

      if (res.status === 409 && detail === 'email_taken') {
        setServerError({ kind: 'email_taken' });
      } else if (res.status === 422) {
        setServerError({ kind: 'validation' });
      } else {
        setServerError({ kind: 'server' });
      }
    } catch {
      setServerError({ kind: 'server' });
    } finally {
      setSubmitting(false);
    }
  };

  const clearServerError = () => {
    if (serverError) setServerError(null);
  };

  return (
    <Layout hideAccount>
      <style>{`
        .fade-up { opacity: 0; transform: translateY(18px); animation: fadeUp 0.6s ease forwards; }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        .delay-1 { animation-delay: 0.1s; }
      `}</style>

      <div style={{ minHeight: 'calc(100vh - 72px - 100px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div
          className="fade-up"
          style={{
            background: isDark ? '#1e293b' : '#fff',
            borderRadius: 24,
            boxShadow: isDark
              ? '0 8px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(148,163,184,0.1)'
              : '0 8px 48px rgba(11,99,67,0.10), 0 2px 12px rgba(0,0,0,0.06)',
            width: '100%',
            maxWidth: 480,
            padding: '48px 40px',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -42,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 84,
              height: 84,
              borderRadius: '50%',
              background: isDark ? '#1e293b' : '#fff',
              boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4), 0 0 0 4px #1e293b' : '0 4px 24px rgba(11,99,67,0.18), 0 0 0 4px #fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <img src={logoImg} alt="Insight" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          <BackButton onClick={() => navigate('/')} />
          <h2
            className="fade-up delay-1"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 28,
              color: isDark ? '#f1f5f9' : '#111827',
              textAlign: 'center',
              marginBottom: 32,
              marginTop: 8,
            }}
          >
            {t('createAccount')}
          </h2>

          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FloatingInput
              id="fullName"
              type="text"
              label={t('fullNameLabel')}
              value={form.watch('fullName')}
              onChange={(e) => { form.setValue('fullName', e.target.value, { shouldValidate: true }); clearServerError(); }}
              onBlur={() => form.trigger('fullName')}
              error={form.formState.errors.fullName}
              isDark={isDark}
            />
            <FloatingInput
              id="email"
              type="email"
              label={t('emailAddress')}
              value={form.watch('email')}
              onChange={(e) => { form.setValue('email', e.target.value, { shouldValidate: true }); clearServerError(); }}
              onBlur={() => form.trigger('email')}
              error={form.formState.errors.email}
              isDark={isDark}
            />
            <FloatingInput
              id="password"
              type="password"
              label={t('password')}
              value={form.watch('password')}
              onChange={(e) => { form.setValue('password', e.target.value, { shouldValidate: true }); clearServerError(); }}
              onBlur={() => form.trigger('password')}
              error={form.formState.errors.password}
              isDark={isDark}
            />
            <FloatingInput
              id="confirmPassword"
              type="password"
              label={t('confirmPassword')}
              value={form.watch('confirmPassword')}
              onChange={(e) => { form.setValue('confirmPassword', e.target.value, { shouldValidate: true }); clearServerError(); }}
              onBlur={() => form.trigger('confirmPassword')}
              error={form.formState.errors.confirmPassword}
              isDark={isDark}
            />
            <Checkbox
              label={t('termsAgreement')}
              checked={form.watch('terms')}
              onChange={(e) => { form.setValue('terms', e.target.checked, { shouldValidate: true }); clearServerError(); }}
              onBlur={() => form.trigger('terms')}
              error={form.formState.errors.terms}
              isDark={isDark}
            />

            {serverError && (
              <div
                role="alert"
                style={{
                  marginBottom: 16,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#ef4444',
                  fontSize: 13,
                  lineHeight: 1.5,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                {serverError.kind === 'email_taken' && (
                  <>
                    <span>{t('signupErrorEmailTaken')}</span>
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#ef4444', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}
                    >
                      {t('signupErrorEmailTakenCta')}
                    </button>
                  </>
                )}
                {serverError.kind === 'validation' && <span>{t('signupErrorValidation')}</span>}
                {serverError.kind === 'server' && <span>{t('signupErrorServer')}</span>}
              </div>
            )}

            <PrimaryButton type="submit" disabled={!form.formState.isValid || submitting}>
              {submitting ? t('submitting') : t('createAccount')}
            </PrimaryButton>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: isDark ? '#94a3b8' : '#6b7280' }}>
            {t('alreadyHaveAccount')}{' '}
            <Link
              to="/"
              style={{ color: '#10b981', fontWeight: 600, textDecoration: 'none' }}
              onMouseEnter={(e) => { e.target.style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { e.target.style.textDecoration = 'none'; }}
            >
              {t('signIn')}
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
