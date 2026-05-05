'use client';

import { useCallback, useState } from 'react';

/* ── Types ───────────────────────────────────────────────────── */

type WaypointType =
  | 'start'
  | 'end'
  | 'fuel'
  | 'food'
  | 'scenic'
  | 'overnight'
  | 'photo'
  | 'pass_summit';
type Difficulty = 'easy' | 'moderate' | 'challenging' | 'expert';
type Surface = 'paved' | 'mixed' | 'off-road';

interface Waypoint {
  id: string;
  name: string;
  type: WaypointType;
  lat: number;
  lng: number;
  notes: string;
  sortOrder: number;
}

interface Day {
  dayIndex: number;
  waypoints: Waypoint[];
}

/* ── Constants ───────────────────────────────────────────────── */

const WAYPOINT_TYPES: { value: WaypointType; label: string }[] = [
  { value: 'start', label: 'Start' },
  { value: 'end', label: 'End' },
  { value: 'fuel', label: 'Fuel Stop' },
  { value: 'food', label: 'Restaurant' },
  { value: 'scenic', label: 'Scenic Point' },
  { value: 'overnight', label: 'Overnight' },
  { value: 'photo', label: 'Photo Spot' },
  { value: 'pass_summit', label: 'Mountain Pass' },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'challenging', label: 'Challenging' },
  { value: 'expert', label: 'Expert' },
];

const SURFACES: { value: Surface; label: string }[] = [
  { value: 'paved', label: 'Paved' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'off-road', label: 'Off-road' },
];

const WAYPOINT_TYPE_LABELS: Record<WaypointType, string> = {
  start: 'Start',
  end: 'End',
  fuel: 'Fuel Stop',
  food: 'Restaurant',
  scenic: 'Scenic Point',
  overnight: 'Overnight',
  photo: 'Photo Spot',
  pass_summit: 'Mountain Pass',
};

/* ── Styles ──────────────────────────────────────────────────── */

