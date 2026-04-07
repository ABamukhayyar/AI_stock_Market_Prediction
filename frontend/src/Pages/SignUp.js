import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast, { Toaster } from 'react-hot-toast';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import Layout, { useTheme } from '../components/Layout';
import { BackButton, PrimaryButton } from '../components/buttons';
import logoImg from '../insight-logo.png';
import { useLanguage } from '../LanguageContext';
import { createDemoUser, setStoredUser } from '../utils/auth';

const step1Schema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm password is required'),
    terms: z.boolean().refine((value) => value === true, 'You must accept the terms and conditions'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

const step2Schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(/^\+\d{1,3}\d{7,15}$/, 'Please enter a valid phone number with digits'),
  verifyMethod: z.enum(['email', 'phone'], { required_error: 'Select a verification method' }),
});

const step3Schema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only digits'),
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
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={{
          width: '100%',
          padding: active ? '24px 48px 8px 16px' : '14px 48px 14px 16px',
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

function OtpInput({ value, onChange, onBlur, error, isDark, label }) {
  const [focused, setFocused] = useState(false);
  const active = focused || (value && value.length > 0);

  return (
    <div style={{ position: 'relative', marginBottom: 24 }}>
      <label
        htmlFor="otp"
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
        id="otp"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        maxLength={6}
        placeholder="123456"
        style={{
          width: '100%',
          padding: active ? '24px 48px 8px 16px' : '14px 48px 14px 16px',
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
          letterSpacing: '0.2em',
          textAlign: 'center',
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

function Checkbox({ label, checked, onChange, onBlur, error, isDark }) {
  const id = `chk-${label.replace(/\s+/g, '-')}`;

  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 7 }}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          onBlur={onBlur}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
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
            transition: 'background 0.15s',
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
        <span
          style={{
            fontSize: 11,
            color: '#ef4444',
            fontWeight: 500,
            marginLeft: 23,
          }}
        >
          {error.message}
        </span>
      )}
    </div>
  );
}

export default function SignupPage() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    confirmPassword: '',
    terms: false,
    email: '',
    phone: '',
    verifyMethod: 'email',
    otp: '',
  });

  const step1Form = useForm({
    resolver: zodResolver(step1Schema),
    mode: 'onChange',
    defaultValues: {
      fullName: formData.fullName,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      terms: formData.terms,
    },
  });

  const step2Form = useForm({
    resolver: zodResolver(step2Schema),
    mode: 'onChange',
    defaultValues: {
      email: formData.email,
      phone: formData.phone,
      verifyMethod: formData.verifyMethod,
    },
  });

  const step3Form = useForm({
    resolver: zodResolver(step3Schema),
    mode: 'onChange',
    defaultValues: { otp: formData.otp },
  });

  const onStep1Submit = (data) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep(2);
  };

  const onStep2Submit = (data) => {
    setFormData((prev) => ({ ...prev, ...data }));
    toast.success(`Verification code sent to ${data.verifyMethod === 'email' ? data.email : data.phone}`);
    setStep(3);
  };

  const onStep3Submit = (data) => {
    setFormData((prev) => ({ ...prev, otp: data.otp }));
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success('OTP verified!');
      setTimeout(() => {
        toast.success('Account created successfully!');
        setStoredUser(
          createDemoUser({
            fullName: formData.fullName || 'Ahmed Al-Rashidi',
            email: formData.email || 'ahmed@example.com',
          })
        );
        navigate('/dashboard');
      }, 500);
    }, 1000);
  };

  const goBack = () => {
    if (step === 1) {
      navigate('/');
      return;
    }
    setStep((prev) => prev - 1);
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
        .delay-1 { animation-delay: 0.1s; }
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

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            {[1, 2, 3].map((currentStep) => (
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

          {step === 1 && (
            <>
              <BackButton onClick={goBack} />
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
              <form onSubmit={step1Form.handleSubmit(onStep1Submit)} noValidate>
                <FloatingInput
                  id="fullName"
                  type="text"
                  label={t('fullNameLabel')}
                  value={step1Form.watch('fullName')}
                  onChange={(e) => step1Form.setValue('fullName', e.target.value, { shouldValidate: true })}
                  onBlur={() => step1Form.trigger('fullName')}
                  error={step1Form.formState.errors.fullName}
                  isDark={isDark}
                />
                <FloatingInput
                  id="password"
                  type="password"
                  label={t('password')}
                  value={step1Form.watch('password')}
                  onChange={(e) => step1Form.setValue('password', e.target.value, { shouldValidate: true })}
                  onBlur={() => step1Form.trigger('password')}
                  error={step1Form.formState.errors.password}
                  isDark={isDark}
                />
                <FloatingInput
                  id="confirmPassword"
                  type="password"
                  label={t('confirmPassword')}
                  value={step1Form.watch('confirmPassword')}
                  onChange={(e) => step1Form.setValue('confirmPassword', e.target.value, { shouldValidate: true })}
                  onBlur={() => step1Form.trigger('confirmPassword')}
                  error={step1Form.formState.errors.confirmPassword}
                  isDark={isDark}
                />
                <Checkbox
                  label={t('termsAgreement')}
                  checked={step1Form.watch('terms')}
                  onChange={(e) => step1Form.setValue('terms', e.target.checked, { shouldValidate: true })}
                  onBlur={() => step1Form.trigger('terms')}
                  error={step1Form.formState.errors.terms}
                  isDark={isDark}
                />
                <PrimaryButton type="submit" disabled={!step1Form.formState.isValid}>
                  {t('continueLabel')}
                </PrimaryButton>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <BackButton onClick={goBack} />
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
                {t('contactInformation')}
              </h2>
              <form onSubmit={step2Form.handleSubmit(onStep2Submit)} noValidate>
                <FloatingInput
                  id="email"
                  type="email"
                  label={t('emailAddress')}
                  value={step2Form.watch('email')}
                  onChange={(e) => step2Form.setValue('email', e.target.value, { shouldValidate: true })}
                  onBlur={() => step2Form.trigger('email')}
                  error={step2Form.formState.errors.email}
                  isDark={isDark}
                />

                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6b7280', display: 'block', marginBottom: 8 }}>{t('phone')}</span>
                  <PhoneInput
                    international
                    defaultCountry="SA"
                    value={step2Form.watch('phone')}
                    onChange={(value) => step2Form.setValue('phone', value || '', { shouldValidate: true })}
                    onBlur={() => step2Form.trigger('phone')}
                    style={{
                      width: '100%',
                      paddingLeft: 16,
                      paddingTop: 10,
                      paddingBottom: 10,
                      borderRadius: 12,
                      border: `1.5px solid ${
                        step2Form.formState.errors.phone
                          ? '#ef4444'
                          : step2Form.formState.touchedFields.phone
                            ? '#0b6343'
                            : '#e5e7eb'
                      }`,
                    }}
                  />
                  {step2Form.formState.errors.phone && (
                    <span style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'block' }}>
                      {step2Form.formState.errors.phone.message}
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6b7280', display: 'block', marginBottom: 8 }}>{t('verifyVia')}:</span>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        value="email"
                        checked={step2Form.watch('verifyMethod') === 'email'}
                        onChange={() => step2Form.setValue('verifyMethod', 'email', { shouldValidate: true })}
                      />
                      <span style={{ fontSize: 13, color: isDark ? '#e2e8f0' : '#374151' }}>{t('email')}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        value="phone"
                        checked={step2Form.watch('verifyMethod') === 'phone'}
                        onChange={() => step2Form.setValue('verifyMethod', 'phone', { shouldValidate: true })}
                      />
                      <span style={{ fontSize: 13, color: isDark ? '#e2e8f0' : '#374151' }}>{t('phone')}</span>
                    </label>
                  </div>
                  {step2Form.formState.errors.verifyMethod && (
                    <span style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'block' }}>
                      {step2Form.formState.errors.verifyMethod.message}
                    </span>
                  )}
                </div>

                <PrimaryButton type="submit" disabled={!step2Form.formState.isValid}>
                  {t('sendCode')}
                </PrimaryButton>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <BackButton onClick={goBack} />
              <h2
                className="fade-up delay-1"
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: 28,
                  color: isDark ? '#f1f5f9' : '#111827',
                  textAlign: 'center',
                  marginBottom: 8,
                  marginTop: 8,
                }}
              >
                {t('verifyYourIdentity')}
              </h2>
              <p style={{ textAlign: 'center', fontSize: 13, color: isDark ? '#94a3b8' : '#6b7280', marginBottom: 32 }}>
                {t('verifyCodeSentTo', { value: formData.verifyMethod === 'email' ? formData.email : formData.phone })}
              </p>
              <form onSubmit={step3Form.handleSubmit(onStep3Submit)} noValidate>
                <OtpInput
                  value={step3Form.watch('otp')}
                  onChange={(e) => step3Form.setValue('otp', e.target.value.replace(/\D/g, ''), { shouldValidate: true })}
                  onBlur={() => step3Form.trigger('otp')}
                  error={step3Form.formState.errors.otp}
                  isDark={isDark}
                  label={t('verificationCode')}
                />
                <PrimaryButton type="submit" disabled={!step3Form.formState.isValid || loading}>
                  {loading ? t('verifying') : t('verifyCode')}
                </PrimaryButton>
              </form>
              <p style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => {
                    toast.success('New code sent!');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0b6343',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {t('resendCode')}
                </button>
              </p>
            </>
          )}

          <p
            style={{
              textAlign: 'center',
              marginTop: 24,
              fontSize: 13,
              color: isDark ? '#94a3b8' : '#6b7280',
            }}
          >
            {t('alreadyHaveAccount')}{' '}
            <Link
              to="/"
              style={{
                color: '#10b981',
                fontWeight: 600,
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                e.target.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.target.style.textDecoration = 'none';
              }}
            >
              {t('signIn')}
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
