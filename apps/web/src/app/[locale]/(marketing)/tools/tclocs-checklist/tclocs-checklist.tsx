'use client';

import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';

interface Category {
  id: string;
  letter: string;
  name: string;
  items: string[];
}

interface Labels {
  overallProgress: string;
  items: string;
  readyToRide: string;
  resetAll: string;
  printChecklist: string;
  ctaTitle: string;
  ctaDesc: string;
  getEarlyAccess: string;
  timerTitle: string;
  timerStart: string;
  timerRunning: string;
  timerComplete: string;
  personalBest: string;
  newRecord: string;
  noBestYet: string;
  downloadPdf: string;
  pdfTitle: string;
  pdfDate: string;
  pdfStatus: string;
  pdfComplete: string;
  pdfIncomplete: string;
  pdfFooter: string;
  pdfCta: string;
  pdfWebsite: string;
}

type CheckedState = Record<string, Set<number>>;

const BEST_TIME_KEY = 'motovault-tclocs-best';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;
  return `${seconds}s`;
}

export function TclocsChecklist({
  categories,
  labels,
}: {
  categories: Category[];
  labels: Labels;
}) {
  const [checked, setChecked] = useState<CheckedState>(() => {
    const state: CheckedState = {};
    for (const cat of categories) {
      state[cat.id] = new Set<number>();
    }
    return state;
  });

  // Timer state
  const [timerStartMs, setTimerStartMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [completionTime, setCompletionTime] = useState<number | null>(null);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load best time from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BEST_TIME_KEY);
      if (saved) setBestTime(Number.parseInt(saved, 10));
    } catch {}
  }, []);

  // Timer tick
  useEffect(() => {
    if (timerStartMs && !completionTime) {
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - timerStartMs);
      }, 100);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [timerStartMs, completionTime]);

  const totalItems = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.items.length, 0),
    [categories],
  );
  const totalChecked = useMemo(
    () => Object.values(checked).reduce((sum, set) => sum + set.size, 0),
    [checked],
  );
  const overallPercent = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;
  const allComplete = totalChecked === totalItems;

  // Check for completion
  useEffect(() => {
    if (allComplete && totalChecked > 0 && timerStartMs && !completionTime) {
      const time = Date.now() - timerStartMs;
      setCompletionTime(time);
      setElapsedMs(time);
      if (timerRef.current) clearInterval(timerRef.current);

      posthog.capture('tclocs_checklist_completed', {
        completion_time_ms: time,
        total_items: totalItems,
      });

      // Check for new record
      if (!bestTime || time < bestTime) {
        setBestTime(time);
        setIsNewRecord(true);
        try {
          localStorage.setItem(BEST_TIME_KEY, String(time));
        } catch {}
      }
    }
  }, [allComplete, totalChecked, timerStartMs, completionTime, bestTime, totalItems]);

  const toggleItem = useCallback(
    (categoryId: string, itemIndex: number) => {
      setChecked((prev) => {
        const next = { ...prev };
        const set = new Set(prev[categoryId]);
        if (set.has(itemIndex)) {
          set.delete(itemIndex);
        } else {
          set.add(itemIndex);
        }
        next[categoryId] = set;

        // Start timer on first check
        if (!timerStartMs) {
          setTimerStartMs(Date.now());
        }

        return next;
      });
    },
    [timerStartMs],
  );

  const resetAll = useCallback(() => {
    const state: CheckedState = {};
    for (const cat of categories) {
      state[cat.id] = new Set<number>();
    }
    setChecked(state);
    setTimerStartMs(null);
    setElapsedMs(0);
    setCompletionTime(null);
    setIsNewRecord(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [categories]);

  const generatePdf = useCallback(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

    const statusText = allComplete
      ? labels.pdfComplete
      : labels.pdfIncomplete
          .replace('{checked}', String(totalChecked))
          .replace('{total}', String(totalItems));

    const categoriesHtml = categories
      .map((cat) => {
        const catChecked = checked[cat.id] ?? new Set();
        const itemsHtml = cat.items
          .map((item, i) => {
            const done = catChecked.has(i);
            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;">
              <div style="width:18px;height:18px;border-radius:4px;border:2px solid ${done ? '#22c55e' : '#d1d5db'};background:${done ? '#22c55e' : 'white'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                ${done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>' : ''}
              </div>
              <span style="font-size:13px;color:${done ? '#6b7280' : '#1f2937'};${done ? 'text-decoration:line-through;' : ''}">${item}</span>
            </div>`;
          })
          .join('');

        const catDone = catChecked.size === cat.items.length;
        return `<div style="margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="width:32px;height:32px;border-radius:50%;background:${catDone ? '#dcfce7' : '#fef3c7'};color:${catDone ? '#16a34a' : '#d97706'};display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:15px;">${cat.letter}</div>
            <span style="font-weight:700;font-size:16px;color:#111827;">${cat.name}</span>
            <span style="margin-left:auto;font-size:12px;color:${catDone ? '#16a34a' : '#6b7280'};">${catChecked.size}/${cat.items.length}</span>
          </div>
          ${itemsHtml}
        </div>`;
      })
      .join('');

    const timerHtml = completionTime
      ? `<div style="text-align:center;padding:12px;background:#f0fdf4;border-radius:8px;margin-bottom:16px;">
            <span style="font-size:13px;color:#16a34a;font-weight:600;">${labels.timerComplete} ${formatTime(completionTime)}</span>
          </div>`
      : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${labels.pdfTitle}</title>
      <style>
        @page { margin: 20mm; size: A4; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; color: #1f2937; }
      </style>
    </head><body>
      <div style="max-width:600px;margin:0 auto;">
        <!-- Header -->
        <div style="text-align:center;padding-bottom:20px;border-bottom:3px solid #D4622E;margin-bottom:24px;">
          <div style="font-size:28px;font-weight:800;color:#111827;letter-spacing:-0.5px;">Moto<span style="color:#D4622E;">Vault</span></div>
          <div style="font-size:20px;font-weight:700;color:#374151;margin-top:8px;">${labels.pdfTitle}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:6px;">${labels.pdfDate}: ${dateStr} — ${timeStr}</div>
        </div>

        <!-- Status -->
        <div style="padding:16px;border-radius:12px;background:${allComplete ? '#f0fdf4' : '#fff7ed'};border:1px solid ${allComplete ? '#bbf7d0' : '#fed7aa'};margin-bottom:20px;text-align:center;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:4px;">${labels.pdfStatus}</div>
          <div style="font-size:18px;font-weight:700;color:${allComplete ? '#16a34a' : '#ea580c'};">${statusText}</div>
        </div>

        ${timerHtml}

        <!-- Categories -->
        ${categoriesHtml}

        <!-- CTA -->
        <div style="margin-top:32px;padding:20px;border-radius:12px;background:linear-gradient(135deg,#1e1b4b,#312e81);text-align:center;">
          <div style="font-size:20px;font-weight:800;color:white;letter-spacing:-0.3px;">Moto<span style="color:#D4A26E;">Vault</span></div>
          <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:10px 0 0;line-height:1.5;">${labels.pdfCta}</p>
          <div style="margin-top:12px;font-size:14px;font-weight:600;color:#D4A26E;">${labels.pdfWebsite}</div>
        </div>

        <!-- Footer -->
        <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:20px;">${labels.pdfFooter}</p>
      </div>
    </body></html>`;

    posthog.capture('tclocs_pdf_downloaded', {
      items_checked: totalChecked,
      total_items: totalItems,
      all_complete: allComplete,
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }, [categories, checked, allComplete, totalChecked, totalItems, completionTime, labels]);

  return (
    <section className="px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Timer + Progress Row */}
        <div className="mb-8 grid gap-4 md:grid-cols-[1fr_auto]">
          {/* Overall Progress */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-400">{labels.overallProgress}</p>
                <p className="mt-1 text-3xl font-extrabold text-neutral-50">
                  {totalChecked}/{totalItems} {labels.items}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-3xl font-extrabold ${allComplete ? 'text-green-400' : 'text-warm-400'}`}
                >
                  {overallPercent}%
                </p>
                {allComplete && (
                  <p className="mt-1 text-sm font-medium text-green-400">{labels.readyToRide}</p>
                )}
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${allComplete ? 'bg-green-500' : 'bg-warm-400'}`}
                style={{ width: `${overallPercent}%` }}
              />
            </div>
            {totalChecked > 0 && (
              <button
                type="button"
                onClick={resetAll}
                className="mt-4 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
              >
                {labels.resetAll}
              </button>
            )}
          </div>

          {/* Speed Run Timer */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 md:w-48">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-warm-400">
              {labels.timerTitle}
            </p>
            {!timerStartMs ? (
              <p className="mt-2 text-center text-xs text-neutral-500">{labels.timerStart}</p>
            ) : (
              <>
                <p
                  className={`mt-1 font-mono text-3xl font-bold tabular-nums ${completionTime ? 'text-green-400' : 'text-neutral-50'}`}
                >
                  {formatTime(elapsedMs)}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {completionTime ? labels.timerComplete : labels.timerRunning}
                </p>
                {isNewRecord && (
                  <p className="mt-2 animate-pulse text-xs font-bold text-warm-400">
                    {labels.newRecord}
                  </p>
                )}
              </>
            )}
            {bestTime && !isNewRecord && (
              <div className="mt-3 border-t border-neutral-800 pt-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-neutral-600">
                  {labels.personalBest}
                </p>
                <p className="font-mono text-sm font-semibold text-neutral-400">
                  {formatTime(bestTime)}
                </p>
              </div>
            )}
            {!bestTime && !timerStartMs && (
              <p className="mt-2 text-center text-[10px] text-neutral-600">{labels.noBestYet}</p>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-6">
          {categories.map((category) => {
            const catChecked = checked[category.id]?.size ?? 0;
            const catTotal = category.items.length;
            const catPercent = catTotal > 0 ? Math.round((catChecked / catTotal) * 100) : 0;
            const catComplete = catChecked === catTotal;

            return (
              <div
                key={category.id}
                className={`rounded-2xl border p-6 transition-colors ${
                  catComplete
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-neutral-800 bg-neutral-900/50'
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
                        catComplete
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-warm-400/10 text-warm-400'
                      }`}
                    >
                      {category.letter}
                    </div>
                    <h2 className="text-xl font-bold text-neutral-50">{category.name}</h2>
                  </div>
                  <span
                    className={`text-sm font-medium ${catComplete ? 'text-green-400' : 'text-neutral-500'}`}
                  >
                    {catChecked}/{catTotal}
                  </span>
                </div>

                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${catComplete ? 'bg-green-500' : 'bg-warm-400'}`}
                    style={{ width: `${catPercent}%` }}
                  />
                </div>

                <ul className="space-y-2">
                  {category.items.map((item, index) => {
                    const isChecked = checked[category.id]?.has(index) ?? false;
                    return (
                      <li key={item}>
                        <button
                          type="button"
                          onClick={() => toggleItem(category.id, index)}
                          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                            isChecked
                              ? 'bg-green-500/10'
                              : 'bg-neutral-800/30 hover:bg-neutral-800/60'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                              isChecked ? 'border-green-500 bg-green-500' : 'border-neutral-600'
                            }`}
                          >
                            {isChecked && (
                              <svg
                                className="h-4 w-4 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                                aria-label="Checked"
                                role="img"
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
                              isChecked ? 'text-neutral-500 line-through' : 'text-neutral-200'
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

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={generatePdf}
            className="flex items-center gap-2 rounded-full bg-warm-500 px-8 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
          >
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
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {labels.downloadPdf}
          </button>
        </div>

        {/* CTA */}
        <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
          <h2 className="text-xl font-bold text-neutral-50">{labels.ctaTitle}</h2>
          <p className="mt-3 text-neutral-400">{labels.ctaDesc}</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-warm-500 px-8 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
          >
            {labels.getEarlyAccess}
          </Link>
        </div>
      </div>
    </section>
  );
}
