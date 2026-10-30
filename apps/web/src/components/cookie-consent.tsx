'use client';

import { Bug, ChartNoAxesColumn, Check, Lock, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PostHog } from 'posthog-js';
import {
  createContext,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useModal } from '@/hooks/use-modal';
import { clearAccountConsent, writeAccountConsent } from '@/lib/account-consent';
import { clearFirstTouch, firstTouchProperties, persistFirstTouch } from '@/lib/campaign';
import { dropQueuedPostHogCalls, getPostHog, loadPostHog } from '@/lib/posthog-client';

// ---------------------------------------------------------------------------
// Consent primitives (cookie read/write, PostHog opt-in/out, geo detection)
// ---------------------------------------------------------------------------

const CONSENT_COOKIE = 'mv_consent';
const COOKIE_MAX_AGE = 15_552_000; // 6 months in seconds

type Decision = 'accepted' | 'rejected';

/**
 * How the decision came about, stored as the cookie's 5th field. `implied` is
 * the automatic grant outside the EU (no banner shown): a default, not a choice,
 * so it must never be written to the rider's account as their decision.
 */
const CONSENT_SOURCE = {
  EXPLICIT: 'explicit',
  IMPLIED: 'implied',
} as const;
type ConsentSource = (typeof CONSENT_SOURCE)[keyof typeof CONSENT_SOURCE];

/** The cookie's fields: `v1:<decision>:<epoch>:EU[:<source>]`. */
function readConsentCookie(): string[] | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  if (!match) return null;
  const parts = decodeURIComponent(match[1]).split(':');
  if (parts.length < 2 || parts[0] !== 'v1') return null;
  return parts;
}

function parseConsent(): Decision | null {
  const decision = readConsentCookie()?.[1];
  return decision === 'accepted' || decision === 'rejected' ? decision : null;
}

function isConsentRequired(): boolean {
  if (typeof document === 'undefined') return true;
  const match = document.cookie.match(/(?:^|; )mv_region=([^;]*)/);
  return !match || match[1] === 'EU';
}

/**
 * Whether the stored decision was a click. Cookies written before the source
 * field existed: a "no" is always a choice (the automatic grant only ever says
 * yes), and a "yes" is ALWAYS treated as implied — it may be an old automatic
 * grant, and the region cookie can since have flipped to EU. Genuine old EU
 * clicks lose nothing but the account sync; they are asked again (see mount).
 */
function isExplicitDecision(parts: string[], decision: Decision): boolean {
  const source = parts[4];
  return source === undefined ? decision === 'rejected' : source === CONSENT_SOURCE.EXPLICIT;
}

/**
 * The visitor's banner decision, read from the shared cookie at call time (so
 * every tab sees the same value), or null unless they actually CHOSE it.
 */
export function readExplicitConsent(): boolean | null {
  const parts = readConsentCookie();
  const decision = parseConsent();
  if (!parts || !decision || !isExplicitDecision(parts, decision)) return null;
  return decision === 'accepted';
}

/**
 * An automatic "yes" that no longer applies: the visitor is now in an opt-in
 * region (e.g. the region cookie was refreshed to EU), so they must be asked.
 */
function isImpliedYesInOptInRegion(): boolean {
  const parts = readConsentCookie();
  const decision = parseConsent();
  return (
    !!parts &&
    decision === 'accepted' &&
    !isExplicitDecision(parts, decision) &&
    isConsentRequired()
  );
}

