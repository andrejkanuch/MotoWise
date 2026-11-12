# R4 deep dive: the first ride attempt (PO4, PO5, PO8) and Experiment 1

2026-11-12. Research only: no app code, flag, PostHog, RevenueCat, GitHub or Supabase change was made.
Code is cited from the clean checkout of `origin/main` at `52d281e9` (`/Users/andrejmacm5/personal/MotoWise-research`),
paths relative to `apps/mobile/src/` unless they start with `apps/`. PostHog = project 155556 (EU), read-only `execute-sql`.
Every PostHog query below excludes the 12 q00 test persons (`queries/q00-excluded-persons.md`); in the SQL they are written
as `<q00>` to keep this file readable. Supabase = production, read-only SELECT through the Management API, aggregates only.

---

## 1. Question

1. **PO5:** In some recordings the Ride HUD seems to open right after onboarding without the rider starting a ride
   (sessions `01a18bae-6ba1-7283-9e7f-04260fc09890`, `01a1815d-5a25-793e-892e-12bc1001c2bf`, scanner
   `01a1cfa6-4f63-7b8b-bd0c-9dbd6bace7a1`). Is this a real bug (resume of a stale active ride, a start-ride deep link, the
   checklist, the `garage_first` paywall dismissal path)?
2. **PO4:** "47 of 73 riders who tried a ride saw 'ride too short'". What happens in code and data on that first attempt,
   and what does it cost?
3. **PO8:** A "Download maps" modal when starting a route (1 recording, `01a19f85`). Real?
4. Does the board's Experiment 1 spec (plan card, standstill teaching sheet, day-1 local message, flag
   `activation_365_first_session` assigned at `onboarding_completed`) match current code? Which exact tasks build it, in order?
5. For every friction: a spec an agent can later use to prove it is gone (repro, expected, automated check, production metric
   by app version).

## 2. Evidence

### 2.1 PostHog queries (all run 2026-11-12)

**Q-R4-01: full event sequence of the two PO5 sessions.**
```sql
SELECT $session_id, timestamp, event, properties.$screen_name, properties.$app_version, properties.source,
       properties.onboarding_variant, properties.distance_m, properties.elapsed_s, properties.action
FROM events
WHERE timestamp >= '2026-10-10' AND timestamp < '2026-11-13'
  AND $session_id IN ('01a18bae-6ba1-7283-9e7f-04260fc09890','01a1815d-5a25-793e-892e-12bc1001c2bf')
  AND event NOT IN ('$snapshot','$exception')
ORDER BY $session_id, timestamp
```
Result (abridged to the relevant rows, UTC):

| Session | Time | Event | Screen |
|---|---|---|---|
| `01a1815d` (3.26.0, `garage_first`) | 07:18:07.859 | `onboarding_completed` | personalizing |
| | 07:18:20 → 07:18:24 | `paywall_viewed` → `paywall_dismissed` (garage_first paywall comes **after** `onboarding_completed`) | personalizing |
| | 07:18:25 | `$screen` | `/(tabs)/(home)` |
| | 07:18:27 | `checklist_item_completed` → `rides_history_viewed` | → `/(tabs)/(profile)/rides` |
| | 07:18:30 → 07:19:23 | home, discover, garage, bike, home, rides | … |
| | 07:19:25 | `$screen` | **`/(modals)/start-ride`** |
| | 07:19:33 → 07:19:37 | `Application Backgrounded` → `Became Active` (OS location dialog) | start-ride |
| | 07:19:37.745 | `ride_location_permission_result` | start-ride |
| | 07:19:37.889 | **`ride_started {source: phone}`** | start-ride |
| | 07:19:38.172 | `$screen` | **`/(modals)/ride-hud`** |
| | 07:19:49 / :51 | `ride_too_short_shown` `shown` / `end`, `distance_m 0`, `elapsed_s 6` | ride-hud |
| | 07:20:00 | `ride_completed` (rider saved the 0 m ride) | ride-summary |
| `01a18bae` (3.26.0, `commit_first`) | 07:22:58.394 | `onboarding_completed` | personalizing |
| | 07:22:58 → 07:24:11 | home, discover, **trip-detail** (`trip_viewed`), discover | … |
| | 07:24:54 | `$screen` | **`/(modals)/start-ride`** |
| | 07:25:04.776 / .809 | `ride_location_permission_result` → **`ride_started {source: phone}`** | start-ride |
| | 07:25:04.852 | `$screen` | **`/(modals)/ride-hud`** |
| | 07:25:31 / :34 | `ride_too_short_shown` `shown` / `end`, `distance_m 0`, `elapsed_s 26` | ride-hud |
| | 07:25:47 | `ride_discarded` | ride-summary |

Both HUDs opened 0.04–0.3 s after a `ride_started` that came from the Start Ride screen, 71 s and 126 s after onboarding.

**Q-R4-02: the Replay Vision observations for the three sessions** (`vision-scanners-observations-list`, scanner
`01a1cfa6-…`, read only). 01a18bae: "After the 'Setting up your ride' screen, the app immediately enters the Ride HUD".
01a1815d: "After onboarding, the first screen shown is a ride tracking interface following a short loading state. Analytics
confirm a ride was started". 01a19f85: "attempting to start a ride by tapping the 'Ruta' (Route) icon. This action triggers a
'Descargar mapas' (Download maps) modal". The summaries skip 1–2 minutes of navigation that the events show.

**Q-R4-03: time from `onboarding_completed` to the first `ride_started`, all completers, 60 days.**
```sql
WITH comp AS (SELECT person_id AS pid, min(timestamp) AS t_oc FROM events
              WHERE timestamp >= now() - INTERVAL 60 DAY AND event = 'onboarding_completed'
                AND person_id NOT IN (<q00>) GROUP BY pid),
     rs AS (SELECT person_id AS pid, min(timestamp) AS t_rs FROM events
            WHERE timestamp >= now() - INTERVAL 60 DAY AND event = 'ride_started' GROUP BY pid)
SELECT multiIf(t_rs IS NULL OR t_rs < t_oc - INTERVAL 1 MINUTE, 'no ride_started after oc',
               dateDiff('second', t_oc, t_rs) < 30, 'a <30s', dateDiff('second', t_oc, t_rs) < 120, 'b 30-120s',
               dateDiff('second', t_oc, t_rs) < 600, 'c 2-10min', dateDiff('second', t_oc, t_rs) < 3600, 'd 10-60min',
               dateDiff('second', t_oc, t_rs) < 86400, 'e 1-24h', 'f >24h') AS bucket, count() AS riders
FROM comp LEFT JOIN rs ON comp.pid = rs.pid GROUP BY bucket ORDER BY bucket
```
| < 30 s | 30–120 s | 2–10 min | 10–60 min | 1–24 h | > 24 h | none after completion | total |
|---|---|---|---|---|---|---|---|
| 12 | 25 | 15 | 3 | 11 | 5 | 220 | 291 |

52 of 71 riders who ever start a ride do it within 10 minutes of finishing onboarding.

**Q-R4-04: screen sequence around `onboarding_completed` for every rider who started a ride within 40 s** (event/screen arrays
per person, `onboarding_completed − 5 s … + 40 s`). 18 riders, builds 3.19.0 → 3.26.0. **In all 18, `/(modals)/start-ride`
precedes `/(modals)/ride-hud`, and `ride_started {source: phone}` has the same second offset as the HUD screen.** No rider
reached the HUD without the Start Ride screen first.

