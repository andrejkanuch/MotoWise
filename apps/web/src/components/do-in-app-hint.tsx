import { Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { GET_PATH } from '@/lib/get-link';
import '@/app/(community)/garage/garage.css';

/**
 * "Do this in the MotoVault app" — a small, non-blocking pointer shown where the
 * web used to offer a create/edit action. The web displays, the app does
 * (issue #277): logging, completing services and editing the profile happen in
 * the app only. Links to /get, which redirects a phone to its store and shows a
 * desktop visitor the store buttons and a QR code.
 *
 * Deliberately minimal; #277 designs the full web→app handoff.
 */
export function DoInAppHint({ className }: { className?: string }) {
  const t = useTranslations('AppHandoff');
  return (
    <Link href={GET_PATH} className={className ? `app-hint ${className}` : 'app-hint'}>
      <Smartphone aria-hidden="true" />
      <span>{t('doInApp')}</span>
      <span className="app-hint-cta" aria-hidden="true">
        &rarr;
      </span>
    </Link>
  );
}
