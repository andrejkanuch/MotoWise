import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckoutTracker } from '@/components/checkout-tracker';
import { WebEvent } from '@/lib/analytics';
import { SUPPORT_EMAIL } from '@/lib/checkout-errors';
import '../../pro.css';

export const metadata: Metadata = {
  title: 'Checkout cancelled',
  robots: { index: false, follow: false },
};

export default function CheckoutCancelPage() {
  return (
    <section className="mvp-section mvp-section--operate">
      <CheckoutTracker event={WebEvent.CHECKOUT_CANCELLED} />
      <div className="mvp-operate-head">
        <h1 className="mv-section-title mvp-operate-title">Checkout cancelled</h1>
        <p className="mvp-operate-sub">
          You have not been charged. Your free account is still active, with everything you have
          logged.
        </p>
      </div>

      <div className="mvp-actions">
        <Link href="/pro" className="mv-btn mv-btn-primary mv-btn-block">
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          Back to plans
        </Link>
        <Link href="/garage" className="mv-btn mv-btn-ghost mv-btn-block">
          Continue on the free plan
        </Link>
      </div>

      <p className="mvp-after">
        Questions?{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="mv-link">
          Email {SUPPORT_EMAIL}
        </a>
      </p>
    </section>
  );
}
