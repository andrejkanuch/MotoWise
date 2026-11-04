# aso-v4 market profiles

One profile per target market (`<CC>.json`), a road polyline per market (`<CC>-route.geojson`), and the method plus global numbers (`_global.json`). India is left out on purpose. Generated on 2026-11-03.

## How the feature data was built

- **Source:** PostHog, mobile SDK events only (`$lib = posthog-react-native`), last 120 days (2026-07-06 to 2026-11-03).
- **Unit:** distinct persons. Each person counts in one country, the one that appears most in their events' `$geoip_country_code`.
- **Test accounts excluded:** `0789780c-2cb3-5985-b8d7-94af0a4b336e`, `cb805adc-d514-5f4d-a289-fb4048ba3630`, `07f99fe8-5a1b-5f5f-91b7-7377e8a25838`, `fd88a33a-e14f-56f2-a394-114fc383a7b0`. PostHog persons carry no email, so I matched these ids by prefix to the test-account notes rather than by an email lookup.
- **Which events count as which feature:** see `feature_event_map` in `_global.json`. `bike_added` is fired by onboarding, so it measures onboarding, not a feature choice, and it is left out of the rankings.

## Global ranking (n = 1,135 users)

| # | Feature | Users | % |
|---|---|---|---|
| 1 | Rides (started a GPS ride) | 136 | 12.0 |
| 2 | Trips (any trip event) | 81 | 7.1 |
| 3 | Maintenance | 67 | 5.9 |
| 4 | AI diagnosis (out of scope) | 56 | 4.9 |
| 5 | Expenses | 51 | 4.5 |
| 6 | Receipt scan | 11 | 1.0 |

- 101 users finished a ride.
- Of the 81 trip users, only 35 built a trip (added a waypoint). The rest only opened a trip detail.
- Expenses have the most repeat use: 176 events from 52 people.
- Onboarding goal: track_rides 56%, maintain_bike 18%, manage_expenses 12%.

**Recommended global screenshot order:** Rides, Maintenance, Expenses (with receipt scan), Trips, Garage.

Trips rank second only when you count views. Counted by trips actually built, they fall below maintenance. Maintenance and expenses are also the two confirmed ASO benefits.

## Per market

Sample strength is "readable" from 150 users, "thin" from 40 users and "very thin" below 40. The three features listed come from the local ranking.

| CC | n | Top 3 features (users) | Screenshot order | Hero route | Demo bikes | App Store page shown | Play listing |
|---|---|---|---|---|---|---|---|
| US | 222 | trips 21, rides 15, maint 15 | global (trips at slot 2 is defensible) | Tail of the Dragon, US 129 (11 mi) | H-D Street Glide, Yamaha MT-07 | en-US | en-US |
| MX | 60 | rides 6, diag 6, expenses 5 | rides, **expenses**, maint, trips, garage | Espinazo del Diablo, MEX 40 libre (El Salto to Concordia, 151 km) | Italika FT150, Yamaha FZ | es-MX | es-419 |
| BR | 62 | rides 4, maint 1, trips 1 | global | Serra do Rio do Rastro, SC-390 | Honda CG 160 Titan, Honda Biz 125 | pt-BR | pt-BR |
| CO | 50 | rides 9, diag 4, trips 3 | global (strongest rides market, 18%) | Trampolín de la Muerte (backup: Bogotá to Villa de Leyva) | Honda XR190L, Yamaha NMAX 155 | es-MX | es-419 |
| ES | 43 | maint 3, rides 1, trips 1 | global; maintenance-first is a test candidate | A-397 San Pedro to Ronda | Yamaha MT-07, Yamaha NMAX 125 | **en-GB (no es-ES localization)** | es-ES |
| PH | 29 | rides 3, diag 2, trips 1 | global | Marilaque Highway | Honda Click 125, Yamaha NMAX 155 | en-GB | en-US (fil for Filipino-language devices) |
| AR | 30 | diag 4, expenses 2, trips 1 | global | Camino de los Siete Lagos, RN 40 | Honda Wave 110 S, Motomel S2 150 | es-MX | es-419 |
| FR | 28 | rides 5, expenses 4, trips 3 | global | Route Napoléon | BMW R 1300 GS, Yamaha MT-07 | fr-FR | fr-FR |
| GB | 28 | maint 5, trips 4, rides 2 | global | Cat and Fiddle, A537 | Triumph Speed 400, BMW R 1300 GS | en-GB | en-GB |
| CA | 25 | rides 5, trips 2, expenses 1 | global | Cabot Trail | Kawasaki Ninja 650, BMW R 1300 GS Adventure | **en-US (no en-CA or fr-CA)** | en-CA |
| AU | 23 | trips 3, rides 1, diag 1 | global | Great Ocean Road, B100 | Yamaha MT-07 LA, Ténéré 700 | **en-GB (no en-AU)** | en-AU |
| IT | 21 | maint 4, diag 3, expenses 2 | global; maintenance-first is a test candidate | Passo dello Stelvio, SS38 | BMW R 1300 GS, Honda SH 125 | it | it-IT |
| DE | 22 | expenses 2, rides 1, maint 1 | global | Schwarzwaldhochstraße, B 500 | BMW R 1300 GS, Kawasaki Z900 | de-DE | de-DE |

Every market has two backup routes, and every route and sales claim cites its sources inside its JSON.

## Store mechanics

- **Apple:** Apple's localization table says CO and AR use Spanish (Mexico), and PH uses English (U.K.). MotoVault 3.26.0 is live in de-DE, en-GB, en-US, es-MX, fr-FR, it and pt-BR. The "page shown" column applies Apple's rule (storefront languages crossed with the app's localizations, falling back to the primary en-US). It has not been checked on a device.
- **Google Play:** The default listing follows the device language. Custom store listings can target countries: up to 50 listings, each country in only one listing, and no automatic translation.
- **Apple country targeting:** Apple cannot target countries on the default product page. The only ways to give a country its own screenshots are Custom Product Pages (reached through their own link or ads) or a localization that only that storefront shows. es-ES, en-AU and en-CA are free per-country slots of that kind.

## Caveats

- **Prices:** Fuel, service and part prices are realistic estimates for the screenshots, not quotes. The fuel page on globalpetrolprices.com could not be read by country (blocked with 429), so check the prices before final copy. ARS amounts age monthly.
- **Maintenance intervals:** Each one has an `interval_confidence` field. The low-confidence ones (Italika, XR190L, Click 125, Wave) need checking against the owner's manual.
- **Polylines:** Fetched from the public OSRM demo server using OpenStreetMap data. Elevation is approximate: 100 samples from SRTM 90 m data. The US polyline is trimmed to 11 mi. The FR polyline uses the A480 for its last ~5 km into Grenoble.