**Q-R4-05: what precedes each `ride-hud` screen view (60 days, all persons minus q00).**
```sql
SELECT cls, count() AS hud_views, uniq(pid) AS riders FROM (
  SELECT person_id AS pid, timestamp, event, toString(properties.$screen_name) AS sn,
         max(if(event = 'ride_started', timestamp, toDateTime('1970-01-01 00:00:00')))
           OVER (PARTITION BY person_id ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS last_rs,
         multiIf(last_rs < toDateTime('2000-01-01 00:00:00'), 'never started a ride before',
                 dateDiff('second', last_rs, timestamp) <= 120, 'ride_started <=120s before',
                 dateDiff('second', last_rs, timestamp) <= 3*3600, 'ride_started 2min-3h before (return to live ride)',
                 'ride_started >3h before (stale ride)') AS cls
  FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND event IN ('ride_started','$screen')
    AND person_id NOT IN (<q00>))
WHERE event = '$screen' AND sn IN ('/(modals)/ride-hud','/ride-hud') GROUP BY cls
```
| Class | HUD views | Riders |
|---|---|---|
| `ride_started` ≤ 120 s before | 764 | 85 |
| `ride_started` 2 min – 3 h before (rider returns to a live ride via the FAB/Home) | 48 | 22 |
| `ride_started` > 3 h before (long or forgotten ride) | 19 | 6 |
| **never started a ride before** | **0** | **0** |

A companion cut by previous screen (same window) showed the ≤ 120 s views come from `start-ride` (752 of 764); the others come
from `/`, Home, Profile or bike screens, i.e. the FAB/Home "ride" entry while a ride is live (`features/ride/ride-route.ts:23-26`).

**Q-R4-06: first-ride funnel among completers by onboarding build (60 days).** Completers; `ride_started`, first
`ride_too_short_shown {action:'shown'}` (any distance and `distance_m < 10`), first real save (`ride_completed` with
`below_min_ride != true`), all within 7 days of `onboarding_completed`; plus guard actions.

| Build at onboarding | Completers | Tried a ride ≤ 7 d | Too-short sheet ≤ 7 d | … at < 10 m | Saved a real ride ≤ 7 d | Standstill sheet → real ride ≤ 7 d | Sheets / Keep / End (rows) |
|---|---|---|---|---|---|---|---|
| < 3.21 | 122 | 33 | 2* | 2* | 11 | 0* | 18 / 45 / 45 |
| **≥ 3.21** | **169** | **36** | **21** | **20** | **11** | **3** | 29 / 1 / 24 |

\* Builds before 3.21.0 wrote mostly decision rows, not `shown` rows [SOURCE: board/02-onboarding-ux.md:10], so their sheet
counts are not comparable. Use the ≥ 3.21 row.

**Q-R4-07: first ride attempt outcome by the app version of that first `ride_started` (completers, 60 days).**
```sql
WITH comp AS (<as Q-R4-03>),
a AS (SELECT person_id AS pid,
        minIf(timestamp, event='ride_started') AS t_rs,
        argMinIf(toString(properties.$app_version), timestamp, event='ride_started') AS ver,
        minIf(timestamp, event='ride_too_short_shown' AND toString(properties.action)='shown'
                         AND toFloat(properties.distance_m) < 10) AS t_ss,
        minIf(timestamp, event='ride_completed' AND toString(properties.below_min_ride)='true') AS t_junk,
        minIf(timestamp, event='ride_completed' AND coalesce(toString(properties.below_min_ride),'false')!='true') AS t_real
      FROM events WHERE timestamp >= now() - INTERVAL 60 DAY
        AND event IN ('ride_started','ride_too_short_shown','ride_completed') GROUP BY pid)
SELECT a.ver, count() AS riders_first_start,
       countIf(a.t_ss >= a.t_rs AND a.t_ss < a.t_rs + INTERVAL 30 MINUTE) AS first_attempt_standstill,
       countIf(a.t_junk >= a.t_rs AND a.t_junk < a.t_rs + INTERVAL 30 MINUTE) AS first_attempt_saved_junk,
       countIf(a.t_real > a.t_rs AND a.t_real < a.t_rs + INTERVAL 7 DAY) AS real_ride_7d
FROM comp JOIN a ON comp.pid = a.pid
WHERE a.t_rs > comp.t_oc - INTERVAL 1 MINUTE AND a.t_rs < comp.t_oc + INTERVAL 7 DAY
GROUP BY a.ver ORDER BY a.ver
```
| First-ride version | Riders | First attempt at standstill (< 10 m) | First attempt saved as a junk ride | Real ride ≤ 7 d |
|---|---|---|---|---|
| 3.19.0 / 3.19.1 / 3.20.0 | 17 / 15 / 1 | 0* / 0* / 0* | 0 / 0 / 0 | 5 / 5 / 1 |
| 3.21.0 | 11 | 5 | 2 | 3 |
| 3.26.0 | 22 | 10 | 3 | 7 |
| 3.27.0 | 3 | 3 | 0 | 1 |
| **≥ 3.21 total** | **36** | **18 (50%)** | **5** | **11 (31%)** |

**Q-R4-08: `ride_completed` on builds ≥ 3.21 by `below_min_ride` (60 days, all persons).** `below_min_ride=true`: 13 rows / 11
riders via `save_trigger='summary'` (rider pressed Save on a standstill ride) + 2 / 2 via `auto_end`; `false`: 207 / 22 + 8 / 4.
So standstill rides are saved as rides, and `below_min_ride` tags them correctly (`lib/ride-analytics.ts:62`).

**Q-R4-09: Start Ride opened vs started on day 0 (completers whose onboarding ran on ≥ 3.21).** 169 completers;
72 opened `/(modals)/start-ride` within a day of completion; 33 started a ride; 34 have a `ride_location_permission_result`.
Entry screens into Start Ride for completers on ≥ 3.21 (previous `$screen`, 60 days): Home 221 views / 60 riders,
Profile 51 / 18, Discover 21 / 15, Garage 15 / 10, Profile › Rides 14 / 11, bike screen 13 / 9.

**Q-R4-10: `checklist_item_completed {item:'first_ride'}` by trigger (60 days).**

| Trigger | Completions | Riders | … of whom ever saved a real ride (60 d) |
|---|---|---|---|
| `tap` | 17 | 17 | **3** |
| `data` | 20 | 20 | 12 |
| (null, older builds) | 10 | 10 | 3 |

17 riders had "See your first ride stats" ticked by tapping it; 14 of them never saved a real ride. Of the 20 data-ticked,
8 have no real ride (a junk ride ticks the item, see code §2.2).

**Q-R4-11: PO8 session `01a19f85-6172-7135-b463-64568ad628f3`** (events 2026-11-03, `posthog-react-native`, `platform =
android`, locale `es-US`, 3.26.0). After `onboarding_completed` 03:54:36 and the onboarding paywall: Home 03:54:50 →
`discover_tab_viewed` 03:54:55.848 → **`Application Backgrounded` 03:54:56.216 → `Became Active` 03:55:00.234** → garage →
home → add-maintenance-task → home → backgrounded. **No `start-ride`, `ride_started`, trip or route screen in the session.**

**Q-R4-12: live builds (`Application Opened`, last 14 days).** 3.26.0 (builds 106, 93), 3.27.0 (108, 95), 3.28.0 (96–111),
3.19.x. Several builds share one `$app_version`, and OTA updates do not change `$app_version` at all (§2.2, `lib/analytics.ts`).

### 2.2 Supabase (production, read-only)