function writeConsent(decision: Decision, source: ConsentSource) {
  const epoch = Math.floor(Date.now() / 1000);
  const value = `v1:${decision}:${epoch}:EU:${source}`;
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  // biome-ignore lint/suspicious/noDocumentCookie: this IS the consent primitive itself
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/** Super property marking that this browser's first touch already reached PostHog. */
const FIRST_TOUCH_SENT = 'ft_sent';

function grantPostHog(posthog: PostHog, announce: boolean) {
  try {
    posthog.set_config({ persistence: 'localStorage+cookie' });
    posthog.opt_in_capturing();
    if (announce) posthog.capture('$consent_granted');
    const touch = persistFirstTouch();
    if (touch && posthog.get_property(FIRST_TOUCH_SENT) === undefined) {
      const props = firstTouchProperties(touch);
      // Super properties put the source on every later event (store click,
      // checkout); $set_once keeps the person's first source permanently.
      posthog.register({ ...props, [FIRST_TOUCH_SENT]: true });
      posthog.setPersonProperties(undefined, props);
    }
  } catch {
    // In private mode / blocked-storage, set_config + opt_in/out_capturing touch
    // localStorage/cookies and throw a SecurityError (DOMException 18) as an
    // unhandled rejection (Sentry MOTOVAULT-WEB-T). PostHog falls back to memory
    // persistence internally, so swallowing the storage error is safe.
  }
}

function denyPostHog(posthog: PostHog | null) {
  try {
    posthog?.opt_out_capturing();
  } catch {
    // Blocked storage (see grantPostHog).
  }
}

/**
 * Bumped on every consent decision. A "yes" that has to wait for the SDK chunk
 * only applies if no later decision replaced it: an Undo or Reject made while
 * posthog-js is still downloading must win over the earlier Accept.
 */
let consentGeneration = 0;
let latestConsentGranted = false;

/**
 * Apply the stored consent decision to PostHog. Runs on every page load for a
 * visitor who already decided, so `announce` is true only when the decision is
 * made right now — `$consent_granted` fires once per person, not once per page.
 * A "yes" loads the SDK (lib/posthog-client.ts) if it is not in yet; a "no"
 * never downloads it, and opts an already-loaded SDK out.
 */
export function applyPostHogConsent(granted: boolean, { announce = false } = {}) {
  if (typeof window === 'undefined') return;
  const generation = ++consentGeneration;
  latestConsentGranted = granted;
  if (granted) {
    const loaded = getPostHog();
    if (loaded) {
      grantPostHog(loaded, announce);
      return;
    }
    loadPostHog().then(
      (posthog) => {
        if (generation === consentGeneration) {
          grantPostHog(posthog, announce);
        } else if (!latestConsentGranted) {
          // The "no" arrived before the SDK did, so it had nothing to opt out.
          denyPostHog(posthog);
        }
        // A later "yes" applies itself from its own pending load.
      },
      () => {
        // The SDK chunk failed to load (offline, blocked): no analytics, no error.
      },
    );
    return;
  }
  dropQueuedPostHogCalls();
  clearFirstTouch();
  denyPostHog(getPostHog());
}

// ---------------------------------------------------------------------------
// Consent context (shared state for banner + analytics gate)
// ---------------------------------------------------------------------------

type ConsentContextValue = {
  consent: boolean | null;
  accept: () => void;
  deny: () => void;
  /** Withdraw the decision entirely (the banner's Undo): back to "not decided". */
  reset: () => void;
};

function clearConsentCookie() {
  // biome-ignore lint/suspicious/noDocumentCookie: clearing the consent primitive
  document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0`;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<boolean | null>(null);

  useEffect(() => {
    if (isImpliedYesInOptInRegion()) {
      // Ask again: drop the automatic grant and stop capturing until they choose.
      // The account is not touched — an implied yes was never written to it.
      clearConsentCookie();
      applyPostHogConsent(false);
      return;
    }
    const current = parseConsent();
    if (current !== null) {
      const asBool = current === 'accepted';
      setConsentState(asBool);
      applyPostHogConsent(asBool);
    } else if (!isConsentRequired()) {
      writeConsent('accepted', CONSENT_SOURCE.IMPLIED);
      setConsentState(true);
      applyPostHogConsent(true, { announce: true });
    }
  }, []);

  // A click is a deliberate choice, so it goes straight to a signed-in account,
  // including a "no" → "yes" change the background sync will never make.
  const accept = useCallback(() => {
    writeConsent('accepted', CONSENT_SOURCE.EXPLICIT);
    setConsentState(true);
    applyPostHogConsent(true, { announce: true });
    void writeAccountConsent(true);
  }, []);

  const deny = useCallback(() => {
    writeConsent('rejected', CONSENT_SOURCE.EXPLICIT);
    setConsentState(false);
    applyPostHogConsent(false);
    void writeAccountConsent(false);
  }, []);

  const reset = useCallback(() => {
    clearConsentCookie();
    setConsentState(null);
    // Undecided means nothing is captured, the same as a "no" for PostHog.
    applyPostHogConsent(false);
    void clearAccountConsent();
  }, []);

  return (
    <ConsentContext.Provider value={{ consent, accept, deny, reset }}>
      {children}
    </ConsentContext.Provider>
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
// Banner UI — the Trackside chrome: tokens only, body face, copper on the one
// confirming action, radius 16, no blur, no shadow, both schemes. The surface
// mounts outside `.mv-marketing`, so it carries `.mv-root` for the shared
// selection and focus grammar. The bar and the settled note enter with the
// kit's `.mv-enter-up`; the kit's reduced-motion policy covers them.
// ---------------------------------------------------------------------------

/**
 * Published on <html> while the consent BAR is on screen, as its height, so
 * every fixed bottom bar (sticky app bar, trip bar, garage bar, explore FAB)
 * can stack above it instead of fighting it for the bottom edge. The settings
 * sheet and the settled note do not publish: the sheet is a dialog that sits
 * over those bars, and the note is a corner toast.
 */
const SURFACE_HEIGHT_VAR = '--mv-cookie-banner-h';

const COOKIE_UI_CSS = `
.mv-cc {
  position: fixed;
  z-index: 110;
  font-family: var(--mv-font-body);
  color: var(--mv-ink);
  -webkit-font-smoothing: antialiased;
}
.mv-cc p { margin: 0; }

/* The bar: full width on the raised step with a hairline top */
.mv-cc-bar {
  left: 0; right: 0; bottom: 0;
  background: var(--mv-surface-2);
  border-top: 1px solid var(--mv-line);
}
.mv-cc-bar-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
  max-width: var(--mv-container);
  margin: 0 auto;
  padding: 12px max(var(--mv-cc-gutter), env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) max(var(--mv-cc-gutter), env(safe-area-inset-left));
  --mv-cc-gutter: 40px;
}
@media (max-width: 900px) { .mv-cc-bar-inner { --mv-cc-gutter: 24px; } }
@media (max-width: 480px) { .mv-cc-bar-inner { --mv-cc-gutter: 20px; } }
/* A landscape phone: one row, tighter type, the two choices still equal. */
@media (max-height: 500px) {
  .mv-cc-bar-inner { flex-wrap: nowrap; padding-top: 8px; padding-bottom: calc(8px + env(safe-area-inset-bottom)); }
  .mv-cc-body { font-size: 13px; line-height: 18px; }
  .mv-cc-actions { flex-wrap: nowrap; }
  .mv-cc-actions .mv-btn { min-height: 40px; padding: 0 14px; }
}
.mv-cc-body {
  flex: 1 1 360px;
  min-width: 0;
  font-size: 15px;
  line-height: 20px;
  color: var(--mv-ink-2);
}
.mv-cc-body strong { color: var(--mv-ink); font-weight: 600; }
.mv-cc-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

/* Buttons are the kit's .mv-btn; the quiet text action stays local */
.mv-cc-text {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--mv-radius-control);
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  color: var(--mv-ink-3);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--mv-line-step);
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--mv-dur-1);
}
.mv-cc-text:hover { color: var(--mv-ink); }

