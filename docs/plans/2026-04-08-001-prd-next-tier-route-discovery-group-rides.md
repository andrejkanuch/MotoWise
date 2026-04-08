---
title: "PRD: NEXT Tier — Route Discovery & Group Rides"
type: prd
status: draft
date: 2026-04-08
phases: 3
features: 9
timeline: Months 2–5
prerequisite: NOW tier shipped
---

# NEXT Tier — Route Discovery & Group Rides

9 Features · 3 Phases (reordered for solo-dev efficiency)

## Overview

### Problem Statement

After the NOW tier ships, MotoVault has a ride feed, shareable ride cards, AI summaries, and a social graph. But there is nowhere to discover new roads, no way to browse what other riders have ridden, and no mechanism for riders to plan and join group rides. The ride data flows through the feed but is not organised, searchable, or actionable.

The cost of not solving this: riders use Rever or AllTrails for route discovery and WhatsApp for group ride coordination. Every time a user leaves MotoVault for a critical workflow, retention weakens.

### Goals

1. Launch a browseable, filterable route discovery page with >=100 routes at launch (seeded + community-contributed)
2. Enable AI-powered personalised route recommendations that differentiate MotoVault from competitors
3. Ship group ride creation and join — the first structured event-planning feature in the motorcycle app market
4. Validate the first premium gate (offline route saving) and collect >=200 premium waitlist sign-ups before launching the subscription
5. Increase weekly active user retention (W1->W4) by >=10 percentage points from the NOW tier baseline

### Non-Goals

- Turn-by-turn navigation — route discovery outputs GPX files and deep links to Scenic/Calimoto
- Multi-day collaborative itinerary planning — too complex; LATER tier
- Live group location sharing during rides — requires real-time infrastructure; LATER tier
- Premium subscription launch — this tier validates the hooks but does not launch a paywall
- Challenges, leaderboards, and gamification — LATER tier

---

## Phases (Reordered)

| Phase | Timeline | Features | Gate to next |
|-------|----------|----------|--------------|
| **A** | Month 2 | Comments on Ride Cards · Route Discovery Page · Route Filters · GPX Export | >=100 routes browseable · >=30 GPX downloads |
| **B** | Months 3–4 | Community Reviews · Save Routes + Premium Waitlist | >=50 route reviews · >=200 premium waitlist |
| **C** | Months 4–5 | AI Route Recommendations (simple v1) · Group Ride Creation · Join/RSVP | >=10 group rides created · >=3 with confirmed riders |

### Rationale for Reorder

1. **Comments first** — cheapest feature, deepens existing feed engagement, no new infrastructure needed
2. **Route Discovery + Filters + GPX together** — the anchor feature bundle; filters and export make discovery actionable
3. **Reviews after Discovery exists** — reviews need routes to review
4. **Save + Waitlist is simple** — bookmark + modal, validates premium demand
5. **AI Recommendations simplified** — start with "top rated near you" query, upgrade to Claude-powered when route volume justifies it
6. **Group Rides last and simplified** — needs community density; v1 drops organiser approval in favour of open join

---

## Phase A · Month 2

### Feature 1: Comments on Ride Cards

Text comments on any public ride card in the feed or on the Discover page. One level of threading (replies nested under parent). This is the second social interaction layer after Kudos.

#### User Stories

| Persona | Story | Priority |
|---------|-------|----------|
| Rider | Leave a comment on a friend's ride to ask about the route or congratulate them | P0 |
| Ride owner | See comments on my ride and reply to engage with the community | P0 |
| Ride owner | Receive a notification when someone comments on my ride | P0 |
| Reader | See threaded replies (one level) so conversations are easy to follow | P1 |

#### Requirements

| P | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| P0 | Comment input at the bottom of every public ride card detail page | Input visible without scrolling; placeholder "Add a comment..."; tap focuses and opens keyboard |
| P0 | Comments display: username, avatar, timestamp, text — sorted oldest first | Load <2s; username tappable to profile |
| P0 | Text only, 500 char max | Character count shown; submit disabled when empty; optimistic UI |
| P0 | Ride owner notification for each new comment | Within 60s; tapping opens ride scrolled to comment; grouped if multiple |
| P1 | Reply to a comment (one level of threading) | Reply indented under parent; no deeper nesting |
| P1 | Comment moderation: flag button; 3 flags hides comment pending review | Flag icon visible; flagged accessible in admin dashboard |

