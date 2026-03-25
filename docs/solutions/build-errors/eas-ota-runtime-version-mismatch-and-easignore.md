---
title: "EAS OTA Update Runtime Version Mismatch & .easignore Optimization"
category: build-errors
date: 2026-03-24
tags: [eas, expo-updates, ota, runtime-version, easignore, build-size]
module: mobile build pipeline
symptom: "OTA update published but not delivered to production users; build archive 324MB"
root_cause: "runtimeVersion policy 'appVersion' means OTA updates only reach devices with matching native build version. Production build was v1.2.0 but OTA targeted v2.3.0."
---

# EAS OTA Update Runtime Version Mismatch & .easignore Optimization

## Problem

After pushing an OTA update via `eas update --branch production`, no users received the update. The production build was v1.2.0 (SDK 54) but the OTA update was published with runtime version 2.3.0.

Additionally, the EAS build archive was 324MB — mostly marketing PNGs, old `.ipa` builds, and the web app.

## Root Cause

With `runtimeVersion: { policy: 'appVersion' }` in `app.config.ts`, the runtime version equals the app version. OTA updates are only delivered to devices running a native build with the **exact same runtime version**. A v1.2.0 build will never receive an update targeting v2.3.0.

**Key insight:** OTA updates are for JS-only changes between native builds. If you bump the app version, you need a new native build first, then OTA works for subsequent JS patches within that version.

## Solution

### 1. Check your production build version before pushing OTA

```bash
eas build:list --platform ios --status finished --limit 1 --json
# Look for runtimeVersion and appVersion
```

### 2. Guard native-dependent features with try/catch

For features using native modules that may not exist in older builds:

```typescript
// hooks/use-lean-angle.ts
useEffect(() => {
  let subscription = null;
  try {
    DeviceMotion.setUpdateInterval(33);
    subscription = DeviceMotion.addListener((data) => { ... });
  } catch {
    // Native module unavailable — degrade gracefully
  }
  return () => { subscription?.remove(); };
}, []);
```

### 3. Optimize .easignore to reduce archive size

```
# .easignore — exclude from EAS build archive
../../apps/api/          # API not needed for mobile
../../apps/web/          # Web app (~411MB)
../../marketing-material/ # PNGs (~92MB)
../../marketing/          # More PNGs (~7.5MB)
*.ipa                    # Old builds (~72MB)
../../scripts/
../../supabase/
../../docs/
../../.claude/
```

This reduced the archive from **324MB → ~50-70MB**.

## Prevention

- Always check `eas build:list` runtime version before `eas update`
- If you bump `version` in `app.config.ts`, you need a new native build before OTA works
- Wrap native module usage in try/catch for graceful degradation
- Keep `.easignore` updated when adding large non-code assets to the repo
