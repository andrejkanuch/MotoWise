---
title: "feat: NEXT Tier Phase A — Comments, Route Discovery, Filters, GPX Export"
type: feat
status: draft
date: 2026-04-08
prd: 2026-04-08-001-prd-next-tier-route-discovery-group-rides.md
---

# NEXT Tier Phase A — Implementation Plan

## Scope

4 features from the NEXT tier PRD, ordered by dependency:

1. **Comments on Ride Cards** — new `comments` table, API module, mobile UI
2. **Route Discovery Page** — new `routes` table (PostGIS), Discover tab, Mapbox map
3. **Route Filters** — filter bottom sheet on Discover page
4. **GPX Export** — server-side GPX generation, share sheet

---

## Step 1: Comments on Ride Cards

The cheapest win — adds social depth to existing feed with no new infrastructure beyond one table.

### 1.1 Database Migration (`00063_comments.sql`)

```sql
-- New table: comments (polymorphic via nullable FKs)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
  route_id UUID,  -- FK added in routes migration
  group_ride_id UUID,  -- FK added in group_rides migration
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  flagged_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Exactly one target must be set
  CONSTRAINT comments_single_target CHECK (
    (ride_id IS NOT NULL)::int +
    (route_id IS NOT NULL)::int +
    (group_ride_id IS NOT NULL)::int = 1
  ),
  -- Only one level of nesting
  CONSTRAINT comments_max_one_level CHECK (
    parent_comment_id IS NULL OR
    NOT EXISTS (SELECT 1 FROM comments c WHERE c.id = parent_comment_id AND c.parent_comment_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_comments_ride ON comments(ride_id, created_at) WHERE ride_id IS NOT NULL;
CREATE INDEX idx_comments_parent ON comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_comments_user ON comments(user_id);

-- RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments on public rides
CREATE POLICY comments_select ON comments FOR SELECT USING (true);

-- Authenticated users can insert their own comments
CREATE POLICY comments_insert ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY comments_delete ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- Any authenticated user can increment flagged_count
CREATE POLICY comments_flag ON comments FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (flagged_count = (SELECT flagged_count FROM comments WHERE id = comments.id) + 1);

-- Add comment_count to rides for quick display
ALTER TABLE rides ADD COLUMN comment_count INT NOT NULL DEFAULT 0;

-- Trigger to maintain comment_count on rides
CREATE OR REPLACE FUNCTION update_ride_comment_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.ride_id IS NOT NULL THEN
    UPDATE rides SET comment_count = comment_count + 1 WHERE id = NEW.ride_id;
  ELSIF TG_OP = 'DELETE' AND OLD.ride_id IS NOT NULL THEN
    UPDATE rides SET comment_count = comment_count - 1 WHERE id = OLD.ride_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_ride_comment_count
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_ride_comment_count();
```

**Note:** The `comments_max_one_level` CHECK constraint uses a subquery which won't work as a CHECK constraint in Postgres. Instead, enforce one-level nesting in the API service layer (reject if parent already has a parent). Remove the CHECK and add a comment explaining this is enforced application-side.

### 1.2 Zod Schema (`packages/types/src/validators/comment.ts`)

```typescript
import { z } from 'zod';

export const CreateCommentInputSchema = z.object({
  rideId: z.string().uuid().optional(),
  routeId: z.string().uuid().optional(),
  groupRideId: z.string().uuid().optional(),
  parentCommentId: z.string().uuid().optional(),
  text: z.string().min(1).max(500),
}).refine(
  (d) => [d.rideId, d.routeId, d.groupRideId].filter(Boolean).length === 1,
  { message: 'Exactly one target (rideId, routeId, or groupRideId) must be provided' },
);

export type CreateCommentInput = z.infer<typeof CreateCommentInputSchema>;

export const FlagCommentInputSchema = z.object({
  commentId: z.string().uuid(),
});

export type FlagCommentInput = z.infer<typeof FlagCommentInputSchema>;
```

Re-export from `validators/index.ts`.

### 1.3 NestJS Module (`apps/api/src/modules/comments/`)

**Files to create:**
- `comments.module.ts` — imports SupabaseModule
- `comments.resolver.ts` — GraphQL resolver
- `comments.service.ts` — DB operations
- `models/comment.model.ts` — GraphQL object type
- `dto/create-comment.input.ts` — NestJS input type
- `dto/flag-comment.input.ts` — NestJS input type