---

### Feature 2: Route Discovery Page

A dedicated "Discover" tab in bottom navigation showing a full-screen map with route pins and a scrollable list below. The primary surface for organic content discovery — works whether or not the user follows anyone.

**Seeding strategy:** >=100 routes at launch. Sources: (a) opt-in community rides from NOW tier feed, (b) 30–50 manually curated "MotoVault Picks" imported via GPX.

#### User Stories

| Persona | Story | Priority |
|---------|-------|----------|
| Explorer | Browse motorcycle routes near me without asking in a forum | P0 |
| Explorer | See routes on a map and filter by distance from my location | P0 |
| Explorer | View route detail: map, distance, elevation, surface type, AI summary, rating | P0 |
| Contributor | Opt-in to share a logged ride on Discover | P0 |
| Contributor | Understand that sharing to Discover is separate from sharing in feed | P0 |
| New user | See interesting routes near me even with no followers | P0 |

#### Requirements

| P | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| P0 | Discover tab in bottom navigation | Tab visible; tapping always opens Discover; badge for new routes since last visit |
| P0 | Full-screen Mapbox map with clustered route pins | Load <3s; pins cluster at low zoom; individual at city zoom; smooth pan/zoom |
| P0 | Scrollable route list below map: name, distance, elevation, rating, thumbnail, contributor | Sorted by distance from user by default; tappable to route detail |
| P0 | Route detail page: full interactive map, distance, duration, elevation chart, surface type, AI summary, contributor link, reviews, actions (Save, Export GPX, Share) | All elements render; elevation chart +-5% accuracy; polyline on Mapbox |
| P0 | Opt-in flow after logging a ride: "Share this route on Discover?" toggle (default off) | Prompt after ride completion; toggle persists; revocable from ride settings |
| P0 | MotoVault Picks: curated routes badged with "MotoVault Pick" + editorial description | Badge distinct; editorial on all Picks; Picks first in default sort when no location |
| P0 | Route privacy: first and last 500m cropped on Discover | Endpoints differ by >=500m from original ride |
| P1 | AI route name generation from GPS + reverse geocoding | Generated for >=90% of routes; "Untitled Route" fallback; contributor can override |
| P1 | "Near me" button re-centres to user location, shows routes within 100km | Location permission on first tap; radius adjustable |
| P2 | Heatmap overlay of most-ridden segments (toggleable) | Load <3s with 1000+ routes |

#### Open Questions

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | AI route name generation approach | (a) Mapbox reverse-geocode midpoint + waypoints, feed to Claude with ride summary. Recommend (a) for cost/consistency. |
| 2 | Route deduplication | Match routes with >=80% GPS overlap within 50m buffer. Cluster as "Ridden by X riders" with merged reviews. |
| 3 | Default viewport when location denied | Centre on user's city from profile, or prominent riding region if blank |
| 4 | MotoVault Picks regions at launch | Top 5 regions by user count |

---

### Feature 3: Route Filters

Filter panel on Discover that narrows routes by motorcycle-specific dimensions. "Show me curvy roads under 2 hours from Austin suitable for a sport bike."

#### User Stories

| Persona | Story | Priority |
|---------|-------|----------|
| Explorer | Filter by distance from my location | P0 |
| Sport rider | Filter by surface type (paved only) | P0 |
| Weekend warrior | Filter by route length for a 2-hour ride vs full day | P0 |
| Explorer | Filter by community rating | P1 |
| Explorer | Filter by bike type (routes ridden by same category) | P1 |

#### Requirements

