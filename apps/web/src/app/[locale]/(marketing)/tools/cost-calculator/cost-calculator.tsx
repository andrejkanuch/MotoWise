'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { trackEvent, WebEvent } from '@/lib/analytics';

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

  return (
    <section className="px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Input Panel */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8">
            <h2 className="mb-6 text-xl font-bold text-neutral-50">{labels.ridingProfile}</h2>

            {/* Bike Type */}
            <div className="mb-6">
              <label
                htmlFor="bike-type"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                {labels.bikeType}
              </label>
              <select
                id="bike-type"
                value={bikeType}
                onChange={(e) => updateParam('type', e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-100 outline-none transition-colors focus:border-warm-400 focus:ring-1 focus:ring-warm-400/50"
              >
                {Object.entries(BIKE_TYPES).map(([key, { mpg }]) => (
                  <option key={key} value={key}>
                    {labels.bikeTypes[key] ?? key} (~{mpg} MPG)
                  </option>
                ))}
              </select>
            </div>

            {/* Annual Mileage */}
            <div className="mb-6">
              <label htmlFor="mileage" className="mb-2 block text-sm font-medium text-neutral-300">
                {labels.annualMileage}
              </label>
              <input
                id="mileage"
                type="number"
                min={0}
                max={100000}
                step={500}
                value={mileage}
                onChange={(e) => updateParam('miles', e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-100 outline-none transition-colors focus:border-warm-400 focus:ring-1 focus:ring-warm-400/50"
              />
            </div>

            {/* Fuel Price */}
            <div className="mb-6">
              <label
                htmlFor="fuel-price"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                {labels.fuelPriceLabel}
              </label>
              <input
                id="fuel-price"
                type="number"
                min={0}
                max={20}
                step={0.1}
                value={fuelPrice}
                onChange={(e) => updateParam('fuel', e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-100 outline-none transition-colors focus:border-warm-400 focus:ring-1 focus:ring-warm-400/50"
              />
            </div>

            {/* Insurance */}
            <div className="mb-6">
              <label
                htmlFor="insurance"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                {labels.insuranceLabel}
              </label>
              <input
                id="insurance"
                type="number"
                min={0}
                max={50000}
                step={50}
                value={insurance}
                onChange={(e) => updateParam('insurance', e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-100 outline-none transition-colors focus:border-warm-400 focus:ring-1 focus:ring-warm-400/50"
              />
            </div>

            {/* Maintenance Tier */}
            <div>
              <span className="mb-3 block text-sm font-medium text-neutral-300">
                {labels.maintenanceTier}
              </span>
              <div className="space-y-3">
                {(Object.keys(MAINTENANCE_COSTS) as MaintenanceTier[]).map((key) => {
                  const tier = labels.maintenanceTiers[key];
                  const cost = MAINTENANCE_COSTS[key];
                  return (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                        maintenance === key
                          ? 'border-warm-400/50 bg-warm-400/5'
                          : 'border-neutral-700 bg-neutral-900/30 hover:border-neutral-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="maintenance"
                        value={key}
                        checked={maintenance === key}
                        onChange={(e) => updateParam('maintenance', e.target.value)}
                        className="mt-0.5 accent-[#D4622E]"
                      />
                      <div>
                        <span className="font-medium text-neutral-100">
                          {tier?.label ?? key}{' '}
                          <span className="text-neutral-500">
                            &mdash; {formatCurrency(cost)}
                            {labels.perYear}
                          </span>
                        </span>
                        <p className="mt-0.5 text-xs text-neutral-500">{tier?.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div>
            <div className="sticky top-24 space-y-6">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8">
                <h2 className="mb-6 text-xl font-bold text-neutral-50">{labels.annualBreakdown}</h2>
                <div className="space-y-4">
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
                  <div className="border-t border-neutral-700 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-neutral-50">
                        {labels.annualTotal}
                      </span>
                      <span className="text-2xl font-extrabold text-warm-400">
                        {formatCurrency(results.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
                  <p className="text-sm text-neutral-400">{labels.costPerMile}</p>
                  <p className="mt-1 text-2xl font-extrabold text-neutral-50">
                    {formatCurrencyPrecise(results.costPerMile)}
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
                  <p className="text-sm text-neutral-400">{labels.fiveYearProjection}</p>
                  <p className="mt-1 text-2xl font-extrabold text-neutral-50">
                    {formatCurrency(results.fiveYear)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-warm-400/20 bg-warm-400/5 p-6 text-center">
                <p className="text-sm text-neutral-400">{labels.monthlyAverage}</p>
                <p className="mt-1 text-3xl font-extrabold text-warm-400">
                  {formatCurrency(results.total / 12)}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{labels.perMonth}</p>
              </div>

              {hasInput && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
                  <p className="mb-3 text-sm text-neutral-400">{labels.shareResults}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      trackEvent(WebEvent.TOOL_USED, {
                        tool: 'cost_calculator',
                        action: 'result_shared',
                        bike_type: bikeType,
                        annual_mileage: mileage,
                        maintenance_tier: maintenance,
                      });
                    }}
                    className="rounded-full bg-neutral-800 px-6 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
                  >
                    {labels.copyLink}
                  </button>
                </div>
              )}

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
                <p
                  className="mb-3 text-sm text-neutral-300"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: translated HTML with <strong>
                  dangerouslySetInnerHTML={{ __html: labels.trackActualCosts }}
                />
                <Link
                  href="/"
                  className="inline-block rounded-full bg-warm-500 px-8 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
                >
                  {labels.getEarlyAccess}
                </Link>
              </div>
            </div>
          </div>
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
    <div className="flex items-center justify-between">
      <div>
        <span className="text-neutral-200">{label}</span>
        {sublabel && <span className="ml-2 text-xs text-neutral-500">({sublabel})</span>}
      </div>
      <span className="font-semibold text-neutral-100">{formatCurrency(amount)}</span>
    </div>
  );
}
