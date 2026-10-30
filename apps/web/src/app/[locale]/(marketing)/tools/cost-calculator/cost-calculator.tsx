'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { storeAnchorProps } from '@/components/marketing/store-buttons';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { CtaPageType, CtaPlacement } from '@/lib/cta-taxonomy';
import { detectPlatform, type Platform } from '@/lib/store-links';

const BIKE_TYPES = {
  sport: { mpg: 40 },
  cruiser: { mpg: 45 },
  adventure: { mpg: 50 },
  naked: { mpg: 45 },
  touring: { mpg: 38 },
} as const;

type BikeType = keyof typeof BIKE_TYPES;

const MAINTENANCE_COSTS = { basic: 300, moderate: 600, premium: 1200 } as const;
type MaintenanceTier = keyof typeof MAINTENANCE_COSTS;

const TIRES_ANNUAL = 400;
const REGISTRATION_ANNUAL = 200;

const COPIED_RESET_MS = 2000;

function parseNum(val: string | null, fallback: number): number {
  if (!val) return fallback;
  const n = Number.parseFloat(val);
  return Number.isNaN(n) ? fallback : n;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatCurrencyPrecise(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

interface Labels {
  ridingProfile: string;
  bikeType: string;
  annualMileage: string;
  fuelPriceLabel: string;
  insuranceLabel: string;
  maintenanceTier: string;
  bikeTypes: Record<string, string>;
  maintenanceTiers: Record<string, { label: string; desc: string }>;
  annualBreakdown: string;
  fuel: string;
  insurance: string;
  maintenance: string;
  tires: string;
  registrationFees: string;
  annualTotal: string;
  costPerMile: string;
  fiveYearProjection: string;
  monthlyAverage: string;
  perMonth: string;
  shareResults: string;
  copyLink: string;
  trackActualCosts: string;
  getEarlyAccess: string;
  perYear: string;
  mpgAvg: string;
}

export function CostCalculator({ labels }: { labels: Labels }) {
  const searchParams = useSearchParams();
  const [platform, setPlatform] = useState<Platform>('unknown');
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  // Seed once from the URL (shareable links), then own the values in local
  // state. Previously every keystroke called router.replace(), which triggers a
  // full RSC server round-trip + route re-render per character — the cause of
  // the ~1.8s INP measured in the field. We now update local state for instant
  // feedback and mirror the values into the URL via history.replaceState, which
  // updates the address bar without any navigation or refetch.
  const [bikeType, setBikeType] = useState<BikeType>(
    () => (searchParams.get('type') as BikeType) || 'naked',
  );
  const [mileage, setMileage] = useState(() => parseNum(searchParams.get('miles'), 5000));
  const [fuelPrice, setFuelPrice] = useState(() => parseNum(searchParams.get('fuel'), 3.5));
  const [insurance, setInsurance] = useState(() => parseNum(searchParams.get('insurance'), 800));
  const [maintenance, setMaintenance] = useState<MaintenanceTier>(
    () => (searchParams.get('maintenance') as MaintenanceTier) || 'moderate',
  );
  const [hasInput, setHasInput] = useState(() => searchParams.toString().length > 0);
  const [copied, setCopied] = useState(false);

  // Dispatch table: URL param key → local state updater. Avoids a per-field
  // branch and keeps the JSX onChange handlers unchanged.
  const fieldSetters = useMemo(
    () => ({
      type: (raw: string) => setBikeType((raw as BikeType) || 'naked'),
      miles: (raw: string) => setMileage(parseNum(raw, 5000)),
      fuel: (raw: string) => setFuelPrice(parseNum(raw, 3.5)),
      insurance: (raw: string) => setInsurance(parseNum(raw, 800)),
      maintenance: (raw: string) => setMaintenance((raw as MaintenanceTier) || 'moderate'),
    }),
    [],
  );

  const updateParam = useCallback(
    (key: keyof typeof fieldSetters, value: string) => {
      fieldSetters[key](value);
      const params = new URLSearchParams(window.location.search);
      params.set(key, value);
      window.history.replaceState(null, '', `?${params.toString()}`);
      setHasInput(true);
    },
    [fieldSetters],
  );

  const results = useMemo(() => {
    const mpg = BIKE_TYPES[bikeType]?.mpg ?? 45;
    const maintenanceCost = MAINTENANCE_COSTS[maintenance] ?? 600;
    const fuelCost = (mileage / mpg) * fuelPrice;
    const total = fuelCost + insurance + maintenanceCost + TIRES_ANNUAL + REGISTRATION_ANNUAL;
    const costPerMile = mileage > 0 ? total / mileage : 0;
    const fiveYear = total * 5;
    return {
      fuelCost,
      insurance,
      maintenanceCost,
      tires: TIRES_ANNUAL,
      registration: REGISTRATION_ANNUAL,
      total,
      costPerMile,
      fiveYear,
      mpg,
    };
  }, [bikeType, mileage, fuelPrice, insurance, maintenance]);

  const copyLink = () => {
    // Swallow rejection — clipboard can be blocked in insecure contexts /
    // restricted webviews.
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
      })
      .catch(() => {});
    trackEvent(WebEvent.TOOL_USED, {
      tool: 'cost_calculator',
      action: 'result_shared',
      bike_type: bikeType,
      annual_mileage: mileage,
      maintenance_tier: maintenance,
    });
  };

  return (
    <section className="mv-tool" style={{ paddingTop: 56 }}>
      <div className="mv-tool-grid">
        {/* Inputs sit on the page: labels in the body face, fields on surface-2 */}
        <form onSubmit={(e) => e.preventDefault()}>
          <h2 className="mv-tool-h2">{labels.ridingProfile}</h2>

          <div className="mv-field">
            <label htmlFor="bike-type">{labels.bikeType}</label>
            <div className="mv-select">
              <select
                id="bike-type"
                value={bikeType}
                onChange={(e) => updateParam('type', e.target.value)}
                className="mv-field-input"
              >
                {Object.entries(BIKE_TYPES).map(([key, { mpg }]) => (
                  <option key={key} value={key}>
                    {labels.bikeTypes[key] ?? key} · {mpg} {labels.mpgAvg}
                  </option>
                ))}
              </select>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          <div className="mv-field">
            <label htmlFor="mileage">{labels.annualMileage}</label>
            <input
              id="mileage"
              type="number"
              inputMode="numeric"
              min={0}
              max={100000}
              step={500}
              value={mileage}
              onChange={(e) => updateParam('miles', e.target.value)}
              className="mv-field-input"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </div>

          <div className="mv-field">
            <label htmlFor="fuel-price">{labels.fuelPriceLabel}</label>
            <input
              id="fuel-price"
              type="number"
              inputMode="decimal"
              min={0}
              max={20}
              step={0.1}
              value={fuelPrice}
              onChange={(e) => updateParam('fuel', e.target.value)}
              className="mv-field-input"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </div>

          <div className="mv-field">
            <label htmlFor="insurance">{labels.insuranceLabel}</label>
            <input
              id="insurance"
              type="number"
              inputMode="numeric"
              min={0}
              max={50000}
              step={50}
              value={insurance}
              onChange={(e) => updateParam('insurance', e.target.value)}
              className="mv-field-input"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </div>

          <fieldset className="mv-field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend
              style={{
                padding: 0,
                marginBottom: 4,
                fontSize: 15,
                fontWeight: 500,
                color: 'var(--mv-ink-2)',
              }}
            >
              {labels.maintenanceTier}
            </legend>
            <div className="mv-choice-list">
              {(Object.keys(MAINTENANCE_COSTS) as MaintenanceTier[]).map((key) => {
                const tier = labels.maintenanceTiers[key];
                const cost = MAINTENANCE_COSTS[key];
                return (
                  <label key={key} className="mv-choice">
                    <input
                      type="radio"
                      name="maintenance"
                      value={key}
                      checked={maintenance === key}
                      onChange={(e) => updateParam('maintenance', e.target.value)}
                    />
                    <span className="mv-choice-title">{tier?.label ?? key}</span>
                    <span className="mv-figure">
                      {formatCurrency(cost)}
                      <span className="mv-route-unit">{labels.perYear}</span>
                    </span>
                    <span className="mv-choice-desc">{tier?.desc}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </form>

        {/* Results: the one surface on the page, figures in the condensed face */}
        <div className="mv-tool-results" aria-live="polite">
          <h2 className="mv-tool-h2">{labels.annualBreakdown}</h2>
          <dl className="mv-tool-rows">
            <CostRow
              label={labels.fuel}
              sublabel={`${results.mpg} ${labels.mpgAvg}`}
              amount={results.fuelCost}
            />
            <CostRow label={labels.insurance} amount={results.insurance} />
            <CostRow
              label={labels.maintenance}
              sublabel={labels.maintenanceTiers[maintenance]?.label}
              amount={results.maintenanceCost}
            />
            <CostRow label={labels.tires} amount={results.tires} />
            <CostRow label={labels.registrationFees} amount={results.registration} />
            <div className="mv-tool-row is-total">
              <dt>{labels.annualTotal}</dt>
              <dd className="mv-figure">{formatCurrency(results.total)}</dd>
            </div>
          </dl>

          <div className="mv-tool-stats">
            <div>
              <span className="mv-figure">{formatCurrencyPrecise(results.costPerMile)}</span>
              <span>{labels.costPerMile}</span>
            </div>
            <div>
              <span className="mv-figure">{formatCurrency(results.total / 12)}</span>
              <span>
                {labels.monthlyAverage}, {labels.perMonth}
              </span>
            </div>
            <div>
              <span className="mv-figure">{formatCurrency(results.fiveYear)}</span>
              <span>{labels.fiveYearProjection}</span>
            </div>
          </div>

          <div className="mv-tool-actions">
            <a
              {...storeAnchorProps(platform, {
                pageType: CtaPageType.Tool,
                placement: CtaPlacement.Inline,
                slug: 'cost-calculator',
                referrerParams: { utm_source: 'tool', utm_campaign: 'cost_calculator' },
              })}
              className="mv-btn mv-btn-primary"
            >
              {labels.getEarlyAccess}
            </a>
            {hasInput && (
              <button type="button" onClick={copyLink} className="mv-btn mv-btn-ghost">
                {copied ? 'Link copied' : labels.copyLink}
              </button>
            )}
          </div>
          <p
            className="mv-tool-footnote"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: translated HTML with <strong>
            dangerouslySetInnerHTML={{
              __html: hasInput
                ? `${labels.trackActualCosts}. ${labels.shareResults}`
                : labels.trackActualCosts,
            }}
          />
        </div>
      </div>
    </section>
  );
}

function CostRow({
  label,
  sublabel,
  amount,
}: {
  label: string;
  sublabel?: string;
  amount: number;
}) {
  return (
    <div className="mv-tool-row">
      <dt>
        {label}
        {sublabel && <span>{sublabel}</span>}
      </dt>
      <dd className="mv-figure">{formatCurrency(amount)}</dd>
    </div>
  );
}
