'use client';

import {
  ArrowRight,
  Bike,
  Download,
  Lock,
  MapPin,
  Receipt,
  ScanSearch,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PRO_FEATURE_KEYS, PRO_FEATURES, WEB_OFFER_COPY } from '@/lib/pro-plan';
import { STATIC_WEB_PLANS, WEB_PLAN_IDS, type WebPlanId } from '@/lib/web-pricing';

/** Static marketing prices; checkout renders the live RevenueCat price instead. */
const PLANS = STATIC_WEB_PLANS.plans;

const PLAN_LABEL: Record<WebPlanId, string> = {
  [WEB_PLAN_IDS.MONTHLY]: 'Monthly',
  [WEB_PLAN_IDS.ANNUAL]: 'Annual',
};

/** Icon per benefit row; copy comes from lib/pro-plan.ts. */
const BENEFIT_ICONS = {
  [PRO_FEATURE_KEYS.BIKES]: Bike,
  [PRO_FEATURE_KEYS.AI_DIAGNOSTICS]: ScanSearch,
  [PRO_FEATURE_KEYS.AI_EXTRAS]: Sparkles,
  [PRO_FEATURE_KEYS.RECEIPT_SCANS]: Receipt,
  [PRO_FEATURE_KEYS.GPX_EXPORT]: Download,
  [PRO_FEATURE_KEYS.OFFLINE_MAPS]: MapPin,
} as const;

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

      <ul className="mv-rows is-open mvp-benefits">
        {PRO_FEATURES.map((f) => {
          const Icon = BENEFIT_ICONS[f.key];
          return (
            <li key={f.key} className="mv-row">
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              {f.title}
            </li>
          );
        })}
      </ul>

      <div>
        <Link href={`/pro/checkout?plan=${plan}`} className="mv-btn mv-btn-primary mv-btn-block">
          {WEB_OFFER_COPY.finalCta}
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </Link>
        <p className="mvp-footnote">
          <Lock size={13} strokeWidth={2} aria-hidden="true" />
          {WEB_OFFER_COPY.cardFootnote}
        </p>
      </div>
    </div>
  );
}
