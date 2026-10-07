# Visual QA — R1 Shell + Overview

Written by the lead from the Visual QA agent's messages (the agent could not write files outside screenshots).

## Environment

- Simulator `worktree-fix-ios27-scene-lifecycle`, iPhone18,1, 402×874 pt @3x (not 390×844), iOS 26.3, dark, status bar 9:41.
- Dev client 3.19.1 (1), JS from Metro. Metro warns native Nitro 0.35.10 vs JS 0.37.1.
- Local Supabase stack (`mvscratch`), users `qa-metric@local.test`, `qa-imperial@local.test`.
- Reference renders: headless Chromium 390×844 @2x straight from `redesign/screens/*.dc.html` (fonts loaded, nothing needed fixing despite the missing `support.js`).
- Android: **not run** (no SDK or emulator on this machine).

## Round 1 — started on `a0410043` + uncommitted files, finished on `b67545f3`

Captured on the dirty tree and not re-shot: `service-tab-*`, `costs-tab-*`, `log-option-*`, `notesheet-filled-*`, `odometersheet-38*`, `odometersheet-39407`, `odometersheet-date-picker`, `notes-search-*`, `notes-swipe-*`, `notes-delete-*`, `notes-after-*`, `notesheet-edit`, `overview-after-*`.

### Verdicts

- **OK apart from accepted differences:** Main populated, Overview scrolled, Overview empty, NOT_READY, one-item, all miles states, loading, bike not found, Log sheet and its five options, Note sheet (new, filled, edit, single-bike), Notes (populated, empty, search, swipe, undo), quick-note keyboard, entry and back labels.
- **Not OK:** Odometer sheet, segment tabs, Dynamic Type.

### Must-fix

1. **Odometer sheet chip row misplaced.** Chips at [8,217]–[425,256] overlay the grabber, title [25,239]–[311,268] and Cancel [323,233]–[376,275]; keypad starts at y 447 while the delta line ends at 376 (empty band). Cancel cannot be tapped. Same in miles. `odometersheet-initial`, `odometersheet-39407`, `defect-odometersheet-cancel-does-nothing`.
2. **Hidden segments receive touches.** After visiting Costs, a tap on an empty area of Service opens an expense detail. `passthrough-1/2/3`.
3. **AX5 Dynamic Type breaks header and segment bar.** `main-dynamic-type-ax5*`, `odometersheet-dynamic-type-ax5`.

### Should-fix

4. Log pill covers the last row's chevrons on short content (Ténéré, document-only, one-item).
5. Failed odometer save shows a system "Error" alert plus the inline error (commit of observation not stated; `0b790dde` was meant to remove the alert).
6. Note-save error rendered below the fold with the keyboard open.
7. Costs card eyebrow truncated to "PER MONTH · 20…".
8. Failed refetch over cached data shows no error or Retry.
9. Edit Motorcycle → back asks "Discard changes?" with nothing changed; Metro logs a native-stack `beforeRemove` error (may predate the branch).

### Nits

10. Bike tab: Manage block on a different ground than the legacy section (seam).
11. Legacy Expense detail: light grey page behind dark cards (legacy, out of scope).
12. Lower-reading alert repeats its title in the body.
13. Rides chip adds to the current entry, not the last reading (38,000 + chip = 39,240, not 39,407).
14. Log sheet Expense sub-line lacks the scan clause (accepted).
15. Note sheet "Attach to" lists the current bike second.
16. Notes search placeholder differs from the design.
17. Empty-state sub-line lacks "No open recalls."
18. READY variant: ~24 pt gap between status card and Costs (12 in the design).
19. Odometer notice shortened (accepted).
20. Bike tab legacy labels and plain delete alert (accepted until R5).
21. Service tab shows the segment badge and the legacy "Maintenance 4" badge at once (legacy until R2).

### Measured (pt)

- Match: back button 44×44, odometer chip 36, segment pills 36 high / 6 gap / first at x 16, attention rows 63 high / 8 gaps, block gaps 12, empty photo band 120, note chips 36.
- Differ: Log pill 27 above the floating tab bar (design 16); keypad keys 54 high (design 56).

### Functional checks

Passed: odometer save updates the chip and adds a reading; lower reading asks first; note count updates; "also make it a task"; delete → Undo restores, no Undo → gone and stays gone after relaunch; remembered segment after relaunch; per-segment scroll position; pull-to-refresh; every interim Bike action (remove cancelled at the confirm); no paywall on any logging path; no duplicated formSheet titles; keyboard never covers Save or the quick-note input; fonts; Home and Garage unchanged; back labels from Home hero, Home task card, Profile.

Failed: Odometer Cancel (1), touches reach hidden segments (2), Log pill overlap (4).

