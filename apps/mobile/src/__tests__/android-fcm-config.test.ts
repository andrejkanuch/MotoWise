import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExpoConfig } from 'expo/config';
import appConfig, { ANDROID_GOOGLE_SERVICES_FILE } from '../../app.config';

// Android push needs Firebase (FCM). From July to 2026-11-12 the app had no
// google-services.json, getExpoPushTokenAsync threw on every Android device, and
// not one Android token reached device_push_tokens. This guard fails the build if
// the config is removed or points at the wrong Firebase app.

const MOBILE_ROOT = resolve(__dirname, '../..');
const ANDROID_PACKAGE = 'com.motovault.app';

interface GoogleServicesFile {
  project_info: { project_id: string };
  client: Array<{ client_info: { android_client_info: { package_name: string } } }>;
}

function resolvedConfig(variant: string): ExpoConfig {
  const previous = process.env.APP_VARIANT;
  process.env.APP_VARIANT = variant;
  try {
    return appConfig({ config: {} } as Parameters<typeof appConfig>[0]);
  } finally {
    // Assigning undefined to process.env stores the string "undefined".
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
}

describe('Android FCM config', () => {
  it.each([
    'production',
    'preview',
    'development',
  ])('the %s app config points android.googleServicesFile at the Firebase file', (variant) => {
    expect(resolvedConfig(variant).android?.googleServicesFile).toBe(ANDROID_GOOGLE_SERVICES_FILE);
  });

  it('the Firebase file exists and registers this Android package', () => {
    const path = resolve(MOBILE_ROOT, ANDROID_GOOGLE_SERVICES_FILE);
    expect(existsSync(path)).toBe(true);
    const file = JSON.parse(readFileSync(path, 'utf8')) as GoogleServicesFile;
    const packages = file.client.map((c) => c.client_info.android_client_info.package_name);
    expect(resolvedConfig('production').android?.package).toBe(ANDROID_PACKAGE);
    expect(packages).toContain(ANDROID_PACKAGE);
  });
});
