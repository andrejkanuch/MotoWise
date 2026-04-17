---
status: pending
priority: p2
issue_id: "121"
tags: [code-review, security, privacy, mobile]
dependencies: []
---

# Offline MMKV cache stores PII unencrypted

## Problem Statement

`apps/mobile/src/lib/offline-trips.ts:19` creates an MMKV instance with no `encryptionKey`. `cacheTripPayload` dumps the entire `TripDetail`: participant ids, display names, usernames, avatar URLs, bike ids, roles, and private waypoint notes. Android defaults to `allowBackup=true` in Expo, so this file ends up in `adb backup`; on jailbroken iOS it's readable from the app sandbox. Offline mode only needs display names — the rest is gratuitous exposure.

## Findings

- **Security Sentinel:** `offline-trips.ts:19` — `new MMKV({ id: 'offline-trips' })` without `encryptionKey`.
- **Security Sentinel:** full TripDetail persisted including participant UUIDs and avatars.
- No `android:allowBackup="false"` override in `apps/mobile/app.json`.

## Proposed Solutions

### Option A: Encrypt the MMKV store + strip non-essential PII (Recommended)

Generate a random 32-byte key on first run, store in `expo-secure-store`, pass as `encryptionKey`. Before writing, project TripDetail to the fields the offline screen actually renders (display name, waypoint name/coords/day_index). Set `android:allowBackup=false` or add backup rules excluding the MMKV file.

```ts
const key = await SecureStore.getItemAsync('mmkv-offline-key')
  ?? (await SecureStore.setItemAsync('mmkv-offline-key', randomBase64(32)), await SecureStore.getItemAsync('mmkv-offline-key'));
const store = new MMKV({ id: 'offline-trips', encryptionKey: key! });
```

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Migrate offline storage to SQLite with SQLCipher

Heavier; only worth it if offline scope expands to many entities.

## Recommended Action

Option A.

## Technical Details

- **Affected files:** `apps/mobile/src/lib/offline-trips.ts`, `apps/mobile/app.json`, possibly `apps/mobile/src/features/offline/*`

## Acceptance Criteria

- [ ] MMKV opened with `encryptionKey` from expo-secure-store
- [ ] Cached TripDetail payload excludes participant UUIDs and bike ids
- [ ] Android backup excludes the MMKV file
- [ ] Test: cache key rotation produces unreadable old file

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | security-sentinel |

## Resources

- Branch: feat/impeccable-discover-redesign
