# Featuring nomination — draft for your review

**Status:** DRAFT. Nothing has been created in App Store Connect. Approve or edit the
description below and I will run the `asc nominations create` command at the end.

**Why now:** `asc nominations list` returns **0** in every state — DRAFT, SUBMITTED,
ARCHIVED. The editorial channel has never been used once. Apple wants roughly three
weeks' lead and likes a release in flight; 3.19.1 is in review, and 3.20.0 is the next
vehicle.

---

## Form values

| Field | Value | Why |
|---|---|---|
| `--type` | `APP_ENHANCEMENTS` | CarPlay and receipt scanning are additions to a shipping app, not a launch. `APP_LAUNCH` would be false. |
| `--name` | `CarPlay Driving Task for motorcycle riders` | Internal label. Leads with the fact that is hardest to ignore. |
| `--device-families` | `IPHONE` | CarPlay is driven by the iPhone. No iPad/Watch/Vision surface exists. |
| `--publish-start-date` | `2026-09-16T08:00:00Z` | ~3 weeks out, comfortably past 3.19.1's review and release. |
| `--submitted` | `false` first | Create as a draft, read it back, then submit. |
| `--locales` | `en-US` | The nomination itself. The app ships 7 localized listings. |

---

## Description — the actual pitch

> MotoVault is a motorcycle ownership app: expenses, service history, rides and trip
> planning for one bike or a garage of them.
>
> The reason we are writing is CarPlay. Apple granted us the Driving Task entitlement
> (Case-ID 20710293), and we have used it for something a rider genuinely cannot do with
> a phone in a pocket or clamped to a bar.
>
> On the head unit, MotoVault shows a live ride panel — speed, distance, moving time and
> climb — in four rows sized to be read at a glance, not studied. It starts, pauses and
> ends the ride from the dash. It auto-pauses when the bike stops. Before the first GPS
> lock it shows dashes rather than a confident 0.0, because a wrong number is worse than
> no number. Ending a ride asks for confirmation with "Keep Riding" as the first option,
> since the one thing a rider should never do is hunt for a button.
>
> The row we are proudest of is the fourth. It carries whatever the rider most needs to
> know about the bike they are on, in priority order: an open safety recall first, then
> overdue service, then anything due soon. A rider can set off on a Sunday morning and
> learn from their dashboard that their machine has an unresolved factory recall. We have
> not seen another app put that on a head unit.
>
> Also new: receipt scanning. Point the camera at a fuel, parts or workshop receipt and
> MotoVault reads the amount, the date and the work done, then fills the expense form in.
> Riders track costs when it takes one photo and stop when it takes typing.
>
> MotoVault is built by one developer who rides. Every feature is there because keeping a
> bike properly is mostly record-keeping, and record-keeping is exactly what a phone
> should do for you.

**1,670 characters / 304 words / 6 paragraphs.**

Every factual claim above was checked against the code rather than written from memory:

| Claim | Verified against |
|---|---|
| Entitlement granted, Case-ID 20710293 | `app.config.ts:285` — `com.apple.developer.carplay-driving-task: true` with the case ID in the comment |
| Panel rows: speed, distance, moving time, climb | Row labels `Speed`, `Distance`, `Moving`, `Climb` in `carplay-templates.ts` |
| Four rows | `buildPanelItems` test: *"leads live rows with speed + distance (≤4 rows)"* |
| Start / pause / end from the dash | Labels `Start Ride`, `Pause`, `Resume`, `Stop`, `End Ride` |
| Auto-pauses when stopped | `deriveState` test: *"is autoPaused when stopped (auto) or manually paused"* |
| Dashes, not `0.0`, before GPS lock | `deriveSnapshot` test: *"shows dashes (never 0.0) before first GPS lock"* |
| "Keep Riding" is the first option | `buildPanelItems` test: *"Keep Riding leads, then End Ride"* |
| Recall → overdue → due soon | `pickHeadsUp` test: *"recall wins over overdue and due-soon (first rung)"* |
| Receipt scan reads amount, date, work done | 3.19.1 App Store "What's New", already published copy |

---

## Notes for the reviewer (internal, `--notes`)

> CarPlay Driving Task entitlement granted by Apple, Case-ID 20710293. Implemented with
> a custom template layer over @iternio/react-native-auto-play; Android Auto is
> deliberately not shipped, so this is an iOS-only capability. The recall/service
> priority logic is in apps/mobile/src/features/carplay/carplay-templates.ts
> (`pickHeadsUp`) and is unit-tested.

---

## Deliberate omissions

- **No rarity claim about the entitlement.** The runbook suggested saying few third-party
  apps hold it. Apple knows exactly how many it has granted; asserting a number we cannot
  verify to the people who own the data is a bad trade. The fact is stated plainly and
  left to speak.
- **No pricing or free-tier detail.** Not what editorial is choosing on, and store copy is
  the place where those claims have to be exact.
- **No AI-diagnostics mention.** Deliberately out of scope for positioning, and PostHog
  puts it last among validated uses.
- **No screenshot/asset references.** `--supplemental-materials-uris` is left empty
  because no CarPlay capture exists yet. Worth adding before submission if you can get a
  head-unit photo or simulator capture — editorial responds to seeing the surface.

## Command to create it, once the copy is approved

```bash
asc nominations create \
  --app 6760291360 \
  --type APP_ENHANCEMENTS \
  --name "CarPlay Driving Task for motorcycle riders" \
  --device-families IPHONE \
  --locales en-US \
  --publish-start-date "2026-09-16T08:00:00Z" \
  --submitted=false \
  --description "$(cat <<'DESC'
<approved description text>
DESC
)"
```

Then read it back with `asc nominations list --status DRAFT` and submit with
`asc nominations update --id <ID> --submitted=true` once you are happy.