/* The settings sheet: a card one step up, radius 16, no shadow */
.mv-cc-sheet {
  left: 0; right: 0; bottom: 0;
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  padding: 20px 20px calc(20px + env(safe-area-inset-bottom));
  background: var(--mv-surface-2);
  border: 1px solid var(--mv-line);
  border-bottom: 0;
  border-radius: var(--mv-radius-card) var(--mv-radius-card) 0 0;
}
@media (min-width: 640px) {
  .mv-cc-sheet {
    left: max(20px, env(safe-area-inset-left)); right: auto; bottom: calc(20px + env(safe-area-inset-bottom));
    width: min(540px, calc(100vw - 40px));
    padding: 24px;
    border-bottom: 1px solid var(--mv-line);
    border-radius: var(--mv-radius-card);
  }
}
.mv-cc-sheet-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--mv-line);
}
.mv-cc-sheet-count {
  font-family: var(--mv-font-display);
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--mv-ink-3);
}
.mv-cc-row {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  column-gap: 12px;
  align-items: start;
  min-height: 44px;
  padding: 12px 0;
  border-bottom: 1px solid var(--mv-line);
}
.mv-cc-row:last-of-type { border-bottom: 0; }
.mv-cc-row-icon { margin-top: 2px; color: var(--mv-ink-3); }
.mv-cc-row-name {
  font-family: var(--mv-font-mono);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  color: var(--mv-ink);
}
.mv-cc-row-tag { font-family: var(--mv-font-body); font-size: 13px; color: var(--mv-ink-3); }
.mv-cc-row-desc { margin-top: 2px; font-size: 13px; line-height: 18px; color: var(--mv-ink-3); }
.mv-cc-sheet-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}
.mv-cc-sheet-actions .mv-cc-text { margin-left: auto; }

