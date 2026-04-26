'use client';

import { useTranslations } from 'next-intl';
import posthog from 'posthog-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Consent primitives (cookie read/write, PostHog opt-in/out, geo detection)
// ---------------------------------------------------------------------------

const CONSENT_COOKIE = 'mv_consent';
const COOKIE_MAX_AGE = 15_552_000; // 6 months in seconds

type Decision = 'accepted' | 'rejected';

function parseConsent(): Decision | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  if (!match) return null;
  const parts = decodeURIComponent(match[1]).split(':');
  if (parts.length < 2 || parts[0] !== 'v1') return null;
  if (parts[1] === 'accepted' || parts[1] === 'rejected') return parts[1];
  return null;
}

function isConsentRequired(): boolean {
  if (typeof document === 'undefined') return true;
  const match = document.cookie.match(/(?:^|; )mv_region=([^;]*)/);
  return !match || match[1] === 'EU';
}

function writeConsent(decision: Decision) {
  const epoch = Math.floor(Date.now() / 1000);
  const value = `v1:${decision}:${epoch}:EU`;
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  // biome-ignore lint/suspicious/noDocumentCookie: this IS the consent primitive itself
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

function applyPostHogConsent(granted: boolean) {
  if (typeof window === 'undefined') return;
  if (granted) {
    posthog.set_config({ persistence: 'localStorage+cookie' });
    posthog.opt_in_capturing();
    posthog.capture('$consent_granted');
  } else {
    posthog.opt_out_capturing();
  }
}

// ---------------------------------------------------------------------------
// Consent context (shared state for banner + analytics gate)
// ---------------------------------------------------------------------------

type ConsentContextValue = {
  consent: boolean | null;
  accept: () => void;
  deny: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<boolean | null>(null);

  useEffect(() => {
    const current = parseConsent();
    if (current !== null) {
      const asBool = current === 'accepted';
      setConsentState(asBool);
      applyPostHogConsent(asBool);
    } else if (!isConsentRequired()) {
      writeConsent('accepted');
      setConsentState(true);
      applyPostHogConsent(true);
    }
  }, []);

  const accept = useCallback(() => {
    writeConsent('accepted');
    setConsentState(true);
    applyPostHogConsent(true);
  }, []);

  const deny = useCallback(() => {
    writeConsent('rejected');
    setConsentState(false);
    applyPostHogConsent(false);
  }, []);

  return (
    <ConsentContext.Provider value={{ consent, accept, deny }}>{children}</ConsentContext.Provider>
  );
}

export function useCookieConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Design tokens (dark theme, matching MotoVault brand)
// ---------------------------------------------------------------------------

const T = {
  bg: 'oklch(0.14 0.012 55)',
  ink: 'oklch(0.98 0.006 80)',
  ink2: 'oklch(0.78 0.012 70)',
  ink3: 'oklch(0.58 0.012 65)',
  warm: 'oklch(0.76 0.18 60)',
  warmHover: 'oklch(0.82 0.16 62)',
  warmDark: 'oklch(0.3 0.1 55)',
  warmLight: 'oklch(0.88 0.12 70)',
  green: 'oklch(0.7 0.18 145)',
  greenTag: 'oklch(0.78 0.18 145)',
  greenTagBg: 'oklch(0.7 0.18 145 / 0.18)',
  border: 'oklch(0.22 0.018 60)',
  borderFaint: 'oklch(1 0 0 / 0.08)',
  whiteA6: 'oklch(1 0 0 / 0.06)',
  whiteA5: 'oklch(1 0 0 / 0.05)',
  whiteA14: 'oklch(1 0 0 / 0.14)',
  whiteA12: 'oklch(1 0 0 / 0.12)',
  whiteA20: 'oklch(1 0 0 / 0.2)',
  shadow: [
    '0 0 0 1px oklch(0.22 0.018 60)',
    '0 30px 60px -20px oklch(0 0 0 / 0.6)',
    '0 60px 120px -40px oklch(0 0 0 / 0.7)',
  ].join(', '),
  font: 'var(--font-sans, system-ui, sans-serif)',
  mono: "'Geist Mono', monospace",
  grain:
    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
} as const;

// ---------------------------------------------------------------------------
// Cookie Banner
// ---------------------------------------------------------------------------

type CookieToggles = { pref: boolean; telemetry: boolean; replay: boolean };

export function CookieConsentBanner() {
  const { consent, accept, deny } = useCookieConsent();
  const t = useTranslations('CookieBanner');
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'main' | 'list' | 'settled'>('main');
  const [settledMsg, setSettledMsg] = useState('');
  const [toggles, setToggles] = useState<CookieToggles>({
    pref: true,
    telemetry: false,
    replay: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const settle = useCallback((msg: string, action: () => void) => {
    action();
    setSettledMsg(msg);
    setView('settled');
  }, []);

  const handleAccept = useCallback(
    () => settle(t('settled.accepted'), accept),
    [settle, t, accept],
  );
  const handleDecline = useCallback(() => settle(t('settled.declined'), deny), [settle, t, deny]);
  const handleSave = useCallback(() => {
    settle(t('settled.saved'), toggles.telemetry ? accept : deny);
  }, [settle, t, toggles.telemetry, accept, deny]);
  const handleAcceptAll = useCallback(() => {
    setToggles({ pref: true, telemetry: true, replay: true });
    settle(t('settled.accepted'), accept);
  }, [settle, t, accept]);

  const handleUndo = useCallback(() => {
    // biome-ignore lint/suspicious/noDocumentCookie: clearing consent cookie
    document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0`;
    setView('main');
    setToggles({ pref: true, telemetry: false, replay: false });
  }, []);

  const toggle = useCallback((key: keyof CookieToggles) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!mounted) return null;
  if (consent !== null && view !== 'settled') return null;

  if (view === 'settled') {
    return <SettledToast message={settledMsg} onUndo={handleUndo} undoLabel={t('settled.undo')} />;
  }

  return (
    <div style={wrapStyle}>
      <div role="dialog" aria-labelledby="cb-title" aria-describedby="cb-body" style={cardStyle}>
        <div aria-hidden="true" style={grainStyle} />
        <div style={{ position: 'relative', zIndex: 2, padding: '24px 26px 26px' }}>
          {view === 'main' ? (
            <MainView
              t={t}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onShowList={() => setView('list')}
            />
          ) : (
            <ListView
              t={t}
              toggles={toggles}
              onToggle={toggle}
              onSave={handleSave}
              onAcceptAll={handleAcceptAll}
              onBack={() => setView('main')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const wrapStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  inset: 'auto 0 0 0',
  padding: 20,
  display: 'flex',
  justifyContent: 'flex-start',
  pointerEvents: 'none',
};

const cardStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  width: '100%',
  maxWidth: 540,
  background: T.bg,
  color: T.ink,
  borderRadius: 22,
  boxShadow: T.shadow,
  fontFamily: T.font,
  overflow: 'hidden',
  position: 'relative',
};

const grainStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 'inherit',
  opacity: 0.04,
  backgroundImage: T.grain,
  pointerEvents: 'none',
};

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 16px',
  borderRadius: 999,
  border: '1px solid transparent',
  fontFamily: 'inherit',
  fontSize: '13.5px',
  fontWeight: 600,
  letterSpacing: '-0.005em',
  cursor: 'pointer',
  transition: 'transform .2s, background .2s, color .2s, border-color .2s, box-shadow .2s',
  whiteSpace: 'nowrap',
  color: T.ink,
};

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

function MainView({
  t,
  onAccept,
  onDecline,
  onShowList,
}: {
  t: ReturnType<typeof useTranslations>;
  onAccept: () => void;
  onDecline: () => void;
  onShowList: () => void;
}) {
  return (
    <>
      <Stamp label={t('stamp')} />

      <h2
        id="cb-title"
        style={{
          margin: '14px 0 0',
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          color: T.ink,
        }}
      >
        {t.rich('title', {
          em: (chunks) => <em style={{ fontStyle: 'italic', color: T.warm }}>{chunks}</em>,
        })}
      </h2>

      <div
        id="cb-body"
        style={{ marginTop: 12, fontSize: '14.5px', lineHeight: 1.55, color: T.ink2 }}
      >
        <p style={{ margin: '0 0 10px' }}>
          {t.rich('body1', {
            strong: (chunks) => <strong style={{ color: T.ink, fontWeight: 600 }}>{chunks}</strong>,
          })}
        </p>
        <p style={{ margin: 0 }}>
          {t.rich('body2', {
            strong: (chunks) => <strong style={{ color: T.ink, fontWeight: 600 }}>{chunks}</strong>,
          })}
        </p>
      </div>

      <div
        style={{ marginTop: 22, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <HoverButton
          base={{
            ...btnBase,
            background: T.warm,
            color: 'oklch(0.15 0.02 55)',
            boxShadow: `0 4px 0 ${T.warmDark}`,
          }}
          hover={{ background: T.warmHover, transform: 'translateY(-1px)' }}
          onClick={onAccept}
        >
          <span>{t('accept')}</span>
          <span aria-hidden="true">→</span>
        </HoverButton>

        <HoverButton
          base={{ ...btnBase, borderColor: T.whiteA14, background: 'transparent' }}
          hover={{ background: T.whiteA5, transform: 'translateY(-1px)' }}
          onClick={onDecline}
        >
          {t('decline')}
        </HoverButton>

        <HoverButton
          base={{
            ...btnBase,
            padding: '11px 8px',
            border: 'none',
            background: 'transparent',
            color: T.ink2,
            textDecoration: 'underline',
            textUnderlineOffset: '4px',
            textDecorationThickness: '1px',
            textDecorationColor: T.whiteA20,
          }}
          hover={{ color: T.ink, transform: 'translateY(-1px)' }}
          onClick={onShowList}
        >
          {t('showList')}
        </HoverButton>
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: `1px solid ${T.borderFaint}`,
          fontSize: '11.5px',
          color: T.ink3,
        }}
      >
        <a
          href="/privacy"
          style={{
            color: T.ink2,
            textDecoration: 'underline',
            textDecorationColor: T.whiteA20,
            textUnderlineOffset: '3px',
          }}
        >
          {t('privacyLink')}
        </a>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------

function ListView({
  t,
  toggles,
  onToggle,
  onSave,
  onAcceptAll,
  onBack,
}: {
  t: ReturnType<typeof useTranslations>;
  toggles: CookieToggles;
  onToggle: (key: keyof CookieToggles) => void;
  onSave: () => void;
  onAcceptAll: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <Stamp label={t('stamp')} />

      <div
        style={{
          marginTop: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 12,
          borderBottom: `1px solid ${T.borderFaint}`,
          fontSize: '12.5px',
          color: T.ink3,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <span>{t('list.whatWeUse')}</span>
        <span style={{ color: T.ink, fontWeight: 600 }}>{t('list.count')}</span>
      </div>

      <CookieRow
        icon="🔒"
        name="mv_session"
        tag={t('list.session.tag')}
        tagRequired
        desc={t('list.session.desc')}
        locked
        on
      />
      <CookieRow
        icon="⚙️"
        name="mv_pref"
        tag={t('list.pref.tag')}
        desc={t('list.pref.desc')}
        on={toggles.pref}
        onToggle={() => onToggle('pref')}
      />
      <CookieRow
        icon="📊"
        name="mv_telemetry"
        tag={t('list.telemetry.tag')}
        desc={t('list.telemetry.desc')}
        on={toggles.telemetry}
        onToggle={() => onToggle('telemetry')}
      />
      <CookieRow
        icon="🐛"
        name="mv_replay"
        tag={t('list.replay.tag')}
        desc={t('list.replay.desc')}
        on={toggles.replay}
        onToggle={() => onToggle('replay')}
      />

      <div
        style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <HoverButton
          base={{
            ...btnBase,
            background: T.warm,
            color: 'oklch(0.15 0.02 55)',
            boxShadow: `0 4px 0 ${T.warmDark}`,
          }}
          hover={{ background: T.warmHover, transform: 'translateY(-1px)' }}
          onClick={onSave}
        >
          <span>{t('list.save')}</span>
          <span aria-hidden="true">→</span>
        </HoverButton>

        <HoverButton
          base={{ ...btnBase, borderColor: T.whiteA14, background: 'transparent' }}
          hover={{ background: T.whiteA5, transform: 'translateY(-1px)' }}
          onClick={onAcceptAll}
        >
          {t('list.acceptAll')}
        </HoverButton>

        <HoverButton
          base={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            padding: '8px 4px',
            fontSize: '13px',
            color: T.ink3,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
          hover={{ color: T.ink }}
          onClick={onBack}
        >
          ← {t('list.back')}
        </HoverButton>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cookie row
// ---------------------------------------------------------------------------

function CookieRow({
  icon,
  name,
  tag,
  tagRequired,
  desc,
  locked,
  on,
  onToggle,
}: {
  icon: string;
  name: string;
  tag: string;
  tagRequired?: boolean;
  desc: string;
  locked?: boolean;
  on: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      style={{
        padding: '14px 4px',
        display: 'grid',
        gridTemplateColumns: '26px 1fr auto',
        gap: '0 12px',
        alignItems: 'start',
        borderBottom: `1px solid ${T.whiteA6}`,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: T.whiteA5,
          display: 'grid',
          placeItems: 'center',
          fontSize: 13,
          color: T.warmLight,
        }}
      >
        {icon}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
          <span style={{ fontFamily: T.mono }}>{name}</span>{' '}
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '2px 5px',
              borderRadius: 4,
              verticalAlign: 'middle',
              ...(tagRequired
                ? { background: T.greenTagBg, color: T.greenTag }
                : { background: T.whiteA6, color: T.ink2 }),
            }}
          >
            {tag}
          </span>
        </div>
        <div style={{ marginTop: 3, fontSize: '12.5px', lineHeight: 1.4, color: T.ink3 }}>
          {desc}
        </div>
      </div>

      <button
        type="button"
        onClick={locked ? undefined : onToggle}
        aria-label={locked ? 'Required, always on' : `Toggle ${name}`}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          border: 'none',
          padding: 0,
          cursor: locked ? 'not-allowed' : 'pointer',
          background: locked ? T.green : on ? T.warm : T.whiteA12,
          position: 'relative',
          transition: 'background .25s',
          marginTop: 2,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px oklch(0 0 0 / 0.25)',
            transition: 'transform .25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: on || locked ? 'translateX(18px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settled toast
// ---------------------------------------------------------------------------

function SettledToast({
  message,
  onUndo,
  undoLabel,
}: {
  message: string;
  onUndo: () => void;
  undoLabel: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div style={wrapStyle}>
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: 380,
          background: T.bg,
          color: T.ink,
          borderRadius: 22,
          boxShadow: `0 0 0 1px ${T.border}, 0 30px 60px -20px oklch(0 0 0 / 0.6)`,
          fontFamily: T.font,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '18px 22px',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: T.green,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            role="img"
            aria-label="Checkmark"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ flex: 1, fontSize: 14, lineHeight: 1.35, letterSpacing: '-0.005em' }}>
          {message}
        </div>
        <button
          type="button"
          onClick={onUndo}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '6px 10px',
            fontSize: '12.5px',
            color: T.ink2,
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            textDecorationColor: T.whiteA20,
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {undoLabel}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stamp badge
// ---------------------------------------------------------------------------

function Stamp({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 11px 5px 8px',
        borderRadius: 999,
        background: T.whiteA6,
        fontSize: '11.5px',
        fontWeight: 500,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        color: T.warmLight,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.warm }} />
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hover button helper — avoids CSS classes for inline-style component
// ---------------------------------------------------------------------------

function HoverButton({
  base,
  hover,
  onClick,
  children,
}: {
  base: React.CSSProperties;
  hover: Partial<React.CSSProperties>;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      style={base}
      onMouseEnter={() => {
        if (!ref.current) return;
        const s = ref.current.style as unknown as Record<string, string>;
        for (const [k, v] of Object.entries(hover)) {
          s[k] = v as string;
        }
      }}
      onMouseLeave={() => {
        if (!ref.current) return;
        const s = ref.current.style as unknown as Record<string, string>;
        const b = base as unknown as Record<string, string>;
        for (const k of Object.keys(hover)) {
          s[k] = b[k] ?? '';
        }
      }}
    >
      {children}
    </button>
  );
}
