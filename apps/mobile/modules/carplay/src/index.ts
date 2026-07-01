// MotoVault CarPlay adapter — a thin JS seam over @iternio/react-native-auto-play
// (the Nitro / new-architecture CarPlay + Android Auto library). It exposes the
// minimal surface the coordinator needs and hides the library's grain:
//
//   • The head-unit panel is a native `InformationTemplate` (title + ≤4 rows +
//     ≤3 actions). Title and actions are FIXED at construction — only rows can be
//     mutated in place via `updateItems`. So `renderInformation` decides per call:
//     rebuild + re-push when the title or actions changed; otherwise update rows
//     in place. The coordinator owns *when* to render (throttle); this owns *how*.
//   • Action presses are per-button `onPress` callbacks (no global event), so we
//     route every button through a single injected dispatcher (`setActionDispatcher`).
//
// CarPlay-only by design (the feature is the Driving Task surface; Android Auto is
// out of scope). The whole module is a safe no-op when the library can't load —
// Android, web, or a build without the native pod — so callers can run unguarded.

import type {
  InformationItems,
  InformationTemplate,
  InformationTemplateConfig,
  ListTemplate,
  Section,
  TextButton,
} from '@iternio/react-native-auto-play';
import { Platform } from 'react-native';
import { captureException } from '../../../src/lib/analytics';

export interface CPInfoItem {
  title: string;
  detail: string;
}

export interface CPInfoAction {
  /** Stable id handed to the action dispatcher when the button is pressed. */
  id: string;
  title: string;
}

export interface CPInformationTemplateModel {
  title: string;
  items: CPInfoItem[];
  actions: CPInfoAction[];
  /** iOS nav-bar buttons (e.g. "Bike") — routed through the same dispatcher. */
  headerActions?: CPInfoAction[];
}

/** A row on the pushed Bike-status list (informational — no press target). */
export interface CPListRow {
  title: string;
  detail: string;
}

export interface CPListModel {
  title: string;
  rows: CPListRow[];
}

/** Lifecycle hooks for the pushed list — load-on-entry + pop detection (KTD2/KTD5). */
export interface CPListLifecycle {
  onWillAppear?: () => void;
  /**
   * Fires when the list leaves the stack for good (back button) — the "gone forever"
   * signal. Uses the library's `onPopped`, NOT `onDidDisappear`, which also fires when
   * the list is merely covered (a system alert / dashboard) and would falsely clear
   * the coordinator's bikeVisible while the list is still on-stack.
   */
  onPopped?: () => void;
}

export interface CarPlaySubscription {
  remove(): void;
}

// Eagerly load the library on iOS so its `didConnect` listener is live before a
// head unit attaches (including a cold, headless CarPlay launch). require (not
// import) keeps it off platforms where the native pod is absent; the try/catch
// turns a missing native side into a graceful no-op.
type AutoPlayLib = typeof import('@iternio/react-native-auto-play');
let lib: AutoPlayLib | null = null;
if (Platform.OS === 'ios') {
  try {
    lib = require('@iternio/react-native-auto-play') as AutoPlayLib;
  } catch {
    lib = null;
  }
}

export const isCarPlayAvailable = lib != null;

// Placeholder row title used when a render is requested with no items — keeps the
// native template valid (min-1 tuple) instead of pushing an empty `[]`.
const DASH_ROW = '—';
// Defensive cap on Bike-list rows. The library exposes no head-unit maximumItemCount
// (v0.5.4), and the Bike list is small (~4-6 rows) — well under any unit's limit.
const MAX_LIST_ROWS = 12;

let dispatch: ((actionId: string) => void) | null = null;
let current: InformationTemplate | null = null;
let lastTitle: string | null = null;
let lastActionsKey: string | null = null;
let currentList: ListTemplate | null = null;
// Fired when the root ride panel becomes topmost again (a pushed list left the stack).
let rootDidAppear: (() => void) | null = null;

