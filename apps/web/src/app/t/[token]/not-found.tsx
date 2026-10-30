import { StoreLink } from '@/components/marketing/store-buttons';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import '@/components/marketing/design-system.css';

/**
 * A shared trip that is private, revoked or gone. Root-only route (English).
 * The ground, a condensed headline, one copper action and a ghost one, in
 * both schemes.
 */
export default function SharedTripNotFound() {
  return (
    <div
      className="mv-marketing"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        padding: '64px 24px',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
        <h1
          className="mv-display"
          style={{
            margin: 0,
            fontSize: 'clamp(44px, 8vw, 72px)',
            fontWeight: 700,
            lineHeight: 0.96,
            color: 'var(--mv-ink)',
            textWrap: 'balance',
          }}
        >
          This trip isn't available
        </h1>
        <p
          style={{
            margin: '20px 0 0',
            maxWidth: '48ch',
            fontSize: 17,
            lineHeight: 1.55,
            color: 'var(--mv-ink-2)',
          }}
        >
          The rider may have made it private, or the link has been revoked.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 36 }}>
          <StoreLink
            platform={StorePlatform.Unknown}
            pageType={CtaPageType.SharedTrip}
            placement={CtaPlacement.Inline}
            className="mv-btn mv-btn-primary"
          >
            Get MotoVault
          </StoreLink>
          <a
            href="https://motovault.app"
            aria-label="Learn more about MotoVault"
            className="mv-btn mv-btn-ghost"
          >
            Learn more
          </a>
        </div>
      </div>
    </div>
  );
}
