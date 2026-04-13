# MotoVault — Visual Assets Specification

**Generated:** 2026-04-11
**Note:** Per memory, 4/5 ASO screenshots are already approved (v1) and screenshot #5 is pending Discover tab retake. This spec captures the canonical layout so future refreshes stay consistent.

---

## Approved screenshot copy (already in production)

| # | Headline | Status |
|---|---|---|
| 1 | TRACK EVERY EXPENSE | Approved (v1) |
| 2 | NEVER MISS A SERVICE | Approved (v1) |
| 3 | DIAGNOSE ANY ISSUE WITH AI | Approved (v1) |
| 4 | LOG EVERY RIDE | Approved (v1) |
| 5 | DISCOVER ROUTES & GROUP RIDES | Pending retake (Discover tab) |

---

## Apple App Store screenshot specs

| Device class | Required size | Required count |
|---|---|---|
| iPhone 6.9" (15/16 Pro Max) | 1290×2796 | 3-10 (use 5-6) |
| iPhone 6.5" (XS Max class) | 1242×2688 | 3-10 (use 5-6) |
| iPhone 5.5" (deprecated 2025) | n/a | n/a |
| iPad 13" (M4 iPad Pro) | 2064×2752 | 3-10 if iPad supported |

**Recommendation:** Ship 6.9" only — Apple auto-resizes for older devices since 2024.

### Recommended order (data-backed by Detecht/Scenic/REVER patterns)

1. **#3 DIAGNOSE ANY ISSUE WITH AI** — lead with the moat
2. **#2 NEVER MISS A SERVICE** — clearest pain-killer benefit
3. **#1 TRACK EVERY EXPENSE** — second pain-killer
4. **#4 LOG EVERY RIDE** — pivot to delight
5. **#5 DISCOVER ROUTES & GROUP RIDES** — community/upsell
6. (optional) Garage hero shot — multi-bike showcase

> **Why AI first:** Apple Search Ads research shows screenshot 1 drives 60-70% of conversion. Lead with what no competitor has.

---

## Google Play screenshot specs

| Asset | Spec |
|---|---|
| Phone screenshots | 1080×1920 (or any 16:9-ish), 2-8 images |
| 7" tablet | 1024×600 or larger |
| 10" tablet | 1280×800 or larger |
| Feature graphic (mandatory) | 1024×500 PNG/JPG, no alpha |
| App icon | 512×512 32-bit PNG, alpha allowed |

### Feature graphic concept

**Layout:** Left 60% — bike silhouette + MotoVault wordmark + tagline "Two wheels. One app."
**Right 40%:** AI Mechanic chat bubble preview ("Engine rattles at 4000 RPM…") with green checkmark.
**Background:** Dark gradient (matches in-app dark mode).
**Avoid:** Stock motorcycle photos. Use the actual app dashboard rendered at scale.

---

## Brand consistency rules

- Background color: matches in-app dark theme (`palette.surface.background` from `@motovault/design-system`)
- Headline typeface: same display font as in-app
- Headlines: ALL CAPS, ≤ 32 chars
- Keep at least 30% of each frame as device chrome (don't crop the phone bezel)
- Show real product UI, not mockups
- Use motorcycle-themed accent imagery (helmet icons, road textures) sparingly — content is the hero

---

## Localization rules for screenshots

For each non-English locale (DE, FR, IT, ES), translate the headlines:

| EN | DE | FR | IT | ES |
|---|---|---|---|---|
| TRACK EVERY EXPENSE | JEDE AUSGABE IM BLICK | SUIVEZ CHAQUE DÉPENSE | TRACCIA OGNI SPESA | CONTROLA CADA GASTO |
| NEVER MISS A SERVICE | KEINE WARTUNG VERPASSEN | NE RATEZ AUCUN ENTRETIEN | MAI PIÙ TAGLIANDI SALTATI | NO PIERDAS NINGÚN SERVICIO |
| DIAGNOSE WITH AI | DIAGNOSE MIT KI | DIAGNOSTIC AVEC L'IA | DIAGNOSI CON L'IA | DIAGNÓSTICO CON IA |
| LOG EVERY RIDE | JEDE FAHRT FESTHALTEN | NOTEZ CHAQUE BALADE | REGISTRA OGNI USCITA | REGISTRA CADA RUTA |
| DISCOVER ROUTES & GROUP RIDES | ROUTEN & GRUPPENFAHRTEN | ITINÉRAIRES & SORTIES DE GROUPE | PERCORSI & USCITE DI GRUPPO | RUTAS & SALIDAS EN GRUPO |

---

## App preview video (optional, recommended)

Apple allows up to 3 app preview videos per locale. We recommend ONE video, 15-30 seconds, showing:

1. (0-3s) Garage screen — multi-bike showcase
2. (3-8s) Asking the AI Mechanic a question, getting an answer
3. (8-13s) Adding a service entry → reminder set
4. (13-20s) Plan a trip → start a ride → see it logged
5. (20-25s) Final hero shot with logo + tagline

**Specs:** 1080×1920 H.264 MP4, 30fps, ≤500 MB.
**Audio:** Optional but recommended — engine rev → soft music → silence at the AI question for emphasis.
