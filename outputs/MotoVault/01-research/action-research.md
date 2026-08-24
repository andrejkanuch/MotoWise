# Research action checklist — MotoVault

_Written 2026-08-24 (Mon). Owner is **Andrej** for everything below — solo developer, one
person. "Owner" columns name the *role* the task belongs to so it can be delegated later._

Dependencies that gate everything: **3.19.1 is `WAITING_FOR_REVIEW`** (submitted today,
build 88, `releaseType: MANUAL`). Metadata for a version in review cannot be edited without
pulling it from review. So all metadata rewrites below target **3.20.0**, not 3.19.1 — with
one exception (A1), which is not metadata and must happen while 3.19.1 is still in review.

---

## A. This week — closes before 3.19.1 goes live

| # | Action | Owner | Due | Done |
|---|---|---|---|---|
| A1 | **Submit a featuring nomination for the CarPlay release.** `asc nominations list` returns 0 in every state — the editorial channel has never been used. Type `APP_ENHANCEMENT`, hook = CarPlay Driving Task entitlement (case 20710293), locales en-US/en-GB/de-DE/fr-FR/it/es-MX/pt-BR, markets Europe + Americas. Apple asks 3 weeks' lead time; 3.19.1 is in review now, so this is the window. | ASO | **2026-08-26 (Wed)** | ☐ |
| A2 | **Decide the 3.19.1 keyword field: leave it, or pull from review.** Recommendation: **leave it.** The recommended set is a subtitle change plus a field change and they belong in one release; pulling 3.19.1 delays the rating soft-ask, which is the #1 constraint. Log the decision either way. | ASO | 2026-08-25 (Tue) | ☐ |
| A3 | **Publish the DRAFT in-app event.** `asc app-events list --app 6760291360` → id `6772116373`, "Initial in app event", `eventState: DRAFT`, never published. In-app events surface on the Today tab, category pages and inside search results and — unlike category charts — require no download velocity. Peg it to receipt scanning or CarPlay. | ASO | 2026-08-28 (Fri) | ☐ |

## B. 3.20.0 metadata — the priority work

Copy-paste strings, character counts and dedup verification are in
`01-research/keyword-list.md` ("Recommended metadata"). Every string there was verified
≤ limit with zero tokens duplicated across name/subtitle/field.

| # | Action | Owner | Due | Done |
|---|---|---|---|---|
| B1 | **Rewrite all 7 subtitles.** Promote the category head term (`Maintenance` / `Wartung` / `Entretien` / `Manutenzione` / `Mantenimiento` / `Manutenção`) out of the keyword field into the subtitle; drop `Trip` and `Ride`. **This is the highest-leverage edit in the account.** | ASO | **2026-09-07 (Mon)** | ☐ |
| B2 | **Fix the two untranslated subtitles found today** — es-MX `Gasto, Servicio, Viaje & Ride` and pt-BR `Custo, Serviço, Viagem & Ride` both ship the English word "Ride" live. Covered by B1's rewrite; verify explicitly. | ASO | with B1 | ☐ |
| B3 | **Rewrite all 7 keyword fields.** Recovers ~30 chars/locale (`budget`, `carplay`, `rider` out; `service`, `log`, `moto`, `odometer`, `Scheckheft`, `libretto`, `revisão`, `quilometragem` in). | ASO | with B1 | ☐ |
| B4 | **Fix the `fi` subtitle:** currently `Service, Trips & AI Mechanic` — English text in a Finnish listing, leading on the least-used feature. Worst string in the account. | ASO | with B1 | ☐ |
| B5 | **Fix the `es-ES` subtitle** (`Rutas, Mantenimiento y Gastos` — routes-first, contradicts demand order). Spain is a target market with a localized subtitle and no version localization. | ASO | with B1 | ☐ |
| B6 | **Decide on `hi` / `th` / `id` / `tr` localizations.** All four are non-target markets (`hi` has had zero users ever) and they correlate with the ~330 junk-geography impressions in the tail. Keep or delete — but decide, don't leave it accidental. | Product | 2026-09-07 (Mon) | ☐ |
| B7 | **Do NOT change any app name in 3.20.0.** Name changes are the escalation path *after* B1 is measured; shipping both makes the result uninterpretable. Recorded here as an explicit non-action. | ASO | n/a | ☑ |

## C. Measurement — how we learn whether B1 worked

The B1 hypothesis is falsifiable in one command. Today MotoVault is **absent** from
`motorcycle maintenance`, `motorrad wartung`, `entretien moto`, `manutenzione moto` and
`manutencao moto`. If the field-weight ladder holds, moving the head term to the subtitle
puts us in the top 5 of most of them.