**GraphQL Operations:**

```graphql
# Query
getComments(rideId: ID, routeId: ID, groupRideId: ID, first: Int = 20, after: String): CommentConnection

# Mutations
createComment(input: CreateCommentInput!): Comment
deleteComment(commentId: ID!): Boolean
flagComment(commentId: ID!): Boolean
```

**Comment model fields:**
`id, text, createdAt, flaggedCount, parentCommentId, user { id, displayName, publicUsername, avatarUrl }, replies (nested comments, one level)`

**Service logic:**
- `createComment`: Validate single target. If `parentCommentId` set, verify parent exists and has no parent itself (one-level enforcement). Insert via `SUPABASE_USER`. Return created comment.
- `getComments`: Fetch top-level comments (where `parent_comment_id IS NULL`) for the target, ordered by `created_at ASC`. For each, fetch replies. Cursor-paginated.
- `deleteComment`: Owner only. Cascades to replies via FK.
- `flagComment`: Increment `flagged_count`. If reaches 3, the comment is still in DB but frontend hides it.

**Throttle:** Apply `THROTTLE_PRESETS.DEFAULT` to `createComment`.

### 1.4 Mobile GraphQL Operations

**New files:**
- `apps/mobile/src/graphql/queries/get-comments.graphql`
- `apps/mobile/src/graphql/mutations/create-comment.graphql`
- `apps/mobile/src/graphql/mutations/delete-comment.graphql`
- `apps/mobile/src/graphql/mutations/flag-comment.graphql`

Run `pnpm generate` after creating these.

### 1.5 Mobile UI Components

**New files:**
- `apps/mobile/src/components/comments/comment-list.tsx` — fetches and renders comments for a target
- `apps/mobile/src/components/comments/comment-item.tsx` — single comment with reply button, flag button
- `apps/mobile/src/components/comments/comment-input.tsx` — text input at bottom with send button

**Integration points:**
- Add `CommentList` + `CommentInput` to `apps/mobile/src/app/(modals)/ride-detail.tsx` inside the `BottomSheetScrollView`, below the stats/charts section
- Add `commentCount` to `FeedRideCard` — show a `MessageCircle` icon + count next to the kudos button
- Update `ride-feed.graphql` to include `commentCount` field

**UI details:**
- Comment input: fixed at bottom of bottom sheet, `TextInput` with placeholder "Add a comment...", send button (`Send` from lucide)
- Comment item: avatar (32px circle) + username + timestamp + text. Reply button shows inline `TextInput` below.
- Replies: indented 40px from left, no further nesting
- Flag: long-press → action sheet with "Report comment" option
- Comments with `flaggedCount >= 3` hidden from list
- Optimistic UI: comment appears immediately on send, rolls back on error
- Animations: `FadeInUp.delay(index * 30)` for comment list items

### 1.6 Notifications

Add to existing notification system (if one exists) or create a simple in-app notification:
- When someone comments on your ride, create a notification entry
- This can be deferred to a follow-up if no notification infrastructure exists yet

---

## Step 2: Route Discovery Page

The anchor feature. Requires PostGIS, a new Discover tab, and Mapbox map integration.

### 2.1 Enable PostGIS on Supabase

```sql
-- Run via Supabase dashboard or migration
CREATE EXTENSION IF NOT EXISTS postgis;
```

This should be the first line of the routes migration.

### 2.2 Database Migration (`00064_routes.sql`)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
  name TEXT,  -- AI-generated or user-set
  description TEXT,
  polyline TEXT NOT NULL,  -- Google encoded polyline (for rendering)
  geography GEOGRAPHY(LINESTRING, 4326),  -- PostGIS for spatial queries
  start_point GEOGRAPHY(POINT, 4326),  -- Cropped start (privacy: +500m from actual)
  end_point GEOGRAPHY(POINT, 4326),  -- Cropped end (privacy: -500m from actual)
  distance_m FLOAT NOT NULL,
  elevation_gain_m FLOAT,
  surface_type TEXT CHECK (surface_type IN ('paved', 'mixed', 'off-road', 'unknown')) DEFAULT 'unknown',
  curvature_index FLOAT,  -- total heading change / distance
  is_motovault_pick BOOLEAN NOT NULL DEFAULT false,
  editorial_description TEXT,  -- Only for MotoVault Picks
  rating_avg FLOAT,  -- Denormalized from route_reviews
  rating_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spatial index for "routes near me" queries
