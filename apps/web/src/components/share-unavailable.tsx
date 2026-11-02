import Image from 'next/image';
import '@/components/marketing/design-system.css';
import '@/components/share-page.css';

/**
 * The share pages (/ride, /rider, /share, /t, /u) when the API never answered:
 * not a 404 and not "expired" — the record may well exist. Names what happened
 * and the next step on the share-page shell, in both schemes. The retry is a
 * plain link back to the same path.
 */
export function ShareUnavailable({ what, path }: { what: string; path: string }) {
  return (
    <div className="mv-marketing sp">
      <div className="sp-brand">
        <a href="/">
          <Image src="/images/marketing/MotoVault.png" alt="" width={28} height={28} />
          MotoVault
        </a>
      </div>

      <main className="sp-main sp-main-tall">
        <h1 className="mv-section-title sp-title">This page didn&apos;t load</h1>
        <p className="sp-prose" style={{ marginTop: 28 }}>
          {what} couldn&apos;t be fetched just now. The link is fine; try again in a moment.
        </p>
        <div className="sp-cta-actions">
          <a href={path} className="mv-btn mv-btn-primary">
            Try again
          </a>
        </div>
      </main>
    </div>
  );
}
