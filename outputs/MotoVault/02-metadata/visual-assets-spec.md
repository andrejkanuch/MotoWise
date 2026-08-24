# Visual Assets Specification — MotoVault (iOS only)

**Rewritten:** 2026-08-24 · supersedes the 2026-07-22 version below.
**Grounded in:** `AUDIT-BRIEF-2026-08-24.md` (this session's verified facts) +
`docs/ASO-Snapshot-2026-08-24.md` + prior approved-caption memory
(`aso_generated_screenshots.md`, `aso_benefits.md`, `feedback_ai_diag_not_hero.md`).
**Scope:** App Store only. Google Play screenshots are a separate asset set, out of
scope for this file (Play's text listing is covered in `google-metadata.md`).

---

## Correction vs. the 2026-07-22 version of this file

The prior pass claimed the live screenshots had **no caption text at all**. That was
wrong, and this session's verified audit brief supersedes it: the live `motovault-v2` set
**is captioned** — the actual defect is **order**, not missing text. Live order is:

**Trips → Rides → Expenses (#3) → Maintenance (#4)**

against the PostHog-validated demand order **expenses > maintenance > rides > trips > AI**.
The two lowest-demand features (trips, rides) currently occupy the two highest-value slide
positions (#1, #2), and expense — the single feature with confirmed paying-user pull —
sits at #3. This is a real, still-uncorrected defect; it's just a different defect than
previously documented. Fix it directly (see below); it needs no A/B test, because there's
no plausible hypothesis under which the current order beats a demand-ordered one, and
testing it would burn PPO exposure re-discovering what the PostHog data already settled
(see `03-testing/ab-test-setup.md` Test 1 for why this ships directly, not as an experiment).

---

## Required sizes (App Store Connect, iOS)

| Device class | Representative device | Portrait px | Screenshots |
|---|---|---|---|
| iPhone 6.9" | iPhone 16 Pro Max / 16 Plus | 1320 × 2868 | 3–10 (use 5–6) |
| iPhone 6.5" | iPhone 14 Plus / 13 Pro Max | 1284 × 2778 | 3–10 (use 5–6) |
| iPhone 6.1" | iPhone 15 / 14 | 1179 × 2556 | Optional — Apple auto-scales from the 6.9"/6.5" set if omitted |
| iPad 13" | iPad Pro (M4) | 2064 × 2752 | 3–10 if the app supports iPad |

**Recommendation unchanged:** upload the 6.9" set as the primary source; App Store
Connect auto-generates 6.5"/6.1" from it. Verify exact pixel dimensions in Media Manager
at upload time — Apple periodically updates these when new device classes ship.

---

## Corrected caption order

| Order | Screen | Headline | Sub-caption (≤40 chars) | Status |
|---|---|---|---|---|
| **1 (flagship)** | Expense log / dashboard | **TRACK EVERY EXPENSE** | "Every fill-up. Every part. One total." | **Already captioned and approved — move from position #3 to #1** |
| 2 | Service/maintenance log | **NEVER MISS A SERVICE** | "Oil, tires, chain — tracked automatically" | **Already captioned and approved — move from position #4 to #2** |
| 3 (NEW) | AI Receipt Scan in action | **SNAP A RECEIPT, DONE** | "Auto-fills the expense or service for you" | New — build for the receipt-scan feature shipping in 3.19.1 |
| 4 | Ride log | **LOG EVERY RIDE** | "Distance, time, and route — automatic" | **Already captioned and approved — move from position #2 to #4** |
| 5 | Trip planner / Discover tab | **DISCOVER ROUTES & GROUP RIDES** | "Plan the ride, don't just track it" | **Already captioned and approved — move from position #1 to #5** |
| 6 (optional, low priority) | AI diagnostic chat | DIAGNOSE ANY ISSUE WITH AI | "Describe it, get an answer" | Approved copy exists; include only as a 6th slot, never leading |

**The fix is a reorder of 4 existing, already-approved, already-captioned assets plus one
new slide (#3, receipt scan) — no new copywriting or re-approval needed for slides 1, 2,
4, 5.** This is why it belongs in Test 1 of the experiment programme as a direct ship, not
a PPO test: every asset already exists, the only work is upload order and one new frame.

---

## Screenshot design rules (unchanged, still correct)

- Background matches the in-app dark theme (`palette.surface.background` from
  `@motovault/design-system`) — never a generic stock gradient.
- Headline typeface: same display font as in-app (Plus Jakarta Sans for the caption;
  Instrument Serif only for an editorial-style hero frame).
- Headline length ≤ 32 characters so it doesn't wrap on smaller device classes.
- Keep ≥30% of each frame as device chrome — don't crop the phone bezel.
- Show real product UI, not mockups or illustrations.
- No AI-hype visual cues (glowing sparkle icons, "✨ AI" badges) on non-AI slides —
  reserve any AI iconography for slide 3/6 only, given the trust position (US storefront
  shows a lone 2★ rating and 40% of impressions).

---

## Localization — caption translations (7 locales)

| EN | en-GB | de-DE | it | es-MX | fr-FR | pt-BR |
|---|---|---|---|---|---|---|
| TRACK EVERY EXPENSE | TRACK EVERY EXPENSE | JEDE AUSGABE IM BLICK | TRACCIA OGNI SPESA | CONTROLA CADA GASTO | SUIVEZ CHAQUE DÉPENSE | CONTROLE CADA GASTO |
| NEVER MISS A SERVICE | NEVER MISS A SERVICE | KEINE WARTUNG VERPASSEN | MAI PIÙ TAGLIANDI SALTATI | NO PIERDAS NINGÚN SERVICIO | NE RATEZ AUCUN ENTRETIEN | NUNCA PERCA UMA REVISÃO |
| SNAP A RECEIPT, DONE | SNAP A RECEIPT, DONE | BELEG FOTOGRAFIEREN, FERTIG | FOTO DELLO SCONTRINO, FATTO | FOTO DEL RECIBO, LISTO | UNE PHOTO DU REÇU, C'EST FAIT | FOTO DO RECIBO, PRONTO |
| LOG EVERY RIDE | LOG EVERY RIDE | JEDE FAHRT FESTHALTEN | REGISTRA OGNI USCITA | REGISTRA CADA RODADA | NOTEZ CHAQUE SORTIE | REGISTRE CADA PASSEIO |
| DISCOVER ROUTES & GROUP RIDES | DISCOVER ROUTES & GROUP RIDES | ROUTEN & GRUPPENFAHRTEN | PERCORSI & USCITE DI GRUPPO | RUTAS & RODADAS EN GRUPO | ITINÉRAIRES & SORTIES DE GROUPE | ROTAS & PASSEIOS EM GRUPO |
| (optional) DIAGNOSE ANY ISSUE WITH AI | same | DIAGNOSE MIT KI | DIAGNOSI CON L'IA | DIAGNÓSTICO CON IA | DIAGNOSTIC AVEC L'IA | DIAGNÓSTICO COM IA |

en-GB reuses en-US captions verbatim — no British-English vocabulary difference for these
particular headlines.

---

## App preview video (optional, still recommended)

Apple allows up to 3 app preview videos per locale. One 15–30s video showing:

1. (0–3s) Garage screen — multi-bike view
2. (3–8s) Log an expense → snap a receipt → auto-fill (the hero moment)
3. (8–13s) Add a service entry → reminder set
4. (13–20s) Start a ride → see it logged automatically
5. (20–25s) Closing hero frame — logo + tagline

**Specs:** 1080×1920 (or native device resolution) H.264 MP4, 30fps, ≤500 MB.

---

## Icon

No change proposed as a direct ship — icon is treated exclusively as PPO test material
(Test 6 in `03-testing/ab-test-setup.md`), because unlike the screenshot reorder above,
there's no confirmed-broken current icon to fix outright; any icon change is a genuine
hypothesis, not a bug fix, so it belongs in an experiment, not a direct release.

---

## What the PPO treatments should actually look like (Test 4, `ab-test-setup.md`)

Apple PPO can only vary **icon, screenshots, and app preview** — never text — so both
arms below reuse the exact caption copy from the corrected order above; only the **hero
slide and its visual emphasis** differ between control and treatment.

**Control (the corrected default page, once Test 1 ships):**
Slide 1 = TRACK EVERY EXPENSE, in the order specified above (1–6). This is simply "what
everyone sees" once the direct fix lands — not a novel treatment, the new baseline.

**Treatment ("Receipt+CarPlay hero"):**
- Slide 1 becomes a **combined hero frame**: a receipt mid-scan animation frame with the
  auto-filled expense form behind it, headline **SNAP A RECEIPT, DONE**, sub-caption
  "Fill in an expense before you've put your helmet down."
- Slide 2 becomes **TRACK EVERY EXPENSE** (demoted one position, not removed — expense
  tracking is still demand #1 and must stay in the top 2 slots per the positioning rule).
- Slides 3–6 unchanged from the control order (Service → Ride → Trip → optional AI).

**Hypothesis under test:** a novelty-forward hook (a feature no competitor has) captures
more marginal taps than a demand-forward hook (a feature every competitor also claims),
*without* pushing expense tracking out of the top two slides — the treatment is a
reordering bet, not an abandonment of the demand-order rule. If the treatment doesn't beat
control by the ~50%+ relative margin the power math in `ab-test-setup.md` says is the only
detectable size at current traffic, keep the demand-forward control — that's the
higher-confidence default regardless of test outcome, since it's the one grounded directly
in PostHog usage data rather than a hypothesis about screenshot novelty.

**Asset prep needed before creating the experiment in ASC:** the receipt-mid-scan hero
frame is **new art**, not a reuse of an existing approved asset (unlike slides 1/2/4/5 in
the direct-ship fix above) — budget design time for it before the Test 4 start date in
`ab-test-setup.md` (targeted after Test 1 ships).