const S = {
  page: {
    minHeight: '100vh',
    background: 'oklch(0.09 0.008 55)',
    color: 'var(--mv-ink-1)',
    padding: '100px 40px 80px',
  },
  container: {
    maxWidth: 1400,
    margin: '0 auto',
  },
  proBanner: {
    padding: '12px 20px',
    background: 'oklch(0.76 0.18 60 / 0.08)',
    border: '1px solid oklch(0.76 0.18 60 / 0.2)',
    borderRadius: 12,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 24,
  },
  topBar: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 24,
    gap: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 500,
    letterSpacing: '-0.03em',
  },
  topActions: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  layout: {
    display: 'flex' as const,
    gap: 24,
    alignItems: 'flex-start' as const,
  },
  leftPanel: {
    width: 400,
    minWidth: 400,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 16,
  },
  rightPanel: {
    flex: 1,
    minHeight: 600,
    display: 'flex' as const,
  },
  card: {
    background: 'oklch(0.12 0.01 55)',
    border: '1px solid var(--mv-line)',
    borderRadius: 16,
    padding: 20,
  },
  titleInput: {
    width: '100%',
    padding: '14px 16px',
    background: 'oklch(0.10 0.008 55)',
    border: '1px solid var(--mv-line)',
    borderRadius: 12,
    color: 'var(--mv-ink-1)',
    fontSize: 16,
    fontWeight: 500,
    letterSpacing: '-0.01em',
    outline: 'none',
  },
  dayTabs: {
    display: 'flex' as const,
    gap: 4,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
  },
  dayTab: (active: boolean) => ({
    padding: '8px 16px',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--mv-warm-400)' : 'var(--mv-line)'}`,
    background: active ? 'oklch(0.76 0.18 60 / 0.12)' : 'transparent',
    color: active ? 'var(--mv-warm-400)' : 'var(--mv-ink-2)',
    fontFamily: 'var(--font-geist-mono, monospace)',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  }),
  addDayBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: '1px dashed var(--mv-line)',
    background: 'transparent',
    color: 'var(--mv-ink-3)',
    fontSize: 16,
    cursor: 'pointer',
    display: 'grid' as const,
    placeItems: 'center' as const,
  },
  waypointList: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 8,
  },
  waypointItem: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: '12px 14px',
    background: 'oklch(0.10 0.008 55)',
    border: '1px solid var(--mv-line)',
    borderRadius: 12,
  },
  waypointDrag: {
    color: 'var(--mv-ink-3)',
    fontSize: 14,
    cursor: 'grab',
    userSelect: 'none' as const,
    lineHeight: 1,
  },
  waypointInfo: {
    flex: 1,
    minWidth: 0,
  },
  waypointName: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--mv-ink-1)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  },
  waypointMeta: {
    fontFamily: 'var(--font-geist-mono, monospace)',
    fontSize: 10,
    color: 'var(--mv-ink-3)',
    letterSpacing: '0.06em',
    marginTop: 2,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid var(--mv-line)',
    background: 'transparent',
    color: 'var(--mv-ink-3)',
    fontSize: 14,
    cursor: 'pointer',
    display: 'grid' as const,
    placeItems: 'center' as const,
    flexShrink: 0,
  },
  addWaypointBtn: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px dashed var(--mv-line)',
    background: 'transparent',
    color: 'var(--mv-ink-2)',
    fontFamily: 'var(--font-geist-mono, monospace)',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    textAlign: 'center' as const,
  },
  metaRow: {
    display: 'flex' as const,
    gap: 10,
  },
  select: {
    flex: 1,
    padding: '10px 12px',
    background: 'oklch(0.10 0.008 55)',
    border: '1px solid var(--mv-line)',
    borderRadius: 10,
    color: 'var(--mv-ink-1)',
    fontFamily: 'var(--font-geist-mono, monospace)',
    fontSize: 12,
    outline: 'none',
    cursor: 'pointer',
  },
  saveBtn: (disabled: boolean) => ({
    padding: '10px 20px',
    borderRadius: 999,
    border: 'none',
    background: disabled ? 'oklch(0.16 0.01 55)' : 'var(--mv-warm-400)',
    color: disabled ? 'var(--mv-ink-3)' : 'oklch(0.09 0.008 55)',
    fontFamily: 'var(--font-geist-mono, monospace)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  // Form styles
  formOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'oklch(0 0 0 / 0.6)',
    backdropFilter: 'blur(6px)',
    display: 'grid' as const,
    placeItems: 'center' as const,
    zIndex: 100,
  },
  formCard: {
    background: 'oklch(0.12 0.01 55)',
    border: '1px solid var(--mv-line)',
    borderRadius: 16,
    padding: 28,
    width: 380,
    maxWidth: '90vw',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 500,
    marginBottom: 20,
    letterSpacing: '-0.01em',
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    display: 'block' as const,
    fontFamily: 'var(--font-geist-mono, monospace)',
    fontSize: 10,
    color: 'var(--mv-ink-3)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  formInput: {
    width: '100%',
    padding: '10px 12px',
    background: 'oklch(0.10 0.008 55)',
    border: '1px solid var(--mv-line)',
    borderRadius: 10,
    color: 'var(--mv-ink-1)',
    fontSize: 14,
    outline: 'none',
  },
  formSelect: {
    width: '100%',
    padding: '10px 12px',
    background: 'oklch(0.10 0.008 55)',
    border: '1px solid var(--mv-line)',
    borderRadius: 10,
    color: 'var(--mv-ink-1)',
    fontSize: 14,
    outline: 'none',
    cursor: 'pointer',
  },
  formRow: {
    display: 'flex' as const,
    gap: 10,
  },
  formActions: {
    display: 'flex' as const,
    gap: 10,
    marginTop: 20,
    justifyContent: 'flex-end' as const,
  },
  formBtnCancel: {
    padding: '10px 18px',
    borderRadius: 10,
    border: '1px solid var(--mv-line)',
    background: 'transparent',
    color: 'var(--mv-ink-2)',
    fontSize: 13,
    cursor: 'pointer',
  },
  formBtnSubmit: {
    padding: '10px 18px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--mv-warm-400)',
    color: 'oklch(0.09 0.008 55)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  removeDayBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: '1px solid var(--mv-line)',
    background: 'transparent',
    color: 'var(--mv-ink-3)',
    fontSize: 12,
    cursor: 'pointer',
    display: 'grid' as const,
    placeItems: 'center' as const,
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    color: 'var(--mv-ink-3)',
    fontSize: 13,
  },
  mapPlaceholder: {
    flex: 1,
    display: 'grid' as const,
    placeItems: 'center' as const,
    background: 'oklch(0.11 0.008 55)',
    borderRadius: 16,
    border: '1px solid var(--mv-line)',
  },
} as const;

/* ── Component ───────────────────────────────────────────────── */

