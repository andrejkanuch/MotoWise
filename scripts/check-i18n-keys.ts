#!/usr/bin/env npx tsx
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOCALES_DIR = resolve(__dirname, '../apps/mobile/src/i18n/locales');

function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return getKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

function loadLocale(filename: string): Record<string, unknown> {
  const filePath = resolve(LOCALES_DIR, filename);
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

const en = loadLocale('en.json');
const es = loadLocale('es.json');
const de = loadLocale('de.json');

const enKeys = getKeys(en);
let hasErrors = false;

for (const [name, locale] of [
  ['es', es],
  ['de', de],
] as const) {
  const localeKeys = getKeys(locale);
  const missingKeys = enKeys.filter((key) => !localeKeys.includes(key));
  const extraKeys = localeKeys.filter((key) => !enKeys.includes(key));

  if (missingKeys.length > 0) {
    hasErrors = true;
    console.error(`\n[${name}.json] Missing ${missingKeys.length} key(s):`);
    for (const key of missingKeys) {
      console.error(`  - ${key}`);
    }
  }

  if (extraKeys.length > 0) {
    hasErrors = true;
    console.error(`\n[${name}.json] Extra ${extraKeys.length} key(s) not in en.json:`);
    for (const key of extraKeys) {
      console.error(`  - ${key}`);
    }
  }

  if (missingKeys.length === 0 && extraKeys.length === 0) {
    console.log(`[${name}.json] All ${enKeys.length} keys match en.json`);
  }
}

if (hasErrors) {
  console.error('\ni18n key check failed.');
  process.exit(1);
} else {
  console.log('\ni18n key check passed. All locales are in sync.');
  process.exit(0);
}
