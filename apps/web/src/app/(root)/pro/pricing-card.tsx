'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PRO_FEATURES, WEB_OFFER_COPY } from '@/lib/pro-plan';
import { STATIC_WEB_PLANS, WEB_PLAN_IDS, type WebPlanId } from '@/lib/web-pricing';

/** Static marketing prices; checkout renders the live RevenueCat price instead. */
const PLANS = STATIC_WEB_PLANS.plans;

const PLAN_LABEL: Record<WebPlanId, string> = {
  [WEB_PLAN_IDS.MONTHLY]: 'Monthly',
  [WEB_PLAN_IDS.ANNUAL]: 'Annual',
};

/** The one card on the plan page: plan toggle, price, what it unlocks, the copper action. */
export function PricingCard() {
  const [plan, setPlan] = useState<WebPlanId>(WEB_PLAN_IDS.ANNUAL);
  const p = PLANS[plan];
  const saving = STATIC_WEB_PLANS.savingsPercent;

  return (
    <div className="mvp-card">
      <fieldset className="mv-segmented mvp-seg">
        <legend className="mvp-sr-only">Billing period</legend>
        {(Object.keys(PLAN_LABEL) as WebPlanId[]).map((id) => (
          <button key={id} type="button" aria-pressed={plan === id} onClick={() => setPlan(id)}>
            {PLAN_LABEL[id]}
            {id === WEB_PLAN_IDS.ANNUAL && saving !== null && (
              <span className="mvp-seg-saving">&minus;{saving}%</span>
            )}
          </button>
        ))}
      </fieldset>

      <div>
        <div className="mvp-price">
          <span className="mv-figure mvp-price-figure">{p.price}</span>
          <span className="mvp-price-period">{p.period}</span>
          {p.crossed && <s className="mv-figure mvp-price-crossed">{p.crossed}</s>}
        </div>
        <p className="mvp-price-sub">{p.sub}</p>
      </div>

      {/* Text rows: the titles say what they are (copy in lib/pro-plan.ts). */}
      <ul className="mv-rows is-open mvp-benefits">
        {PRO_FEATURES.map((f) => (
          <li key={f.key} className="mv-row">
            {f.title}
          </li>
        ))}
      </ul>

      <div>
        <Link href={`/pro/checkout?plan=${plan}`} className="mv-btn mv-btn-primary mv-btn-block">
          {WEB_OFFER_COPY.finalCta}
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </Link>
        <p className="mvp-footnote">{WEB_OFFER_COPY.cardFootnote}</p>
      </div>
    </div>
  );
}