CREATE INDEX idx_routes_geography ON routes USING GIST (geography);
CREATE INDEX idx_routes_start_point ON routes USING GIST (start_point);
CREATE INDEX idx_routes_status ON routes(status) WHERE status = 'published';
CREATE INDEX idx_routes_contributor ON routes(contributor_user_id);
CREATE INDEX idx_routes_rating ON routes(rating_avg DESC NULLS LAST) WHERE status = 'published';

-- Add FK from comments to routes
ALTER TABLE comments ADD CONSTRAINT fk_comments_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY routes_select ON routes FOR SELECT USING (status = 'published');
CREATE POLICY routes_insert ON routes FOR INSERT WITH CHECK (auth.uid() = contributor_user_id);
CREATE POLICY routes_update ON routes FOR UPDATE USING (auth.uid() = contributor_user_id);
```

### 2.3 Zod Schema (`packages/types/src/validators/route.ts`)

```typescript
import { z } from 'zod';

export const ShareRideToDiscoverInputSchema = z.object({
  rideId: z.string().uuid(),
  name: z.string().max(200).optional(),
  surfaceType: z.enum(['paved', 'mixed', 'off-road', 'unknown']).optional(),
});

export type ShareRideToDiscoverInput = z.infer<typeof ShareRideToDiscoverInputSchema>;

export const DiscoverRoutesFilterSchema = z.object({
  bounds: z.object({
    ne: z.object({ lat: z.number(), lng: z.number() }),
    sw: z.object({ lat: z.number(), lng: z.number() }),
  }).optional(),
  nearLat: z.number().optional(),
  nearLng: z.number().optional(),
  radiusKm: z.number().min(10).max(500).optional(),
  lengthRanges: z.array(z.enum(['under50', '50to100', '100to200', '200to500', 'over500'])).optional(),
  surfaceTypes: z.array(z.enum(['paved', 'mixed', 'off-road'])).optional(),
  elevationRanges: z.array(z.enum(['flat', 'moderate', 'mountainous'])).optional(),
  highlyRatedOnly: z.boolean().optional(),
  bikeCategory: z.string().optional(),
});

export type DiscoverRoutesFilter = z.infer<typeof DiscoverRoutesFilterSchema>;
```

### 2.4 NestJS Module (`apps/api/src/modules/routes/`)

**Files to create:**
- `routes.module.ts`
- `routes.resolver.ts`
- `routes.service.ts`
- `models/route.model.ts`
- `models/route-connection.model.ts`
- `dto/share-ride-to-discover.input.ts`
- `dto/discover-routes-filter.input.ts`

**GraphQL Operations:**

```graphql
# Queries
discoverRoutes(filter: DiscoverRoutesFilterInput, first: Int = 20, after: String): RouteConnection
routeDetail(routeId: ID!): Route  # @Public — anyone can view

