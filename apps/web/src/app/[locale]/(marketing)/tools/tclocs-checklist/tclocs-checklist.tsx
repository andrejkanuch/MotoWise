'use client';

import { useCallback, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';

const CATEGORIES = [
  {
    id: 'tires',
    letter: 'T',
    name: 'Tires',
    items: [
      'Check tire pressure',
      'Inspect tread depth (>2mm)',
      'Look for cracks/damage',
      'Check valve stems',
      'Verify wheel bearings',
    ],
  },
  {
    id: 'controls',
    letter: 'C',
    name: 'Controls',
    items: [
      'Test front brake lever',
      'Test rear brake pedal',
      'Check clutch free play',
      'Verify throttle snap-back',
      'Test horn',
    ],
  },
  {
    id: 'lights',
    letter: 'L',
    name: 'Lights',
    items: [
      'Headlight (low/high)',
      'Tail light',
      'Brake light (both levers)',
      'Turn signals (all 4)',
      'Dashboard warnings',
    ],
  },
  {
    id: 'oil',
    letter: 'O',
    name: 'Oil',
    items: [
      'Check oil level',
      'Look for leaks',
      'Verify oil color',
      'Check coolant (if liquid-cooled)',
    ],
  },
  {
    id: 'chassis',
    letter: 'C',
    name: 'Chassis',
    items: [
      'Inspect frame for cracks',
      'Check suspension',
      'Verify fasteners tight',
      'Check chain tension/lube',
    ],
  },
  {
    id: 'stands',
    letter: 'S',
    name: 'Stands',
    items: [
      'Side stand retracts fully',
      'Center stand (if equipped)',
      'Stand switch works',
    ],
  },
] as const;

type CheckedState = Record<string, Set<number>>;

function buildInitialState(): CheckedState {
  const state: CheckedState = {};
  for (const cat of CATEGORIES) {
    state[cat.id] = new Set<number>();
  }
  return state;
}

export function TclocsChecklist() {
  const [checked, setChecked] = useState<CheckedState>(buildInitialState);

  const toggleItem = useCallback((categoryId: string, itemIndex: number) => {
    setChecked((prev) => {
      const next = { ...prev };
      const set = new Set(prev[categoryId]);
      if (set.has(itemIndex)) {
        set.delete(itemIndex);
      } else {
        set.add(itemIndex);
      }
      next[categoryId] = set;
      return next;
    });
  }, []);

  const totalItems = useMemo(() => CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0), []);
  const totalChecked = useMemo(
    () => Object.values(checked).reduce((sum, set) => sum + set.size, 0),
    [checked],
  );

  const overallPercent = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;
  const allComplete = totalChecked === totalItems;

  const resetAll = useCallback(() => {
    setChecked(buildInitialState());
  }, []);

  return (
    <section className="px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Overall Progress */}
        <div className="mb-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 print:border-neutral-300 print:bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-400 print:text-neutral-600">
                Overall Progress
              </p>
              <p className="mt-1 text-3xl font-extrabold text-neutral-50 print:text-neutral-900">
                {totalChecked}/{totalItems} items
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-3xl font-extrabold ${
                  allComplete ? 'text-green-400' : 'text-warm-400'
                } print:text-neutral-900`}
              >
                {overallPercent}%
              </p>
              {allComplete && (
                <p className="mt-1 text-sm font-medium text-green-400 print:text-green-700">
                  Ready to ride!
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-800 print:bg-neutral-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                allComplete ? 'bg-green-500' : 'bg-warm-400'
              } print:bg-neutral-900`}
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          {totalChecked > 0 && (
            <button
              type="button"
              onClick={resetAll}
              className="mt-4 text-sm text-neutral-500 transition-colors hover:text-neutral-300 print:hidden"
            >
              Reset all
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="space-y-6">
          {CATEGORIES.map((category) => {
            const catChecked = checked[category.id]?.size ?? 0;
            const catTotal = category.items.length;
            const catPercent = catTotal > 0 ? Math.round((catChecked / catTotal) * 100) : 0;
            const catComplete = catChecked === catTotal;

            return (
              <div
                key={category.id}
                className={`rounded-2xl border p-6 transition-colors print:border-neutral-300 print:bg-white ${
                  catComplete
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-neutral-800 bg-neutral-900/50'
                }`}
              >
                {/* Category Header */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold print:border print:border-neutral-400 ${
                        catComplete
                          ? 'bg-green-500/20 text-green-400 print:text-green-700'
                          : 'bg-warm-400/10 text-warm-400 print:text-neutral-700'
                      }`}
                    >
                      {category.letter}
                    </div>
                    <h2 className="text-xl font-bold text-neutral-50 print:text-neutral-900">
                      {category.name}
                    </h2>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      catComplete
                        ? 'text-green-400 print:text-green-700'
                        : 'text-neutral-500 print:text-neutral-600'
                    }`}
                  >
                    {catChecked}/{catTotal}
                  </span>
                </div>

                {/* Category Progress Bar */}
                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-neutral-800 print:bg-neutral-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      catComplete ? 'bg-green-500' : 'bg-warm-400'
                    } print:bg-neutral-700`}
                    style={{ width: `${catPercent}%` }}
                  />
                </div>

                {/* Items */}
                <ul className="space-y-2">
                  {category.items.map((item, index) => {
                    const isChecked = checked[category.id]?.has(index) ?? false;
                    return (
                      <li key={item}>
                        <button
                          type="button"
                          onClick={() => toggleItem(category.id, index)}
                          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all print:border print:border-neutral-300 ${
                            isChecked
                              ? 'bg-green-500/10 print:bg-green-50'
                              : 'bg-neutral-800/30 hover:bg-neutral-800/60 print:bg-white'
                          }`}
                        >
                          {/* Checkbox */}
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all print:border-neutral-400 ${
                              isChecked
                                ? 'border-green-500 bg-green-500 print:border-green-600 print:bg-green-600'
                                : 'border-neutral-600'
                            }`}
                          >
                            {isChecked && (
                              <svg
                                className="h-4 w-4 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </span>
                          <span
                            className={`text-sm transition-all ${
                              isChecked
                                ? 'text-neutral-500 line-through print:text-neutral-600'
                                : 'text-neutral-200 print:text-neutral-800'
                            }`}
                          >
                            {item}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Print Button */}
        <div className="mt-8 flex justify-center print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-neutral-800 px-8 py-3 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
          >
            Print Checklist
          </button>
        </div>

        {/* CTA */}
        <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 text-center print:hidden">
          <h2 className="text-xl font-bold text-neutral-50">
            Get Automated Pre-Ride Reminders
          </h2>
          <p className="mt-3 text-neutral-400">
            MotoVault sends smart reminders before your rides and tracks maintenance
            history so you never miss a critical check.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-warm-500 px-8 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
          >
            Get Early Access
          </Link>
        </div>
      </div>

      {/* Print Styles */}
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: print stylesheet
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body { background: white !important; color: black !important; }
              nav, footer, .grain-overlay { display: none !important; }
              .print\\:hidden { display: none !important; }
            }
          `.replace(/</g, '\\u003c'),
        }}
      />
    </section>
  );
}