**Checked / not checked on the final commit `b67545f3` (agent's own statement):**

- Log sheet: all five options opened their forms on the dirty tree at `a0410043` (before the hand-off rewrites). On `b67545f3` only **Note** was opened (twice); Expense, Task, Past work, Document **not checked**; fast double tap **not checked** on any commit.
- Failed odometer save: system alert + inline error observed on `b67545f3`, i.e. **after** `0b790dde` — the global alert is not suppressed. Failed note save on `b67545f3`: inline only. Failed note delete: not checked.
- Offline cold open: with the API frozen and the app relaunched the status card showed the skeleton, no verdict, no setup list (`main-loading`). With cache and the API stopped it kept the cached status with no error. "Couldn't load the ride status" + Retry never seen. True uncached case not checked.
- "Due now" wording: **not checked**.
- Also not checked: odometer yesterday-with-higher-value, back-dated notice, odometer-0 bike; Notes task link returning to the existing hub; tapping "Make it a task"; Photo chip opening the picker; tasks error on a bike with no documents.
- Batch A (`a0410043` + uncommitted, HEAD not recorded in between) vs batch B (`b67545f3` clean): see the capture list in the agent's message; odometer functional checks, note delete/undo, scroll position and "also make it a task" are batch A.

### Not run / not captured

Android; photo states (seed has no photos); per-block error + Retry (nothing shown over cache; without cache an API-down sign-in lands on the welcome screen); VoiceOver order; one-item variants (1 note, 1 category, no previous-year data, bike without odometer, long nickname).

### Outside the hub (not counted, for the owner)

For the imperial user the Home hero shows "23.7k km" for a 23,716 mi bike, and "READY TO RIDE" while the hub says "Check before riding" (`home-qa-imperial`).

### State left behind

Metro and local API stopped; Supabase stack up; fixture restored by the seed script; `preferences.onboardingCompleted = true` set by hand for both QA users; simulator shut down, still signed in as qa-metric.

## Round 2 — on `a350306a` (app code frozen at `1f980061`), clean tree

### Environment

- Same simulator as round 1 (`worktree-fix-ios27-scene-lifecycle`, 402×874 pt @3x, iOS 26.3, dark, status bar overridden to 9:41). Dev client 3.19.1, JS from Metro (`--dev-client --clear`, local EXPO_PUBLIC_* overrides). Local API via node/ts-node per `local-stack.md`; `packages/types` rebuilt; seed run before and after.
- Driven with the Maestro **CLI** (`maestro test` / `maestro hierarchy`). The Maestro MCP lost its driver connection after the first CLI call, and `axe` fails on this Xcode (`SimulatorKit.framework` missing). Every r2 capture is `xcrun simctl io … screenshot` → `app/r2-*.png`.
- Local DB edits made for coverage (all reverted by the final seed): Ténéré given one document (doc-only variant), then one task (one-item variant), then odometer 0 with its readings deleted (item 18). Bike A's odometer was moved to 46,900 and 42,100 for item 16.
- Android: not run.

### Checklist

| # | Check | Result | Evidence / what was seen |
|---|---|---|---|
| 1 | Odometer chip row placement + Cancel (km, mi) | **PASS** | Chips at y 351–433, between the detail line (ends 332) and the keypad (starts 447). Nothing overlaps the grabber, title or Cancel. Cancel closes the sheet in km and in mi. `r2-odometersheet-initial`, `r2-odometersheet-after-cancel`, `r2-odometersheet-miles`, `r2-odometersheet-miles-after-cancel` |
| 2 | Hidden segments inert | **PASS** | Costs → Service, then taps at (260,193), (200,213) and (300,690) (the Costs "2nd scheduled service" row position): nothing opened. Bike → Overview, then taps at (200,579), (200,650) and (390,600) over the Bike rows' positions: nothing opened. `r2-passthrough-service`, `r2-passthrough-overview` |
| 3 | AX5 Dynamic Type | **FAIL** | Header, segment bar (Bike pill ends at x 403, the bar scrolls), Log pill and keypad keys are capped and legible. **Odometer sheet:** the detail line and footnote are not capped, so Save is pushed off-screen and the sheet does not scroll (Save is not in the hierarchy). At AX3, Save sits at y 834–886 and is half off-screen; at AX1 it is fine. **Log sheet:** it does not scroll, so only Expense and Maintenance task can be reached; Work already done, Note and Document are unreachable, and "Maintena / nce task" breaks mid-word. Known gap "Log pill under the tab bar at the largest size" is **refuted** (pill-gap table below; my first AX5 reading was taken after a live size change with stale layout and is superseded). `r2-ax5-main`, `r2-ax5-odometersheet`, `r2-ax5-odometersheet-scrolled`, `r2-ax3-odometersheet`, `r2-ax1-odometersheet`, `r2-ax5-logsheet`, `r2-ax5-logsheet-scrolled` |
| 4 | Log pill clears the last row on short content | **PASS** | Empty Ténéré, doc-only and one-item variants: the last row ends at 630, the pill is at 707–759, the tab bar top is at 775. Pill bottom to tab bar = **16 pt** (design 16). `r2-overview-empty-tenere-bottom`, `r2-overview-doconly-bottom`, `r2-overview-oneitem-bottom` |
| 5 | No system alert when the API is down | **FAIL** (odometer half PASS) | Odometer, API killed, Save pressed with the sheet open for 7 s and again after more than 15 s: only "Couldn't save the reading. Try again." and no alert (`r2-offline-odometer-save-15s`). Uncached hub with the API down (Ténéré opened by deep link): **three** stacked system "Error / Something went wrong" alerts over the hub's inline "Couldn't load …" blocks (`r2-offline-uncached-deeplink`). Queries in the hub without `meta: { showErrorAlert: false }`: `documents.categories` in `use-overview-data.ts:93`, plus `tasksQuery` / `rides` / `bikes` in `shell/use-bike-hub-data.ts:62-71`. I did not prove which three fired. |
| 6 | Note-save failure above Save with the keyboard open | **PASS** | "Couldn't save the note. Try again." at y 450–467, directly above Save (474–527), keyboard up. `r2-offline-note-save` |
| 7 | Costs eyebrow not truncated | **PASS** | "PER MONTH · / 2026" wraps onto two lines, as in the reference. `r2-overview-scrolled` |
| 8 | "Couldn't refresh · Retry" over cache; Retry works | **PASS** | Pull-to-refresh with the API killed: inline "Couldn't refresh · Retry" under Needs attention, Costs and Notes; cached content and status stay; no alert. With the API back, each Retry clears only its own block (three taps for three blocks). `r2-offline-refresh-cached`, `r2-offline-refresh-retry-recovered`, `r2-offline-refresh-second-block`. Note: with the API **frozen** (SIGSTOP) the refresh spinner runs indefinitely, because there is no GraphQL request timeout. |
| 9 | Log → Expense opens its form | **PASS** | `r2-log-expense` |
| 10 | Log → Maintenance task | **PASS** | "Plan ahead" mode. `r2-log-task` |
| 11 | Log → Work already done | **PASS** | "Log work." with a Date completed record. `r2-log-pastwork` |
| 12 | Log → Note | **PASS** | `r2-log-note` |
| 13 | Log → Document | **PASS** | Legacy Add a document. `r2-log-document` |
| 14 | Fast double tap opens one form | **PASS** | `doubleTapOn` Note → one sheet; after one Cancel the hub shows. Same for Expense with one dismiss. `r2-log-doubletap-note`, `r2-log-doubletap-after-cancel`, `r2-log-doubletap-expense-after` |
| 15 | Offline ride status, cached / uncached / Retry | **PASS** | Cached: the status card stays "Check before riding" with the API down. Uncached (Ténéré by deep link after relaunch; Garage and Home themselves error offline): "Couldn't load the ride status" + Retry, and likewise for tasks, costs and notes. With the API back, Retry → "Ready to ride". `r2-offline-refresh-cached`, `r2-offline-uncached-deeplink`, `r2-offline-retry-recovered`. (The uncached case also raised the alerts in item 5.) |
| 16 | "Due now" wording | **NOT OBSERVED** | Odometer set to 46,900 (Air filter target): the Air filter row folds into "4 more overdue, medium and low …", so its due line never renders anywhere in the hub (Service is legacy). The secondary wording at the exact target **was** seen: odometer 42,100 → "Brake pads inspection · 201 days late · target reached". Observation: a task exactly at its distance target is grouped as *overdue*. `r2-due-now-overview`, `r2-due-now-service`, `r2-due-target-reached` |
| 17 | Back-dating | **PASS** | Oct 1 (yesterday), 39,407 > 38,167: applied (header chip 39,407; row stamped 2026-10-01 23:59:59 local). Sep 27, before the Sep 28 reading: the notice "Dated before your latest reading: it is logged, and the odometer stays at 39,407 km." is shown, and after save the row is logged and the odometer stays. `r2-odometersheet-yesterday-39407`, `r2-odometer-after-yesterday-save`, `r2-odometersheet-backdated-notice` |
| 18 | Odometer-0 bike | **PASS** | Header "Odometer not set, tap to set it"; the sheet shows "0 km · First reading for this bike"; 850 saves, and the header and DB show 850. `r2-header-odometer-not-set`, `r2-odometersheet-zero`, `r2-odometer-zero-saved` |
| 19 | Note task link returns to the existing hub | **PASS** | The link opens the hub on Service; Back goes straight to Garage (no second hub). `r2-notes-task-link`, `r2-notes-task-link-back` |
| 20 | Photo chip opens the picker | **PASS** | Action sheet Take Photo / Choose from Library → permission prompt → system picker. `r2-notesheet-photo-chip`, `r2-notesheet-photo-picker`, `r2-notesheet-photo-picker2` |
| 21 | Make-it-a-task; delete → Undo; delete → gone after relaunch | **PASS** | Low-priority task "R2 QA check fork seals" created (DB). Delete + Undo on "Idea: heated grips" restored it. "R2 …" deleted without Undo: still gone after relaunch (5 notes). `r2-note-saved-task`, `r2-notes-delete-undo`, `r2-notes-after-undo`, `r2-notes-after-relaunch` |
| 22 | Per-segment scroll; remembered segment | **PASS** | Overview and Costs offsets kept across switches; Costs reopened after a relaunch. `r2-relaunch-remembered-segment` |
| 23 | Rides chip = last + rides; confirm body ≠ title | **PASS** | Typed 99 → chip → 39,407. Lower reading: title "Lower than the last reading", body "The last reading was 38,167 km. Save 99 km anyway?". `r2-odometersheet-39407`, `r2-odometersheet-lower-confirm` |
| 24 | Attach to: current bike first and selected; search placeholder | **PASS** | Africa Twin first and selected, Ténéré second. Placeholder "Search part numbers, pressures, shops…" matches the design. `r2-log-note`, `r2-notes` |
| 25 | "No open recalls." only when known; READY gap | **PASS** | Ténéré (NHTSA returns 0, query loaded): "No open recalls. Ride status appears…". Uncached/offline: the card shows the error, not the claim. READY Ténéré: status card bottom 363 → Costs eyebrow 379 = 16 pt (other blocks 19 pt card → eyebrow text); no double gap. `r2-overview-empty-tenere`, `r2-overview-doconly` |
| 26 | Bike tab seam; keypad key height | **PASS** / **FAIL** | Bike tab ground is a uniform #1A1510 from the segment bar to Manage, so the seam is gone. Keypad keys measure **54 pt** (447→501, 8 pt gaps); design 56. Remaining seam elsewhere: Service, Costs and Bike use #1A1510 under the bar while the header and Overview use #141210, giving a hard line at y ≈ 162. `r2-bike-tab`, `r2-odometersheet-initial` |

### Log pill gap at each Dynamic Type size (requested by the lead)

Fresh app launch at each size, Africa Twin Overview at scroll top. Pill bounds come from the hierarchy plus pixels. The tab bar top is read from the bar's edge in the screenshot (±2 pt); the hierarchy gives only the tab items, so the bar's own frame was read from pixels.

| Size | Pill (y, pt) | Tab items (y) | Tab bar top (y) | Pill bottom → bar top | Capture |
|---|---|---|---|---|---|
| Default (Large) | 707–759 | 785–830 | 775 | **16** | `r2-pillgap-default` |
| AX1 | 676–728 | 765–819 | ≈744 | **≈16** | `r2-pillgap-ax1` |
| AX3 | 655–707 | 733–830 | ≈724 | **≈17** | `r2-pillgap-ax3` |
| AX5 | 591–643 | 690–808 | ≈658 | **≈15** | `r2-pillgap-ax5` |

The tab bar grows with Dynamic Type and the pill moves up with it, so the pill never touches the bar on this commit; the review's AX3+ overlap prediction is not borne out. Outside the hub: tab labels wrap mid-word from AX1 ("Discove/r", "Garag/e", "Ho/me").

### Side-by-side (`side-by-side/r2-<Screen>.png`; reference 390×844 left, app 402×874 right)

**Must-fix**
- (AX5, item 3) Odometer sheet Save unreachable at AX3 and above; Log sheet options 3–5 unreachable at AX5. Both sheets need to scroll, or need capped text.
- (item 5) Uncached hub with the API down raises three system alerts.

**Should-fix**
- Notes, swipe left on a row with a task link: the link label ("R2 QA check fork seals") stays in place while the row slides, so it overlaps the revealed Edit/Delete area. `r2-notes-swipe-r2`
- Note sheet with the keyboard open: the keyboard-attached Save bar covers the "Also make it a task" toggle (y 451–479 under a bar starting at about 462). It is fully hidden once the error line appears. `r2-notesheet-filled-task`, `r2-offline-note-save`
- Main: the recall row reads "2 open safety recalls / Free dealer fix · FUEL SYSTEM, GASO…" (raw uppercase NHTSA component, truncated) where the design has "Open safety recall · ECU stall risk / Free dealer fix · 1 other already fixed". `r2-Main`
- No GraphQL request timeout: with a hung API, pull-to-refresh spins indefinitely and no "Couldn't refresh" ever appears.
- Keypad keys 54 pt vs 56.

**Nits**
- Log sheet: the Expense icon is a "$" receipt for a EUR rider (design "€"). The sheet floats inset with side and bottom margins; the design is edge-anchored. Sub-line without the scan clause (accepted).
- Odometer sheet: the chip row wraps (+250 alone on a second row); the design keeps one row by wrapping the rides chip text. The reading numerals are smaller than the design's (about 40 vs 48 pt). The backdrop dims the hub less. Footnote shortened (accepted). For a Sep 27 reading the detail line says "+250 km since Oct 1".
- Overview scrolled: the header collapses to a smaller one-line title with no "2022 · HONDA"; the design keeps the full header.
- Main: the Insurance row uses a document icon (design: shield) and lacks "renew or upload the new policy". The photo band is empty (no seed photo), so not comparable.
- Note sheet: no "Link a job or expense" chip; no "Part numbers… become tappable" hint; the task sub-line doesn't name the task ("Creates 'Check rear sag' · Low…"); the sheet is full height where the design is inset about 64 pt from the top.
- Notes: the floating tab bar stays visible on the pushed Notes screen (none in the design), so the list is clipped above the composer and the tab bar.
- "Couldn't refresh" needs one Retry per block (three taps).
- Work already done opens with the header "Add task". Legacy Add a document: duplicated title, the keyboard covers Save, and it would not save without a file.
- Photo permission prompt says "upload diagnostic images" (app-wide string).
- After switching Dynamic Type back from AX5 to Large live, the hub kept AX5 container heights until remounted.

### Not run / partial

- Item 16 lead "Due now": unreachable with the fixtures (see the table).
- Overview/Notes alert check "after cache cleared" was done on the Ténéré hub by deep link. Garage and Home cannot be passed offline, so the Africa Twin hub could not be reached uncached.
- Android; VoiceOver; photo states (no photo picked/uploaded).

### Outside the hub (for the owner)

- Garage after Back from a hub reached via the Notes task link: the list stayed at the pull-to-refresh offset (header at y 314, spinner) until nudged. `r2-notes-task-link-back`
- Offline: Garage shows "Error / Retry" plus a system alert; Home shows the raw string "fetch failed: UnexpectedException: Could not connect to the server. (at ExpoModulesCore/…)". `r2-offline-cached-relaunch`, `r2-offline-home`
- Imperial user: Garage says "1 BIKE · 23,716 KM" and "Total distance 23,716 km" for a miles bike (the hub correctly says mi).

### State left behind

(Restarted once more for the pill-gap captures; no module-not-found errors from Metro or the API at any point, including after the 17:12 pnpm prune.) Metro and local API stopped; Dynamic Type `large`; status-bar override cleared; seed re-run (bike A 38,167 km, Ténéré 1,240 km, no R2 rows); Supabase `mvscratch` up (7 containers); simulator booted; app terminated, signed in as qa-metric. `docs/.../redesign/PROGRESS.md` shows as modified in git status; this agent did not touch it.

## Round 3 — on `97107802` (app code frozen at `597f1445`), clean app tree

### Environment

- Same simulator (`worktree-fix-ios27-scene-lifecycle`, F48582BA-…, 402×874 pt @3x, iOS 26.3, dark, status bar 9:41). Dev client 3.19.1, JS from Metro (`--dev-client --clear`, local EXPO_PUBLIC_* overrides). Local API via node/ts-node per `local-stack.md`. `packages/types` rebuilt; seed run before and after.
- Driven with the Maestro CLI (`maestro test` with inline flows, `maestro hierarchy`). Captures: `xcrun simctl io … screenshot` → `app/r3-*.png`. Coordinates below are pt from the hierarchy; the tab-bar top (not in the hierarchy) is read from pixel columns at x = 100 and 250 pt.
- Every Dynamic Type measurement is from a fresh launch (`simctl ui content_size`, terminate, relaunch, deep link). Size names: AX1 = `accessibility-medium`, AX3 = `accessibility-extra-large`, AX5 = `accessibility-extra-extra-extra-large`.
- "API down" = the ts-node process killed (port 4000 closed). "Uncached" = the app relaunched online at Home (fresh in-memory cache), API then killed, hub opened by deep link. The persisted cache still holds `motorcycles`, `maintenance-tasks/all-user` and `rides` lists (by design, `query-persist.ts`), same as round 2. A true offline cold launch was also tried: see "Outside the hub".
- Local DB changes during the run (all reverted by the final seed, checked): one note + low task "Check rear sag before the trip"; Africa Twin odometer 38,217 (AX5 save). The back-dated reading was not saved; the Ténéré offline odometer save failed as intended.
- Android: not run.

### Checklist

| # | Check | Result | Evidence / what was seen |
|---|---|---|---|
| A1 | Odometer sheet at default: layout, chips, Cancel | **PASS** | Grabber 211–235, title 238–266, Cancel 231–273; detail line ends 374; chip row 393–433 = rides chip (23–183, label on two lines) + +50 / +100 / +250 on **one row**; keypad starts 447; Save 743–793. Nothing over grabber/title/Cancel (no round-1 lift). Cancel closes the sheet. `r3-odometersheet-default`, `r3-odometersheet-after-cancel` |
| A2 | Odometer sheet at AX3 and AX5, save at AX5 | **PASS** | AX5: title 148–185, reading 229–286, detail line 290–311, chips 330–424 (+250 wraps to a second row, as the commit says), keypad 438–676, footnote 689–729, **Save 743–793 fully visible** without scrolling; text visibly capped. Saved +50 at AX5 → header and DB 38,217. AX3: Save 743–793 visible, nothing clipped. `r3-ax5-odometersheet`, `r3-ax5-odometersheet-38217`, `r3-ax5-odometer-saved`, `r3-ax3-odometersheet` |
| A3 | Log sheet at AX5: five options, no mid-word breaks, open Document | **PASS** | All five rows fit without scrolling (Expense 292–367 … Document 696–793); sub-lines wrap at word boundaries ("due by date or / distance"), no "Maintena/nce". Document → legacy "Add a document" opens. `r3-ax5-logsheet`, `r3-ax5-log-document` |
| A4 | Log sheet at default; € icon for EUR | **PASS** | Receipt icon with "€". Layout as round 2 (floating inset sheet, accepted). `r3-logsheet-default` |
| B5 | Uncached Ténéré hub, API down → zero alerts; inline errors + Retry; Retry recovers | **PASS** | Inline "Couldn't load the ride status / tasks / costs / notes" each with Retry; **0 system alerts** at 4 s and 16 s (retries finished; round 2 had three). API back: Retry recovers each block (ride status, then costs, then notes). `r3-offline-uncached-deeplink-4s`, `r3-offline-uncached-deeplink`, `r3-offline-retry-1`, `r3-offline-retry-recovered` |
| B6 | Same, remembered segment = Bike | **PASS** | Hub opened on Bike: "Couldn't load documents" + Retry (219–263), **0 alerts** at 16 s and 31 s. API back: Retry → "No documents yet". `r3-offline-uncached-bike-segment`, `r3-offline-bike-segment-retry-recovered` |
| B7 | Same, remembered segment = Costs | **PASS** | Legacy expenses section: "Failed to load expense data" + Retry (not "No expenses yet"); **0 alerts** at 30 s. API back: Retry → "No expenses yet" (correct for the Ténéré). `r3-offline-uncached-costs-segment`, `r3-offline-costs-retry-recovered` |
| B8 | Odometer save with API down | **PASS** | Ténéré, +50, Save: "Couldn't save the reading. Try again." at 714–729 above Save; no alert after 18 s. `r3-offline-odometer-save` |
| C9 | Pill gap above the tab bar (fresh launches) | **PASS** | See the table below: 16 / 16 / ≈17 / 16 pt. |
| C10 | "Couldn't refresh · Retry" over cached data | **PASS** | Pull-to-refresh with the API down: the line appears under Needs attention (441–459), Costs (319–337 scrolled) and Notes (572–590); cached content and the "Check before riding" status stay; no alert. With the API back each labelled Retry ("Retry needs attention / costs / notes") clears only its own block. At default size the line fits on one row, so wrapping was not observed. `r3-offline-refresh-cached`, `r3-offline-refresh-cached-scrolled`, `r3-offline-refresh-retry-recovered` |
| C11 | Recall row reads naturally; insurance row shield + copy | **PASS** (with nit) | Recall sub-line "Free dealer fix · Fuel injection syste…" — sentence case, no raw uppercase; it still ellipsizes at the row width (the live NHTSA component is long). Insurance row: shield icon, sub-line "In 12 days · Mapfre · renew or upload the…" visually truncated; the a11y label carries the full "renew or upload the new policy". No DB edit was needed (seeded insurance expires in 12 days). `r3-main-populated` |
| C12 | Note sheet, keyboard open: toggle above Save, also with error; sub-line names the task | **PASS** (with nit) | Keyboard up: toggle row 393–445, Save 475–527; sub-line "Creates "Check rear sag before the trip" · Low · no due date, with this note attached". API down + Save with keyboard up: the error line (450–467) sits above Save; the toggle title and switch (405–433) stay visible, the second line of the sub-line is cut by the error bar until the content is scrolled — a swipe brings the whole row clear (261–312). `r3-notesheet-keyboard`, `r3-notesheet-keyboard-error`, `r3-notesheet-keyboard-error-scrolled` |
| C13 | Back-dated reading wording | **PASS** | Date Sep 27 (before the Sep 28 reading), +250: detail line "Dated before your latest reading: it is logged, and the odometer stays at 38,167 km." — no "+N km since …". `r3-odometersheet-backdated` |
| C14 | Untracked sub-line on the Ténéré | **PASS** | One sentence pair: "No open recalls. Ride status appears once a task or a document exists." (350–384). `r3-overview-empty-tenere` |
| D | Main populated | **PASS** | `r3-main-populated` |
| D | Overview scrolled | **PASS** | Costs card, notes, header collapsed (accepted). `r3-overview-scrolled` |
| D | Overview empty (Ténéré) | **PASS** | `r3-overview-empty-tenere` |
| D | Notes list + swipe + undo | **PASS** | Swipe reveals Edit/Delete; the task-link label now slides with the row (round-2 should-fix gone). Delete → "Note deleted · Undo" → Undo restores (5 → 4 → 5 notes). `r3-notes`, `r3-notes-swipe`, `r3-notes-delete-snackbar`, `r3-notes-after-undo` |
| D | Note save + "also make it a task" | **PASS** | After the API came back, Save created the note and a low-priority task "Check rear sag before the trip" (DB). `r3-note-saved-task` |
| D | Segment switching keeps scroll | **PASS** | Overview (NOTES at 642) and Costs (Scan a receipt at 37) offsets kept across switches. `r3-segment-costs-scrolled`, `r3-segment-back-overview-kept` |
| D | Hidden segments inert | **PASS** | Costs (scrolled) → Service; taps at (300,193), (200,214), (30,780): nothing opened, still on Active (6). `r3-passthrough-service`, `r3-passthrough-service-after-taps` |
| D | Miles user Overview + Odometer sheet | **PASS** | qa-imperial: header 23,716 mi, "2,444 mi to target", "in 5,426 mi"; sheet in mi, rides chip +1,240 (API converts metres to miles; checked in `odometer.service`). `r3-miles-overview`, `r3-miles-odometersheet` |

### Log pill gap (fresh launch per size, Africa Twin Overview at top)

| Size | Pill (y) | Tab bar top (pixels) | Gap | Capture |
|---|---|---|---|---|
| Default | 707–759 | 775.0 | **16** | `r3-pillgap-default` (= `r3-main-populated`) |
| AX1 | 676–728 | 744.3 | **16** | `r3-pillgap-ax1` |
| AX3 | 655–707 | 723.7 | **≈17** | `r3-pillgap-ax3` |
| AX5 | 591–643 | 659.0 | **16** | `r3-pillgap-ax5` |

### Side-by-side (`side-by-side/r3-<Screen>.png`; reference left, app right, same height)

**Must-fix**: none.

**Should-fix**
- Main, Needs attention: the recall and insurance sub-lines are one line with an ellipsis ("Fuel injection syste…", "renew or upload the…"); the design wraps them to two lines, so the insurance row's new call to action is cut on screen (only VoiceOver gets the whole sentence). The recall row's a11y label also drops the component ("2 open safety recalls. Free dealer fix").

**Nits**
- Note sheet, API down with the keyboard up: the error line covers the second line of the task sub-line until the rider scrolls (toggle itself stays visible). `r3-notesheet-keyboard-error`
- Odometer sheet: reading numerals smaller than the design (about 40 vs 48 pt), as in round 2. At AX3+ the +250 chip wraps to a second row (expected per the commit).
- Log sheet: still floats inset with side/bottom margins (design edge-anchored); Expense glyph is a € receipt where the design has a bare "€".
- Overview empty: matches the reference closely; only the floating tab bar overlaps the Costs card (tab bar out of scope).
- After recovering an uncached Ténéré hub with Retry, the status card no longer says "No open recalls." (recalls are not re-fetched by the ride-status Retry). Correct by the "only when known" rule, but the claim does not come back until remount.
- The Costs Retry on the uncached Ténéré hub sat at 717–761, under the Log pill (707–759); a tap at its centre opened the Log sheet. Reachable after a small scroll.
- Already-accepted differences not re-raised: header collapse, no Link-a-job chip / part-number hint, tab bar on Notes, smaller iOS 26 sheet, legacy screens, no request timeout, Android.

### Not run / partial

- C10 wrapping at a large text size: not exercised (the line fits at default; the AX runs were spent on the sheets and the pill).
- B5 "cold" in the strict sense: a true offline cold launch did not reach the hub (see below), so B5–B7 were run with the app relaunched online and the API then killed; the hub's own queries were uncached each time.
- Android; VoiceOver; photo states.

### Outside the hub (for the owner)

- True offline cold launch (app terminated, API down, `motovault://bike/<id>`): the first time the dev client landed on Home (not the hub) with the raw "fetch failed: UnexpectedException…" string plus a system "Error / Something went wrong" alert. The second time (same steps) it landed on the **signed-out welcome screen** ("Your rides. Your bike. Your journey."), which stayed after 25 s; relaunching with the API up showed the user still signed in. `r3-offline-relaunch-signed-out`. Worth a look: an API outage at launch shows a signed-in rider the onboarding screen.
- Notes list: the task and expense links on note rows ("2nd scheduled service", "Linked expense") open the Service segment / legacy expense detail; the snackbar's Undo disappears after a few seconds, after which a tap at its spot lands on the row underneath. Both expected, noted because they caught me out.

### State left behind

Metro and the local API stopped; Dynamic Type `large`; status-bar override cleared; seed re-run (bike A 38,167 km, Ténéré 1,240 km, no "Check rear sag" note or task); Supabase `mvscratch` up (7 containers); simulator booted; app terminated, signed in as qa-metric (remembered segment Overview on both bikes).

## Final targeted check — on `cc217f23`, clean app tree

### Environment

Same as round 3: simulator `worktree-fix-ios27-scene-lifecycle` (F48582BA-…, 402×874 pt @3x, iOS 26.3, dark, status bar 9:41), dev client 3.19.1, JS from Metro (`--dev-client --clear`, local EXPO_PUBLIC_* overrides), local API via node/ts-node per `local-stack.md`, `packages/types` rebuilt, seed run before and after. Driven with the Maestro CLI (`--device F48582BA…`, a second sim is booted); captures `xcrun simctl io … screenshot` → `app/final-*.png`; coordinates in pt from `maestro hierarchy`, tab-bar top from pixel columns. "API down" / "uncached" mean the same as in round 3. Dynamic Type changed only with a terminate + relaunch. Android: not run.

### Checklist

| # | Check | Result | Evidence / what was seen |
|---|---|---|---|
| 1 | Main: recall + insurance sub-lines wrap to two lines; one-line rows unchanged | **PASS** (with nit) | Insurance row 599–678 (79 pt): "In 12 days · Mapfre · renew or upload the / new policy", full text on screen. Recall row 441–520 (79 pt): two lines, "Free dealer fix · Fuel injection system · / Motorcycle handlebar switch pod le…" — it wraps as required but the live NHTSA text (two components) is still longer than two lines, so the second line ellipsizes; the a11y label now carries both components. One-line rows unchanged: Brake pads 528–591 and "3 more overdue" 686–749 (63 pt each), about 62 pt in `r3-main-populated` by pixels. Side-by-side `side-by-side/final-Main.png`: wrapping now matches the reference's two-line insurance row. `final-main-populated` |
| 2 | Home cold start, API down: Home's error card, zero system alerts within 20 s | **FAIL** | Attempt 1 landed on Home: at 10 s only Home's inline card ("Error / fetch failed: UnexpectedException: Could not connect to the server. (at ExpoModulesCore/Promise.swift:56)" + Retry, still the raw string); by 15 s a **system alert "Error / Something went wrong. Please try again." + OK** (alert 41,365–361,537; OK 57,473–345,521) sits over it, still up at 20 s and 25 s. One alert only: after OK, Home's card remains and no second alert appeared. Source is the global `QueryCache.onError` (`apps/mobile/src/lib/query-client.ts:237`): some uncached query on the Home cold-start path has no alert opt-out (or one of its observers lacks it). Which query was not identified (Sentry capture goes to the dummy DSN). Attempts 2 and 3 (same steps) landed on the **signed-out welcome screen** ("Your rides. Your bike. Your journey." 28,478–374,649) as in round 3; relaunching with the API up showed the user still signed in. `final-home-coldstart-apidown-{5,10,15,20,25}s`, `final-home-coldstart-apidown-after-ok`, `final-home-coldstart-apidown-welcome`, `final-home-coldstart-apidown-try3-{10,20}s` |
| 3 | Hub uncached, API down (relaunch online at Home, kill API, deep link Ténéré) | **PASS** | Inline "Couldn't load the ride status / tasks / costs / notes", each with a warm Retry (324,316 · 331,407 · 316,496 · 318,587); **0 alerts** at 5 s and 20 s. `final-offline-uncached-tenere-5s`, `final-offline-uncached-tenere-20s` |
| 4 | "Couldn't refresh · Retry" over cached data, default and AX3 | **PASS** | Default: one row, "Couldn't refresh · Retry" (441–459) under Needs attention, separator present because it does not wrap; no alert; API back → Retry clears it. AX3 (fresh launch online, then API killed, pull-to-refresh): "Couldn't refresh" (248–295) and "Retry" on its own row (296–343), **no dangling " · "** visible (the text node still contains the separator; it is not drawn); no alert; API back → Retry clears it. `final-refresh-cached-default`, `final-refresh-retry-recovered-default`, `final-ax3-refresh-cached`, `final-ax3-refresh-retry-recovered` |
| 5 | Bike segment Documents online; error state; Costs legacy error | **PASS** | Online (Africa Twin, Bike): grouped list Inspection / Insurance / Manual / Registration, Details, Manage — pixel-identical to `r2-bike-tab` below y = 160. Ténéré, remembered segment Bike, relaunched online at Home, API killed, deep link: "Couldn't load documents" + warm Retry (327,219–380,263), 0 alerts at 20 s; API back → "No documents yet". Costs: "Failed to load expense data" now a left-aligned row with a **warm** Retry (327,305–380,349; was a centred blue Retry in `r3-offline-uncached-costs-segment`), 0 alerts; API back → "No expenses yet". The legacy header's "+" and chart buttons are still blue (pre-existing, not part of this change). `final-bike-documents-online`, `final-offline-uncached-bike-segment`, `final-offline-bike-segment-retry-recovered`, `final-offline-uncached-costs-segment`, `final-offline-costs-retry-recovered` |
| 6 | Note sheet, keyboard open; API down error line | **PASS** (round-3 nit persists) | Keyboard up, toggle on: toggle row 393–445, Save 475–527 — same as round 3; sub-line "Creates "Check rear sag before the trip" · Low · no due date, with this note attached". API down + Save: error line 450–467, Save 474–527 (round 3: 450–467 / 475–527) — no extra overlap. The toggle title and switch stay visible; the error bar still covers the sub-line's second line (413–445) until a swipe, which brings the row to 280–332, fully clear. Not saved (discarded). `final-notesheet-keyboard`, `final-notesheet-keyboard-error`, `final-notesheet-keyboard-error-scrolled` |
| 7 | Odometer sheet + Log sheet at default (regression) | **PASS** | Odometer: every coordinate equals round 3 A1 (grabber 211–235, title 238–266, Cancel 231–273, chips 393–433 on one row, keypad 447, Save 743–793); pixel-identical to `r3-odometersheet-default` from y = 200 to 834. Log sheet: five rows 397–793, pixel-identical to `r3-logsheet-default` from y = 300 to 834. The only differing band in both is 834–874 (the tab-bar strip at the very bottom, not sheet content). `final-odometersheet-default`, `final-logsheet-default` |
| 8 | Pill gap at default | **PASS** | Pill 707–759, tab-bar top 775.0 at x = 100 and 250 → **16 pt**. `final-main-populated` |

### Nits

- Recall row: two lines now, but the live NHTSA string still ellipsizes on line 2 ("…switch pod le…"). Accepted by the two-line cap; full text is in the a11y label.
- Note sheet, API down with keyboard up: unchanged from round 3 — the error line hides the second line of the task sub-line until the rider scrolls.
- Home's inline error card still shows the raw "fetch failed: UnexpectedException…" string (outside the hub, same as round 3).

### Not run

Android; VoiceOver; the "categories-only failure renders ungrouped docs" path in legacy Documents (not reachable by killing the whole API).

### State left behind

Metro and the local API stopped; Dynamic Type `large`; status-bar override cleared; seed re-run (bike A 38,167 km, no "rear sag" note — checked in the DB); remembered segment Overview on both bikes; Supabase `mvscratch` up (7 containers); simulator booted; app terminated, signed in as qa-metric. No app code touched, no commits.