# Mutations
shareRideToDiscover(input: ShareRideToDiscoverInput!): Route
unshareRoute(routeId: ID!): Boolean
```

**Route model fields:**
`id, name, description, polyline, distanceM, elevationGainM, surfaceType, curvatureIndex, isMotovaultPick, editorialDescription, ratingAvg, ratingCount, commentCount, status, createdAt, contributor { id, displayName, publicUsername, avatarUrl }`

**Service logic:**

- `shareRideToDiscover(rideId)`:
  1. Fetch the ride + waypoints (owner must match current user)
  2. Verify ride is completed and has route_polyline
  3. Crop first/last 500m of waypoints for privacy
  4. Build PostGIS LINESTRING from cropped waypoints
  5. Calculate curvature_index (sum of heading changes / total distance)
  6. Insert into `routes` table with geography column
  7. Optionally trigger AI route name generation (async, Claude + Mapbox geocoding)
  8. Return created route

- `discoverRoutes(filter)`:
  1. Base query: `SELECT * FROM routes WHERE status = 'published'`
  2. If `nearLat/nearLng + radiusKm`: `ST_DWithin(geography, ST_Point(lng, lat)::geography, radius_m)`
  3. If `bounds`: `ST_Intersects(geography, ST_MakeEnvelope(sw.lng, sw.lat, ne.lng, ne.lat, 4326)::geography)`
  4. Apply length/surface/elevation/rating filters
  5. If `bikeCategory`: join through `source_ride_id -> rides -> motorcycles` to check category
  6. Order by `ST_Distance` from user location (if provided), else by `rating_avg DESC NULLS LAST`
  7. Cursor-paginate

- `routeDetail(routeId)`: Simple fetch with contributor join. Public endpoint.

**AI Route Name Generation (async):**
- After route creation, emit an event (or call inline)
- Reverse-geocode midpoint + 2-3 notable waypoints via Mapbox Geocoding API
- Feed location names + ride stats to Claude: "Generate a descriptive route name like 'Santa Cruz Mountain Loop via Highway 9'"
- Update `routes.name` with result
- Fallback: "Untitled Route"

### 2.5 Mobile: Add Discover Tab

**Modify:** `apps/mobile/src/app/(tabs)/_layout.tsx`
- Add `(discover)` to `TAB_CONFIG` between `(home)` and `(diagnose)`:
  ```typescript
  { name: '(discover)', icon: Compass, labelKey: 'tabs.discover' },
  ```
- This gives 5 visible tabs: Home, Discover, [Ride FAB], Diagnose, Garage, Profile
- Wait — that's 5 tabs + FAB = crowded. Consider replacing the hidden `(learn)` tab slot or restructuring.

**Decision needed:** The current layout has 4 tabs + a center FAB. Adding Discover makes 5 tabs + FAB = 6 items in the bar. Options:
- **(a)** Move Profile to a header avatar (like Instagram) and use its slot for Discover → 4 tabs + FAB
- **(b)** Move Diagnose into Garage as a sub-screen → 4 tabs + FAB
- **(c)** Keep 5 tabs + FAB, shrink icon/label size
- **Recommend (b)**: Diagnose is used less frequently and fits conceptually inside Garage (it's bike-specific). This keeps the island tab bar at 4 tabs + FAB.

**New directory:** `apps/mobile/src/app/(tabs)/(discover)/`
- `_layout.tsx` — Stack wrapper
- `index.tsx` — DiscoverScreen

### 2.6 Mobile: Discover Screen

**New files:**
- `apps/mobile/src/app/(tabs)/(discover)/index.tsx` — DiscoverScreen (orchestrator)
- `apps/mobile/src/components/discover/discover-map.tsx` — Mapbox map with clustered route pins
- `apps/mobile/src/components/discover/route-card.tsx` — Route card for the scrollable list
- `apps/mobile/src/components/discover/route-list.tsx` — FlatList of route cards below map

**Screen structure:**
```
[Mapbox Map — flex: 1, fills top portion]
  [Clustered pins for routes]
  [Near Me button — floating, bottom-right of map]
[Draggable bottom sheet — @gorhom/bottom-sheet]
  [Search/Filter bar at top]
  [Route list — FlatList, infinite scroll]