**S-R4-01: first ride of each sign-up of the last 60 days** (same exclusions as `q99-day0-schedule-weekly`).
```sql
with u as (select id from public.users where created_at >= now() - interval '60 days'
           and coalesce(is_synthetic,false)=false and <q08 email exclusions>),
fr as (select distinct on (r.user_id) r.user_id, r.status, r.distance_m, r.started_at, r.deleted_at is not null as deleted
       from rides r join u on u.id=r.user_id order by r.user_id, r.started_at)
select count(*), count(*) filter (where status='completed' and not deleted and distance_m < 50),
       count(*) filter (where status='completed' and not deleted and distance_m >= 500),
       count(*) filter (where deleted), (select count(*) from u) from fr
```
359 sign-ups; 72 have a ride. First ride: **26 live, "completed", under 50 m (junk kept in history)**; 16 live ≥ 500 m;
13 deleted (discarded); 15 with a null distance.

**S-R4-02: does a junk first ride lead to a real one?** Junk-first riders: 26, of whom **4** have a live ≥ 500 m ride
within 7 days of the first ride (avg 1.12 live < 50 m rides each). Riders whose first ride was not live junk: 31, of whom 14.
[Selection, not causation: a rider who saves a 0 m test was at home.]

### 2.3 Code read (origin/main 52d281e9)

| Topic | Finding | Source |
|---|---|---|
| Ways into the HUD | Only three: Start Ride after a successful `startRideSession` (`router.replace('/(modals)/ride-hud')`); Resume in the unfinished-ride banner; `rideRouteFor` when the store is `recording`/`paused` and not interrupted | `app/(modals)/start-ride.tsx:81-111`; `features/ride/use-unfinished-ride.ts:70-75`; `features/ride/ride-route.ts:23-26, 46-49` |
| Ride entry taps | FAB in the tab bar and Home's ride action call `useOpenRide()`; profile rides empty state pushes start-ride; iOS quick action `start-ride` opens Start Ride (not the HUD) | `app/(tabs)/_layout.tsx:76-107`; `app/(tabs)/(home)/index.tsx:60,133`; `app/(tabs)/(profile)/rides.tsx:762-768`; `app/_layout.tsx:916-924` |
| Stale-ride protection | A new start first resolves an existing record; after an app kill the GPS task is re-checked; a failed GPS start rolls back the persisted ride so the next launch does not read it as unfinished | `features/ride/ride-controller.ts:180-190, 229-239` |
| Start is immediate | "Start ride" → (disclosure when permissions missing, `start-ride.tsx:122-137`) → OS prompt → ride recording → HUD, no extra confirmation. The OS dialog is not in the replay, so the replay jumps from Start Ride to the HUD | `app/(modals)/start-ride.tsx:122-148` |
| `garage_first` order | `onboarding_completed` fires on the payoff screen **before** "Open my garage" presents the paywall; the rider reaches Home only in `handleContinue` after the paywall settles | `app/(onboarding)/personalizing.tsx:389-413, 415-468`; events Q-R4-01 (oc 07:18:07, paywall 07:18:20–24) |
| Too-short guard | `elapsed < MIN_RIDE_ELAPSED_S (30) || dist < MIN_RIDE_DISTANCE_M (50)` opens the sheet; ≥ 120 s is the no-GPS branch; event carries `elapsed_s`, `distance_m`, `action` only | `app/(modals)/ride-hud.tsx:54-68, 213-228`; `utils/ride-constants.ts:25-26` |
| Guard copy | "End ride?" / "Your ride was very short ({{seconds}}s, {{meters}}m). Are you sure?"; tip shown once; buttons Keep Riding / End Anyway | `i18n/locales/en.json:2173-2177`; `ride-hud.tsx:332-436` |
| GPS fix signal | `gpsAccuracy` is set only when a buffered point exists; no "had any fix" flag | `ride-hud.tsx:93, 140-151` |
| End Anyway → saved | "End Anyway" calls `executeEndRide` → `endRideSession` → summary; the ride is already completed on the server, and the summary's primary button is Save; only Discard deletes it | `ride-hud.tsx:202-211, 244-257`; `app/(modals)/ride-summary.tsx:193-279` |
| Sheet not in a11y tree | The `@gorhom` guard sheet texts are not exposed; the existing E2E taps "End Anyway" by screen point | `apps/mobile/.maestro/flows/log-ride.yaml:14-19, 56-71` |
| No testIDs | `start-ride.tsx`, `ride-hud.tsx`, `onboarding-checklist.tsx` carry no `testID` | grep, 0 hits |
| Checklist FIRST_RIDE | Label "See your first ride stats", deep link `PROFILE_ROUTE.RIDES` (the empty rides list) | `stores/checklist.store.ts:66-72`; `en.json:824` |
| Tap ticks a data item | Every row press calls `completeItem(item.id)` (trigger `tap`) before navigating, including data-backed FIRST_RIDE | `components/home/onboarding-checklist.tsx:153-180` |
| Data rule counts junk | FIRST_RIDE completes on any ride with status Completed, whatever its distance | `lib/checklist-signals.ts:44-47` |
| Rides empty state | "No rides yet" + "Start a Ride" → start-ride | `app/(tabs)/(profile)/rides.tsx:752-790`; `en.json:327-329` |
| Flags | `isFeatureFlagOn` returns false whenever analytics is off (all pre-consent EEA/UK/CH installs) | `lib/feature-flags.ts:18-25` |
| Sticky assignment pattern | Onboarding A/B: PostHog value if it answers, else uniform on-device draw, stored first-write-wins, exposure sent later if pre-consent | `lib/onboarding-experiment.ts:13-40, 67-71`; `stores/experiment.store.ts:20-68` |
| Version tagging | Super properties exist (`registerSuperProperties`), but no OTA update id is registered; `$app_version` stays the same across OTAs | `lib/analytics.ts:485-493`; grep `Updates.updateId` 0 hits in `lib/` |
| Discover asks for location on open | `useUserCountry()` runs `requestForegroundLocationPermission()` then `getCurrentPositionAsync` on Discover mount | `app/(tabs)/(discover)/index.tsx:503`; `hooks/use-user-country.ts:30-45` |
| "Descargar mapas" | Not an app string: `es.json` has no such key (closest: `offlinePack.downloadA11y` "Descargar para usar sin conexión", only on trip detail) | `i18n/locales/es.json:2735` |
| FAB icon | The tab-bar ride button is a `Route` icon with no visible label | `app/(tabs)/_layout.tsx:137` |

## 3. Root cause

### 3.1 PO5 "HUD opens by itself after onboarding": not a bug

**Verdict:** The HUD never opened without a rider-started ride. In both flagged sessions the rider opened Start Ride (71 s and
126 s after onboarding, via the rides empty state and via Discover → FAB), tapped Start, answered the OS location dialog, and
the HUD opened 0.04–0.3 s after `ride_started` [SOURCE: Q-R4-01]. Across all riders in 60 days, 0 HUD views came from a person
who had never started a ride, and every HUD within 40 s of onboarding came through Start Ride [SOURCE: Q-R4-04, Q-R4-05].
Code has no path to the HUD without a recording/paused store (§2.3). The replay summaries compressed 1–2 minutes and the
system dialog (which replay does not capture) into "the app immediately enters the Ride HUD" [SOURCE: Q-R4-02].
None of the suspected causes applies: no stale-ride resume (0 "never started" views), no deep link (quick action opens Start
Ride, not the HUD), no checklist path (FIRST_RIDE opens the rides list), no `garage_first` dismissal path (it calls
`handleContinue` → Home only).

**Confidence: 92%.** Raises it to ~99%: watch the two recordings at 07:19:20–07:19:40 (01a1815d) and 07:24:50–07:25:06
(01a18bae) and see the Start tap; or run the T2 Maestro guard on a fresh install of the current build.

