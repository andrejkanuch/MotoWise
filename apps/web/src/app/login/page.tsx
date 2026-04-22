'use client';

import { createBrowserClient } from '@supabase/ssr';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { identifyUser, trackEvent, WebEvent } from '@/lib/analytics';

/* ------------------------------------------------------------------ */
/*  CSS variable tokens (from marketing design-system.css / login.html) */
/* ------------------------------------------------------------------ */
const t = {
  bg: 'oklch(0.12 0.01 55)',
  bg2: 'oklch(0.09 0.008 55)',
  ink: 'oklch(0.98 0.006 80)',
  ink2: 'oklch(0.78 0.012 70)',
  ink3: 'oklch(0.58 0.012 65)',
  ink4: 'oklch(0.4 0.012 60)',
  line: 'oklch(1 0 0 / 0.07)',
  warm500: 'oklch(0.76 0.18 60)',
  warm400: 'oklch(0.84 0.15 68)',
  warm300: 'oklch(0.9 0.11 72)',
  warm900: 'oklch(0.32 0.1 55)',
};

export default function LoginPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      ),
    [],
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    trackEvent(WebEvent.SIGN_IN_SUBMITTED, { method: 'email' });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      trackEvent(WebEvent.SIGN_IN_ERROR, { method: 'email', error_message: error.message });
    } else {
      if (data.user) {
        identifyUser(data.user.id);
      }
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get('redirect') || '/feed';
      window.location.href = redirectTo;
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading('google');
    trackEvent(WebEvent.SIGN_IN_OAUTH_CLICKED, { provider: 'google' });
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(new URLSearchParams(window.location.search).get('redirect') || '/feed')}`,
      },
    });
  };

  const handleAppleSignIn = async () => {
    setOauthLoading('apple');
    trackEvent(WebEvent.SIGN_IN_OAUTH_CLICKED, { provider: 'apple' });
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(new URLSearchParams(window.location.search).get('redirect') || '/feed')}`,
      },
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500&display=swap');
        @keyframes bgBreath {
          0%   { transform: scale(1.05) translateY(0); }
          100% { transform: scale(1.12) translateY(-1.5%); }
        }
        .auth-submit-btn::before {
          content: "";
          position: absolute; inset: 0;
          background: ${t.warm500};
          transform: translateY(100%);
          transition: transform .4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .auth-submit-btn:hover::before { transform: translateY(0); }
        .auth-submit-btn:hover { transform: translateY(-1px); }
        .auth-submit-btn:active { transform: translateY(0); }
        .auth-sso-btn:hover {
          background: oklch(1 0 0 / 0.07) !important;
          border-color: oklch(1 0 0 / 0.16) !important;
          transform: translateY(-1px);
        }
        .auth-input-field:hover { border-color: oklch(1 0 0 / 0.13) !important; }
        .auth-input-field:focus {
          border-color: ${t.warm500} !important;
          background: oklch(1 0 0 / 0.04) !important;
          box-shadow: 0 0 0 4px oklch(0.76 0.18 60 / 0.1) !important;
        }
        .auth-input-field::placeholder { color: ${t.ink4}; }
        .auth-back-link:hover { color: ${t.warm400}; transform: translateX(-3px); }
        .auth-back-link:hover svg { transform: translateX(-3px); }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          gridTemplateColumns: '1.05fr 1fr',
          fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
          background: t.bg,
          color: t.ink,
        }}
      >
        {/* ======== LEFT VISUAL ======== */}
        <aside
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'hidden',
            isolation: 'isolate',
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Background image */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: -3,
              backgroundImage: "url('/images/marketing/hero-bg.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: 'scale(1.05)',
              animation: 'bgBreath 20s ease-in-out infinite alternate',
              filter: 'saturate(0.85) contrast(1.05) brightness(0.55)',
            }}
          />
          {/* Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: -2,
              background: `radial-gradient(ellipse 60% 50% at 30% 30%, oklch(0.76 0.18 60 / 0.22), transparent 60%), linear-gradient(180deg, oklch(0.09 0.008 55 / 0.5) 0%, oklch(0.09 0.008 55 / 0.85) 100%)`,
            }}
          />
          {/* Grid pattern */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: -1,
              backgroundImage:
                'linear-gradient(to right, oklch(1 0 0 / 0.03) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 0.03) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
              maskImage: 'radial-gradient(ellipse 80% 100% at 50% 50%, #000, transparent 80%)',
              pointerEvents: 'none',
            }}
          />

          {/* Top: brand + back */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: t.ink,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 17,
                letterSpacing: '-0.02em',
              }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 9, overflow: 'hidden' }}>
                <Image
                  src="/images/marketing/MotoVault.png"
                  alt="MotoVault"
                  width={32}
                  height={32}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </span>
              MotoVault
            </a>
            <a
              href="/"
              className="auth-back-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                color: t.ink2,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '-0.005em',
                transition: 'color .2s, transform .2s',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: 'transform .3s' }}
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back to home
            </a>
          </div>

          {/* Quote */}
          <div style={{ maxWidth: 520, zIndex: 1 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 14,
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: t.ink3,
                letterSpacing: '0.2em',
                textTransform: 'uppercase' as const,
                marginBottom: 28,
              }}
            >
              <span style={{ width: 28, height: 1, background: t.warm500 }} />
              From the riders
            </div>
            <p
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: 'italic',
                fontSize: 'clamp(32px, 4vw, 52px)',
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
                color: t.ink,
                margin: 0,
              }}
            >
              &ldquo;MotoVault is the first app that{' '}
              <span style={{ color: t.warm300 }}>actually understands</span> what it&rsquo;s like to
              plan a long ride. Three months in, my garage stays cleaner than ever.&rdquo;
            </p>
            <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, oklch(0.55 0.15 30), oklch(0.65 0.18 60))',
                  border: '1px solid oklch(1 0 0 / 0.2)',
                  display: 'grid',
                  placeItems: 'center',
                  color: t.ink,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                JS
              </div>
              <div style={{ fontSize: 13 }}>
                <strong
                  style={{
                    display: 'block',
                    color: t.ink,
                    fontWeight: 500,
                    letterSpacing: '-0.005em',
                  }}
                >
                  Jordan Sato
                </strong>
                <span
                  style={{
                    color: t.ink3,
                    fontSize: 11.5,
                    marginTop: 2,
                    display: 'block',
                    letterSpacing: '-0.005em',
                  }}
                >
                  Triumph Bonneville T120 &middot; 12,400 km tracked
                </span>
              </div>
            </div>

            {/* Stats strip */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                borderTop: `1px solid ${t.line}`,
                paddingTop: 22,
                marginTop: 28,
              }}
            >
              {[
                { label: 'Riders', val: '42', suffix: 'k+' },
                { label: 'Routes', val: '11', suffix: 'k' },
                { label: 'App Store', val: '4.8', suffix: '\u2605' },
              ].map((s, i) => (
                <div
                  key={s.label}
                  style={{
                    flex: 1,
                    borderRight: i < 2 ? `1px solid ${t.line}` : 'none',
                    paddingRight: i < 2 ? 20 : 0,
                    paddingLeft: i > 0 ? 20 : 0,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 9.5,
                      color: t.ink3,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 22,
                      fontWeight: 500,
                      letterSpacing: '-0.025em',
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {s.val}
                    <span
                      style={{
                        color: t.warm400,
                        fontFamily: "'Instrument Serif', serif",
                        fontStyle: 'italic',
                        fontSize: 20,
                      }}
                    >
                      {s.suffix}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ======== RIGHT FORM ======== */}
        <main
          style={{
            background: t.bg,
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Dot grid */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(circle at 1px 1px, oklch(1 0 0 / 0.04) 1px, transparent 0)',
              backgroundSize: '32px 32px',
              maskImage: 'radial-gradient(ellipse 80% 80% at 50% 30%, #000, transparent 80%)',
              pointerEvents: 'none',
            }}
          />

          {/* Top link */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 14,
              zIndex: 1,
            }}
          >
            <div style={{ color: t.ink3, fontSize: 13, letterSpacing: '-0.005em' }}>
              No account yet?
              <Link
                href="/signup"
                style={{
                  color: t.ink,
                  fontWeight: 500,
                  textDecoration: 'none',
                  marginLeft: 6,
                  borderBottom: `1px solid ${t.warm500}`,
                  paddingBottom: 1,
                  transition: 'color .2s',
                }}
              >
                Create one &rarr;
              </Link>
            </div>
          </div>

          {/* Form wrapper */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '40px 0',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <form
              onSubmit={handleLogin}
              autoComplete="on"
              noValidate
              style={{ width: '100%', maxWidth: 400 }}
            >
              {/* Meta label */}
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 11,
                  color: t.warm400,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase' as const,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <span style={{ width: 24, height: 1, background: t.warm500 }} />
                Sign in
              </div>
              {/* Title */}
              <h1
                style={{
                  margin: '18px 0 0',
                  fontSize: 'clamp(36px, 4vw, 52px)',
                  fontWeight: 500,
                  lineHeight: 0.98,
                  letterSpacing: '-0.035em',
                }}
              >
                Welcome{' '}
                <span
                  style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontStyle: 'italic',
                    color: t.warm300,
                    fontWeight: 400,
                    letterSpacing: '-0.03em',
                  }}
                >
                  back.
                </span>
              </h1>
              {/* Subtitle */}
              <p
                style={{
                  marginTop: 14,
                  color: t.ink3,
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  maxWidth: 380,
                  letterSpacing: '-0.005em',
                }}
              >
                Pick up where you left off — your garage, routes and history sync across all
                devices.
              </p>

              {/* Error */}
              {error && (
                <p
                  role="alert"
                  style={{
                    marginTop: 16,
                    fontSize: 13,
                    color: '#ef4444',
                    padding: '10px 14px',
                    background: 'oklch(0.25 0.08 25 / 0.3)',
                    borderRadius: 10,
                    border: '1px solid oklch(0.5 0.15 25 / 0.3)',
                  }}
                >
                  {error}
                </p>
              )}

              {/* SSO buttons */}
              <div
                style={{
                  marginTop: 36,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={oauthLoading !== null}
                  className="auth-sso-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: 13,
                    background: 'oklch(1 0 0 / 0.03)',
                    border: `1px solid ${t.line}`,
                    color: t.ink,
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    fontWeight: 500,
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'all .2s',
                    letterSpacing: '-0.005em',
                    opacity: oauthLoading !== null ? 0.5 : 1,
                  }}
                >
                  {oauthLoading === 'google' ? <Spinner /> : <GoogleIcon />}
                  {oauthLoading === 'google' ? 'Redirecting...' : 'Google'}
                </button>
                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  disabled={oauthLoading !== null}
                  className="auth-sso-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: 13,
                    background: 'oklch(1 0 0 / 0.03)',
                    border: `1px solid ${t.line}`,
                    color: t.ink,
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    fontWeight: 500,
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'all .2s',
                    letterSpacing: '-0.005em',
                    opacity: oauthLoading !== null ? 0.5 : 1,
                  }}
                >
                  {oauthLoading === 'apple' ? <Spinner /> : <AppleIcon />}
                  {oauthLoading === 'apple' ? 'Redirecting...' : 'Apple'}
                </button>
              </div>

              {/* Divider */}
              <div
                style={{
                  margin: '24px 0',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div style={{ height: 1, background: t.line }} />
                <span
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 10.5,
                    color: t.ink4,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  or with email
                </span>
                <div style={{ height: 1, background: t.line }} />
              </div>

              {/* Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Email */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <label
                    htmlFor="login-email"
                    style={{
                      fontSize: 12,
                      color: t.ink3,
                      letterSpacing: '-0.005em',
                    }}
                  >
                    Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      maxLength={255}
                      required
                      className="auth-input-field"
                      style={{
                        width: '100%',
                        background: 'oklch(1 0 0 / 0.025)',
                        border: `1px solid ${t.line}`,
                        borderRadius: 11,
                        padding: '13px 14px 13px 42px',
                        color: t.ink,
                        fontFamily: 'inherit',
                        fontSize: 14,
                        letterSpacing: '-0.005em',
                        transition: 'border-color .2s, background .2s, box-shadow .2s',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: t.ink3,
                        pointerEvents: 'none',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Password */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <label
                    htmlFor="login-password"
                    style={{
                      fontSize: 12,
                      color: t.ink3,
                      letterSpacing: '-0.005em',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    Password
                    <Link
                      href="/forgot-password"
                      style={{
                        color: t.ink3,
                        textDecoration: 'none',
                        fontSize: 11.5,
                        transition: 'color .2s',
                      }}
                    >
                      Forgot?
                    </Link>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                      autoComplete="current-password"
                      maxLength={128}
                      required
                      className="auth-input-field"
                      style={{
                        width: '100%',
                        background: 'oklch(1 0 0 / 0.025)',
                        border: `1px solid ${t.line}`,
                        borderRadius: 11,
                        padding: '13px 44px 13px 42px',
                        color: t.ink,
                        fontFamily: 'inherit',
                        fontSize: 14,
                        letterSpacing: '-0.005em',
                        transition: 'border-color .2s, background .2s, box-shadow .2s',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: t.ink3,
                        pointerEvents: 'none',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: t.ink3,
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 4,
                        transition: 'color .2s',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="auth-submit-btn"
                style={{
                  marginTop: 22,
                  width: '100%',
                  padding: 14,
                  border: 'none',
                  borderRadius: 11,
                  background: t.ink,
                  color: 'oklch(0.15 0.02 55)',
                  fontFamily: 'inherit',
                  fontSize: 14.5,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  letterSpacing: '-0.005em',
                  transition: 'background .2s, transform .2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  position: 'relative',
                  overflow: 'hidden',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <span style={{ position: 'relative', zIndex: 1 }}>
                  {loading ? 'One moment\u2026' : 'Sign in'}
                </span>
                {!loading && (
                  <svg
                    style={{ position: 'relative', zIndex: 1 }}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                )}
              </button>

              {/* Footer */}
              <div
                style={{
                  marginTop: 28,
                  textAlign: 'center' as const,
                  fontSize: 12.5,
                  color: t.ink4,
                  letterSpacing: '-0.005em',
                  lineHeight: 1.5,
                }}
              >
                By continuing you confirm you&rsquo;ve read and accepted our{' '}
                <a
                  href="/terms"
                  style={{
                    color: t.ink3,
                    textDecoration: 'none',
                    borderBottom: `1px solid ${t.line}`,
                    paddingBottom: 1,
                  }}
                >
                  Terms
                </a>{' '}
                &amp;{' '}
                <a
                  href="/privacy"
                  style={{
                    color: t.ink3,
                    textDecoration: 'none',
                    borderBottom: `1px solid ${t.line}`,
                    paddingBottom: 1,
                  }}
                >
                  Privacy Policy
                </a>
                .
              </div>
            </form>
          </div>

          {/* Right footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: t.ink4,
              fontSize: 11,
              fontFamily: "'Geist Mono', monospace",
              letterSpacing: '0.05em',
              zIndex: 1,
            }}
          >
            <span>&copy; 2026 MotoVault</span>
            <a href="mailto:hello@motovault.app" style={{ color: t.ink4, textDecoration: 'none' }}>
              hello@motovault.app
            </a>
          </div>
        </main>
      </div>

      {/* Mobile responsive override */}
      <style>{`
        @media (max-width: 900px) {
          .auth-grid-root {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
          }
        }
      `}</style>
    </>
  );
}

function Spinner() {
  return (
    <svg
      style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34a853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#fbbc05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#ea4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 12.5c0-2.4 2-3.6 2-3.6-1.1-1.6-2.8-1.8-3.4-1.9-1.4-.1-2.8.8-3.5.8-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 2.9 2.4 1.2 0 1.6-.8 3-.8s1.8.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.5-3.8zM15.3 5.5c.6-.8 1.1-1.9.9-3-1 0-2.2.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.3-.6 2.9-1.4z" />
    </svg>
  );
}
