---
title: Deployment Readiness - EAS Build & Store Submission
type: feat
status: completed
date: 2026-03-09
linear: MOT-116
---

# Deployment Readiness - EAS Build & Store Submission

## Overview

Prepare the MotoWise mobile app for deployment to Apple App Store and Google Play Store using EAS Build and EAS Submit. The app currently runs in development but is missing critical deployment configuration.

## Problem Statement

The app has no `eas.json`, no Expo project ID, uses old "MotoLearn" branding in native projects, has no splash screen configuration, and release builds on Android use the debug keystore. These must be fixed before any successful store submission.

## Phase 1: EAS Foundation (Critical)

### 1.1 Initialize EAS Project
- [ ] Run `eas init` in `apps/mobile/` to create Expo project and get `projectId`
- [ ] Add `owner` and `extra.eas.projectId` to app config
- [ ] Add `runtimeVersion` policy for EAS Update support

### 1.2 Convert app.json to app.config.ts
- [ ] Create `apps/mobile/app.config.ts` with dynamic env var injection
- [ ] Support build profiles: development, preview, production
- [ ] Delete `app.json` after migration
- [ ] Ensure `EXPO_PUBLIC_*` env vars are properly injected per profile

### 1.3 Create eas.json
- [ ] Create `apps/mobile/eas.json` with profiles:
  - `development`: dev client build, internal distribution
  - `preview`: TestFlight / internal track, staging API
  - `production`: App Store / Play Store submission, production API
- [ ] Configure `credentialsSource: "remote"` for cloud builds
- [ ] Configure `credentialsSource: "local"` option for local builds
- [ ] Set `channel` per profile for EAS Update

### 1.4 Create .easignore
- [ ] Create `apps/mobile/.easignore` to exclude:
  - `../../apps/api/`, `../../apps/web/`, `../../docs/`
  - `*.docx`, `*.md` (PRD files in root)
  - Test files, IDE config

## Phase 2: Branding & Assets

### 2.1 Fix Native Branding
- [ ] Update iOS `CFBundleDisplayName` to "MotoWise" in `Info.plist`
- [ ] Update Android `app_name` to "MotoWise" in `strings.xml`
- [ ] Update iOS permission strings from "MotoLearn" to "MotoWise" in `Info.plist`

### 2.2 Splash Screen
- [ ] Add `splash` configuration to app config (background color, image, resize mode)
- [ ] Ensure `expo-splash-screen` plugin is configured
- [ ] Verify splash screen renders on both platforms

### 2.3 App Icons Verification
- [ ] Verify iOS app icon (1024x1024) exists and is valid
- [ ] Verify Android adaptive icon (foreground + background) exists
- [ ] Add `icon` and `adaptiveIcon` configuration to app config if missing

## Phase 3: Build Configuration

### 3.1 iOS Build Setup
- [ ] Ensure `usesAppleSignIn` entitlement is set
- [ ] Configure `infoPlist` overrides for production (disable local networking)
- [ ] Add `expo-build-properties` plugin for iOS deployment target if needed

### 3.2 Android Build Setup
- [ ] Remove deprecated permissions (`WRITE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`) via `expo-build-properties`
- [ ] Remove `RECORD_AUDIO` if unused
- [ ] Configure `expo-build-properties` for targetSdkVersion/compileSdkVersion

### 3.3 Version Management
- [ ] Set initial version to `1.0.0`
- [ ] Configure `autoIncrement` for `buildNumber` (iOS) and `versionCode` (Android) in eas.json

## Phase 4: Environment & Secrets

### 4.1 Environment Configuration
- [ ] Create `.env.production` with production API URL and keys
- [ ] Document EAS Secrets setup for cloud builds (`eas secret:create`)
- [ ] Ensure app.config.ts reads correct env vars per profile

## Phase 5: Verification

### 5.1 Local Build Test
- [ ] Run `eas build --platform ios --profile development --local` successfully
- [ ] Run `eas build --platform android --profile development --local` successfully

### 5.2 Pre-submission Checklist
- [ ] All branding shows "MotoWise"
- [ ] Splash screen works on both platforms
- [ ] App icons render correctly
- [ ] Push notification permissions work
- [ ] RevenueCat initializes with test keys
- [ ] Deep linking works (`motowise://` scheme)

## Acceptance Criteria

- [ ] `eas.json` exists with development/preview/production profiles
- [ ] `app.config.ts` dynamically configures app per build profile
- [ ] `.easignore` excludes non-mobile monorepo content
- [ ] All native branding says "MotoWise"
- [ ] Splash screen configured
- [ ] Version set to 1.0.0
- [ ] Local EAS build succeeds for at least one platform

## Technical References

- Existing app config: `apps/mobile/app.json`
- Metro config: `apps/mobile/metro.config.js`
- Native iOS: `apps/mobile/ios/MotoLearn/`
- Native Android: `apps/mobile/android/app/`
- Env files: `apps/mobile/.env`, `apps/mobile/.env.example`
- Subscription: `apps/mobile/src/lib/subscription.ts`
- Notifications: `apps/mobile/src/lib/notifications.ts`
