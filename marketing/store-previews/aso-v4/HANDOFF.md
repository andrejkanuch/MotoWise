# Handoff: per-country App Store screenshots + PPO test (2026-11-03)

From session motowise-ba to the next session. Read this whole file before acting.

## Goal

Real in-app screenshots per country, in each country's language, are composed into store images in the owner's canvas style. They are used in ONE App Store Product Page Optimization (PPO) test, with a treatment localization per live App Store language. Later they also go onto Google Play.

## Owner decisions already made (don't re-ask)

- **Go now:** upload what is available and start the test now. The 7 live App Store languages are en-US, en-GB, es-MX, pt-BR, fr-FR, it and de-DE. A language without a set is left out of the treatment, so its visitors see the control.
- **One experiment:** "Local per-country screenshots Nov 2026", one treatment "Local per-country set", 50% traffic. The previous PPO eb5c0fd3 was STOPPED today.
- **No new App Store localizations (es-ES, en-CA, en-AU) yet.** The Apple account is moving from personal to corporate. If any App Store write fails in a way that looks account-related, STOP and tell the owner; don't retry around it.
- **Phones show the full screen including the bottom tab bar** (the composer already does this). Ride tracking shows the stats sheet.
- **Nothing may reach RevenueCat or analytics from capture runs.** Use only the local key-free build (`build_capture.sh` exports empty RC/PostHog/Meta/Sentry keys, OTA off). Never use a TestFlight/store build or a prod OTA. Never open a paywall. Delete demo accounts with SQL + the Auth Admin API, never through the app.
- **Don't publish an OTA** without the owner's explicit go-ahead.

## State right now

- **Composed sets** (`marketing/store-previews/aso-v4/pipeline/out/composed/<CC>/`): US GB CA AU PH MX CO AR ES FR IT DE, each with `ios/iphone-6.9/` (10 slides, 1290x2796), `ios/asset-library/header.png` (3840x1646), `ios/asset-library/search.png` (3840x2560), `play/phone/` (8) and `play/feature-graphic.png`.
- **Brazil (pt-BR):** not captured yet. On 3.26.0 a Portuguese phone gets English, a bug that is fixed on branch `fix/mobile-pt-br-locale` (commit 30f737af; PR #360 was closed as redundant with #357). Session motowise-ba started "build from that branch, then capture BR" in the background around 17:00. Check `out/captures/BR/` (10 PNGs) and `out/capture-all-summary.txt`:
  - If BR is captured, compose it: `python3 compose/compose.py BR --captures out/captures/BR --out out/composed/BR --accent-line2`.
  - If not, rebuild and capture:

    ```
    UDID=3ACCF7AE-4A78-4048-9A1B-305F0C3C8DB6 ~/.motovault-screenshots/build_capture.sh
    xcrun simctl install 3ACCF7AE-4A78-4048-9A1B-305F0C3C8DB6 /Users/andrejmacm5/personal/MotoWise-currency-limits/apps/mobile/build/Build/Products/Release-iphonesimulator/MotoVaultDev.app
    cd marketing/store-previews/aso-v4/pipeline
    APP_TREE=/Users/andrejmacm5/personal/MotoWise-currency-limits PW_DIR=$HOME/.motovault-screenshots/pw capture/capture_all.sh 3ACCF7AE-4A78-4048-9A1B-305F0C3C8DB6 BR
    ```

    The worktree `/Users/andrejmacm5/personal/MotoWise-currency-limits` must be on `fix/mobile-pt-br-locale`. The build takes about 15 min and each market about 5 min. `capture_market.sh` runs the RevenueCat/analytics preflight first; it must PASS.
- **Demo accounts on prod:** `screenshots+<cc>@motovault.app` for all 13 markets, seeded and onboarded. Ids are in `~/.motovault-screenshots/accounts.txt`, passwords in `~/.motovault-screenshots/pw/<cc>.pw` (mode 600, never print them).
- **Canvas** for owner review: https://claude.ai/artifact/E3jxrkkw3xixkA7vNwDDX1. The page "Store sets · 13 countries" has 7 sets and "Apple · aso-v4" has the copy and the Mexico boards. The owner edits this canvas too, so always re-read `project/canvas.json` before publishing to it.

## Next steps

1. **Finish BR** (see above).
2. **Dry run, then create and upload:**

   ```
   cd marketing/store-previews/aso-v4/pipeline
   PPO_LOCALES="en-US:US en-GB:GB es-MX:MX pt-BR:BR fr-FR:FR it:IT de-DE:DE" upload/ppo_publish.sh --dry-run
   PPO_LOCALES="en-US:US en-GB:GB es-MX:MX pt-BR:BR fr-FR:FR it:IT de-DE:DE" upload/ppo_publish.sh
   ```

   Drop `pt-BR:BR` if BR can't be captured. The script creates the experiment and treatment. Per language it creates the treatment localization, syncs the iPhone screenshot set (IPHONE_67), and uploads and places the header and search assets through `upload/asc_ppo.mjs` (Asset Library raw API). The log goes to `out/ppo-publish.log` and holds the experiment id.
3. **Check in ASC** (or via `asc product-pages experiments treatments localizations screenshot-sets list --localization-id …`) that each language shows its own 10 screenshots.
4. **Submit:** `node upload/asc_ppo.mjs submit <experimentId>`. It needs env `ASC_KEY_ID=B7J3LS6SPC ASC_ISSUER_ID=faa21eba-ddd9-41ca-b90d-42b5af7913d0 ASC_PRIVATE_KEY_PATH=~/.asc/keys/AuthKey_B7J3LS6SPC.p8`.
5. **Start after Apple approves:**

   ```
   asc product-pages experiments update --v2 --experiment-id <id> --started true </dev/null
   ```

   Use env-var auth as in `upload/ppo_publish.sh`.
6. **Results** come from `GET /analytics/api/v1/ab-tests/<id>?baseline=default` with the `asc web` session cookies (memory `reference_asc_analytics_pull`). Traffic is low: earlier tests needed a very large lift to show a winner.

## Later (not now)

- **When PR #357 merges** (native i18n review by session motowise-5a, app version 3.27.0): re-capture es / pt-BR / fr (MX CO AR ES BR FR) from main, because #357 rewrites their wording and fixes the glossary (ride = rodada/rolê/sortie, trip = viaje/viagem/voyage). it, de and en don't change.
- **3.27.0 store version:** new names, keywords and descriptions are in `copy/apple-*.json`. Add es-ES/en-CA/en-AU only once the account move allows it.
- **Google Play:** default listings via `gplay` (RUNBOOK §8). The MX/CO/AR/PH custom store listings are console-only.

## Gotchas learned today

- **Seed and capture quirks:**
  - The seed must set `preferences.onboardingCompleted = true`, because the app routes on it.
  - The receipt breakdown must be net of tax.
  - Demo passwords must be lowercase letters and digits only, because some simulator keyboards mistype other characters.
- **Maestro:**
  - Use `MAESTRO_DRIVER_STARTUP_TIMEOUT=240000`, and don't run the Maestro MCP and CLI on the same simulator.
  - `capture_all.sh` reinstalls the app and resets the keychain per market, because the session survives an uninstall.
  - The analytics-consent sheet can appear late, over the sign-in form; `_signin.yaml` handles it.
- **Full details:** memory `project_aso_v4_market_screenshots.md` and `pipeline/RUNBOOK.md`.
