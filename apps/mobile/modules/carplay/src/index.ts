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
  TextButton,
} from '@iternio/react-native-auto-play';
import { Platform } from 'react-native';

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
}

export interface CarPlayActionEvent {
  actionId: string;
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

let dispatch: ((actionId: string) => void) | null = null;
let current: InformationTemplate | null = null;
let lastTitle: string | null = null;
let lastActionsKey: string | null = null;

const actionsKey = (actions: CPInfoAction[]): string => actions.map((a) => a.id).join('|');

function toRows(items: CPInfoItem[]): InformationItems {
  // CPInformationTemplate shows at most 4 rows; extra rows would be dropped.
  // Row title/detail are AutoText ({ text }), not bare strings.
  return items.slice(0, 4).map((i) => ({
    type: 'text' as const,
    title: { text: i.title },
    detailedText: { text: i.detail },
  })) as unknown as InformationItems;
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

function buildTemplate(model: CPInformationTemplateModel): InformationTemplate {
  if (!lib) throw new Error('CarPlay library unavailable');
  return new lib.InformationTemplate({
    title: { text: model.title },
    items: toRows(model.items),
    actions: toIosActions(model.actions),
  });
}

/** Injects the dispatcher that head-unit action presses are routed to. */
export function setActionDispatcher(fn: (actionId: string) => void): void {
  dispatch = fn;
}

/**
 * Render the live-ride panel. Rebuilds + re-pushes the template when the title or
 * the action set changed (the library can't mutate those in place); otherwise
 * updates the rows in place. The first call after a (re)connect always builds.
 */
export function renderInformation(model: CPInformationTemplateModel): void {
  if (!lib) return;
  const key = actionsKey(model.actions);
  if (!current || model.title !== lastTitle || key !== lastActionsKey) {
    current = buildTemplate(model);
    current.setRootTemplate();
    lastTitle = model.title;
    lastActionsKey = key;
    return;
  }
  current.updateItems(toRows(model.items));
}

/** Drop the template reference so the next render rebuilds (call on disconnect). */
export function clearInformation(): void {
  current = null;
  lastTitle = null;
  lastActionsKey = null;
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