// Identity of the action + header-action sets: a change here forces a rebuild (the
// library fixes actions/header buttons at construction — they can't mutate in place).
const actionsKey = (model: CPInformationTemplateModel): string =>
  `${model.actions.map((a) => a.id).join('|')}#${(model.headerActions ?? []).map((a) => a.id).join('|')}`;

function toRows(items: CPInfoItem[]): InformationItems {
  // CPInformationTemplate shows 1–4 rows; extra rows would be dropped. Row
  // title/detail are AutoText ({ text }), not bare strings. `InformationItems` is a
  // min-1 tuple, so an empty list is an invalid native template — fall back to a
  // single dash row rather than push `[]` (the "always hand the native layer a
  // valid, non-empty state" learning, see docs/solutions ios-widget-data-sync).
  const source = items.length > 0 ? items.slice(0, 4) : [{ title: DASH_ROW, detail: '' }];
  const rows: InformationItems[number][] = source.map((i) => ({
    type: 'text' as const,
    title: { text: i.title },
    detailedText: { text: i.detail },
  }));
  return rows as InformationItems;
}

function toIosActions(actions: CPInfoAction[]): InformationTemplateConfig['actions'] {
  if (!actions.length) return undefined;
  // iOS allows up to 3 text buttons; each routes through the shared dispatcher.
  const buttons = actions.slice(0, 3).map(
    (a): TextButton<InformationTemplate> => ({
      type: 'text',
      title: a.title,
      onPress: () => dispatch?.(a.id),
    }),
  );
  return { ios: buttons as NonNullable<InformationTemplateConfig['actions']>['ios'] };
}

function toIosHeaderActions(
  actions: CPInfoAction[] | undefined,
): InformationTemplateConfig['headerActions'] {
  if (!actions?.length) return undefined;
  // iOS shows up to 2 trailing nav-bar buttons; route each through the dispatcher.
  const buttons = actions.slice(0, 2).map((a) => ({
    type: 'text' as const,
    title: a.title,
    onPress: () => dispatch?.(a.id),
  }));
  return {
    ios: { trailingNavigationBarButtons: buttons },
  } as unknown as InformationTemplateConfig['headerActions'];
}

function buildTemplate(model: CPInformationTemplateModel): InformationTemplate {
  if (!lib) throw new Error('CarPlay library unavailable');
  return new lib.InformationTemplate({
    title: { text: model.title },
    items: toRows(model.items),
    actions: toIosActions(model.actions),
    headerActions: toIosHeaderActions(model.headerActions),
    // Root panel is topmost again → any pushed Bike list is gone. This fires on the
    // native CarPlay back button too — unlike the list's own onPopped, which iOS only
    // delivers on a *programmatic* pop (see AutoPlayInterfaceController: back-button
    // dismiss runs templateDidDisappear, which removes + fires onPopped for a
    // CPAlertTemplate only). Drop the stale list ref so the next pushBikeList
    // re-pushes instead of updateSections-ing a popped template, and notify the
    // coordinator so it clears its covered flag and resumes rendering.
    onDidAppear: () => {
      currentList = null;
      rootDidAppear?.();
    },
  });
}

function toListSections(rows: CPListRow[]): Section<ListTemplate> {
  // Single default section of informational text rows. Fall back to one dash row
  // rather than an empty section (same always-valid-native-state rule as toRows).
  const source = rows.length > 0 ? rows.slice(0, MAX_LIST_ROWS) : [{ title: DASH_ROW, detail: '' }];
  const items = source.map((r) => ({
    type: 'text' as const,
    title: { text: r.title },
    detailedText: { text: r.detail },
  }));
  return { type: 'default', items } as unknown as Section<ListTemplate>;
}

/** Injects the dispatcher that head-unit action presses are routed to. */
export function setActionDispatcher(fn: (actionId: string) => void): void {
  dispatch = fn;
}

/**
 * Register a callback fired when the root ride panel becomes topmost again — i.e. a
 * pushed secondary template (the Bike list) was dismissed. This is the only reliable
 * "list gone" signal on iOS: the list's own `onPopped` fires solely on a programmatic
 * pop, never on the native CarPlay back button. `onDidAppear` on the root covers both,
 * and — unlike `onDidDisappear` — does not fire when the panel is merely covered.
 */
