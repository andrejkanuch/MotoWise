'use client';

import type { MaintenanceDraftReviewQuery } from '@motovault/graphql';
import {
  ApproveMaintenanceDraftDocument,
  MaintenanceDraftReviewDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { gqlFetcher } from '@/lib/graphql-client';

// ─── Query key (shared so onSuccess invalidation matches the list query) ───
const MAINTENANCE_REVIEW_QUERY_KEY = ['admin', 'maintenance-draft-review'] as const;

// ─── Draft-kind discriminator (matches the API mutation `kind` param) ───
const DRAFT_KIND = {
  schedule: 'schedule',
  spec: 'spec',
} as const;
type DraftKind = (typeof DRAFT_KIND)[keyof typeof DRAFT_KIND];

// ─── Type aliases off the generated query result ───
type ReviewData = MaintenanceDraftReviewQuery['maintenanceDraftReview'];
type ScheduleDraft = ReviewData['schedules'][number];
type SpecDraft = ReviewData['specs'][number];

// A normalized shape both schedules and specs map into for the row UI. Keeps the
// row component data-driven instead of branching schedule-vs-spec everywhere.
type DraftRow = {
  id: string;
  kind: DraftKind;
  name: string; // task name (schedule) or spec name (spec)
  bike: string; // "Make Model · Variant"
  valueDisplay: string; // human-readable value shown in the card + confirm
  retypeTarget: string; // the exact string the reviewer must re-type (safety-critical only)
  unit: string | null;
  isSafetyCritical: boolean;
  sourcePage: string | null;
  sourceContext: string | null;
  sourceTitle: string | null;
};

function formatBike(
  make: string,
  model: string | null | undefined,
  variant: string | null | undefined,
): string {
  const base = [make, model].filter(Boolean).join(' ');
  return variant ? `${base} · ${variant}` : base;
}

// Schedule value: intervalKm + intervalDays (either may be null).
function scheduleValueDisplay(d: ScheduleDraft): string {
  const parts: string[] = [];
  if (d.intervalKm != null) parts.push(`${d.intervalKm.toLocaleString()} km`);
  if (d.intervalDays != null) parts.push(`${d.intervalDays.toLocaleString()} days`);
  return parts.length > 0 ? parts.join(' / ') : '—';
}

function mapSchedule(d: ScheduleDraft): DraftRow {
  const valueDisplay = scheduleValueDisplay(d);
  return {
    id: d.id,
    kind: DRAFT_KIND.schedule,
    name: d.taskName,
    bike: formatBike(d.make, d.model, d.variant),
    valueDisplay,
    // Re-type target for schedules is the interval string (km / days) the reviewer sees.
    retypeTarget: valueDisplay,
    unit: null,
    isSafetyCritical: d.isSafetyCritical,
    sourcePage: d.sourcePage ?? null,
    sourceContext: d.sourceContext ?? null,
    sourceTitle: d.sourceTitle ?? null,
  };
}

function mapSpec(d: SpecDraft): DraftRow {
  // value_display is the canonical human string; fall back to numeric+unit if absent.
  const valueDisplay = d.valueDisplay ?? `${d.valueNumeric}${d.unit ? ` ${d.unit}` : ''}`.trim();
  return {
    id: d.id,
    kind: DRAFT_KIND.spec,
    name: d.specName,
    bike: formatBike(d.make, d.model, d.variant),
    valueDisplay,
    // Re-type target for specs is value_display per the anti-rubber-stamp spec.
    retypeTarget: d.valueDisplay ?? valueDisplay,
    unit: d.unit ?? null,
    isSafetyCritical: d.isSafetyCritical,
    sourcePage: d.sourcePage ?? null,
    sourceContext: d.sourceContext ?? null,
    sourceTitle: d.sourceTitle ?? null,
  };
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-200 align-[-2px]"
      aria-hidden="true"
    />
  );
}