| P | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| P0 | Filter panel via "Filter" button; opens as bottom sheet | Opens/closes smoothly; all filters visible; "Apply" and "Clear all" buttons |
| P0 | Distance from me: slider 10km–500km (default 100km) | Map updates real-time; routes outside radius hidden from map + list |
| P0 | Route length: chips <50km, 50–100km, 100–200km, 200–500km, 500km+ | Multi-select (OR logic); map + list update on selection |
| P0 | Surface type: chips Paved, Mixed, Off-road | Single or multi-select; unknown labelled "Unknown" |
| P0 | Elevation gain: chips Flat (<200m), Moderate (200–800m), Mountainous (800m+) | Calculated from GPS; correct categorisation |
| P1 | Community rating toggle: "Highly rated only" (>=4.0, >=3 reviews) | Filters list + map; unrated hidden; result count updates real-time |
| P1 | Bike type: chips from user's registered bike category | Shows routes ridden by >=1 rider with same category |
| P1 | Active filter count badge: "Filter (3)" | Updates immediately; clears when filters cleared |
| P2 | Curviness slider: "Straight" to "Extremely Twisty" (curvature index) | Calculated at route ingestion; slider filters correctly |

---

### Feature 4: GPX Export

Any Discover route or own logged ride exportable as GPX 1.1. Integration-over-competition — feed Scenic, Calimoto, Kurviger, Garmin.

#### Requirements

| P | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| P0 | "Export GPX" button on route detail + own ride detail | Tapping triggers GPX download via system share sheet |
| P0 | Valid GPX 1.1 XML: `<trk>` with `<trkpt>` (lat, lon, ele, time) | Validated against schema; imports into Scenic, Calimoto, Garmin Connect |
| P0 | File name: `[route-name]-motovault.gpx` | Sanitised name; no special chars |
| P1 | Deep link: tapping GPX on iOS opens Scenic or Calimoto if installed | Fallback to Files app |
| P1 | Waypoints for notable points (start, end, highest elevation, named locations) | Visible when imported; meaningfully labelled |
| P2 | Batch export: select multiple routes, download ZIP | ZIP contains named GPX files |

---

## Phase B · Months 3–4

### Feature 5: Community Route Reviews & Condition Reports

Rating + text review + condition tags from riders who completed a route. The trust layer that turns GPS tracks into verified, community-rated routes.

#### User Stories

| Persona | Story | Priority |
|---------|-------|----------|
| Reviewer | Leave a rating and review after completing a Discover route | P0 |
| Reviewer | Tag current road conditions (good surface, gravel hazard, construction, scenic) | P0 |
| Explorer | Read reviews sorted by recency for current conditions | P0 |
| Explorer | See aggregate rating on route card (e.g. 4.3/5 from 12 riders) | P0 |
| Explorer | See condition summary at top of route detail | P1 |

#### Requirements

| P | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| P0 | "Leave a review" button — only enabled for riders with >=60% GPS overlap | Disabled with "Ride this route first" for non-eligible; overlap server-side |
| P0 | Review form: 1–5 stars (required), text (optional, 500 char), condition tags (optional, multi-select) | Validates star before submit; text truncated at 500 |
| P0 | Condition tags: Good Surface, Gravel Hazard, Construction, Low Traffic, Heavy Traffic, Scenic, Technical Curves | Tappable chips; multi-select; stored with timestamp |
| P0 | Aggregate rating on route card + detail: X.X/5 (N reviews) | Weighted average; updates within 60s; shown when >=1 review |
| P0 | Reviews sorted most recent first: username, date, stars, text, tags, bike | Paginated (10/page); reviewer profile tappable |
| P1 | Condition summary bar: "4 riders reported Good Surface in last 30 days" | Auto-generated; hidden when <3 condition reports |
| P1 | Review moderation: flag button; 3 flags hides pending review | Flagged accessible in admin dashboard |
| P2 | AI route quality score (rating + recency + condition sentiment + completion rate) | Badge on route card; refreshed nightly |

---

### Feature 6: Save Routes + Premium Waitlist

Bookmark routes to a personal "Saved" collection. Offline download gated behind a premium waitlist modal to validate demand.

#### Requirements

| P | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| P0 | Save button (bookmark) on route card + detail — toggles saved/unsaved | Optimistic UI; saved routes in "Saved" section in profile tab |
| P0 | Saved Routes page: list sorted by date saved (newest first) | Load <2s; tappable to detail; swipe-to-unsave |
| P0 | Offline download button shows premium gate modal: "Coming soon with MotoVault Premium. Join the waitlist." | Modal on tap; opt-in toggle; "Join waitlist" records to waitlist table |
| P0 | Waitlist tracking: user_id, route_id, signed_up_at | Exportable; total count in admin dashboard |
| P1 | Badge on saved routes when new reviews added since save | Clears on opening route detail |

