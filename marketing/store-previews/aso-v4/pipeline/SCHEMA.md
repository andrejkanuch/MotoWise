# aso-v4 pipeline input schemas

Three inputs feed the pipeline. All are plain JSON/GeoJSON, UTF-8, one file per market (or per locale for copy).

| File | Written by | Read by |
|---|---|---|
| `markets/<CC>.json` | market-data agent | `gen_seed_market.py`, `capture/capture_market.sh`, `compose/compose.py` |
| `markets/<CC>-route.geojson` | market-data agent | `gen_seed_market.py` (hero ride) |
| `copy/<store-locale>.json` | aso-copy agent | `compose/compose.py` |

`<CC>` is the ISO 3166-1 alpha-2 country code, upper case: `US MX BR CO ES PH AR FR GB CA AU IT DE`.
A stub US lives in `pipeline/fixtures/`; the real files in `../markets/` now follow this schema directly. `gen_seed_market.py --validate`
checks a real file against this schema without writing SQL.

## 1. `markets/<CC>.json`

Required fields are marked **R**. Everything else has a default the generator fills in, so a minimal
file is short. Money is in the market currency, as a plain number (no symbols). Distances follow
`measurement_system`: odometers and `target_odometer` in **mi** for imperial, **km** for metric.
Ride stats (`distance_km`, `avg_speed_kmh`…) are always metric; the app converts.

```jsonc
{
  "cc": "US",                                   // R
  "market_name": "United States",               // R, for review pages only
  "app_language": "en",                         // R, one of the app's UI locales: en es de fr it pt-BR (see RUNBOOK "UI locales")
  "store_locales": { "ios": "en-US", "play": "en-US" },   // R, ASC + Play listing locale codes
  "device": {                                   // simulator locale for the capture run
    "apple_languages": ["en-US", "en"],         // R, AppleLanguages array, first = UI language
    "apple_locale": "en_US",                    // R, AppleLocale (region drives date format)
    "metric": false                             // AppleMetricUnits; default = measurement_system == metric
  },
  "measurement_system": "imperial",             // R, "metric" | "imperial"
  "currency": "USD",                            // R, in the DB allowlist (00131); PHP only with --assume-currency-fix (00194)
  "timezone": "America/New_York",               // R, IANA tz for ride/expense times
  "region_code": "US-NC",                       // rides.region, ISO 3166-2; default = cc
  "rider": {
    "display_name": "Jake M.",                  // R, a plausible local first name + initial
    "city": "Asheville",                        // R
    "home": [35.5951, -82.5515]                 // R, [lat, lng], where non-hero rides start
  },
  "bikes": [                                    // R, 1-2 entries, first is primary. Locally popular models
    {
      "key": "primary",                         // R, stable id seed: do not rename after seeding
      "make": "HARLEY-DAVIDSON",                // R, the app shows make upper case
      "model": "Street Glide Special",          // R
      "year": 2022,                             // R
      "nickname": "The Glide",                  // local-language nickname
      "variant": "Milwaukee-Eight 114",
      "type": "touring",                        // motorcycle_type enum: cruiser sportbike standard touring dual_sport dirt_bike scooter other
      "engine_cc": 1868,
      "odometer": 23480,                        // R, current reading in the market unit
      "odometer_jan1": 16680,                   // reading on 1 Jan of the current year (season delta). Default: odometer - season distance
      "purchase_date": "2022-04-09",
      "purchase_price": 27900
    }
  ],
  "hero_ride": {                                // R. Geometry comes from <CC>-route.geojson
    "name": "Tail of the Dragon + Cherohala Skyway",   // R, as a local rider would title it, in app_language
    "road": "US-129 / Cherohala Skyway",        // R, for captions and the review page
    "date": "2026-10-10",                       // R, within the last ~4 weeks of the capture date
    "start_time": "09:30",                      // local time
    "avg_speed_kmh": 58,                        // R, moving average; realistic for that road
    "max_speed_kmh": 110,                       // R, legal-ish for the road
    "max_lean_deg": 38,                         // R, <= 45 sport, <= 32 touring/cruiser
    "elevation_gain_m": null                    // null = computed from the GeoJSON z values or the DEM
  },
  "other_rides": [                              // ~6 named rides; the generator adds filler rides for the season totals
    { "name": "Blue Ridge Parkway to Mount Mitchell", "date": "2026-10-03",
      "waypoints": [[35.5951,-82.5515],[35.6998,-82.3794],[35.7647,-82.2651]],  // [lat,lng] via points, routed on roads (OSRM, cached). Optional
      "distance_km": 160, "avg_speed_kmh": 55, "elevation_gain_m": 1900 }      // used as-is when waypoints are absent
  ],
  "season": { "rides": 70, "distance_km": 10900 },   // year-to-date totals across all bikes; default 60 rides / 9,000 km
  "fuel": {
    "label": "Premium 91",                      // R, local grade name ("Magna", "Gasolina aditivada", "SP98", "E10 Super")
    "unit": "gal",                              // R, "gal" | "L"
    "price_per_unit": 3.85,                     // R, current local price
    "fill_size": [3.8, 5.4],                    // per fill-up, in unit
    "stations": ["Shell, Patton Ave", "Exxon, Weaverville"]   // R, 3-8 local station names
  },
  "service": {                                  // R. The scanned dealer service; also feeds the receipt-scan review
    "title": "20,000-mile service",             // R, in app_language
    "date": "2026-07-24",                       // R
    "odometer": 20050,                          // R, market unit
    "vendor": "Blue Ridge V-Twin Service",      // R, FICTIONAL dealer name (never a real business)
    "tax_label": "Sales tax 7%",                // R, as printed locally (IVA 21%, TVA 20%, MwSt. 19%, VAT 20%, GST 10%)
    "tax_rate": 0.07,                           // R, the tax line amount is computed from the other lines
    "tax_included": false,                      // true = EU/BR style prices incl. VAT (tax line shown but not added)
    "line_items": [                             // R, 3-8 lines, labels in app_language
      { "label": "Syn3 20W-50 oil, 5 qt", "service_type": "oil_change", "amount": 79.75, "part_ref": "62600030" }
    ]                                           // service_type: oil_change oil_filter brake_fluid transmission_oil final_drive coolant valve_clearance
                                                //   air_filter spark_plug fork_oil chain tire brake_pads belt battery general_service other
  },
  "history_services": [                         // older completed services for the History tab; default = 4 generated from interval
    { "title": "15,000-mile service", "date": "2025-09-19", "odometer": 15060, "amount": 405.00 }
  ],
  "service_interval": 5000,                     // market unit; drives generated history and the next-service reminder
  "expenses": [                                 // fixed, non-fuel costs this year and earlier
    { "category": "insurance", "date": "2026-04-09", "amount": 684.00, "item": "Annual policy 2026", "vendor": "Motorcycle insurance" }
  ],                                            // category: fuel maintenance parts tires gear accessories modifications insurance registration taxes_fees tolls parking training other
  "tasks": [                                    // reminders. 1 overdue + 2-3 upcoming reads best
    { "title": "Front tire tread check", "due_date": "2026-10-01", "priority": "high" },
    { "title": "25,000-mile service", "target_odometer": 25000, "priority": "medium" }
  ],
  "trip": {                                     // R for the trip_planning slot
    "title": "Smokies weekend",                 // R, in app_language
    "description": "Two days on the Dragon and the Parkway",
    "start_date": "2026-11-14", "end_date": "2026-11-15",   // R, upcoming
    "difficulty": "moderate",                   // easy moderate challenging expert
    "status": "draft",                          // draft (default, private to the organiser) | published (visible in public lists: avoid)
    "stops": [                                  // R, 3-8, first type start, last type end
      { "name": "Asheville", "lat": 35.5951, "lng": -82.5515, "type": "start", "day": 0 }
    ]                                           // type: start end fuel food scenic overnight photo mechanical ferry pass_summit rally_point
  },
  "receipt_image": null,                        // optional path to a rendered receipt (pipeline/assets/receipts/<CC>.png); used by the review page only
  "notes": "free text for reviewers"
}
```

