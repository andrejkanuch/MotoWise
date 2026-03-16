'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { Link } from '@/i18n/navigation';

const BIKE_TYPES = {
  sport: { label: 'Sport', mpg: 40 },
  cruiser: { label: 'Cruiser', mpg: 45 },
  adventure: { label: 'Adventure', mpg: 50 },
  naked: { label: 'Naked', mpg: 45 },
  touring: { label: 'Touring', mpg: 38 },
} as const;

type BikeType = keyof typeof BIKE_TYPES;

const MAINTENANCE_TIERS = {
  basic: { label: 'Basic', cost: 300, description: 'Oil changes, chain lube, basic upkeep' },
  moderate: {
    label: 'Moderate',
    cost: 600,
    description: 'Basic + brake pads, filters, valve checks',
  },
  premium: { label: 'Premium', cost: 1200, description: 'Full dealer servicing, all consumables' },
} as const;

type MaintenanceTier = keyof typeof MAINTENANCE_TIERS;

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

export function CostCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const bikeType = (searchParams.get('type') as BikeType) || 'naked';
  const mileage = parseNum(searchParams.get('miles'), 5000);
  const fuelPrice = parseNum(searchParams.get('fuel'), 3.5);
  const insurance = parseNum(searchParams.get('insurance'), 800);
  const maintenance = (searchParams.get('maintenance') as MaintenanceTier) || 'moderate';

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  const results = useMemo(() => {
    const mpg = BIKE_TYPES[bikeType]?.mpg ?? 45;
    const maintenanceCost = MAINTENANCE_TIERS[maintenance]?.cost ?? 600;
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

  const hasInput = searchParams.toString().length > 0;

  return (
    <section className="px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Input Panel */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8">
            <h2 className="mb-6 text-xl font-bold text-neutral-50">Your Riding Profile</h2>

            {/* Bike Type */}
            <div className="mb-6">
              <label
                htmlFor="bike-type"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                Bike Type
              </label>
              <select
                id="bike-type"
                value={bikeType}
                onChange={(e) => updateParam('type', e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-100 outline-none transition-colors focus:border-warm-400 focus:ring-1 focus:ring-warm-400/50"
              >
                {Object.entries(BIKE_TYPES).map(([key, { label, mpg }]) => (
                  <option key={key} value={key}>
                    {label} (~{mpg} MPG)
                  </option>
                ))}
              </select>
            </div>

            {/* Annual Mileage */}
            <div className="mb-6">
              <label htmlFor="mileage" className="mb-2 block text-sm font-medium text-neutral-300">
                Annual Mileage
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
                Fuel Price per Gallon ($)
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
                Annual Insurance Cost ($)
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
                Maintenance Tier
              </span>
              <div className="space-y-3">
                {Object.entries(MAINTENANCE_TIERS).map(([key, { label, cost, description }]) => (
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
                        {label}{' '}
                        <span className="text-neutral-500">&mdash; {formatCurrency(cost)}/yr</span>
                      </span>
                      <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div>
            <div className="sticky top-24 space-y-6">
              {/* Annual Breakdown */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8">
                <h2 className="mb-6 text-xl font-bold text-neutral-50">Annual Cost Breakdown</h2>
                <div className="space-y-4">
                  <CostRow
                    label="Fuel"
                    sublabel={`${BIKE_TYPES[bikeType]?.mpg ?? 45} MPG avg`}
                    amount={results.fuelCost}
                  />
                  <CostRow label="Insurance" amount={results.insurance} />
                  <CostRow
                    label="Maintenance"
                    sublabel={MAINTENANCE_TIERS[maintenance]?.label ?? 'Moderate'}
                    amount={results.maintenanceCost}
                  />
                  <CostRow label="Tires" amount={results.tires} />
                  <CostRow label="Registration & Fees" amount={results.registration} />

                  <div className="border-t border-neutral-700 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-neutral-50">Annual Total</span>
                      <span className="text-2xl font-extrabold text-warm-400">
                        {formatCurrency(results.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
                  <p className="text-sm text-neutral-400">Cost per Mile</p>
                  <p className="mt-1 text-2xl font-extrabold text-neutral-50">
                    {formatCurrencyPrecise(results.costPerMile)}
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
                  <p className="text-sm text-neutral-400">5-Year Projection</p>
                  <p className="mt-1 text-2xl font-extrabold text-neutral-50">
                    {formatCurrency(results.fiveYear)}
                  </p>
                </div>
              </div>

              {/* Monthly */}
              <div className="rounded-2xl border border-warm-400/20 bg-warm-400/5 p-6 text-center">
                <p className="text-sm text-neutral-400">Monthly Average</p>
                <p className="mt-1 text-3xl font-extrabold text-warm-400">
                  {formatCurrency(results.total / 12)}
                </p>
                <p className="mt-1 text-xs text-neutral-500">per month</p>
              </div>

              {/* Share / CTA */}
              {hasInput && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
                  <p className="mb-3 text-sm text-neutral-400">
                    Share these results &mdash; the URL updates automatically with your inputs.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                    }}
                    className="rounded-full bg-neutral-800 px-6 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
                  >
                    Copy Link
                  </button>
                </div>
              )}

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
                <p className="mb-3 text-sm text-neutral-300">
                  Track your <strong>actual</strong> costs with MotoVault
                </p>
                <Link
                  href="/"
                  className="inline-block rounded-full bg-warm-500 px-8 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
                >
                  Get Early Access
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
