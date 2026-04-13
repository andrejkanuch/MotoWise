#!/usr/bin/env tsx
/**
 * publish-carousel.ts — publish a carousel from a local directory of slides.
 *
 * Reads slide-*.png files from the given directory (sorted), base64-encodes
 * each, reads the caption from caption.md (the "## Instagram Caption" section,
 * or the whole file if that section is missing), and POSTs to the worker's
 * /publish-carousel endpoint.
 *
 * Run locally. Requires env vars:
 *   WORKER_URL        — e.g. https://motovault-social-api.<account>.workers.dev
 *   WORKER_AUTH_KEY   — matches the deployed worker secret
 *
 * Usage:
 *   tsx infra/social-worker/scripts/publish-carousel.ts <directory> [--platform=both|instagram|facebook] [--dry-run] [--smoke-test]
 *
 * Examples:
 *   # Smoke test: only first 2 slides, IG only — use this BEFORE publishing real
 *   tsx infra/social-worker/scripts/publish-carousel.ts \
 *     marketing/carousel-all-features --smoke-test
 *
 *   # Real publish to both IG + FB
 *   tsx infra/social-worker/scripts/publish-carousel.ts \
 *     marketing/carousel-all-features --platform=both
 *
 *   # Dry run: prints what would be sent without hitting the worker
 *   tsx infra/social-worker/scripts/publish-carousel.ts \
 *     marketing/carousel-all-features --dry-run
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Platform = 'both' | 'instagram' | 'facebook';

interface Args {
  directory: string;
  platform: Platform;
  dryRun: boolean;
  smokeTest: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  if (positional.length !== 1) {
    console.error(
      'Usage: tsx publish-carousel.ts <directory> [--platform=both|instagram|facebook] [--dry-run] [--smoke-test]',
    );
    process.exit(1);
  }
  const platformArg = args.find((a) => a.startsWith('--platform='))?.split('=')[1];
  const platform: Platform = (platformArg as Platform) ?? 'both';
  if (!['both', 'instagram', 'facebook'].includes(platform)) {
    console.error(`Invalid platform: ${platform}`);
    process.exit(1);
  }
  return {
    directory: resolve(positional[0]),
    platform,
    dryRun: args.includes('--dry-run'),
    smokeTest: args.includes('--smoke-test'),
  };
}

/**
 * Pull the Instagram caption out of caption.md. Looks for the "## Instagram
 * Caption" header and grabs everything until the next "##" or "---". Falls back
 * to the full file contents if that section is missing.
 */
function readCaption(directory: string): string {
  const captionPath = join(directory, 'caption.md');
  if (!statSync(captionPath, { throwIfNoEntry: false })) {
    throw new Error(`Missing caption.md in ${directory}`);
  }
  const raw = readFileSync(captionPath, 'utf-8');
  const igMatch = raw.match(/##\s*Instagram Caption\s*\n([\s\S]*?)(?=\n##\s|\n---|$)/i);
  if (igMatch) return igMatch[1].trim();
  return raw.trim();
}

function loadSlides(directory: string): { name: string; base64: string }[] {
  const files = readdirSync(directory)
    .filter((f) => /^slide-\d+.*\.png$/i.test(f))
    .sort();
  if (files.length === 0) {
    throw new Error(`No slide-*.png files in ${directory}`);
  }
  return files.map((name) => ({
    name,
    base64: readFileSync(join(directory, name)).toString('base64'),
  }));
}

async function main() {
  const args = parseArgs();
  const workerUrl = process.env.WORKER_URL;
  const workerAuthKey = process.env.WORKER_AUTH_KEY;

  if (!args.dryRun && (!workerUrl || !workerAuthKey)) {
    console.error('WORKER_URL and WORKER_AUTH_KEY env vars are required (or pass --dry-run).');
    process.exit(1);
  }
  // After the guard above, both vars are non-null on the live path. Narrow the
  // types so the fetch call below doesn't need a non-null assertion.
  const url = workerUrl ?? '';
  const authKey = workerAuthKey ?? '';

  const caption = readCaption(args.directory);
  let slides = loadSlides(args.directory);

  if (args.smokeTest) {
    slides = slides.slice(0, 2);
    console.log('🧪 SMOKE TEST: only first 2 slides, instagram only');
  }

  console.log(`Directory : ${args.directory}`);
  console.log(`Slides    : ${slides.length} (${slides.map((s) => s.name).join(', ')})`);
  console.log(`Platform  : ${args.smokeTest ? 'instagram' : args.platform}`);
  console.log(`Caption   : ${caption.split('\n')[0].slice(0, 80)}…`);
  console.log(
    `Total b64 : ${slides.reduce((acc, s) => acc + s.base64.length, 0).toLocaleString()} chars`,
  );

  if (args.dryRun) {
    console.log('\n[dry run] not sending request');
    return;
  }

  const body = {
    images_base64: slides.map((s) => s.base64),
    caption,
    platform: args.smokeTest ? 'instagram' : args.platform,
  };

  console.log('\n→ POST /publish-carousel');
  const res = await fetch(`${url}/publish-carousel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Key': authKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`← ${res.status} ${res.statusText}`);
  console.log(text);

  if (!res.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
