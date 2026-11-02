import Image from 'next/image';
import { GetAppLink } from '@/components/open-in-app-link';
import { CtaPageType, CtaPlacement } from '@/lib/cta-taxonomy';
import '@/components/marketing/design-system.css';
import '@/components/share-page.css';

/**
 * A ride that is private, deleted or never existed. A stranger's first
 * MotoVault screen names the product and the reason instead of the site-wide
 * "wrong turn": the share-page shell, one copper action and a ghost one, in
 * both schemes. Root-only route (English).
 */
export default function RideNotFound() {
  return (
    <div className="mv-marketing sp">
      <div className="sp-brand">
        <a href="/">
          <Image src="/images/marketing/MotoVault.png" alt="" width={28} height={28} />
          MotoVault
        </a>
      </div>

      <main className="sp-main sp-main-tall">
        <h1 className="mv-section-title sp-title">This ride isn&apos;t available</h1>
        <p className="sp-prose" style={{ marginTop: 28 }}>
          The rider may have made it private, or the link has been revoked.
        </p>
        <div className="sp-cta-actions">
          <GetAppLink
            pageType={CtaPageType.Ride}
            placement={CtaPlacement.Inline}
            className="mv-btn mv-btn-primary"
          >
            Get the app
          </GetAppLink>
          <a href="https://motovault.app" className="mv-btn mv-btn-ghost">
            What MotoVault does
          </a>
        </div>
      </main>
    </div>
  );
}
