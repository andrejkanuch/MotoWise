import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AbstractIntlMessages } from 'next-intl';
import { describe, expect, it } from 'vitest';
import enCatalog from '../../messages/en.json';
import { CLIENT_MESSAGE_NAMESPACES, pickClientMessages } from './client-messages';

// JSON arrays (e.g. testimonial items) don't fit next-intl's message type statically.
const en = enCatalog as unknown as AbstractIntlMessages;
const SRC_DIR = path.resolve(__dirname, '..');
const SOURCE_FILE = /\.tsx?$/;
const SKIPPED_FILE = /\.(test|stories)\.tsx?$/;
const USE_CLIENT = /^\s*['"]use client['"]/m;
const NAMESPACE_CALL = /useTranslations\(\s*['"]([A-Za-z0-9_]+)/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return SOURCE_FILE.test(entry.name) && !SKIPPED_FILE.test(entry.name) ? [full] : [];
  });
}

function clientNamespaces(): Set<string> {
  const used = new Set<string>();
  for (const file of sourceFiles(SRC_DIR)) {
    const source = readFileSync(file, 'utf8');
    if (!USE_CLIENT.test(source)) continue;
    for (const match of source.matchAll(NAMESPACE_CALL)) used.add(match[1]);
  }
  return used;
}

describe('client message namespaces', () => {
  it('lists every namespace a client component reads', () => {
    const listed = new Set<string>(CLIENT_MESSAGE_NAMESPACES);
    const missing = [...clientNamespaces()].filter((ns) => !listed.has(ns));
    expect(missing).toEqual([]);
  });

  it('lists only namespaces that exist in the catalog', () => {
    const missing = CLIENT_MESSAGE_NAMESPACES.filter((ns) => !(ns in en));
    expect(missing).toEqual([]);
  });

  it('keeps the client payload a small fraction of the catalog', () => {
    const picked = JSON.stringify(pickClientMessages(en)).length;
    expect(picked).toBeLessThan(JSON.stringify(en).length / 4);
  });
});
