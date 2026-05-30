#!/usr/bin/env npx tsx
/**
 * i18n NEW-KEY ratchet.
 *
 * Blocks the exact failure mode "added an English string but forgot to translate
 * it in the other locales", WITHOUT choking on the pre-existing completeness
 * backlog (plural-grammar forms etc).
 *
 * Strategy: diff `en.json` keys against the merge-base, take only the keys that
 * are NEW on this branch, and require each to be present in every locale.
 *
 * Plural awareness: a new key ending in a CLDR suffix (_zero/_one/_two/_few/
 * _many/_other) is only a "plural" if en.json also defines its `<base>_other`
 * variant. For such keys we require the locale to define `<base>_other` (the one
 * CLDR category every language has) rather than the exact English suffix — so we
 * never false-positive on e.g. Japanese, which has no `_one` form.
 *
 * Usage: tsx scripts/check-i18n-new-keys.ts <base-git-ref>
 *   (no base ref → nothing to diff against → passes)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOCALES_DIR = resolve(__dirname, '../apps/mobile/src/i18n/locales');
const EN_REPO_PATH = 'apps/mobile/src/i18n/locales/en.json';
const SECONDARY_LOCALES = [
  'es',
  'de',
  'fr',
  'it',
  'pt-BR',
  'ja',
  'hi',
  'th',
  'id',
  'tr',
  'pl',
  'sk',
] as const;

const CLDR_SUFFIX = /_(zero|one|two|few|many|other)$/;

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? flattenKeys(value as Record<string, unknown>, fullKey)
      : [fullKey];
  });
}

function loadJson(absPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(absPath, 'utf-8'));
}

/** Read a file's contents at a git ref; returns null if it didn't exist there. */
function gitShow(ref: string, repoPath: string): string | null {
  try {
    return execFileSync('git', ['show', `${ref}:${repoPath}`], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/** The translation key a locale must define to satisfy `key`. */
function requiredKeyFor(key: string, enKeys: Set<string>): string {
  const match = key.match(CLDR_SUFFIX);
  if (match) {
    const base = key.slice(0, key.length - match[0].length);
    // Only treat as a plural set if en.json actually defines `<base>_other`.
    if (enKeys.has(`${base}_other`)) return `${base}_other`;
  }
  return key;
}

const baseRef = process.argv[2];
if (!baseRef) {
  console.log('check-i18n-new-keys: no base ref provided — skipping (nothing to diff).');
  process.exit(0);
}

const currentEn = loadJson(resolve(LOCALES_DIR, 'en.json'));
const baseEnRaw = gitShow(baseRef, EN_REPO_PATH);
const baseEn: Record<string, unknown> = baseEnRaw ? JSON.parse(baseEnRaw) : {};

const currentEnKeys = flattenKeys(currentEn);
const currentEnKeySet = new Set(currentEnKeys);
const baseEnKeySet = new Set(flattenKeys(baseEn));

const newKeys = currentEnKeys.filter((k) => !baseEnKeySet.has(k));

if (newKeys.length === 0) {
  console.log('check-i18n-new-keys: no new en.json keys on this branch — nothing to verify.');
  process.exit(0);
}

// Map each new key to the key a locale must define (collapsing plural variants).
const requiredKeys = new Set(newKeys.map((k) => requiredKeyFor(k, currentEnKeySet)));

console.log(
  `check-i18n-new-keys: ${newKeys.length} new en key(s) → ${requiredKeys.size} required translation(s) per locale.`,
);

let hasErrors = false;
for (const locale of SECONDARY_LOCALES) {
  const localeKeys = new Set(flattenKeys(loadJson(resolve(LOCALES_DIR, `${locale}.json`))));
  const missing = [...requiredKeys].filter((k) => !localeKeys.has(k));
  if (missing.length > 0) {
    hasErrors = true;
    console.error(`\n[${locale}.json] missing ${missing.length} new key(s):`);
    for (const key of missing) console.error(`  - ${key}`);
  }
}

if (hasErrors) {
  console.error(
    '\ni18n new-key check failed: new English strings must be translated in every locale before pushing.',
  );
  console.error(
    'Tip: run `pnpm --filter mobile exec i18next-cli extract` to scaffold keys, then translate.',
  );
  process.exit(1);
}

console.log('\ncheck-i18n-new-keys: all new keys are translated in every locale. ✔');
process.exit(0);