export function BuilderClient() {
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<Day[]>([{ dayIndex: 0, waypoints: [] }]);
  const [activeDay, setActiveDay] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate');
  const [surface, setSurface] = useState<Surface>('paved');
  const [showForm, setShowForm] = useState(false);

  // Waypoint form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<WaypointType>('scenic');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const activeDayData = days.find((d) => d.dayIndex === activeDay);

  /* ── Handlers ────────────────────────────────────────────── */

  const addDay = useCallback(() => {
    setDays((prev) => {
      const nextIndex = prev.length > 0 ? Math.max(...prev.map((d) => d.dayIndex)) + 1 : 0;
      return [...prev, { dayIndex: nextIndex, waypoints: [] }];
    });
  }, []);

  const removeDay = useCallback(
    (dayIndex: number) => {
      setDays((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((d) => d.dayIndex !== dayIndex);
        if (activeDay === dayIndex) {
          setActiveDay(next[0].dayIndex);
        }
        return next;
      });
    },
    [activeDay],
  );

  const openAddWaypoint = useCallback(() => {
    setFormName('');
    setFormType('scenic');
    setFormLat('');
    setFormLng('');
    setFormNotes('');
    setShowForm(true);
  }, []);

  const addWaypoint = useCallback(() => {
    const lat = Number.parseFloat(formLat);
    const lng = Number.parseFloat(formLng);
    if (!formName.trim() || Number.isNaN(lat) || Number.isNaN(lng)) return;

    const newWaypoint: Waypoint = {
      id: crypto.randomUUID(),
      name: formName.trim(),
      type: formType,
      lat,
      lng,
      notes: formNotes.trim(),
      sortOrder: activeDayData ? activeDayData.waypoints.length : 0,
    };

    setDays((prev) =>
      prev.map((d) =>
        d.dayIndex === activeDay ? { ...d, waypoints: [...d.waypoints, newWaypoint] } : d,
      ),
    );
    setShowForm(false);
  }, [formName, formType, formLat, formLng, formNotes, activeDay, activeDayData]);

  const removeWaypoint = useCallback(
    (waypointId: string) => {
      setDays((prev) =>
        prev.map((d) =>
          d.dayIndex === activeDay
            ? {
                ...d,
                waypoints: d.waypoints
                  .filter((wp) => wp.id !== waypointId)
                  .map((wp, i) => ({ ...wp, sortOrder: i })),
              }
            : d,
        ),
      );
    },
    [activeDay],
  );

  const totalWaypoints = days.reduce((sum, d) => sum + d.waypoints.length, 0);

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Pro banner */}
        <div style={S.proBanner}>
          <span style={{ fontSize: 13, color: 'var(--mv-warm-400)' }}>
            Trip Builder is a Pro feature.
          </span>
          <a
            href="/pro/checkout"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--mv-warm-400)',
              textDecoration: 'underline',
            }}
          >
            Upgrade to Pro
          </a>
        </div>

        {/* Top bar */}
        <div style={S.topBar}>
          <h1 style={S.pageTitle}>Trip Builder</h1>
          <div style={S.topActions}>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              style={S.select}
              aria-label="Difficulty"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <select
              value={surface}
              onChange={(e) => setSurface(e.target.value as Surface)}
              style={S.select}
              aria-label="Surface type"
            >
              {SURFACES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button type="button" style={S.saveBtn(true)} disabled title="Pro required">
              Save
            </button>
          </div>
        </div>

        {/* Main layout */}
        <div style={S.layout}>
          {/* Left panel */}
          <div style={S.leftPanel}>
            {/* Title input */}
            <input
              type="text"
              placeholder="Trip title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={S.titleInput}
              aria-label="Trip title"
            />

            {/* Day tabs */}
            <div style={S.card}>
              <div style={S.dayTabs}>
                {days.map((d) => (
                  <div key={d.dayIndex} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      type="button"
                      style={S.dayTab(activeDay === d.dayIndex)}
                      onClick={() => setActiveDay(d.dayIndex)}
                    >
                      Day {d.dayIndex + 1}
                    </button>
                    {days.length > 1 && (
                      <button
                        type="button"
                        style={S.removeDayBtn}
                        onClick={() => removeDay(d.dayIndex)}
                        title={`Remove Day ${d.dayIndex + 1}`}
                        aria-label={`Remove Day ${d.dayIndex + 1}`}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  style={S.addDayBtn}
                  onClick={addDay}
                  title="Add day"
                  aria-label="Add day"
                >
                  +
                </button>
              </div>

              {/* Stats */}
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: '1px solid var(--mv-line)',
                  fontFamily: 'var(--font-geist-mono, monospace)',
                  fontSize: 10,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  display: 'flex',
                  gap: 16,
                }}
              >
                <span>
                  {days.length} {days.length === 1 ? 'day' : 'days'}
                </span>
                <span>
                  {totalWaypoints} {totalWaypoints === 1 ? 'waypoint' : 'waypoints'}
                </span>
                <span>{difficulty}</span>
                <span>{surface}</span>
              </div>
            </div>

            {/* Waypoint list */}
            <div style={S.card}>
              <div
                style={{
                  fontFamily: 'var(--font-geist-mono, monospace)',
                  fontSize: 10,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  marginBottom: 14,
                }}
              >
                Day {(activeDay ?? 0) + 1} waypoints
              </div>

              {activeDayData && activeDayData.waypoints.length > 0 ? (
                <div style={S.waypointList}>
                  {activeDayData.waypoints.map((wp, idx) => (
                    <div key={wp.id} style={S.waypointItem}>
                      {/* Drag handle (visual only) */}
                      <span style={S.waypointDrag} aria-hidden="true">
                        &#8942;&#8942;
                      </span>
                      {/* Order badge */}
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          background: 'oklch(0.76 0.18 60 / 0.12)',
                          color: 'var(--mv-warm-400)',
                          fontFamily: 'var(--font-geist-mono, monospace)',
                          fontSize: 10,
                          fontWeight: 600,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      {/* Info */}
                      <div style={S.waypointInfo}>
                        <div style={S.waypointName}>{wp.name}</div>
                        <div style={S.waypointMeta}>
                          {WAYPOINT_TYPE_LABELS[wp.type]}
                          {wp.notes ? ` \u00b7 ${wp.notes}` : ''}
                          {' \u00b7 '}
                          {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                        </div>
                      </div>
                      {/* Remove */}
                      <button
                        type="button"
                        style={S.removeBtn}
                        onClick={() => removeWaypoint(wp.id)}
                        title={`Remove ${wp.name}`}
                        aria-label={`Remove ${wp.name}`}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={S.emptyState}>No waypoints yet. Add your first stop below.</div>
              )}

              <button
                type="button"
                style={{ ...S.addWaypointBtn, marginTop: 12 }}
                onClick={openAddWaypoint}
              >
                + Add waypoint
              </button>
            </div>
          </div>

          {/* Right panel — map placeholder */}
          <div style={S.mapPlaceholder}>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
                {/* biome-ignore lint/a11y/noEmoji: decorative placeholder */}
                <span role="img" aria-label="Map">
                  &#x1F5FA;&#xFE0F;
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Interactive map coming soon</div>
              <div style={{ fontSize: 13, color: 'var(--mv-ink-3)', marginTop: 8 }}>
                Add waypoints manually for now — map editing will be available in the next update.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Waypoint Form Modal ───────────────────────────── */}
      {showForm && (
        <div
          style={S.formOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowForm(false);
          }}
        >
          <div style={S.formCard}>
            <div style={S.formTitle}>Add Waypoint</div>

            <div style={S.formGroup}>
              <label style={S.formLabel} htmlFor="wp-name">
                Name
              </label>
              <input
                id="wp-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={S.formInput}
                placeholder="e.g. Stelvio Pass summit"
                autoFocus
              />
            </div>

            <div style={S.formGroup}>
              <label style={S.formLabel} htmlFor="wp-type">
                Type
              </label>
              <select
                id="wp-type"
                value={formType}
                onChange={(e) => setFormType(e.target.value as WaypointType)}
                style={S.formSelect}
              >
                {WAYPOINT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={S.formGroup}>
              <div style={S.formRow}>
                <div style={{ flex: 1 }}>
                  <label style={S.formLabel} htmlFor="wp-lat">
                    Latitude
                  </label>
                  <input
                    id="wp-lat"
                    type="number"
                    step="any"
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    style={S.formInput}
                    placeholder="46.5287"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={S.formLabel} htmlFor="wp-lng">
                    Longitude
                  </label>
                  <input
                    id="wp-lng"
                    type="number"
                    step="any"
                    value={formLng}
                    onChange={(e) => setFormLng(e.target.value)}
                    style={S.formInput}
                    placeholder="10.4531"
                  />
                </div>
              </div>
            </div>

            <div style={S.formGroup}>
              <label style={S.formLabel} htmlFor="wp-notes">
                Notes (optional)
              </label>
              <input
                id="wp-notes"
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                style={S.formInput}
                placeholder="Great view, stop for photos"
              />
            </div>

            <div style={S.formActions}>
              <button type="button" style={S.formBtnCancel} onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                type="button"
                style={{
                  ...S.formBtnSubmit,
                  opacity: formName.trim() && formLat && formLng ? 1 : 0.4,
                }}
                onClick={addWaypoint}
                disabled={!formName.trim() || !formLat || !formLng}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
