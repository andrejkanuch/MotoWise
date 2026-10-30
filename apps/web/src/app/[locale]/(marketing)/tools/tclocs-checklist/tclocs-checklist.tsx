'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { storeAnchorProps } from '@/components/marketing/store-buttons';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { CtaPageType, CtaPlacement } from '@/lib/cta-taxonomy';
import { detectPlatform, type Platform } from '@/lib/store-links';

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

/**
 * The printed sheet is a standalone document opened in a new window, so it
 * cannot read the site's CSS custom properties. These are the Race Plate
 * values from packages/design-system (paper ramp, near-black ink, copper,
 * go-green) written out once for print only — never used in the page itself.
 */
const PRINT_INK = '#141517';
const PRINT_INK_2 = '#45464a';
const PRINT_INK_3 = '#6b6c70';
const PRINT_LINE = '#dedbd4';
const PRINT_SURFACE = '#ebe9e4';
const PRINT_COPPER = '#b8501f';
const PRINT_GO = '#2e8a55';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;
  return `${seconds}s`;
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function TclocsChecklist({
  categories,
  labels,
}: {
  categories: Category[];
  labels: Labels;
}) {
  const [platform, setPlatform] = useState<Platform>('unknown');
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);
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

      trackEvent(WebEvent.TOOL_USED, {
        tool: 'tclocs_checklist',
        action: 'completed',
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
            return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid ${PRINT_LINE};">
              <div style="width:18px;height:18px;border-radius:5px;border:1.5px solid ${done ? PRINT_COPPER : PRINT_INK_3};background:${done ? PRINT_COPPER : 'white'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                ${done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>' : ''}
              </div>
              <span style="font-size:13px;color:${done ? PRINT_INK_3 : PRINT_INK};">${item}</span>
            </div>`;
          })
          .join('');

        const catDone = catChecked.size === cat.items.length;
        return `<div style="margin-bottom:22px;">
          <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px;">
            <span style="font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700;font-size:28px;line-height:1;color:${catDone ? PRINT_GO : PRINT_INK_3};">${cat.letter}</span>
            <span style="font-weight:600;font-size:16px;color:${PRINT_INK};">${cat.name}</span>
            <span style="margin-left:auto;font-size:12px;color:${catDone ? PRINT_GO : PRINT_INK_3};">${catChecked.size}/${cat.items.length}</span>
          </div>
          ${itemsHtml}
        </div>`;
      })
      .join('');

    const timerHtml = completionTime
      ? `<p style="margin:0 0 16px;font-size:13px;color:${PRINT_GO};font-weight:600;">${labels.timerComplete} ${formatTime(completionTime)}</p>`
      : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${labels.pdfTitle}</title>
      <style>
        @page { margin: 20mm; size: A4; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; color: ${PRINT_INK}; }
      </style>
    </head><body>
      <div style="max-width:600px;margin:0 auto;">
        <div style="padding-bottom:16px;border-bottom:1px solid ${PRINT_INK};margin-bottom:20px;">
          <div style="font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-size:34px;font-weight:700;line-height:1;color:${PRINT_INK};">${labels.pdfTitle}</div>
          <div style="font-size:13px;color:${PRINT_INK_3};margin-top:8px;">${labels.pdfDate}: ${dateStr} — ${timeStr}</div>
        </div>

        <div style="padding:12px 16px;border-radius:12px;background:${PRINT_SURFACE};margin-bottom:16px;">
          <div style="font-size:12px;color:${PRINT_INK_3};margin-bottom:2px;">${labels.pdfStatus}</div>
          <div style="font-size:17px;font-weight:600;color:${allComplete ? PRINT_GO : PRINT_INK};">${statusText}</div>
        </div>

        ${timerHtml}

        ${categoriesHtml}

        <div style="margin-top:28px;padding-top:16px;border-top:1px solid ${PRINT_LINE};">
          <div style="font-size:15px;font-weight:600;color:${PRINT_INK};">MotoVault</div>
          <p style="font-size:13px;color:${PRINT_INK_2};margin:6px 0 0;line-height:1.5;">${labels.pdfCta}</p>
          <div style="margin-top:6px;font-size:13px;font-weight:600;color:${PRINT_COPPER};">${labels.pdfWebsite}</div>
        </div>

        <p style="font-size:11px;color:${PRINT_INK_3};margin-top:20px;">${labels.pdfFooter}</p>
      </div>
    </body></html>`;

    trackEvent(WebEvent.TOOL_USED, {
      tool: 'tclocs_checklist',
      action: 'pdf_downloaded',
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

  const timerFigure = timerStartMs ? formatTime(elapsedMs) : null;

  return (
    <section className="mv-tool" style={{ paddingTop: 56, maxWidth: 760 }}>
      {/* Progress + timer: figures in the condensed face, one hairline below */}
      <div className="mv-check-summary" aria-live="polite">
        <div>
          <span className="mv-check-summary-label">
            {labels.overallProgress} · {overallPercent}%
          </span>
          <span className={`mv-figure${allComplete ? ' is-done' : ''}`}>
            {totalChecked}/{totalItems}
          </span>
          <p className={`mv-check-summary-note${allComplete ? ' is-done' : ''}`}>
            {allComplete ? labels.readyToRide : `${totalItems - totalChecked} ${labels.items} left`}
          </p>
        </div>
        <div className="mv-check-timer">
          <span className="mv-check-summary-label">{labels.timerTitle}</span>
          {timerFigure ? (
            <>
              <span className={`mv-figure${completionTime ? ' is-done' : ''}`}>{timerFigure}</span>
              <p className={`mv-check-timer-sub${completionTime ? ' is-done' : ''}`}>
                {isNewRecord
                  ? labels.newRecord
                  : completionTime
                    ? labels.timerComplete
                    : labels.timerRunning}
              </p>
            </>
          ) : (
            <>
              <span className="mv-figure" style={{ color: 'var(--mv-ink-4)' }}>
                0s
              </span>
              <p className="mv-check-timer-sub">{labels.timerStart}</p>
            </>
          )}
          {bestTime && !isNewRecord && (
            <p className="mv-check-timer-sub">
              {labels.personalBest}{' '}
              <span className="mv-figure" style={{ fontSize: 15, color: 'var(--mv-ink-2)' }}>
                {formatTime(bestTime)}
              </span>
            </p>
          )}
          {!bestTime && !timerStartMs && <p className="mv-check-timer-sub">{labels.noBestYet}</p>}
        </div>
      </div>
      <div className="mv-progress" aria-hidden="true">
        <div
          className={allComplete ? 'is-done' : undefined}
          style={{ width: `${overallPercent}%` }}
        />
      </div>

      {/* Six groups: a big letter, the name, a real checkbox per item */}
      {categories.map((category) => {
        const catChecked = checked[category.id]?.size ?? 0;
        const catTotal = category.items.length;
        const catComplete = catChecked === catTotal;

        return (
          <fieldset
            key={category.id}
            className="mv-check-group"
            style={{ border: 0, padding: 0, margin: '40px 0 0', minWidth: 0 }}
          >
            <legend className="sr-only">{category.name}</legend>
            <div className={`mv-check-head${catComplete ? ' is-done' : ''}`}>
              <span className="mv-check-letter" aria-hidden="true">
                {category.letter}
              </span>
              <h2 className="mv-check-name">{category.name}</h2>
              <span className="mv-check-count mv-figure">
                {catChecked}/{catTotal}
              </span>
            </div>

            <ul className="mv-check-items">
              {category.items.map((item, index) => {
                const isChecked = checked[category.id]?.has(index) ?? false;
                return (
                  <li key={item}>
                    <label className="mv-check-item">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(category.id, index)}
                      />
                      <span className="mv-check-box" aria-hidden="true">
                        <CheckIcon />
                      </span>
                      <span className="mv-check-text">{item}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}

      <div className="mv-tool-actions" style={{ marginTop: 40 }}>
        <button type="button" onClick={generatePdf} className="mv-btn mv-btn-ghost">
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
        {totalChecked > 0 && (
          <button type="button" onClick={resetAll} className="mv-text-action">
            {labels.resetAll}
          </button>
        )}
      </div>

      <div className="mv-tool-cta">
        <h2>{labels.ctaTitle}</h2>
        <p>{labels.ctaDesc}</p>
        <a
          {...storeAnchorProps(platform, {
            pageType: CtaPageType.Tool,
            placement: CtaPlacement.Inline,
            slug: 'tclocs-checklist',
            referrerParams: { utm_source: 'tool', utm_campaign: 'tclocs_checklist' },
          })}
          className="mv-btn mv-btn-primary"
        >
          {labels.getEarlyAccess}
        </a>
      </div>
    </section>
  );
}