## 2. `markets/<CC>-route.geojson`

The hero ride, on the real road. A `FeatureCollection` with exactly one `LineString` feature
(a `MultiLineString` is joined in order). Coordinates are GeoJSON order **[lng, lat]** or
**[lng, lat, elevation_m]**. Densify to at least one point every ~250 m along the road (a road
router's full-overview geometry is fine); the generator resamples to ~230 m spacing and caps at
1,500 waypoints.

```json
{ "type": "FeatureCollection",
  "features": [ { "type": "Feature",
    "properties": { "name": "Tail of the Dragon", "road": "US-129", "source": "OSRM / OpenStreetMap", "loop": true },
    "geometry": { "type": "LineString", "coordinates": [[-83.8074, 35.3226, 640.0], [-83.81, 35.33, 652.5]] } } ] }
```

If no z values are present, elevation comes from Open-Meteo (cached in the seed output dir);
`--offline` falls back to a smooth synthetic profile and says so in the summary.

## 3. `copy/<store-locale>.json`

One file per store locale (`en-US.json`, `es-MX.json`, `pt-BR.json`, `de-DE.json`…). Keys are the
capture slots. Headlines are short: the composer sets them in Barlow Condensed 700 upper case and
shrinks them to fit two lines; a line over ~18 characters will get small.

```jsonc
{
  "locale": "en-US",
  "slots": {
    "ride_tracking":         { "headline": ["Every ride,", "on the map"], "sub": "Route, speed and lean angle, recorded." },
    "ride_stats":            { "headline": ["Know your", "ride"],          "sub": "..." },
    "expenses":              { "headline": [...], "sub": "..." },
    "receipt_scan":          { ... },
    "maintenance_reminders": { ... },
    "service_history":       { ... },
    "garage":                { ... },
    "trip_planning":         { ... },
    "season_summary":        { ... },
    "costs_overview":        { ... }
  },
  "order": ["ride_tracking", "expenses", "maintenance_reminders", "..."],   // store order, max 10 (iOS) / 8 (Play)
  "feature_graphic": { "headline": ["Your bike.", "Fully logged."] },      // Play 1024x500
  "header":          { "headline": ["Your bike.", "Fully logged."] },      // iOS product page header 3840x1646
  "search":          { "headline": ["Your motorcycle,", "fully logged."], "sub": "Rides · Expenses · Maintenance" }  // iOS search 3840x2560
}
```

`headline` is one or two lines, both in #F4F1EA as in the owner's canvas (`compose.py --accent-line2`
paints line 2 #D4622E). `sub` is DM Sans 17px, wrapping to two lines at most. Play reads `order_play`.
Optional per slot: `"layout": {"frame_top": 330, "img_offset": 0}` (canvas px) to move the phone or the capture. A `{n}` placeholder is not supported: write real numbers from the market file.
