#!/usr/bin/env tsx
/**
 * upload-screenshots.ts — sync marketing/screenshots/ to Supabase Storage.
 *
 * Uploads all PNG files from marketing/screenshots/ to the `social-media`
 * bucket under the `screenshots/` prefix. Uses upsert mode so re-running
 * is safe and idempotent.
 *
 * Run locally (NOT from a Claude sandbox). Requires env vars:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY  (or SUPABASE_SERVICE_ROLE_KEY)
 *
 * Usage:
 *   pnpm --filter @motovault/social-worker upload-screenshots
 *   # or from repo root:
 *   tsx infra/social-worker/scripts/upload-screenshots.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __scriptDir =
  typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = resolve(__scriptDir, '../../../marketing/screenshots');
const BUCKET = 'social-media';
const PREFIX = 'screenshots';

function die(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const authKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !authKey) {
    die('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be set in env');
  }

  const files = readdirSync(SCREENSHOTS_DIR).filter((f) => f.endsWith('.png'));
  if (files.length === 0) {
    die(`No PNG files found in ${SCREENSHOTS_DIR}`);
  }

  console.log(`→ Uploading ${files.length} screenshot(s) to ${BUCKET}/${PREFIX}/\n`);

  let uploaded = 0;
  let failed = 0;

  for (const file of files) {
    const localPath = join(SCREENSHOTS_DIR, file);
    const storagePath = `${PREFIX}/${file}`;
    const data = readFileSync(localPath);

    const url = `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authKey}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: data,
    });

    if (res.ok) {
      console.log(`  ✓ ${storagePath} (${(data.length / 1024).toFixed(0)} KB)`);
      uploaded++;
    } else {
      const body = await res.text();
      console.error(`  ✗ ${storagePath}: ${res.status} ${body.slice(0, 200)}`);
      failed++;
    }
  }

  console.log(`\n✓ Uploaded: ${uploaded}  ✗ Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