// ─── Single draft row ───
function DraftReviewRow({
  row,
  onApprove,
  isApproving,
  error,
}: {
  row: DraftRow;
  onApprove: (row: DraftRow) => void;
  isApproving: boolean;
  error: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  const hasCitation = Boolean(row.sourceTitle || row.sourcePage || row.sourceContext);
  const retypeMatches = typed.trim() === row.retypeTarget.trim();

  return (
    <div
      className={`p-5 border rounded-2xl bg-neutral-900 ${
        row.isSafetyCritical ? 'border-amber-700/60' : 'border-neutral-800'
      }`}
    >
      {/* Header: name + badges */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-neutral-50 truncate">{row.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
              {row.kind === DRAFT_KIND.schedule ? 'Interval' : 'Spec'}
            </span>
            {row.isSafetyCritical && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 font-medium">
                Safety-critical
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-400">{row.bike}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-neutral-50 tabular-nums">{row.valueDisplay}</p>
          {row.unit && <p className="text-xs text-neutral-500">{row.unit}</p>}
        </div>
      </div>

      {/* Citation block — reviewer confirms the value is for the RIGHT spec */}
      <div className="mt-4 p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
        {hasCitation ? (
          <>
            <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-400">
              {row.sourceTitle && (
                <span className="font-medium text-neutral-300">{row.sourceTitle}</span>
              )}
              {row.sourcePage && (
                <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                  Page {row.sourcePage}
                </span>
              )}
            </div>
            {row.sourceContext && (
              <p className="mt-2 text-sm text-neutral-300 italic leading-relaxed">
                “{row.sourceContext}”
              </p>
            )}
          </>
        ) : (
          <p className="text-sm font-medium text-red-400">
            ⚠ Missing citation — cannot verify this value against a source.
          </p>
        )}
      </div>

      {/* Error + retry */}
      {error && (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-red-400">
          <span>Approve failed: {error}</span>
          <button
            type="button"
            onClick={() => onApprove(row)}
            disabled={isApproving}
            className="px-3 py-1 rounded-lg border border-red-800 text-red-300 hover:bg-red-950/40 transition-colors disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4">
        {row.isSafetyCritical ? (
          confirming ? (
            <div className="space-y-3">
              <p className="text-sm text-neutral-300">
                Re-type the value to confirm you read it on{' '}
                {row.sourcePage ? `page ${row.sourcePage}` : 'the cited source'}:{' '}
                <span className="font-mono text-neutral-100">{row.retypeTarget}</span>
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Re-type value exactly"
                  className="flex-1 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:outline-none focus:border-neutral-500"
                  // biome-ignore lint/a11y/noAutofocus: focus the confirm field when the reviewer opens it
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => onApprove(row)}
                  disabled={!retypeMatches || isApproving}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {isApproving && <Spinner />}
                  Confirm approve
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setTyped('');
                  }}
                  disabled={isApproving}
                  className="px-3 py-2 rounded-lg border border-neutral-700 text-neutral-300 text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              {typed.length > 0 && !retypeMatches && (
                <p className="text-xs text-red-400">Value does not match the cited value.</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={isApproving}
              className="px-4 py-2 rounded-lg border border-amber-700 text-amber-300 text-sm font-medium hover:bg-amber-950/40 transition-colors disabled:opacity-50"
            >
              Approve (requires re-type)
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => onApprove(row)}
            disabled={isApproving}
            className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-900 text-sm font-medium hover:bg-white transition-colors disabled:opacity-40 inline-flex items-center gap-2"
          >
            {isApproving && <Spinner />}
            Approve
          </button>
        )}
      </div>
    </div>
  );
}

export default function MaintenanceReviewPage() {
  const queryClient = useQueryClient();
  // Per-row in-flight + error state, keyed by `${kind}:${id}`.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [bulkRunning, setBulkRunning] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: MAINTENANCE_REVIEW_QUERY_KEY,
    queryFn: () => gqlFetcher(MaintenanceDraftReviewDocument),
  });

  const approveMutation = useMutation({
    mutationFn: (row: DraftRow) =>
      gqlFetcher(ApproveMaintenanceDraftDocument, { input: { kind: row.kind, id: row.id } }),
  });

  const rowKey = (row: DraftRow) => `${row.kind}:${row.id}`;

  // Approve a single row; resolves true on success so the bulk action can sequence.
  const approveRow = async (row: DraftRow): Promise<boolean> => {
    const key = rowKey(row);
    setPendingKey(key);
    setRowErrors((prev) => {
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });
    try {
      await approveMutation.mutateAsync(row);
      // Invalidate so the approved row disappears on refetch.
      await queryClient.invalidateQueries({ queryKey: MAINTENANCE_REVIEW_QUERY_KEY });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setRowErrors((prev) => ({ ...prev, [key]: message }));
      return false;
    } finally {
      setPendingKey((cur) => (cur === key ? null : cur));
    }
  };

  const rows: DraftRow[] = data
    ? [
        ...data.maintenanceDraftReview.schedules.map(mapSchedule),
        ...data.maintenanceDraftReview.specs.map(mapSpec),
      ]
    : [];

  const nonCriticalRows = rows.filter((r) => !r.isSafetyCritical);

  // Bulk "approve all non-safety-critical": calls the single-id mutation once per
  // non-critical row (there is no array param). Sequential so per-row errors stick.
  const approveAllNonCritical = async () => {
    setBulkRunning(true);
    try {
      for (const row of nonCriticalRows) {
        await approveRow(row);
      }
    } finally {
      setBulkRunning(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-50">Maintenance Draft Review</h1>
          <p className="mt-2 text-neutral-400 max-w-2xl">
            Review extracted OEM intervals and specs against their cited source before they go live.
            Safety-critical values require you to re-type the value to confirm you read it on the
            cited page.
          </p>
          <p className="mt-2 text-xs text-neutral-500 max-w-2xl">
            Pilot is <strong className="text-neutral-400">single-source</strong> — there is no
            cross-source mismatch flag yet. Confirm each value against its citation context (intake
            vs exhaust, hot vs cold, DCT vs MT) before approving.
          </p>
        </div>
        {nonCriticalRows.length > 0 && (
          <button
            type="button"
            onClick={approveAllNonCritical}
            disabled={bulkRunning || pendingKey !== null}
            className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-200 text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 inline-flex items-center gap-2 shrink-0"
          >
            {bulkRunning && <Spinner />}
            Approve all non-safety-critical ({nonCriticalRows.length})
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="mt-10 flex items-center justify-center py-24">
          <Spinner />
        </div>
      )}

      {/* List-level error */}
      {isError && !isLoading && (
        <div className="mt-10 p-6 border border-red-900 rounded-2xl bg-neutral-900 text-center">
          <p className="text-red-400">Failed to load drafts.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 px-4 py-2 rounded-lg bg-neutral-100 text-neutral-900 text-sm font-medium hover:bg-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && rows.length === 0 && (
        <div className="mt-10 p-12 border border-neutral-800 rounded-2xl bg-neutral-900 text-center">
          <p className="text-neutral-300 font-medium">No pending drafts — all values verified</p>
          <p className="mt-1 text-sm text-neutral-500">
            New extractions will appear here for review.
          </p>
        </div>
      )}

      {/* Rows */}
      {!isLoading && !isError && rows.length > 0 && (
        <div className="mt-8 space-y-4">
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <DraftReviewRow
                key={key}
                row={row}
                onApprove={(r) => {
                  void approveRow(r);
                }}
                isApproving={pendingKey === key}
                error={rowErrors[key] ?? null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