---

## Phase C · Months 4–5

### Feature 7: AI Route Recommendations (Simple v1)

**Scope cut from PRD v1:** No nightly batch job, no embeddings, no complex recommendation engine. v1 is a smart query: top-rated routes near the user, filtered by bike category, that they haven't ridden.

Upgrade path to Claude-powered recommendations when route count exceeds 500.

#### Requirements

| P | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| P0 | "Recommended for you" section at top of Discover: 3–5 route cards | Horizontal scroll; present for all users including new |
| P0 | v1 algorithm: top-rated routes within 200km matching user's bike category, excluding already-ridden | Returns relevant results; verified with test accounts |
| P0 | Cold-start: users with <3 rides see top-rated routes near their city | Cold-start recommendations present and relevant |
| P1 | "Not interested" button removes card and excludes from future results | Tapping removes with animation; exclusion persists |
| P2 | Upgrade to Claude-powered: user profile + candidate routes as context, explanation line | Deferred until >=500 routes. Explanation: "Similar to [Route] — curvy, 1200m elevation" |

---

### Feature 8: Group Ride Creation (Simplified v1)

**Scope cut from PRD v1:** No organiser approval flow. Open join (first-come, first-served up to max riders). No group messaging. No recurring rides. No post-ride review of organiser.

This dramatically reduces the state machine and notification complexity. Add approval flow later if organisers request it.

#### User Stories

| Persona | Story | Priority |
|---------|-------|----------|
| Organiser | Create a group ride event with title, date, meeting point, route, description, difficulty, max riders | P0 |
| Organiser | Attach a Discover route or describe in text | P0 |
| Participant | Browse upcoming group rides near me | P0 |
| Participant | See organiser profile and ride history for trust | P0 |
| Participant | Join a group ride (open join, first-come first-served) | P0 |

#### Requirements

| P | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| P0 | "Create a Group Ride" button in Discover + profile tab | Opens full-screen form (formSheet on iOS) |
| P0 | Form: Title (100 char), Date/Time (future only), Meeting Point (map pin or address), Route (optional, attach from Discover or text), Description (1000 char), Difficulty (Easy/Moderate/Challenging), Max Riders (2–50, default 10) | Validates required fields; date picker blocks past; Mapbox geocoding |
| P0 | Shareable URL: motovault.app/ride/group/[id] — web page with details + "Join" CTA | Resolves; OG meta tags correct; non-users see download CTA |
| P0 | States: Published -> Full (max reached) -> Completed (date passed) -> Cancelled | Server-side enforcement; UI reflects state; organiser can cancel anytime |
| P0 | "Group Rides" section on Discover + organiser's followers' feed + searchable by location | Visible within 60s of publish; hidden after cancel/complete |
| P0 | Organiser profile link on every group ride card | Profile shows ride history + follower count |
| P0 | **Open join**: "Join" button, first-come first-served, count shows "7/10 riders" | Button disabled when full; "Full" badge; join is instant (no approval) |
| P1 | Edit after publish (date, description, max riders increase) — participants notified | Edit button for organiser only; notification to confirmed |
| P1 | Post-ride: prompt organiser to add summary + up to 5 photos | Prompt 24h after event; summary visible on group ride page |

---

### Feature 9: Join a Group Ride

Simplified from PRD v1 — no approval flow, no group messaging, no post-ride organiser rating.

#### Requirements

| P | Requirement | Acceptance Criteria |
|---|-------------|---------------------|
| P0 | "Join" button on published, not-full group rides | Tapping instantly adds user; button changes to "Joined"; count updates |
| P0 | Participant list visible to all: username, bike, profile link | Updates in real-time on join |
| P0 | Participant can leave (withdraw) anytime before ride date | "Leave" button; organiser notified; spot opens up |
| P0 | Organiser notified when someone joins or leaves | Within 60s |
| P1 | Comments on group ride page for pre-ride coordination | Thread on detail page; visible to all users |

---

## Engineering Notes

### New Database Tables