/* Switch: ink when on (selection, not status), raised step when off. The
   26px track sits inside a 44px target (the padding is the hit area; the
   fill is clipped to the track). */
.mv-cc-switch {
  position: relative;
  box-sizing: content-box;
  width: 44px; height: 26px;
  margin-top: -7px;
  padding: 9px 0;
  border: 0;
  border-radius: var(--mv-radius-pill);
  background: var(--mv-surface-3);
  background-clip: content-box;
  cursor: pointer;
  transition: background var(--mv-dur-1);
}
.mv-cc-switch[aria-checked="true"] { background: var(--mv-ink); }
.mv-cc-switch[aria-disabled="true"] { background: var(--mv-line-step); cursor: not-allowed; }
.mv-cc-switch-knob {
  position: absolute;
  top: 12px; left: 3px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--mv-ink-2);
  transition: transform var(--mv-dur-2) var(--mv-ease-expo), background var(--mv-dur-1);
}
.mv-cc-switch[aria-checked="true"] .mv-cc-switch-knob,
.mv-cc-switch[aria-disabled="true"] .mv-cc-switch-knob { transform: translateX(18px); background: var(--mv-bg); }

/* The settled note */
.mv-cc-toast {
  left: max(20px, env(safe-area-inset-left)); right: 20px; bottom: calc(20px + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 12px;
  width: fit-content;
  max-width: calc(100vw - 40px);
  padding: 8px 8px 8px 16px;
  background: var(--mv-surface-2);
  border: 1px solid var(--mv-line);
  border-radius: var(--mv-radius-card);
}
.mv-cc-toast svg { flex-shrink: 0; color: var(--mv-go); }
.mv-cc-toast-msg { font-size: 15px; line-height: 20px; }
/* The kit's policy stops the entrances; the knob's slide is the one local move. */
@media (prefers-reduced-motion: reduce) {
  .mv-cc-switch-knob { transition: background var(--mv-dur-1); }
}
`;

/** Keeps the root's {@link SURFACE_HEIGHT_VAR} equal to this surface's height while it is mounted. */
function usePublishSurfaceHeight(ref: RefObject<HTMLElement | null>, publish: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !publish) return;
    const root = document.documentElement;
    const write = () => root.style.setProperty(SURFACE_HEIGHT_VAR, `${el.offsetHeight}px`);
    write();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(write);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(SURFACE_HEIGHT_VAR);
    };
  }, [ref, publish]);
}

function ConsentSurface({
  className,
  children,
  publish = false,
  surfaceRef,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  className: string;
  /** Publish this surface's height for the fixed bars to stack on. */
  publish?: boolean;
  surfaceRef?: RefObject<HTMLDivElement | null>;
}) {
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = surfaceRef ?? ownRef;
  usePublishSurfaceHeight(ref, publish);
  return (
    <div ref={ref} className={`mv-root mv-cc ${className}`} {...rest}>
      <style>{COOKIE_UI_CSS}</style>
      {children}
    </div>
  );
}

type CookieToggles = { pref: boolean; telemetry: boolean; replay: boolean };

const DEFAULT_TOGGLES: CookieToggles = { pref: true, telemetry: false, replay: false };

export function CookieConsentBanner() {
  const { consent, accept, deny, reset } = useCookieConsent();
  const t = useTranslations('CookieBanner');
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'main' | 'list' | 'settled'>('main');
  const [settledMsg, setSettledMsg] = useState('');
  const [toggles, setToggles] = useState<CookieToggles>(DEFAULT_TOGGLES);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetTitleRef = useRef<HTMLHeadingElement>(null);
  const returnToSettingsRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Opening "Settings" unmounts the button that was clicked, so the sheet is
  // a modal dialog: its title takes focus, Tab stays inside, Escape and
  // "Back" return to the bar, and focus returns to the Settings button.
  const closeSheet = useCallback(() => {
    returnToSettingsRef.current = true;
    setView('main');
  }, []);
  useModal(view === 'list', closeSheet, sheetRef, sheetTitleRef);
  useEffect(() => {
    if (view === 'main' && returnToSettingsRef.current) {
      returnToSettingsRef.current = false;
      settingsButtonRef.current?.focus();
    }
  }, [view]);

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
    reset();
    setView('main');
    setToggles(DEFAULT_TOGGLES);
  }, [reset]);

  const toggle = useCallback((key: keyof CookieToggles) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!mounted) return null;
  if (consent !== null && view !== 'settled') return null;

  if (view === 'settled') {
    return <SettledToast message={settledMsg} onUndo={handleUndo} undoLabel={t('settled.undo')} />;
  }

  if (view === 'main') {
    return (
      <ConsentSurface
        className="mv-cc-bar mv-enter-up"
        role="dialog"
        aria-labelledby="cb-title"
        aria-describedby="cb-body"
        publish
      >
        <div className="mv-cc-bar-inner">
          <span id="cb-title" hidden>
            {t('stamp')}
          </span>
          <p id="cb-body" className="mv-cc-body">
            {t.rich('body1', { strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
          <div className="mv-cc-actions">
            <button type="button" className="mv-btn mv-btn-primary" onClick={handleAccept}>
              {t('accept')}
            </button>
            <button type="button" className="mv-btn mv-btn-ghost" onClick={handleDecline}>
              {t('decline')}
            </button>
            <button
              ref={settingsButtonRef}
              type="button"
              className="mv-cc-text"
              onClick={() => setView('list')}
            >
              {t('settings')}
            </button>
          </div>
        </div>
      </ConsentSurface>
    );
  }

  return (
    <ConsentSurface
      className="mv-cc-sheet mv-enter-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cb-list-title"
      aria-describedby="cb-body"
      surfaceRef={sheetRef}
    >
      <span id="cb-body" hidden>
        {t('stamp')}
      </span>
      <ListView
        t={t}
        titleRef={sheetTitleRef}
        toggles={toggles}
        onToggle={toggle}
        onSave={handleSave}
        onAcceptAll={handleAcceptAll}
        onBack={closeSheet}
      />
    </ConsentSurface>
  );
}

// ---------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------

function ListView({
  t,
  titleRef,
  toggles,
  onToggle,
  onSave,
  onAcceptAll,
  onBack,
}: {
  t: ReturnType<typeof useTranslations>;
  titleRef: RefObject<HTMLHeadingElement | null>;
  toggles: CookieToggles;
  onToggle: (key: keyof CookieToggles) => void;
  onSave: () => void;
  onAcceptAll: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="mv-cc-sheet-head">
        <h2 id="cb-list-title" ref={titleRef} tabIndex={-1} className="mv-h3">
          {t('list.whatWeUse')}
        </h2>
        <span className="mv-cc-sheet-count">{t('list.count')}</span>
      </div>

      <CookieRow
        Icon={Lock}
        name="mv_session"
        tag={t('list.session.tag')}
        desc={t('list.session.desc')}
        lockedLabel={t('list.requiredAlwaysOn')}
        on
      />
      <CookieRow
        Icon={SlidersHorizontal}
        name="mv_pref"
        tag={t('list.pref.tag')}
        desc={t('list.pref.desc')}
        toggleLabel={t('list.toggleCookie', { name: 'mv_pref' })}
        on={toggles.pref}
        onToggle={() => onToggle('pref')}
      />
      <CookieRow
        Icon={ChartNoAxesColumn}
        name="mv_telemetry"
        tag={t('list.telemetry.tag')}
        desc={t('list.telemetry.desc')}
        toggleLabel={t('list.toggleCookie', { name: 'mv_telemetry' })}
        on={toggles.telemetry}
        onToggle={() => onToggle('telemetry')}
      />
      <CookieRow
        Icon={Bug}
        name="mv_replay"
        tag={t('list.replay.tag')}
        desc={t('list.replay.desc')}
        toggleLabel={t('list.toggleCookie', { name: 'mv_replay' })}
        on={toggles.replay}
        onToggle={() => onToggle('replay')}
      />

      <div className="mv-cc-sheet-actions">
        <button type="button" className="mv-btn mv-btn-primary" onClick={onSave}>
          {t('list.save')}
        </button>
        <button type="button" className="mv-btn mv-btn-ghost" onClick={onAcceptAll}>
          {t('list.acceptAll')}
        </button>
        <button type="button" className="mv-cc-text" onClick={onBack}>
          {t('list.back')}
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cookie row
// ---------------------------------------------------------------------------

function CookieRow({
  Icon,
  name,
  tag,
  desc,
  lockedLabel,
  toggleLabel,
  on,
  onToggle,
}: {
  Icon: typeof Lock;
  name: string;
  tag: string;
  desc: string;
  /** Present on the required cookie: the switch is on and cannot change. */
  lockedLabel?: string;
  toggleLabel?: string;
  on: boolean;
  onToggle?: () => void;
}) {
  const locked = lockedLabel !== undefined;
  return (
    <div className="mv-cc-row">
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" className="mv-cc-row-icon" />
      <div style={{ minWidth: 0 }}>
        <div className="mv-cc-row-name">
          {name} <span className="mv-cc-row-tag">· {tag}</span>
        </div>
        <div className="mv-cc-row-desc">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        className="mv-cc-switch"
        aria-checked={on || locked}
        aria-disabled={locked || undefined}
        aria-label={locked ? lockedLabel : toggleLabel}
        onClick={locked ? undefined : onToggle}
      >
        <span className="mv-cc-switch-knob" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settled toast
// ---------------------------------------------------------------------------

const SETTLED_TOAST_MS = 4000;

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
    const timer = setTimeout(() => setVisible(false), SETTLED_TOAST_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <ConsentSurface className="mv-cc-toast mv-enter-up" role="status">
      <Check size={18} strokeWidth={2.2} aria-hidden="true" />
      <span className="mv-cc-toast-msg">{message}</span>
      <button type="button" className="mv-cc-text" onClick={onUndo}>
        {undoLabel}
      </button>
    </ConsentSurface>
  );
}
