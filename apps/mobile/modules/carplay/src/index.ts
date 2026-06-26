// MotoVault CarPlay native module — typed JS surface.
//
// Loaded via requireOptionalNativeModule so the whole module is a safe no-op when
// the native side is absent (Android, web, or a build without the CarPlay native
// code). Callers check `isCarPlayAvailable` or rely on the null-safe wrappers.

import { type EventSubscription, requireOptionalNativeModule } from 'expo-modules-core';
import type {
  CarPlayActionEvent,
  CPInfoAction,
  CPInfoItem,
  CPInformationTemplateModel,
} from './types';

interface CarPlayNativeModule {
  setRootTemplate(model: CPInformationTemplateModel): void;
  updateInformationItems(items: CPInfoItem[]): void;
  updateInformationActions(actions: CPInfoAction[]): void;
  /** Re-fires onConnect if a head unit is already connected (late subscriber). */
  checkForConnection(): void;
  addListener(event: 'onConnect' | 'onDisconnect', listener: () => void): EventSubscription;
  addListener(event: 'onActionPress', listener: (e: CarPlayActionEvent) => void): EventSubscription;
}

const Native = requireOptionalNativeModule<CarPlayNativeModule>('MotoVaultCarPlay');

export const isCarPlayAvailable = Native != null;

export function setRootInformationTemplate(model: CPInformationTemplateModel): void {
  Native?.setRootTemplate(model);
}

export function updateInformationItems(items: CPInfoItem[]): void {
  Native?.updateInformationItems(items);
}

export function updateInformationActions(actions: CPInfoAction[]): void {
  Native?.updateInformationActions(actions);
}

export function checkForConnection(): void {
  Native?.checkForConnection();
}

export function addConnectListener(listener: () => void): EventSubscription | null {
  return Native?.addListener('onConnect', listener) ?? null;
}

export function addDisconnectListener(listener: () => void): EventSubscription | null {
  return Native?.addListener('onDisconnect', listener) ?? null;
}

export function addActionListener(
  listener: (e: CarPlayActionEvent) => void,
): EventSubscription | null {
  return Native?.addListener('onActionPress', listener) ?? null;
}

export type {
  CarPlayActionEvent,
  CPInfoAction,
  CPInfoItem,
  CPInformationTemplateModel,
} from './types';