```

**Map implementation:**
- `MapboxGL.ShapeSource` with GeoJSON FeatureCollection of route start_points
- `MapboxGL.SymbolLayer` for pins (or `CircleLayer` for dots)
- Clustering via `MapboxGL.ShapeSource` `cluster` prop
- On pin tap: scroll list to that route card or open route detail
- On map pan/zoom: refetch routes for new bounds (`discoverRoutes(bounds)`)
- Debounce map movement → refetch (300ms debounce)

**Route card:**
- Thumbnail: static Mapbox image of route polyline (or first frame from ride)
- Name, distance, elevation, surface type badge, rating stars, contributor username
- MotoVault Pick badge (if applicable)
- Tap → navigate to route detail modal

### 2.7 Mobile: Route Detail Modal

**New file:** `apps/mobile/src/app/(modals)/route-detail.tsx`

Similar structure to `ride-detail.tsx`:
- Full-screen Mapbox map with route polyline
- Bottom sheet with: name, contributor link, distance, duration estimate, elevation chart, surface type, AI summary / editorial description (for Picks), rating, action buttons (Save, Export GPX, Share), CommentList + CommentInput (reuse from Step 1)
- Reviews section (added in Phase B)

**Register in:** `apps/mobile/src/app/(modals)/_layout.tsx` as `fullScreenModal`

### 2.8 Mobile GraphQL Operations

**New files:**
- `queries/discover-routes.graphql`
- `queries/route-detail.graphql`
- `mutations/share-ride-to-discover.graphql`
- `mutations/unshare-route.graphql`

### 2.9 Opt-In Flow

**Modify:** `apps/mobile/src/app/(modals)/ride-summary.tsx` (the post-ride summary screen)
- After ride completion, below the existing content, add a section:
  ```
  [Compass icon] Share this route on Discover?
  [Toggle switch — default OFF]
  [Helper text: "Other riders will be able to see and ride this route"]
  ```
- On toggle ON: call `shareRideToDiscover` mutation
- Show success toast with route link

### 2.10 i18n Keys

Add to all message files (`apps/web/messages/*.json` and mobile i18n):
- `tabs.discover`
- `discover.title`, `discover.nearMe`, `discover.filter`, `discover.noRoutes`
- `discover.motovaultPick`, `discover.shareToDiscover`, `discover.shareHelper`
- `comments.addComment`, `comments.reply`, `comments.report`, `comments.deleted`
- `route.distance`, `route.elevation`, `route.surface`, `route.rating`, `route.export`

---

## Step 3: Route Filters

### 3.1 Mobile: Filter Bottom Sheet

**New file:** `apps/mobile/src/components/discover/route-filters.tsx`

**Implementation:**
- Opens as a bottom sheet from the "Filter" button on Discover
- Sections:
  - **Distance from me:** Slider component (10–500km, default 100km). Use `@react-native-community/slider` or build with reanimated `PanGestureHandler`
  - **Route length:** Chip row, multi-select. Chips: <50km, 50-100, 100-200, 200-500, 500+
  - **Surface type:** Chip row, multi-select. Chips: Paved, Mixed, Off-road
  - **Elevation:** Chip row, multi-select. Chips: Flat, Moderate, Mountainous
  - **Highly rated only:** Toggle switch (>=4.0, >=3 reviews)
  - **Bike type:** Chip row from user's registered bike categories
- "Apply" button at bottom closes sheet and triggers refetch with filter params
- "Clear all" resets all filters
- Filter state stored in Zustand (persists across tab switches)

**New files:**
- `apps/mobile/src/components/discover/filter-chips.tsx` — reusable chip selector
- `apps/mobile/src/stores/discover.store.ts` — Zustand store for filter state + map viewport

**Integration:**
- The filter params are passed to `discoverRoutes` query as variables
- Active filter count shown as badge on "Filter" button: "Filter (3)"

---

## Step 4: GPX Export

### 4.1 NestJS: GPX Generation

**Add to routes module:**
- `routes.service.ts` → `exportRouteGPX(routeId): Buffer`
  1. Fetch route + source ride waypoints
  2. Build GPX 1.1 XML string:
     ```xml
     <?xml version="1.0" encoding="UTF-8"?>
     <gpx version="1.1" creator="MotoVault" xmlns="http://www.topografix.com/GPX/1/1">
       <trk>
         <name>{route.name}</name>
         <trkseg>
           <trkpt lat="{}" lon="{}"><ele>{}</ele><time>{}</time></trkpt>
           ...
         </trkseg>
       </trk>
       <!-- P1: waypoints for notable points -->
     </gpx>
     ```
  3. Return as buffer with appropriate content-type

**New GraphQL operation:**
```graphql
query ExportRouteGPX($routeId: ID!): String!  # Returns GPX XML as string
```

Alternative: REST endpoint `/api/routes/:id/export.gpx` that returns the file directly with `Content-Type: application/gpx+xml` and `Content-Disposition: attachment`. **Recommend REST** for file downloads — cleaner than stuffing a file into a GraphQL response.

### 4.2 NestJS: REST Endpoint

**New file:** `apps/api/src/modules/routes/routes.controller.ts`

```typescript
@Controller('routes')
export class RoutesController {
  @Get(':id/export.gpx')
  async exportGpx(@Param('id') id: string, @Res() res: Response) {
    const { gpx, filename } = await this.routesService.exportRouteGPX(id);
    res.set({
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(gpx);
  }
}
```

### 4.3 Mobile: Export Button

**Modify:** Route detail modal
- "Export GPX" button → calls `Share.share()` with the GPX file URL
- On iOS: triggers the native share sheet, allowing AirDrop, Files, Scenic, etc.
- Implementation: `Linking.openURL(apiUrl + '/routes/' + routeId + '/export.gpx')` or use `expo-file-system` to download then `expo-sharing` to share

---

## File Change Summary

### New Files

| Layer | Path | Purpose |
|-------|------|---------|
| DB | `supabase/migrations/00063_comments.sql` | Comments table + RLS + triggers |
| DB | `supabase/migrations/00064_routes.sql` | Routes table (PostGIS) + RLS |
| Types | `packages/types/src/validators/comment.ts` | Comment Zod schemas |
| Types | `packages/types/src/validators/route.ts` | Route + filter Zod schemas |
| API | `apps/api/src/modules/comments/` (6 files) | Comments module |
| API | `apps/api/src/modules/routes/` (8 files) | Routes module + REST controller |
| Mobile | `apps/mobile/src/app/(tabs)/(discover)/_layout.tsx` | Discover tab layout |
| Mobile | `apps/mobile/src/app/(tabs)/(discover)/index.tsx` | Discover screen |
| Mobile | `apps/mobile/src/app/(modals)/route-detail.tsx` | Route detail modal |
| Mobile | `apps/mobile/src/components/comments/` (3 files) | Comment UI components |
| Mobile | `apps/mobile/src/components/discover/` (5 files) | Discover UI components |
| Mobile | `apps/mobile/src/stores/discover.store.ts` | Discover filter + viewport state |
| Mobile | `apps/mobile/src/graphql/queries/` (3 files) | get-comments, discover-routes, route-detail |
| Mobile | `apps/mobile/src/graphql/mutations/` (5 files) | create-comment, delete-comment, flag-comment, share-ride-to-discover, unshare-route |

### Modified Files

| Path | Change |
|------|--------|
| `packages/types/src/validators/index.ts` | Re-export comment + route schemas |
| `apps/api/src/app.module.ts` | Register CommentsModule + RoutesModule |
| `apps/mobile/src/app/(tabs)/_layout.tsx` | Add Discover tab, restructure tabs |
| `apps/mobile/src/app/(modals)/_layout.tsx` | Register route-detail modal |
| `apps/mobile/src/app/(modals)/ride-detail.tsx` | Add CommentList + CommentInput |
| `apps/mobile/src/app/(modals)/ride-summary.tsx` | Add "Share to Discover" opt-in toggle |
| `apps/mobile/src/components/feed/FeedRideCard.tsx` | Add comment count icon |
| `apps/mobile/src/graphql/queries/ride-feed.graphql` | Add `commentCount` field |
| `apps/web/messages/*.json` (13 files) | Add i18n keys for comments + discover |

---

## Implementation Order

```
1. DB: 00063_comments.sql → push migration
2. Types: comment.ts + re-export
3. API: comments module (resolver, service, models, DTOs)
4. Mobile: comment GraphQL ops → pnpm generate
5. Mobile: comment components (list, item, input)
6. Mobile: integrate comments into ride-detail
7. Mobile: add commentCount to feed card
   --- Comments feature complete, test end-to-end ---
8. DB: 00064_routes.sql (PostGIS) → push migration
9. Types: route.ts + re-export
10. API: routes module (resolver, service, models, DTOs, controller)
11. Mobile: route GraphQL ops → pnpm generate
12. Mobile: restructure tabs (move Diagnose or find slot for Discover)
13. Mobile: Discover screen + map + route list
14. Mobile: route-detail modal
15. Mobile: opt-in flow in ride-summary
    --- Route Discovery complete, test end-to-end ---
16. Mobile: route-filters component + Zustand store
17. Mobile: integrate filters into Discover screen
    --- Filters complete ---
18. API: GPX export REST endpoint
19. Mobile: Export GPX button + share sheet
    --- Phase A complete ---
```

---

## Open Decisions

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Tab bar restructure for Discover | (a) Move Profile to header, (b) Move Diagnose into Garage, (c) 5 tabs + FAB | **(b)** — Diagnose is lower-frequency, fits in Garage conceptually |
| 2 | GPX delivery | GraphQL string vs REST endpoint | **REST** — cleaner for file downloads |
| 3 | Route name AI generation | Sync (block on creation) vs async (generate in background) | **Async** — don't block the share flow; show "Generating name..." then update |
| 4 | Map pin data source | Fetch all route points vs fetch per viewport | **Per viewport** with debounced refetch on map move — scales better |
| 5 | Slider library for distance filter | `@react-native-community/slider` vs custom reanimated | **Community slider** — battle-tested, less code |
| 6 | Comment notification system | Build now vs defer | **Defer** — ship comments without notifications first, add in Phase B |