**What PO5 really shows** [UNBACKED — own reading]: a rider who taps the FAB or "Start a Ride" while exploring at home gets a
recording ride after one tap plus the OS prompt, with nothing saying "you are now recording; ride to save it". That is the
entry to PO4, not a separate bug.

### 3.2 PO4 "ride too short" on the first attempt

**Verdict:** Riders test the Start button at home. On builds ≥ 3.21, 18 of 36 completers' first attempts end at a standstill
(< 10 m) [SOURCE: Q-R4-07]. Three things then go wrong, all in code:
1. The sheet treats the test as an error ("Are you sure?") and gives no next step; riders end anyway (24 End vs 1 Keep on
   ≥ 3.21) [SOURCE: Q-R4-06; ride-hud.tsx:332-436; en.json:2174].
2. **"End Anyway" leads to a summary that saves the 0 m ride** ("RIDE SAVED", Save is primary; the ride is already completed on
   the server) [SOURCE: ride-hud.tsx:244-257; ride-summary.tsx:193-279; log-ride.yaml:19]. In the database, 26 of 72 new
   riders' first ride is a live sub-50 m ride [SOURCE: S-R4-01]. The board did not have this finding.
3. That junk ride ticks the "first ride" checklist item, and so does merely tapping the row [SOURCE: checklist-signals.ts:44-47;
   onboarding-checklist.tsx:153-160]: 17 riders ticked it by tap and 14 of them never saved a real ride [SOURCE: Q-R4-10]. So the
   one checklist row that should keep pointing at "ride" disappears after a test or a curious tap.

Only 3 of the 20 riders whose first sheet (≥ 3.21) was a standstill saved a real ride within 7 days [SOURCE: Q-R4-06] (the board's
canonical 1/13 used a stricter window [SOURCE: board/02-onboarding-ux.md:10]).

**The replay figure "47 of 73" is not reproduced by this cut.** It mixes builds, where old builds wrote `end`/`keep` rows without
`shown` (§2.1 note). Use **≥ 3.21: 20 of 36 triers (56%) hit the standstill sheet within 7 days** [SOURCE: Q-R4-06].

**Confidence: 80%** that "home test → error sheet → junk save / no next step" is the mechanism behind the low first-ride
save rate. What it cannot say: whether these riders would ride soon anyway (season, weather). Raises it: the new
`max_speed_kmh` / `gps_fix` fields on the sheet (T1) for one month, and 10 replays of standstill sheets on ≥ 3.27.

### 3.3 PO8 "Download maps" on route start: not reproduced, probably not our UI

**Verdict:** The session never started a route or ride [SOURCE: Q-R4-11]. The rider opened Discover; 0.37 s later the app went
to the background for 4 s, which on Android means another Activity covered it. Discover requests location permission on mount
[SOURCE: discover/index.tsx:503; use-user-country.ts:30-45], and the OS permission dialog (or a Google Play services
location-accuracy dialog after `getCurrentPositionAsync`) is such an Activity. "Descargar mapas" is not an app string
[SOURCE: es.json grep]. The AI likely misread a system or third-party dialog, and called the Route-icon FAB / Discover "Ruta".
**Confidence: 35%** in that specific explanation (n = 1). What is certain (95%): Discover asks for location with no context the
first time it opens, the first minute after onboarding. Raises it: watch the recording at 03:54:55–03:55:01, and the T10 repro
on a fresh Android install.

### 3.4 Board Experiment 1 spec vs current code: corrections

| Board spec item | Code today | Correction |
|---|---|---|
| "Assigned at `onboarding_completed` … after the paywall" [SOURCE: board/99-synthesis.md §4] | For `garage_first`, `onboarding_completed` fires **before** the paywall (§2.3); the cold-start resume path completes without `handleContinue` (`personalizing.tsx:363-371`) | Assign where onboarding is flipped to completed: `handleContinue` (`:389-393`, after the paywall in both arms) and the cold-start branch, through one shared function. Fire `activation_exposure` there. |
| Flag `activation_365_first_session` read via PostHog | `isFeatureFlagOn` is false for every pre-consent install (`lib/feature-flags.ts:18-25`) | Copy the onboarding pattern: PostHog value if it answers, else uniform local draw; sticky in a new experiment-store field; pending exposure flushed on consent. Without this, EEA pre-consent riders all land in control (SRM by region). |
| Plan card "replaces the `FIRST_RIDE` link to the empty rides list" (checklist.store.ts:67-70) | Confirmed (`:66-72`). Also: the row ticks on tap, and a junk ride ticks it | Both arms (bug fix, before the slot): no tap-completion for data-backed items; FIRST_RIDE needs a ride ≥ 30 s and ≥ 50 m. Test arm: plan card instead of the row. |
| Teaching sheet "Got it (ends and discards)" | No discard path in the HUD; discard lives in the summary (`ride-summary.tsx:256-279`) | Extract a `discardEndedRide(rideId)` controller function used by both. |
| Title "Test ride: all good" only if a GPS fix arrived | HUD keeps only the last point's accuracy (`ride-hud.tsx:93,150`) | Add `hadFixRef` set when any point is buffered; send `gps_fix`. |
| "no saved real ride" condition | Home rides query has `status` only (`checklist-signals.ts:5`) | Add distance/duration to the home rides fragment, or a persisted `hasRealRide` flag set on a real save. |
| `ride_too_short_shown` gains `variant`, `gps_fix`, `max_speed_kmh`, `action:'remind_me'` | Confirmed missing (`ride-hud.tsx:220-226`) | As spec, plus `has_real_ride` and `arm`. |
| Read per release by `$app_version` | OTA updates keep `$app_version` (Q-R4-12) | Register super properties `ota_update_id` and `activation_fix_level` (T1) so before/after works per OTA. |
| Sheet E2E | Sheet not in the a11y tree; no testIDs | testIDs on the sheet buttons (T1); if `@gorhom` still hides them, render the guard with `BottomSheetView` `accessible` children or a RN `Modal`. |

## 4. Fix options