| # | Action | Owner | Due | Done |
|---|---|---|---|---|
| C1 | **Baseline is captured** — 22 search queries + 224 per-territory rating reads saved to `01-research/raw-data/2026-08-24/`. Re-run the identical script post-release for a clean diff. | ASO | 2026-08-24 | ☑ |
| C2 | **Rank re-check, 3 weeks after 3.20.0 ships.** Re-run the 5 head-term queries above. Leading indicator, available in minutes. | ASO | **3.20.0 release + 21d** | ☐ |
| C3 | **Impressions re-pull** — WEEKLY instances of request `f25db9b3-06e1-4442-a33b-98cf84224602`, reports r14/r3/r6/r12. Run **serially**: a few hundred analytics calls throttles the whole ASC API. Compare against the 138.4 imp/day post-3.18.0 baseline. | ASO | **2026-09-21 (Mon)** | ☐ |
| C4 | **Ratings re-pull** after 3.19.1 is live and the soft-ask reaches real users. `asc reviews ratings --app 6760291360 --all` (not the per-storefront lookup — that is what produced the wrong "1 rating" figure in earlier audits). Watch the **US** count specifically: US is 40% of impressions and currently shows a lone 2★. | ASO | **2026-09-14 (Mon)** | ☐ |
| C5 | **Monthly competitor re-pull, not quarterly.** Seven direct competitors shipped updates in the 6 days to 2026-08-24 and 15 new entrants appeared since the July audit. Quarterly is too slow for this cluster. | ASO | **2026-09-28 (Mon)**, then monthly | ☐ |

## D. Decisions closed by this research — do not re-litigate

| Question | Answer | Evidence |
|---|---|---|
| Change the primary category away from Utilities to chase browse? | **No.** Browse impressions come from Top Charts, category pages and the Today tab. Charts need download velocity; we are at **1.24 first-time installs/day**, nowhere near the Top 200 of any category. Apple's full category list was pulled (57 entries) — **there is no automotive or motorcycle category to move into.** Revisit only at two-digit daily installs. | `asc categories list`; funnel figures from the audit brief |
| Is there an App Store "CarPlay apps" browse collection to be eligible for? | **No — it does not exist.** CarPlay app discovery happens on the CarPlay screen and in Settings, not via an App Store browse surface. Any plan built on this is void. | Searched and verified 2026-08-24 |
| Add OEM brand keywords (`harley`, `yamaha`, `bmw`, `ktm`)? | **No.** The ranking opportunity is real (`harley maintenance` has no credible incumbent) but third-party trademarks in the keyword field are a live App Review 5.2.1 risk and 3.19.1 is in review now. | Live search results; App Review guideline 5.2.1 |
| Add `tracker` to the keyword field? | **No — add it to the subtitle.** Its value is in compounds (`expense tracker`, `maintenance tracker`), and the standalone `motorcycle tracker` query is owned by GPS apps (REVER 16,125 ratings). Subtitle placement covers the compounds at higher weight. | Live `motorcycle tracker` result set |
| Keep `receipt` in the en-US field? | **Yes.** It was part of the 3.18.0 field that produced ×2.45 impressions; cutting it removes a variable from a configuration that demonstrably worked, and it costs 8 chars. | 3.18.0 vs 3.19.1 field diff via `asc localizations list` |
| Reply to the US 2★? | **Impossible, already struck.** Star-only rating with no review text; Apple provides no mechanism. The only lever is generating new US ratings. | Audit brief, confirmed |

## E. Open questions this research could not answer

| Question | Why it's open | What would close it |
|---|---|---|
| **Which queries actually produce our 133 daily search impressions?** | Apple exposes this nowhere. No Apple Search Ads campaign is running, so there are no popularity scores and no term-level impression data. Every "demand" judgement in `keyword-list.md` is ordinal, inferred from result-set depth. | A minimal Apple Search Ads campaign (even $5/day) unlocks Search Ads popularity + search-term reports — the only first-party source of Apple keyword volume. This is the single biggest blind spot in the whole ASO program. |
| Do iTunes Search API ranks track App Store search ranks? | They are different relevance engines. The field-weight ladder in `keyword-list.md` is built on *within-app* comparisons to control for that, and it replicates across 7 locales — but it is inference, not measurement. | B1 shipping is itself the experiment (C2/C3). |
| Play Store keyword performance | Play statistics reports need a GCS bucket URI that is not configured in Play Console, and Play Store Listing Experiments have no public API. Play listings were expanded to 46 locales on 2026-08-10 with no measurement attached. | Configure the GCS export in Play Console. Separate task, not ASO research. |
| Result of PPO experiment `cc64b9d2` | Visible only in the ASC web UI, not via API. It is a **screenshot** test (PPO cannot vary text) running Jun 29 – Sep 27, and at 138 imp/day it is no longer underpowered. | Read it in the ASC UI before 2026-09-27. |

---

**Handoff:** `keyword-list.md` carries copy-paste-ready strings for all 7 locales with
verified character counts and dedup checks — aso-optimizer can apply them directly.
`competitor-gaps.md` carries the positioning claims that survive live data (and the two
markets, Italy and France, where the "nobody here has reviews" argument does not).
