import Image from 'next/image';
import { StoreLink } from '@/components/marketing/store-buttons';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import '@/components/marketing/design-system.css';
import '@/components/share-page.css';

/**
 * A shared trip that is private, revoked or gone. Root-only route (English),
 * on the share-page shell so the expired state reads like the rest of /t:
 * the ground, a condensed headline, one copper action and a ghost one, in
 * both schemes.
 */
export default function SharedTripNotFound() {
  return (
    <div className="mv-marketing sp">
      <div className="sp-brand">
        <a href="/">
          <Image src="/images/marketing/MotoVault.png" alt="" width={28} height={28} />
          MotoVault
        </a>
      </div>

      <main className="sp-main sp-main-tall">
        <h1 className="mv-section-title sp-title">This trip isn&apos;t available</h1>
        <p className="sp-prose" style={{ marginTop: 28 }}>
          The rider may have made it private, or the link has been revoked.
        </p>
        <div className="sp-cta-actions">
          <StoreLink
            platform={StorePlatform.Unknown}
            pageType={CtaPageType.SharedTrip}
            placement={CtaPlacement.Inline}
            className="mv-btn mv-btn-primary"
          >
            Get the app
          </StoreLink>
          <a href="https://motovault.app" className="mv-btn mv-btn-ghost">
            What MotoVault does
          </a>
        </div>
      </main>
    </div>
  );
}