export function setInformationLifecycle(lifecycle: { onDidAppear?: () => void }): void {
  rootDidAppear = lifecycle.onDidAppear ?? null;
}

/**
 * Render the live-ride panel. Rebuilds + re-pushes the template when the title or
 * the action set changed (the library can't mutate those in place); otherwise
 * updates the rows in place. The first call after a (re)connect always builds.
 */
export function renderInformation(model: CPInformationTemplateModel): void {
  if (!lib) return;
  const key = actionsKey(model);
  if (!current || model.title !== lastTitle || key !== lastActionsKey) {
    current = buildTemplate(model);
    // setRootTemplate()/updateItems() return Promise<void>; a native rejection is
    // otherwise silent (panel stalls on stale data with no signal). Route to Sentry.
    current
      .setRootTemplate()
      .catch((e) => captureException(e, { source: 'carplay.setRootTemplate' }));
    lastTitle = model.title;
    lastActionsKey = key;
    return;
  }
  current
    .updateItems(toRows(model.items))
    .catch((e) => captureException(e, { source: 'carplay.updateItems' }));
}

/** Drop the template reference so the next render rebuilds (call on disconnect). */
export function clearInformation(): void {
  current = null;
  lastTitle = null;
  lastActionsKey = null;
}

/**
 * Push the Bike-status list on top of the Ride root (depth 2). If a list is already
 * pushed, update its rows in place instead of re-pushing. `lifecycle.onWillAppear`
 * is the load-on-entry hook; `onDidDisappear` fires on pop so the coordinator can
 * clear its `bikeVisible` flag. All Promise-returning calls route rejections to Sentry.
 */
export function pushBikeList(model: CPListModel, lifecycle?: CPListLifecycle): void {
  if (!lib) return;
  if (currentList) {
    currentList
      .updateSections(toListSections(model.rows))
      .catch((e) => captureException(e, { source: 'carplay.updateSections' }));
    return;
  }
  // "Gone forever" cleanup — run on a real pop, or if the push itself fails (in which
  // case nothing will ever pop). Either way the coordinator's bikeVisible must clear,
  // or the ride panel stays frozen behind a list that isn't there.
  const onGone = () => {
    currentList = null;
    lifecycle?.onPopped?.();
  };
  currentList = new lib.ListTemplate({
    title: { text: model.title },
    sections: toListSections(model.rows),
    onWillAppear: lifecycle?.onWillAppear,
    onPopped: onGone,
  });
  currentList.push().catch((e) => {
    captureException(e, { source: 'carplay.pushList' });
    onGone(); // push rejected — recover so the ride panel isn't stuck covered
  });
}

/** Update the pushed Bike list's rows in place (no-op if nothing is pushed). */
export function updateBikeList(model: CPListModel): void {
  if (!lib || !currentList) return;
  currentList
    .updateSections(toListSections(model.rows))
    .catch((e) => captureException(e, { source: 'carplay.updateSections' }));
}

/** Pop the Bike list back to the Ride root (safe no-op if nothing is pushed). */
export function popBikeList(): void {
  if (!lib || !currentList) return;
  currentList = null;
  lib.HybridAutoPlay.popTemplate().catch((e) =>
    captureException(e, { source: 'carplay.popTemplate' }),
  );
}

/** True if a head unit is currently connected (catches an already-attached unit). */
export function isHeadUnitConnected(): boolean {
  return lib?.HybridAutoPlay.isConnected() ?? false;
}

export function addConnectListener(listener: () => void): CarPlaySubscription | null {
  if (!lib) return null;
  const cleanup = lib.HybridAutoPlay.addListener('didConnect', listener);
  return { remove: cleanup };
}

export function addDisconnectListener(listener: () => void): CarPlaySubscription | null {
  if (!lib) return null;
  const cleanup = lib.HybridAutoPlay.addListener('didDisconnect', listener);
  return { remove: cleanup };
}
