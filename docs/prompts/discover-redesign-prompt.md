# Claude Design Prompt: MotoVault Discover Screen

## App Context

MotoVault is a motorcycle trip planning & diagnostics app (iOS, dark theme, editorial typography). The Discover tab is the main trip browsing and planning entry point.

## Design System

- **Fonts**: Instrument Serif (display), Geist (body), Geist Mono (labels/caps)
- **Colors**: Warm editorial palette — dark bg (#1a1510), cream text (#faf6f0), warm accent (#c47a3a), green success (#4eba6f)
- **Style**: Magazine-editorial aesthetic with warm tones, not cold tech. Rounded corners with `borderCurve: continuous`. Dark mode primary.
- **Tab bar**: Floating island style with green center "Ride" FAB button
- **Icons**: Lucide icon set (stroke-based)

## What the User Sees When They Open Discover

They have a motorcycle in their garage (BMW R 1250 GS, 13.5k km). They may have 0-5 draft trips they started planning. The app knows their location.

## Available Real Data (GraphQL API)

### 1. Trip Templates (browseable catalog) — `tripTemplates` query
These are admin-curated motorcycle routes. We have ~50+ across Europe.
```
Fields per trip:
- title: "Passo di Gavia — Italian Alps"
- description: "One of the highest paved passes..."
- difficulty: easy | moderate | challenging | expert
- surfaceType: paved | mixed | off_road
- distanceM: 28000 (meters)
- elevationGainM: 1390
- estimatedDurationMinutes: 80
- dayCount: 1 (or multi-day: 2, 3...)
- startLat/startLng: GPS coordinates
- countryCode: "IT"
- city: "Bormio"
- averageRating: 4.8
- reviewCount: 567
- cloneCount: 2840 (how many riders used this)
- isMotovaultPick: true (editor's choice)
- coverImageUrl: photo URL
- curvatureIndex: 0.85 (how twisty, 0-1)
- polyline: encoded route line
- waypoints: [{name, lat, lng, dayIndex}]

Filterable by:
- country (IT, ES, AT, DE, FR, CH, US...)
- surfaceType (paved, mixed, off_road)
- difficulty
- dayCountMin/Max
- searchText (fuzzy name search)
```

### 2. User's Own Trips — `myTrips` query
Trips the user created or joined. Has a `status` field:
- `draft` — started planning, not finished
- `published` — shared/visible
- `active` — currently happening
- `completed` — done
- `archived`

Same Trip fields as above, plus visibility (private/unlisted/public).

### 3. Rider Trips (social) — `discoverRiderTrips` query
Public upcoming trips from real riders (not templates). Shows:
- organiser name + avatar
- participant count / max riders
- start/end dates
- waypoints

### 4. Saved Trips — `savedTrips` query
Trips the user bookmarked for later.

### 5. Search — `searchTypeahead` query
Fuzzy search across routes and places. Returns:
- routes: [{id, name}]
- places: [{id, name, countryCode, regionCode, kind}]

### 6. User's Motorcycle — `myMotorcycles` query
```
- make: "BMW"
- model: "R 1250 GS"
- year: 2022
- type: adventure | sport | cruiser | naked | touring...
- currentMileage: 13500
- primaryPhotoUrl: bike photo
```

### 7. Weather (already implemented) — Open-Meteo API
Free, no API key. We have a `useWeatherForecast` hook that returns:
```
- headline: "Monday · 17°C · Cloudy today"
- days: [{date, tempMax, tempMin, precipProbability, weatherCode, label}]
- isGoodWeekend: boolean
- coords: {lat, lon} (user's location)
```

### 8. Mapbox Map
We have Mapbox GL integrated. Can show:
- Interactive map with trip pins (clustered)
- Route polylines
- User location

## What Does NOT Exist Yet (don't design for these)
- Friend/follower system (no social graph)
- Real-time rider locations
- Route stitching/chaining AI
- Fuel station database
- Hotel/accommodation booking
- Group ride chat

## User Segments & Their Jobs

1. **Browser** (most common): Opens Discover to browse interesting routes. Wants to scroll, see photos, tap into details. Filter by country, surface, difficulty.

2. **Planner**: Has a destination in mind. Searches for it, finds a template trip, taps "Use as my trip" to clone it into their own editable trip.

3. **Returning planner**: Has 1-3 draft trips. Wants to resume where they left off.

4. **Weekend spontaneous**: Wants to ride this weekend. Interested in what's nearby, weather-appropriate, doable in a day.

## Design Requirements

1. **Every section must be backed by real data** listed above. No fake names, no mock friends, no hardcoded "Gavia + Stelvio" suggestions.

2. **Every tappable element must do something real:**
   - Trip card → opens trip detail screen
   - Search → searches routes and places
   - Filter chip → filters the trip list
   - "Plan Trip" FAB → opens create-trip modal
   - Draft card → opens create-trip with that trip pre-loaded

3. **Weather** should appear as contextual info (the weekend spontaneous rider segment), not as a primary UI element. A subtle line, not a hero card.

4. **The map** is valuable — riders love seeing where routes are geographically. Keep it but make it collapsible.

5. **Show the user's bike** contextually (e.g. "Routes for your R 1250 GS" or surface type recommendations based on bike type).

6. **Draft trips section** should only appear when the user actually has drafts (status=draft). Show 0 UI when 0 drafts.

7. **Keep it simple.** A browseable list of real trip templates with good filtering is more useful than a complex planner that shows fake data.

## Screen Structure to Design

Design a single mobile screen (390×844 viewport, dark mode) showing:

1. **Collapsible map header** with trip pins
2. **Search bar** (existing TypeaheadSearch component)
3. **Filter row** (chips for Popular, Twisty, Paved, Mixed, Off-road, Top Rated + country filter)
4. **Optional: Draft trips strip** (only if user has drafts — horizontal scroll of their in-progress trips)
5. **Optional: Weather context** (subtle, for the weekend segment — e.g. "Good riding weather this Saturday" badge)
6. **Trip template cards** (the main content — scrollable list of real route cards with photo, title, stats, rating)
7. **Plan Trip FAB** (floating green button, bottom right)

The design should feel like a curated motorcycle route magazine, not a trip planning form.
