#!/usr/bin/env node
// App Store Connect raw-API helper for the aso-v4 PPO test: the parts asc 5.4.0 has no command for.
//   node asc_ppo.mjs asset <header|search> <treatmentLocalizationId> <file.png>
//       Upload one creative asset and place it (ppo_publish.sh uses this, one marker per kind).
//   node asc_ppo.mjs assets <treatmentLocalizationId> <header.png> <search.png>
//       Upload both creative assets to the Asset Library and place them on that treatment localization.
//   node asc_ppo.mjs submit <experimentId>
//       Create a review submission holding the v2 experiment and submit it to App Review.
// Auth: team key from env (ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY_PATH), ES256 JWT, no deps.
// Flow verified on 2026-10-06 (memory project_screenshot_ab_test_1006): image POST -> PUT upload
// operations -> PATCH uploaded:true (no checksum attribute, it 409s) -> placement POST.
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const APP_ID = '6760291360';
const BASE = 'https://api.appstoreconnect.apple.com/';
const PLACEMENT = { header: 'PRODUCT_PAGE_HEADER_ASSET', search: 'APP_STORE_SEARCH_RESULTS_ASSET' };

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' });
  const body = b64({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' });
  const key = createPrivateKey(readFileSync(process.env.ASC_PRIVATE_KEY_PATH));
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${sig.toString('base64url')}`;
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadImage(file) {
  const bytes = readFileSync(file);
  const created = await api('POST', 'v1/appAssetLibraryImages', {
    data: {
      type: 'appAssetLibraryImages',
      attributes: { category: 'CREATIVE_ASSETS', fileName: basename(file), fileSize: statSync(file).size },
      relationships: { assetLibrary: { data: { type: 'appAssetLibraries', id: APP_ID } } },
    },
  });
  const id = created.data.id;
  for (const op of created.data.attributes.uploadOperations ?? []) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, {
      method: op.method,
      headers,
      body: bytes.subarray(op.offset, op.offset + op.length),
      signal: AbortSignal.timeout(600_000),
    });
    if (!res.ok) throw new Error(`upload part for ${file} -> ${res.status}`);
  }
  await api('PATCH', `v1/appAssetLibraryImages/${id}`, {
    data: { type: 'appAssetLibraryImages', id, attributes: { uploaded: true } },
  });
  // Apple processes the image after the upload: AWAITING_UPLOAD -> UPLOAD_COMPLETE -> a ready state
  // (PREPARE_FOR_SUBMISSION, seen 2026-11-03), or FAILED. Processing took up to ~2 min on 2026-11-03,
  // so wait up to 5 min. Never place an image that failed or is still processing.
  const PENDING = new Set(['AWAITING_UPLOAD', 'UPLOAD_COMPLETE']);
  let state;
  for (let i = 0; i < 100; i++) {
    const s = await api('GET', `v1/appAssetLibraryImages/${id}`);
    state = s.data.attributes.assetDeliveryState?.state ?? s.data.attributes.state;
    if (state === 'FAILED') {
      const why = JSON.stringify(s.data.attributes.stateDetails ?? s.data.attributes.assetDeliveryState?.errors ?? null);
      throw new Error(`${file}: Asset Library image ${id} FAILED processing: ${why}`);
    }
    if (state && !PENDING.has(state)) return { id, state };
    await sleep(3000);
  }
  throw new Error(`${file}: Asset Library image ${id} still ${state ?? 'unknown'} after 5 min; not placed`);
}

async function place(kind, imageId, treatmentLocId) {
  return api('POST', 'v1/appAssetLibraryPlacements', {
    data: {
      type: 'appAssetLibraryPlacements',
      attributes: { placementType: PLACEMENT[kind] },
      relationships: {
        image: { data: { type: 'appAssetLibraryImages', id: imageId } },
        appStoreVersionExperimentTreatmentLocalization: {
          data: { type: 'appStoreVersionExperimentTreatmentLocalizations', id: treatmentLocId },
        },
      },
    },
  });
}

async function asset(kind, locId, file) {
  if (!PLACEMENT[kind]) throw new Error(`unknown asset kind ${kind} (header | search)`);
  const img = await uploadImage(file);
  const p = await place(kind, img.id, locId);
  console.log(JSON.stringify({ kind, image: img.id, state: img.state, placement: p.data?.id }));
}

async function assets(locId, header, search) {
  await asset('header', locId, header);
  await asset('search', locId, search);
}

async function submit(experimentId) {
  const sub = await api('POST', 'v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  const sid = sub.data.id;
  await api('POST', 'v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: sid } },
        appStoreVersionExperimentV2: { data: { type: 'appStoreVersionExperiments', id: experimentId } },
      },
    },
  });
  const done = await api('PATCH', `v1/reviewSubmissions/${sid}`, {
    data: { type: 'reviewSubmissions', id: sid, attributes: { submitted: true } },
  });
  console.log(JSON.stringify({ reviewSubmission: sid, state: done.data.attributes.state }));
}

const [cmd, ...args] = process.argv.slice(2);
const run = { asset: () => asset(...args), assets: () => assets(...args), submit: () => submit(...args) }[cmd];
if (!run) {
  console.error('usage: asc_ppo.mjs asset <header|search> <treatmentLocId> <file.png> | assets <treatmentLocId> <header.png> <search.png> | submit <experimentId>');
  process.exit(2);
}
run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