```
routes — id, contributor_user_id, name, description, polyline (PostGIS geography),
         distance_m, elevation_gain_m, surface_type, curvature_index,
         is_motovault_pick, editorial_description, created_at,
         status (published/hidden)

route_reviews — id, route_id, user_id, rating (1–5), text,
               condition_tags (jsonb array), bike_id, created_at

route_saves — route_id, user_id, saved_at  [composite PK]

premium_waitlist — id, user_id, feature (text), signed_up_at

group_rides — id, organiser_user_id, title, description, date_time,
             meeting_point (PostGIS point), route_id (nullable FK),
             difficulty, max_riders, status (published/full/completed/cancelled),
             created_at

group_ride_participants — group_ride_id, user_id, joined_at

comments — id, parent_comment_id (nullable), ride_id (nullable),
          route_id (nullable), group_ride_id (nullable),
          user_id, text, created_at, flagged_count
```

**Removed from original PRD:** `route_recommendations` table (v1 uses query, not precomputed), `group_ride_messages` table (use comments instead), participant `status` column (no approval flow — presence = joined).

### New GraphQL Operations

```
# Comments (Phase A)
CreateComment(targetId, targetType, text, parentCommentId)
FlagComment(commentId)
GetComments(targetId, targetType, cursor)

# Route Discovery (Phase A)
GetDiscoverRoutes(bounds, filters, cursor)
GetRouteDetail(routeId)
ShareRideToDiscover(rideId)
ExportRouteGPX(routeId)

# Reviews (Phase B)
CreateRouteReview(routeId, rating, text, conditionTags)

# Save + Waitlist (Phase B)
SaveRoute(routeId) / UnsaveRoute(routeId)
JoinPremiumWaitlist(feature)

# Group Rides (Phase C)
CreateGroupRide(...) / UpdateGroupRide(...) / CancelGroupRide(groupRideId)
JoinGroupRide(groupRideId) / LeaveGroupRide(groupRideId)
GetGroupRides(bounds, dateRange, cursor)
```

### RLS Policies

- **routes**: readable by anyone (published); writable by contributor or admin
- **route_reviews**: readable by anyone; writable by authenticated; one per (route_id, user_id)
- **route_saves**: readable/writable by owner only
- **premium_waitlist**: writable by authenticated; readable by service role
- **group_rides**: readable by anyone (published); writable by organiser only
- **group_ride_participants**: readable by anyone; writable by participant (join/leave)
- **comments**: readable by anyone; writable by authenticated; flagged_count updatable by authenticated

### Infrastructure Dependencies

- **PostGIS** extension on Supabase (spatial queries for routes + meeting points)
- **Mapbox Geocoding API** for meeting point resolution + route name generation
- Admin dashboard (Next.js web) needs: flagged content queue, MotoVault Picks import, waitlist export

### Blocking Questions

| # | Question | Recommendation | Phase |
|---|----------|----------------|-------|
| 1 | Route deduplication algorithm | >=80% GPS overlap within 50m buffer; cluster as "Ridden by X riders" | A |
| 2 | AI route name generation | Mapbox reverse-geocode + Claude prompt (consistent with existing AI pipeline) | A |
| 3 | Route schema: PostGIS from day one? | **Yes** — use geography columns; avoids painful migration later | A |
| 4 | Group ride moderation gate | Any public-profile user with >=3 logged rides can create | C |
| 5 | Premium waitlist GDPR consent | Require explicit marketing consent toggle in waitlist modal | B |
| 6 | MotoVault Picks GPX sourcing | Verify no copyright/ToS issues with importing from public sources | A |

---

## Success Metrics

| Metric | 30-day target | 90-day target |
|--------|---------------|---------------|
| Routes on Discover | >=100 | >=500 |
| Weekly Discover visits per active user | >=1.5x | >=3x |
| Filter usage rate | >=25% | >=40% |
| GPX exports/week | >=30 | >=150 |
| Routes with >=1 review | >=30 | >=100 |
| Premium waitlist sign-ups | >=100 | >=300 |
| Group rides created | >=10 | >=50 |
| Group rides with >=2 participants | >=3 | >=20 |
| Comments per public ride (avg) | >=0.5 | >=1.2 |
| W1->W4 retention | baseline +5pp | baseline +10pp |

---

*This spec covers NEXT tier only. LATER tier (Multi-day Trips, Live Location, Challenges, Premium Subscription) will be specced after NEXT success metrics are reviewed.*
