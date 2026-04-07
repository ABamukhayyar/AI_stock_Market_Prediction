import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast, { Toaster } from 'react-hot-toast';
import Layout, { useTheme } from '../components/Layout';
import { BackButton, PrimaryButton } from '../components/buttons';
import logoImg from '../insight-logo.png';
import { useLanguage } from '../LanguageContext';

const requestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const resetSchema = z
  .object({
    otp: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must contain only digits'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

function InputField({ id, type, label, value, onChange, onBlur, error, maxLength, isDark }) {
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
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        maxLength={maxLength}
        style={{
          width: '100%',
          padding: active ? '24px 16px 8px' : '14px 16px',
          borderRadius: 12,
          border: `1.5px solid ${error ? '#ef4444' : focused ? '#10b981' : (isDark ? 'rgba(148,163,184,0.2)' : '#e5e7eb')}`,
          outline: 'none',
          fontSize: 15,
          background: focused ? (isDark ? '#1e293b' : '#fff') : (isDark ? '#111827' : '#f9fafb'),
          transition: 'all 0.2s ease',
          boxShadow: error
            ? '0 0 0 3px rgba(239,68,68,0.08)'
            : focused
              ? isDark ? '0 0 0 3px rgba(16,185,129,0.15)' : '0 0 0 3px rgba(11,99,67,0.08)'
              : 'none',
          color: isDark ? '#e2e8f0' : '#111',
          lineHeight: 1.2,
        }}
      />
      {error && (
        <span
          style={{
            position: 'absolute',
            left: 16,
            bottom: -18,
            fontSize: 11,
            color: '#ef4444',
            fontWeight: 500,
          }}
        >
          {error.message}
        </span>
      )}
    </div>
  );
}

export default function ForgotPassword() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const requestForm = useForm({
    resolver: zodResolver(requestSchema),
    mode: 'onChange',
    defaultValues: { email: '' },
  });

  const resetForm = useForm({
    resolver: zodResolver(resetSchema),
    mode: 'onChange',
    defaultValues: { otp: '', password: '', confirmPassword: '' },
  });

  const onRequestCode = (data) => {
    setEmail(data.email);
    toast.success(`Reset code sent to ${data.email}`);
    setStep(2);
  };

  const onResetPassword = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success('Password reset successfully');
      setTimeout(() => navigate('/'), 500);
    }, 1000);
  };

  const goBack = () => {
    if (step === 1) {
      navigate('/');
      return;
    }
    setStep(1);
  };

  return (
    <Layout hideAccount>
      <Toaster position="top-center" />
      <style>{`
        .fade-up {
          opacity: 0;
          transform: translateY(18px);
          animation: fadeUp 0.6s ease forwards;
        }
        @keyframes fadeUp {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          minHeight: 'calc(100vh - 72px - 100px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <div
          className="fade-up"
          style={{
            background: isDark ? '#1e293b' : '#fff',
            borderRadius: 24,
            boxShadow: isDark
              ? '0 8px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(148,163,184,0.1)'
              : '0 8px 48px rgba(11,99,67,0.10), 0 2px 12px rgba(0,0,0,0.06)',
            width: '100%',
            maxWidth: 500,
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

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            {[1, 2].map((currentStep) => (
              <div
                key={currentStep}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: currentStep === step ? '#10b981' : (isDark ? '#334155' : '#d1d5db'),
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>

          <BackButton onClick={goBack} />

          <h2
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 28,
              color: isDark ? '#f1f5f9' : '#111827',
              textAlign: 'center',
              marginBottom: 10,
              marginTop: 8,
            }}
          >
            {step === 1 ? t('forgotPassword') : t('resetPasswordTitle')}
          </h2>

          <p style={{ textAlign: 'center', fontSize: 13, color: isDark ? '#94a3b8' : '#6b7280', marginBottom: 28 }}>
            {step === 1 ? t('forgotPasswordIntro') : t('verifyCodeSentTo', { value: email })}
          </p>

          {step === 1 ? (
            <form onSubmit={requestForm.handleSubmit(onRequestCode)} noValidate>
              <InputField
                id="email"
                type="email"
                label={t('emailAddress')}
                value={requestForm.watch('email')}
                onChange={(e) => requestForm.setValue('email', e.target.value, { shouldValidate: true })}
                onBlur={() => requestForm.trigger('email')}
                error={requestForm.formState.errors.email}
                isDark={isDark}
              />
              <PrimaryButton type="submit" disabled={!requestForm.formState.isValid}>
                {t('sendResetCode')}
              </PrimaryButton>
            </form>
          ) : (
            <form onSubmit={resetForm.handleSubmit(onResetPassword)} noValidate>
              <InputField
                id="otp"
                type="text"
                label={t('resetCode')}
                maxLength={6}
                value={resetForm.watch('otp')}
                onChange={(e) => resetForm.setValue('otp', e.target.value.replace(/\D/g, ''), { shouldValidate: true })}
                onBlur={() => resetForm.trigger('otp')}
                error={resetForm.formState.errors.otp}
                isDark={isDark}
              />
              <InputField
                id="password"
                type="password"
                label={t('newPassword')}
                value={resetForm.watch('password')}
                onChange={(e) => resetForm.setValue('password', e.target.value, { shouldValidate: true })}
                onBlur={() => resetForm.trigger('password')}
                error={resetForm.formState.errors.password}
                isDark={isDark}
              />
              <InputField
                id="confirmPassword"
                type="password"
                label={t('confirmPassword')}
                value={resetForm.watch('confirmPassword')}
                onChange={(e) => resetForm.setValue('confirmPassword', e.target.value, { shouldValidate: true })}
                onBlur={() => resetForm.trigger('confirmPassword')}
                error={resetForm.formState.errors.confirmPassword}
                isDark={isDark}
              />
              <PrimaryButton type="submit" disabled={!resetForm.formState.isValid || loading}>
                {loading ? t('resetting') : t('resetPasswordTitle')}
              </PrimaryButton>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: isDark ? '#94a3b8' : '#6b7280' }}>
            {t('rememberedPassword')}{' '}
            <Link to="/" style={{ color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>
              {t('signIn')}
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