| Friction | Option | Pros | Cons | Pick |
|---|---|---|---|---|
| PO5 | (a) Nothing in code; add a regression E2E + metric | Cheap; proves the negative on every release | none | **Yes** |
| | (b) Add a "Recording started" confirmation step | Clear | Extra tap for real riders on the bike; not needed | No |
| PO4 junk save | (a) Both arms: a ride below the floors that the rider ends from the guard is discarded, not shown as "RIDE SAVED" | Removes junk from history, checklist and insights; tiny change | Changes control too, so ship before the slot starts | **Yes (owner decision)** |
| | (b) Only in the test arm (board's "Got it ends and discards") | Keeps control pure | Leaves 26/72-type junk in control during a 3-month slot; `ride_completed` keeps junk | Fallback |
| PO4 error copy | (a) Teaching sheet in the test arm (board P02.2/P01.1/P03.2/P05.1) | Sourced; reads as a mechanism chain | Effect unbacked; 2–3 riders/week | **Yes** |
| | (b) Lower 30 s / 50 m | — | Counts standstill taps as rides (board rejected) | No |
| Checklist FIRST_RIDE | (a) Both arms: data-backed items never tick on tap; FIRST_RIDE rule requires a real ride | Bug fix; the row stays as a pointer to "ride" | Slightly fewer ticks | **Yes** |
| | (b) Test arm only: plan card replaces the row | Board spec | — | **Yes, in addition** |
| PO8 | (a) Repro first; then move the Discover location request behind a "Use my location" tap in "Near you" | Context for the OS prompt; no surprise dialog in the first minute | Touches Discover in both arms | **Yes, after repro (owner decision on timing vs slot)** |
| Measurement | `activation_fix_level` + `ota_update_id` super properties, PostHog annotations per release | Per-OTA before/after | One small PR | **Yes, first** |

## 5. Friction specs

Common prerequisites for the Maestro flows: a bundled preview/release build, the parameterized runner
`scripts/run-onboarding-e2e.sh` (creates and deletes a confirmed test user), `onboarding.yaml` as setup, `setLocation` for a GPS
fix, no RevenueCat in test runs (paywall closes via `optional: true`), the custom keyboard caveat (no numeric input needed here)
[SOURCE: apps/mobile/.maestro/README.md]. Each new flow gets a `test:e2e:<name>` script in `apps/mobile/package.json`
(`E2E_FLOW=<file> E2E_EMAIL_PREFIX=e2e-<name> sh scripts/run-onboarding-e2e.sh`). For arm-specific flows, the runner repeats the
flow until the requested arm is drawn (`EXPECTED_ARM`, `MAX_TRIES`), as `run-onboarding-paywall-e2e.sh` does; the flow reads
the arm from the UI (`id: activation-plan-card` present ⇒ test). No production override switch.

Common production metric frame: completers whose `onboarding_completed` falls in the window, q00 excluded, broken down by
`$app_version` **and** `activation_fix_level` (T1) — before T1 ships, `$app_version` only. Read with the P06.3 harm rule;
mechanical metrics are read directly.

### F-R4-1 (PO5): the Ride HUD must open only after the rider starts or resumes a ride

1. **Repro:** iOS simulator and Android emulator, fresh install of the build under test, new account (free), complete onboarding
   in each paywall arm, land on Home, wait 15 s, kill and relaunch.
2. **Expected:** Home (or the last tab) shows; never `/(modals)/ride-hud`. The HUD appears only after "Start ride" on Start Ride,
   Resume in the unfinished banner, or the FAB/Home while a ride is live.
3. **Automated:** Maestro `apps/mobile/.maestro/flows/first-session-no-auto-hud.yaml` — `runFlow: onboarding.yaml`;
   `assertVisible` Home anchor; `assertNotVisible: {id: "ride-hud-root"}` (T1 adds the testID); `waitForAnimationToEnd`,
   wait 10 s, assert again; `stopApp` + `launchApp` (no `clearState`), assert again; tap the FAB `{id: "tab-ride-fab"}` →
   `assertVisible: {id: "start-ride-screen"}` and `assertNotVisible: {id: "ride-hud-root"}`; tap Close. Unit test (exists, keep):
   `features/ride/__tests__/ride-route.test.ts` covers `rideRouteFor` idle → START.
4. **Production metric** (HogQL; baseline **0 views / 0 riders**, 60 d to 2026-11-12 [SOURCE: Q-R4-05]; target 0 on every
   version):
   ```sql
   SELECT ver, countIf(last_rs < toDateTime('2000-01-01 00:00:00')) AS hud_without_any_start,
          countIf(last_rs >= toDateTime('2000-01-01 00:00:00') AND dateDiff('second', last_rs, timestamp) > 3*3600) AS hud_stale_gt3h
   FROM (SELECT timestamp, event, toString(properties.$app_version) AS ver, toString(properties.$screen_name) AS sn,
                max(if(event='ride_started', timestamp, toDateTime('1970-01-01 00:00:00')))
                  OVER (PARTITION BY person_id ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS last_rs
         FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND event IN ('ride_started','$screen')
           AND person_id NOT IN (<q00>))
   WHERE event='$screen' AND sn='/(modals)/ride-hud' GROUP BY ver ORDER BY ver
   ```
   `hud_stale_gt3h` baseline 19 views / 6 riders (all versions) — watch only.

### F-R4-2 (PO4): a standstill first attempt must teach, not ask "Are you sure?" (test arm of Experiment 1)

1. **Repro:** simulator with a fixed `setLocation` (no movement), new free account, finish onboarding, FAB → Start ride → wait
   5 s → hold to end.
2. **Expected (test arm, rider with no real ride, `distance_m < 10`, too-short branch):** sheet titled "Test ride: all good" when a
   fix arrived, else "Testing it out?"; body states both floors interpolated from `MIN_RIDE_ELAPSED_S` / `MIN_RIDE_DISTANCE_M`;
   buttons "Got it" (ends and discards), "Keep recording", "Remind me on my next ride day" (opens the plan chips). Control and
   riders with a real ride or `distance_m ≥ 10`: today's sheet. HUD stays `HUD_THEME` (dark) in both system modes.
3. **Automated:** Maestro `ride-standstill-teaching.yaml` (`EXPECTED_ARM=test`): setup; `setLocation`; FAB; `tapOn: {id:
   "start-ride-button"}`; `extendedWaitUntil: RECORDING`; wait 5 s; `longPressOn: ".*Hold to end ride.*"`;
   `assertVisible: {id: "ride-guard-sheet", ...}` and `{id: "ride-guard-variant-teaching"}`; `assertVisible: "Test ride: all good|Testing it out\\?"`;
   `assertVisible: ".*30 seconds.*50 m.*"`; `tapOn: {id: "ride-guard-got-it"}`; `assertNotVisible: ".*RIDE SAVED.*"`.
   Same flow with `EXPECTED_ARM=control` asserts `{id: "ride-guard-variant-default"}`. Jest:
   `app/(modals)/__tests__/ride-guard-variant.test.ts` for a pure `selectGuardVariant({elapsedS, distanceM, hasRealRide, arm})`
   (all branches incl. no-GPS ≥ 120 s, `distance_m` 9/10/50) and copy interpolation from the constants. Screenshots light/dark.
4. **Production metrics** (by `$app_version`, `activation_fix_level`, arm):
   - Mechanism: share of standstill sheets with `variant='teaching'` among eligible (target ≥ 95% in test, 0% in control; hygiene:
     0 teaching sheets with `distance_m ≥ 10` or after a real ride).
   - Outcome (descriptive, 2–3 riders/week): of riders whose first standstill sheet came before any real ride, share with a real
     `ride_completed` within 7 days. **Baseline ≥ 3.21: 3/20** [SOURCE: Q-R4-06] (board canonical 1/13). Target: none claimed;
     read inside Experiment 1 only.
   ```sql
   WITH t AS (SELECT person_id AS pid,
       minIf(timestamp, event='ride_too_short_shown' AND toString(properties.action)='shown' AND toFloat(properties.distance_m) < 10) AS t_ss,
       argMinIf(toString(properties.$app_version), timestamp, event='ride_too_short_shown' AND toString(properties.action)='shown'
                AND toFloat(properties.distance_m) < 10) AS ver,
       argMinIf(toString(properties.variant), timestamp, event='ride_too_short_shown' AND toString(properties.action)='shown'
                AND toFloat(properties.distance_m) < 10) AS variant,
       minIf(timestamp, event='ride_completed' AND coalesce(toString(properties.below_min_ride),'false')!='true') AS t_real
     FROM events WHERE timestamp >= now() - INTERVAL 90 DAY AND event IN ('ride_too_short_shown','ride_completed')
       AND person_id NOT IN (<q00>) GROUP BY pid)
   SELECT ver, variant, countIf(t_ss > '2000-01-01' AND (t_real < '2000-01-01' OR t_real > t_ss) AND t_ss < now() - INTERVAL 7 DAY) AS eligible,
          countIf(t_ss > '2000-01-01' AND t_real > t_ss AND t_real < t_ss + INTERVAL 7 DAY) AS real_ride_7d
   FROM t GROUP BY ver, variant ORDER BY ver
   ```

### F-R4-3 (PO4): a ride under the floors ended from the guard must not be saved as a ride (both arms; owner decision)

1. **Repro:** as F-R4-2, control arm or today's build; on the sheet tap "End Anyway".
2. **Expected:** the ride is ended and deleted (same effect as Discard: `deleteRide` op, `finalizeEndedRide`), the rider lands on
   Start Ride or Home with a short toast "Not saved: rides under {{seconds}} s or {{meters}} m aren't kept"; no "RIDE SAVED"
   summary; Profile › Rides still shows "No rides yet"; `ride_discarded {reason:'below_min_guard'}` fires; no `ride_completed`.
   A ride above both floors is unchanged. Auto-ended rides (`auto_end`) below the floors are also discarded server-side or
   flagged — owner decision (2 rows / 60 d).
3. **Automated:** update `log-ride.yaml` (it currently expects "RIDE SAVED" for a standstill ride, `log-ride.yaml:62-80`): use
   Features ▸ Location ▸ Freeway Drive / `travel` so the happy path exceeds the floors; new flow `ride-standstill-not-saved.yaml`:
   standstill start → end → `tapOn: {id: "ride-guard-end-anyway"}` → `assertNotVisible: ".*RIDE SAVED.*"` → Profile tab →
   Rides → `assertVisible: "No rides yet"`. Jest: `features/ride/__tests__/ride-controller.test.ts` adds
   `discardEndedRide` (enqueues `deleteRide`, clears the record); `ride-summary-save.test.tsx` unchanged for real rides.
4. **Production metric:** `ride_completed` with `below_min_ride = true` per version. **Baseline ≥ 3.21: 15 events / 13 riders in
   60 d** [SOURCE: Q-R4-08]; DB: **26 of 72** new riders' first ride is a live sub-50 m ride [SOURCE: S-R4-01]. **Target: 0
   `below_min_ride=true` with `save_trigger='summary'` on fixed versions; DB share of live sub-50 m first rides < 5% for sign-ups
   after the release.**
   ```sql
   SELECT toString(properties.$app_version) AS ver, toString(properties.activation_fix_level) AS lvl,
          toString(properties.save_trigger) AS trig, count() AS junk_saves, uniq(person_id) AS riders
   FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND event = 'ride_completed'
     AND toString(properties.below_min_ride) = 'true' AND person_id NOT IN (<q00>)
   GROUP BY ver, lvl, trig ORDER BY ver
   ```

### F-R4-4 (PO4/PO10): the "first ride" checklist row must not tick without a real ride, and must lead to a ride (both arms)

1. **Repro:** new account, Home, tap "See your first ride stats".
2. **Expected:** the row stays unticked; it opens Start Ride (not the empty rides list) — or, in the test arm, the row is replaced
   by the plan card (F-R4-5). A sub-floor ride does not tick it; a real ride (≥ 30 s and ≥ 50 m) does. Other data-backed items
   (expense, bike photo, receipt) also no longer tick on tap.
3. **Automated:** Maestro `checklist-first-ride.yaml` (control arm): Home → `tapOn: {id: "checklist-row-first_ride"}` →
   `assertVisible: {id: "start-ride-screen"}` → Close → `assertVisible: {id: "checklist-row-first_ride", checked: false}`
   (a11y `checked` state already set, `onboarding-checklist.tsx:181-182`). Jest: extend `lib/__tests__/checklist-signals.test.ts`
   (a Completed ride with `distanceM 0` does not complete FIRST_RIDE; one with 60 s / 800 m does) and
   `components/home/__tests__/onboarding-checklist.test.tsx` (press on a data-backed row does not call `completeItem`).
4. **Production metric:** `checklist_item_completed {item:'first_ride'}` by `trigger`. **Baseline 60 d: tap 17 riders (3 with a real
   ride), data 20 riders (12 with a real ride)** [SOURCE: Q-R4-10]. **Target on fixed versions: tap = 0; data-ticked riders without
   a real ride = 0.**
   ```sql
   SELECT toString(properties.$app_version) AS ver, toString(properties.trigger) AS trig, uniq(person_id) AS riders,
          uniqIf(person_id, person_id IN (SELECT person_id FROM events WHERE timestamp >= now() - INTERVAL 60 DAY
                 AND event='ride_completed' AND coalesce(toString(properties.below_min_ride),'false')!='true')) AS with_real_ride
   FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND event='checklist_item_completed'
     AND toString(properties.item)='first_ride' AND person_id NOT IN (<q00>) GROUP BY ver, trig ORDER BY ver
   ```

### F-R4-5 (Experiment 1 core): a completer with no ride gets a "When's your next ride?" plan (test arm)

1. **Repro:** new account, finish onboarding (either paywall arm), land on Home, test arm.
2. **Expected:** top of the Get Started card shows the plan card (chips Today/Later today per owner, Tomorrow, This weekend, Not
   sure yet); a chip tap asks notification permission in context once (if not granted), schedules one local notification of kind
   `activation` at 03's default time, shows "We'll remind you {{when}}", fires `next_ride_plan_set {when, source:'plan_card',
   permission_granted}` and `reminder_scheduled {kind:'activation', source:'plan_card'}`; the notification opens Start Ride; any
   core action cancels it; a "Bike added" row is pre-ticked. Light and dark mode via `useEditorialTheme`.
3. **Automated:** Maestro `first-ride-plan-card.yaml` (`EXPECTED_ARM=test`): setup → `assertVisible: {id: "activation-plan-card"}` →
   `tapOn: {id: "plan-chip-tomorrow"}` → `tapOn: {text: "Allow", optional: true}` → `assertVisible: {id: "plan-card-scheduled"}` →
   relaunch → still scheduled. Control run asserts `assertNotVisible: {id: "activation-plan-card"}`. Delivery is NOT provable in
   Maestro (OS scheduler); covered by jest `features/activation/__tests__/plan-fire-time.test.ts` (fire-time per chip, 19:00 cap,
   time zones, DST, Saturday rule) + `scheduler.test.ts` (one `activation` notification max, cancel on core action) and by the
   Android device check (T9) + `activation_nudge_presented`.
4. **Production metrics:** plan set rate among eligible test-arm completers (kill rule < 1 in 10 after 8 weeks [SOURCE:
   board/99-synthesis.md §4]); chain plan set → scheduled → presented → opened → core action ≤ 48 h; primary: week-1 core action
   among completers by arm, **baseline 61/367 (16.6%), Oct 16/127** [SOURCE: board/99-synthesis.md §4]. Query by arm:
   ```sql
   SELECT toString(properties.arm) AS arm, toString(properties.onboarding_variant) AS ob, toString(properties.$app_version) AS ver,
          uniq(person_id) AS enrolled
   FROM events WHERE timestamp >= '2026-12-15' AND event='activation_exposure'
     AND toString(properties.experiment)='activation_365_first_session' AND person_id NOT IN (<q00>)
   GROUP BY arm, ob, ver
   ```
   (core-action join as in the ledger definition; SRM χ² per platform weekly.)

### F-R4-6 (PO8): no unexplained modal when a new rider opens Discover or starts a ride (both arms)

1. **Repro:** Android emulator (and a real Android phone), fresh install, Spanish locale, new account, finish onboarding, tap the
   Discover tab, then the FAB.
2. **Expected:** no system/third-party dialog appears on Discover open without a rider action; location for "Near you" is asked
   only after a tap on a "Use my location" control, with a one-line reason; Start Ride shows only the existing disclosure → OS
   location prompt.
3. **Automated:** Maestro `discover-first-open-android.yaml` on an emulator with location permission reset: setup → `tapOn: {id:
   "tab-discover"}` → wait 3 s → `assertNotVisible: "Allow.*location|While using the app|Only this time|Descargar.*"` →
   `assertVisible: {id: "near-you-use-location"}` → tap → `assertVisible: "While using the app|Only this time"` (OS dialog). Jest:
   `hooks/__tests__/use-user-country.test.ts` — the query is disabled until the rider opts in.
4. **Production metric:** `Application Backgrounded` within 2 s of `discover_tab_viewed` on a rider's first Discover visit, by
   `$app_version` and platform. Baseline: not measured yet (n = 1 seen) — run once before the fix; target: no change in
   first-day Discover → next-screen continuation; the backgrounding share should fall to ~0 after the fix.
   ```sql
   SELECT toString(properties.$app_version) AS ver, toString(properties.platform) AS plat, count() AS first_visits,
          countIf(bg_s >= 0 AND bg_s <= 2) AS backgrounded_2s
   FROM (SELECT person_id, timestamp, properties,
           dateDiff('second', timestamp, leadInFrame(if(event='Application Backgrounded', timestamp, toDateTime('1970-01-01 00:00:00')))
             OVER (PARTITION BY person_id ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)) AS bg_s,
           row_number() OVER (PARTITION BY person_id, event ORDER BY timestamp) AS rn, event
         FROM events WHERE timestamp >= now() - INTERVAL 60 DAY
           AND event IN ('discover_tab_viewed','Application Backgrounded') AND person_id NOT IN (<q00>))
   WHERE event='discover_tab_viewed' AND rn=1 GROUP BY ver, plat ORDER BY ver
   ```

### F-R4-7 (measurement): every fix release must be readable before/after in PostHog

1. **Repro:** ship an OTA; `$app_version` does not change (Q-R4-12).
2. **Expected:** every event carries `activation_fix_level` (integer constant in `config/activation.ts`, bumped by each PR that
   fixes an R4/#365 friction) and `ota_update_id` (`Updates.updateId ?? 'embedded'`); each release gets a PostHog annotation
   "activation_fix_level N: <frictions>" (owner-approved write).
3. **Automated:** jest `lib/__tests__/analytics-super-properties.test.ts` asserts both keys are registered at analytics init and
   re-registered on consent; a CI check (`scripts/check-activation-fix-level.ts`, optional) fails a PR that touches the listed
   files without bumping the constant.
4. **Production metric:** share of `Application Opened` events carrying `activation_fix_level`, by `$app_version`; target 100%
   on builds/OTAs after T1. All F-R4 metrics then group by `activation_fix_level` instead of, or next to, `$app_version`.

## 6. Tasks (in order)

**T1. Instrumentation and test hooks for the first ride (one small mobile PR).** Size S. Depends on nothing.
- Why: no testIDs on Start Ride, HUD guard, checklist; the guard sheet is invisible to Maestro; OTA releases can't be told apart;
  the sheet lacks `gps_fix` / `max_speed_kmh` [SOURCE: §2.3; Q-R4-12; board/99 instrumentation 3].
- What: testIDs `tab-ride-fab`, `start-ride-screen`, `start-ride-button`, `ride-hud-root`, `ride-guard-sheet`,
  `ride-guard-keep`, `ride-guard-end-anyway`, `checklist-row-<id>`; make the guard buttons reachable (verify with
  `inspect_screen`; if not, render the sheet content in `BottomSheetView` with accessible children); `ride_too_short_shown` adds
  `gps_fix` (any point buffered, new `hadFixRef`), `max_speed_kmh`, `has_real_ride`; super properties `activation_fix_level = 1`
  and `ota_update_id`; `post_onboarding_landed {screen, onboarding_variant}`.
- Files: `app/(tabs)/_layout.tsx`, `app/(modals)/start-ride.tsx`, `app/(modals)/ride-hud.tsx`,
  `components/home/onboarding-checklist.tsx`, `lib/analytics.ts`, new `config/activation.ts`, `app/_layout.tsx` (or Home) for
  `post_onboarding_landed`.
- Acceptance: `inspect_screen` on iOS sim and Android emulator lists all ids incl. the sheet buttons; `log-ride.yaml` switched from
  point taps to ids and passes; events show the new fields in PostHog for a test account.
- Verify: Maestro `log-ride.yaml`; F-R4-7 query = 100% on the new OTA. `pnpm verify:mobile`.
- Owner decision: none.

**T2. Regression guard for PO5.** Size S. Depends on T1.
- Why: PO5 is not a bug (§3.1), but nothing proves it per release.
- What: `apps/mobile/.maestro/flows/first-session-no-auto-hud.yaml` + `test:e2e:first-session-hud` script; save F-R4-1 HogQL as a
  PostHog insight (owner-approved write) with a weekly alert if `hud_without_any_start > 0`.
- Acceptance: flow passes on iOS and Android preview builds in both onboarding arms.
- Verify: F-R4-1 (Maestro + metric 0).
- Owner decision: approve the PostHog insight/alert write.

**T3. Checklist FIRST_RIDE fix (both arms, before the slot).** Size S. Depends on T1.
- Why: 17 riders ticked "first ride" by tap, 14 with no real ride; junk rides tick it too [SOURCE: Q-R4-10;
  onboarding-checklist.tsx:153-160; checklist-signals.ts:44-47].
- What: no `completeItem` on press for `isDataBackedItem(id)`; FIRST_RIDE rule = a Completed ride with duration ≥
  `MIN_RIDE_ELAPSED_S` and distance ≥ `MIN_RIDE_DISTANCE_M` (add `distanceM`/`durationS` to the home rides fragment →
  `pnpm generate`); FIRST_RIDE deep link → `/(modals)/start-ride` (label "Record your first ride", 7 app locales); bump
  `activation_fix_level`.
- Files: `components/home/onboarding-checklist.tsx`, `lib/checklist-signals.ts`, `components/home/use-checklist-signals.ts`, the
  home rides `.graphql` in `src/graphql/`, `stores/checklist.store.ts` (+ persist migration v6 for the deep link),
  `i18n/locales/*.json`.
- Acceptance: F-R4-4 expected behaviour; existing checklist tests pass.
- Verify: Maestro `checklist-first-ride.yaml`; jest as F-R4-4; metric F-R4-4 tap = 0 on the new level.
- Owner decision: new row label and deep link (Start Ride vs keep rides list).

**T4. Standstill ride is not saved (both arms, before the slot).** Size S–M. Depends on T1.
- Why: 26 of 72 new riders' first ride is junk kept in history; "End Anyway" shows "RIDE SAVED" [SOURCE: S-R4-01; Q-R4-08].
- What: extract `discardEndedRide(rideId, reason)` from `ride-summary.tsx:256-279` into `features/ride/ride-controller.ts`; in
  `handleGuardEndAnyway`, when below both floors and not the no-GPS branch, end + discard + toast + route to Start Ride/Home;
  `ride_discarded {reason:'below_min_guard'}`; rename "End Anyway" to "End without saving" (7 locales). Update `log-ride.yaml` to
  a moving route. Decide the `auto_end` sub-floor case.
- Files: `app/(modals)/ride-hud.tsx`, `app/(modals)/ride-summary.tsx`, `features/ride/ride-controller.ts`, `i18n/locales/*.json`,
  `apps/mobile/.maestro/flows/log-ride.yaml`, new `ride-standstill-not-saved.yaml`.
- Acceptance: F-R4-3 expected; a ≥ 30 s / ≥ 50 m ride still reaches the summary; CarPlay end path unchanged.
- Verify: Maestro `ride-standstill-not-saved.yaml`, updated `log-ride.yaml`; jest `ride-controller.test.ts`; metric F-R4-3 (0 junk
  `summary` saves; DB share < 5%).
- Owner decision: **yes** — both arms now (recommended) vs only the test arm's "Got it".

**T5. Flag `activation_365_first_session` and assignment.** Size M. Depends on T1 (and P06.1 ledger signed).
- Why: board design; assignment point must be after the paywall for `garage_first` and must not drop pre-consent installs
  [SOURCE: §3.4; personalizing.tsx:389-468; lib/feature-flags.ts:18-25].
- What: `lib/activation-experiment.ts` mirroring `onboarding-experiment.ts` (PostHog multivariate `control`/`test` if it answers →
  source `posthog`; flag off/unknown → `control` kill switch; cannot ask → uniform local draw, source `local`); sticky
  `activationArm` / `activationAssignedAt` / `activationSource` / `activationExposurePending` in `stores/experiment.store.ts`
  (version 2 migration); assign in one `completeOnboardingAndAssign()` called from `handleContinue` (`personalizing.tsx:389-393`) AND the cold-start
  resume branch (`:366-371`, which bypasses `handleContinue`), only for riders with no prior ride on this account; `activation_exposure
  {experiment, arm, source, onboarding_variant, notifications_granted}` + super property `activation_arm`; pending exposure flushed
  on consent. Ships by OTA (post-onboarding code). PostHog flag created by the owner, 50/50, no targeting.
- Files: new `lib/activation-experiment.ts`, `stores/experiment.store.ts`, `app/(onboarding)/personalizing.tsx`,
  `lib/analytics.ts` (event names), `config/activation.ts`.
- Acceptance: jest `lib/__tests__/activation-experiment.test.ts` (each source path, stickiness across relaunch and sign-out, no
  re-roll, exposure once, pre-consent flush, assignment after the garage_first paywall); SRM simulation over 10,000 local draws.
- Verify: F-R4-5 exposure query by arm × `onboarding_variant` × platform; Maestro runner can reach both arms.
- Owner decision: create the flag (PostHog write); confirm 50/50 and launch date ≤ 2027-01-06.

**T6. Teaching sheet (test arm).** Size M. Depends on T1, T4, T5.
- Why: §3.2; board P02.2 merged spec.
- What: pure `selectGuardVariant`; copy per §5 F-R4-2 (both floors interpolated); "Got it" = T4 discard; "Keep recording";
  "Remind me on my next ride day" opens the plan chips (T7 component); events `variant`, `action:'remind_me'`; 7 locales;
  `HUD_THEME` tokens.
- Files: `app/(modals)/ride-hud.tsx`, new `features/activation/guard-variant.ts`, `i18n/locales/*.json`.
- Acceptance/verify: F-R4-2 (Maestro both arms, jest, light/dark screenshots, hygiene metric).
- Owner decision: final copy.

**T7. Plan card + scheduler (test arm).** Size M. Depends on T3, T5.
- Why: board P02.1/P03.1 — "See your first ride stats" leads to an empty list [SOURCE: checklist.store.ts:66-72].
- What: `components/home/activation-plan-card.tsx` on top of `OnboardingChecklist` for test-arm riders with no real ride; chips and
  fire times from `features/activation/plan-fire-time.ts`; in-context permission once; schedule via `lib/notifications.ts` with
  kind `activation`, `source`; deep link to Start Ride through the existing notification response handler; cancel on any core
  action; `next_ride_plan_set`, `reminder_scheduled`, `reminder_opened`, `activation_nudge_presented`
  (`getPresentedNotificationsAsync`); pre-ticked "Bike added"; 7 locales; light/dark.
- Files: new `components/home/activation-plan-card.tsx`, `features/activation/*`, `components/home/onboarding-checklist.tsx`,
  `lib/notifications.ts`, `app/_layout.tsx` (response routing), `i18n/locales/*.json`.
- Acceptance/verify: F-R4-5.
- Owner decision: first chip "Today" vs "Later today"; notification kind name.

**T8. Day-1 fallback local notification (test arm).** Size S–M. Depends on T5, T7, T9.
- What: for granted test-arm riders with no plan and no core action by end of day 0, one `activation` notification next day 18:00
  local, goal-branched copy (owner bet for `maintain_bike`), no Pro/price wording; at most one activation notification per rider in
  week 1.
- Acceptance: jest scheduling rules; device check passed. Verify: chain counts by `source:'d1_fallback'`.
- Owner decision: `maintain_bike` copy.

**T9. Android delivery check (gate for T7/T8).** Size S. Depends on T7 build.
- What: stock Pixel (Android 14+) and a Samsung on default battery settings: schedule next-day 18:00, record delivery time and
  `activation_nudge_presented`. Document in `docs/research/activation-365/experiments.md`.
- Acceptance: delivered within 1 h on both, or Android gets card + sheet without reminder copy.
- Owner decision: hardware.

**T10. PO8 repro and Discover location ask.** Size S (repro) + S (fix). Depends on T1.
- Why: §3.3.
- What: watch the recording at 03:54:55–03:55:01; repro on a fresh Android install (Spanish). If an OS/Play-services dialog: gate
  `useUserCountry` behind an explicit "Use my location" tap in "Near you" (`enabled` on the query), with a reason line.
- Files: `hooks/use-user-country.ts`, `app/(tabs)/(discover)/index.tsx`, `components/discover/near-you-section.tsx`.
- Acceptance/verify: F-R4-6.
- Owner decision: ship before the slot (both arms) or after 2026-03-31.

**T11. Ledger, dashboards, annotations.** Size S. Depends on T1–T5.
- What: write the F-R4 metric definitions, baselines and the arm query into `docs/research/activation-365/experiments.md`; save the
  F-R4-1…6 queries as PostHog insights on one "Activation #365 — first ride" dashboard broken down by `activation_fix_level`; add
  an annotation per release. All PostHog writes are owner-approved.
- Acceptance: each F-R4 metric visible per level; baselines match this file.

## 7. Risks

- **Changing control during the slot.** T3, T4 and T10 change both arms; ship them before 2026-12-15 or log the date and cut the
  readout before/after it [SOURCE: board/99-synthesis.md §4 Experiment 2 guardrail].
- **T4 deletes rides.** A real but GPS-poor ride under 50 m with < 120 s would be dropped; the no-GPS branch (≥ 120 s) is kept,
  so only sub-2-minute sub-50 m rides are affected. Rider still chooses "End without saving" explicitly.
- **Sheet accessibility.** If `@gorhom` keeps the guard content out of the a11y tree, the E2E needs a different container; a11y for
  screen-reader riders is also affected today.
- **Assignment drift.** The cold-start resume path completes onboarding with its own `setOnboardingCompleted(true)` and never
  calls `handleContinue` [SOURCE: personalizing.tsx:363-371]. Assigning only in `handleContinue` would skip those riders. T5 puts
  the assignment in one `completeOnboardingAndAssign()` that both paths call.
- **Volume.** Standstill sheets reach ~2–3 riders/week; F-R4-2 outcomes are descriptive only.
- **Replay AI misreads** (PO5, PO8): any future replay-only finding should be checked against the event stream before it becomes a
  task.

## 8. Open questions

1. Owner: T4 both arms now, or only the test arm's "Got it"?
2. Owner: FIRST_RIDE row → Start Ride with a new label, or keep the rides list?
3. ~~Does the cold-start completion path reach `handleContinue`?~~ Answered: no (`personalizing.tsx:363-371`); T5 covers it.
4. What did 01a19f85 actually show (watch 03:54:55–03:55:01)? Is "Descargar mapas" Google Maps/Play services?
5. Should auto-ended sub-floor rides (2 in 60 d) also be discarded server-side?
6. The 15 first rides with a null distance in S-R4-01: abandoned starts, or a sync gap? (Not checked here.)
