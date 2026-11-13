import type { JsonType } from '@posthog/core';
import * as Updates from 'expo-updates';
import { ACTIVATION_FIX_LEVEL } from '../config/activation';
import { SUPER_PROPERTY } from './analytics-super-properties';
import { isE2eRun } from './e2e-build';

// -------------------------------------------------------------------
// Release marker (issue 365 T01, friction spec FS-M)
// -------------------------------------------------------------------
// An OTA keeps `$app_version`/`$app_build`, so nothing on an event told which JS
// ran. These super properties say it: the issue 365 fix level, the running update (or
// `embedded` for the binary's own JS, which every new rider's first session runs),
// the channel and runtime, and the platform. Everything here is fixed for the
// whole launch and holds no personal data.
// -------------------------------------------------------------------

export const RELEASE_MARKER_PROPERTY = {
  ACTIVATION_FIX_LEVEL: 'activation_fix_level',
  OTA_UPDATE_ID: 'ota_update_id',
  OTA_CHANNEL: 'ota_channel',
  IS_EMBEDDED_LAUNCH: 'is_embedded_launch',
  RUNTIME_VERSION: 'runtime_version',
  PLATFORM: SUPER_PROPERTY.PLATFORM,
  E2E_RUN: 'e2e_run',
} as const;

/** `ota_update_id` of a launch that runs the JS embedded in the binary. */
export const EMBEDDED_UPDATE_ID = 'embedded';

/**
 * The marker for this launch. An embedded launch reports `embedded` even though
 * expo-updates gives the embedded bundle an id of its own: what matters is that
 * the binary's JS ran. Unknown values (dev builds, updates disabled) are left out
 * rather than sent as null; `e2e_run` exists only on E2E builds.
 */
export function buildReleaseMarker(): Record<string, JsonType> {
  const otaUpdateId = Updates.isEmbeddedLaunch
    ? EMBEDDED_UPDATE_ID
    : (Updates.updateId ?? EMBEDDED_UPDATE_ID);
  const entries: [string, JsonType | null | undefined][] = [
    [RELEASE_MARKER_PROPERTY.ACTIVATION_FIX_LEVEL, ACTIVATION_FIX_LEVEL],
    [RELEASE_MARKER_PROPERTY.OTA_UPDATE_ID, otaUpdateId],
    [RELEASE_MARKER_PROPERTY.OTA_CHANNEL, Updates.channel],
    [RELEASE_MARKER_PROPERTY.IS_EMBEDDED_LAUNCH, Updates.isEmbeddedLaunch],
    [RELEASE_MARKER_PROPERTY.RUNTIME_VERSION, Updates.runtimeVersion],
    [RELEASE_MARKER_PROPERTY.PLATFORM, process.env.EXPO_OS],
    [RELEASE_MARKER_PROPERTY.E2E_RUN, isE2eRun() ? true : undefined],
  ];
  return Object.fromEntries(
    entries.filter(
      (entry): entry is [string, JsonType] => entry[1] !== undefined && entry[1] !== null,
    ),
  );
}
