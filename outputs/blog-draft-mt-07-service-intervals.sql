-- ============================================================================
-- MotoVault blog — SPEC/maintenance draft insert for "mt-07-service-intervals"
-- Mode: SPEC (maintenance) -> status='draft', spec_data=true, is_safety_critical=true
-- Project: tpsoneenbrmdwvzcbifw  (run via Supabase execute_sql / SQL editor)
--
-- NOTE: The scheduled run could NOT execute this: the connected Supabase MCP
-- account only has access to project "modpkxfqqzuvanohailj" (Piel), not the
-- MotoVault blog project tpsoneenbrmdwvzcbifw ("You do not have permission").
-- A human with access should review the numbers against the cited sources and
-- run this. Everything upserts on natural keys, so it is safe to re-run.
-- ============================================================================

-- 1) Base post + maintenance row + translation + primary category (single CTE)
WITH new_post AS (
  INSERT INTO blog_posts (type, slug, status, published_at, author, spec_data, is_safety_critical)
  VALUES ('maintenance', 'mt-07-service-intervals', 'draft', NULL, 'MotoVault Editorial', true, true)
  ON CONFLICT (slug) DO UPDATE
    SET status='draft', spec_data=true, is_safety_critical=true, updated_at=now()
  RETURNING id
),
maint AS (
  INSERT INTO blog_post_maintenance (post_id, make, model, variant, dataset_models, applicable_models)
  SELECT id, 'YAMAHA', 'MT-07', NULL, ARRAY['YAMAHA/MT-07'], ARRAY['YAMAHA/MT-07','YAMAHA/FZ-07']
  FROM new_post
  ON CONFLICT (post_id) DO UPDATE SET make=EXCLUDED.make, model=EXCLUDED.model,
    dataset_models=EXCLUDED.dataset_models, applicable_models=EXCLUDED.applicable_models
  RETURNING post_id
),
tr AS (
  INSERT INTO blog_post_translations
    (post_id, locale, title, excerpt, seo_title, seo_description,
     body_raw, body_text, keyword_text, faq, reading_time, word_count)
  SELECT id, 'en',
    'Yamaha MT-07 Service Intervals & Oil Change Schedule',
    'When to service a Yamaha MT-07 — oil, valves, chain and fluids — with metric and imperial figures for every model year.',
    'Yamaha MT-07 Service Intervals & Oil Change Schedule',
    'Yamaha MT-07 service intervals: oil every 10,000 km / 6,000 mi, valve checks at 40,000 km, plus torque and capacities. Verify against your owner''s manual.',
    $body$
{/* SPEC draft — status=draft, spec_data=true, is_safety_critical=true. Target keyword: mt-07 service intervals */}

The Yamaha MT-07 follows a simple, forgiving service rhythm: change the engine oil at the first **1,000 km / 600 mi** break-in service, then every **10,000 km / 6,000 mi** (or once a year) on European-manual bikes, and have the valve clearances checked at **40,000 km / 24,000 mi**. The CP2 689 cc parallel twin is one of the lowest-maintenance middleweight engines on the market, and the schedule below has stayed effectively unchanged across every MT-07 and FZ-07 from 2014 through 2026.

This guide lays out the full MT-07 service intervals with both metric and imperial figures, the oil capacity and torque numbers you need for a DIY oil change, and the one thing that trips up most owners — the deliberate difference between Yamaha's US and European maintenance charts.

> Track this schedule automatically in MotoVault: log your mileage once and the app tells you which service is due next and when the valve check is coming, so nothing slips.

## Yamaha MT-07 maintenance schedule at a glance

Yamaha publishes two different charts for the MT-07 depending on region, and the intervals genuinely differ (this is normal for Yamaha and reflects local emissions rules, not a stricter engine). Use the chart that matches your bike's manual.

### European / Australian / Asia-Pacific schedule (kilometres)

| Interval (km) | Engine oil | Oil filter | Spark plugs | Valve clearance | Air filter |
|---|---|---|---|---|---|
| 1,000 (break-in) | Change | Replace | — | — | — |
| 10,000 / yearly | Change | — | Inspect/clean | — | — |
| 20,000 | Change | Replace | Replace | — | — |
| 30,000 | Change | — | Inspect/clean | — | — |
| 40,000 | Change | Replace | Replace | **Check & adjust** | Replace |

### US schedule (miles)

| Interval (mi) | Engine oil | Oil filter | Spark plugs | Valve clearance | Air filter |
|---|---|---|---|---|---|
| 600 (break-in) | Change | Replace | — | — | — |
| 4,000 / 6 mo | Change | — | Inspect/clean | — | — |
| 8,000 | Change | Replace | Replace | — | — |
| 12,000 | Change | — | Inspect/clean | — | — |
| 16,000 | Change | Replace | Replace | — | — |
| 24,000 | Change | — | — | — | Replace |
| 26,600 | — | — | — | **Check & adjust** | — |

Brake fluid is replaced every **2 years**, brake hoses every **4 years**, and coolant every **3 years** (the European chart states 3 years; the US chart lists the coolant change at the 24-month service — verify against your own manual). At every service the dealer also runs a standard inspection checklist covering brakes, lights, steering, suspension, fasteners and the drive chain.

## Engine oil change: capacity, spec and torque

The oil change is the single most important job on the CP2 engine, and it is a genuine 30-minute DIY task.

| Item | Specification |
|---|---|
| Oil capacity — with filter change | **2.60 L** (2.75 US qt / 2.29 Imp qt) |
| Oil capacity — without filter | **2.30 L** (2.43 US qt / 2.02 Imp qt) |
| Viscosity | **10W-40** (10W-50, 15W-40, 20W-40 and 20W-50 also listed by year/climate) |
| Oil grade | API SG or higher, **JASO MA / MA2** (protects the wet clutch) |
| Drain bolt torque | **43 Nm / 32 lb-ft** — always with a new crush washer |
| Oil filter torque | **17 Nm / 13 lb-ft** (hand-tight plus ¾ turn) |

Always confirm the final level through the sight glass on the right side of the crankcase rather than trusting the poured volume alone — fill roughly 2.3 L, run the engine briefly, let it settle, then top up to the max mark. The oil filter, crush washer and oil specification are identical across all model years from 2014 to 2026, including the US-market FZ-07, which is what makes MT-07 maintenance so predictable.

Yamaha's chart replaces the oil filter at every second oil change (every **20,000 km / 8,000 mi**). Many riders and independent shops prefer to fit a fresh filter at **every** oil change for a few dollars more — a reasonable choice, though not what the manual strictly requires.

## Valve clearance check

The CP2 uses a shim-under-bucket valve train, and the first valve-clearance inspection is the biggest scheduled item on the calendar:

- **European manual:** every **40,000 km / 24,000 mi**
- **US manual:** every **26,600 mi / 42,000 km**

In practice these are the same service arriving at slightly different odometer readings. Because the shims are durable and the CP2 runs cool, many bikes are found to be within spec at the first check with no adjustment needed — but the inspection still has to happen, because a tight valve that goes unchecked can eventually burn. This is dealer-tool territory for most owners: the airbox, throttle bodies and cam cover all have to come off to measure clearances with the engine cold.

## Drive chain, tyres and other consumables

The drive chain needs attention far more often than anything in the engine. Yamaha specifies checking and lubricating the chain every **1,000 km / 500 mi**, and after any ride in rain or after washing the bike.

| Item | Specification |
|---|---|
| Drive chain slack | **51–56 mm** (measured under the chain guard, bike on the side stand, in neutral) |
| Front tyre | 120/70 ZR17 — **2.5 bar / 250 kPa / 36 psi** (cold) |
| Rear tyre | 180/55 ZR17 — **2.9 bar / 290 kPa / 42 psi** (cold) |
| Spark plug | NGK **LMAR9E-J**, gap 0.6–0.7 mm |
| Rear axle nut | 105 Nm / 77 lb-ft |

Tyre pressures and chain slack above reflect the standard Yamaha figures for the MT-07 — confirm the exact values on the swingarm/chain-guard sticker and in your model-year manual before adjusting, as pressures can vary with the fitted tyre.

## What a Yamaha MT-07 service costs

Costs vary widely by country, dealer labour rate and whether you do the work yourself, so treat the following as rough estimates rather than fixed figures:

- **DIY oil and filter change:** roughly the price of 3 L of quality 10W-40, a filter and a crush washer — often under €40 / $45 in parts.
- **Dealer minor service (oil, filter, inspection):** typically €120–€250 / $130–$280.
- **Valve-clearance inspection (the 40,000 km / 24,000 mi service):** the big one, usually €350–€650 / $400–$700 because of the labour to access the cam cover — even when no adjustment is needed.

The economics are why so many MT-07 owners learn to do their own oil changes and chain maintenance and save the dealer for the valve check. For a broader primer on getting started, see our beginner's guide below.

## How the schedule changes by model year (2014–2026)

The MT-07 has run through four generations, but the maintenance schedule has stayed the same because the CP2 engine is fundamentally unchanged:

- **Gen 1 (2014–2017):** original CP2, sold as the FZ-07 in the US.
- **Gen 2 (2018–2020):** Euro 4, revised suspension.
- **Gen 3 (2021–2024):** Euro 5, larger 298 mm front discs (same brake pads), TFT/LCD display, Michelin PR5 tyres.
- **Gen 4 (2025–2026):** Euro 5+, optional Y-AMT automated transmission (same engine oil; its transmission oil is checked separately).

The 2021 restyle did not change service intervals, oil capacity or torque values. If you own any MT-07, FZ-07, or the same-engine XSR700, Ténéré 700, YZF-R7 or Tracer 7, the core intervals in this guide apply.

For related schedules, see our [Yamaha MT-09 service intervals](/blog/mt-09-service-intervals) guide, the combined [Yamaha MT & R-series maintenance schedule](/blog/yamaha-mt-r-series-maintenance-schedule), and — if your MT-07 is brand new — our [motorcycle break-in period guide](/blog/motorcycle-break-in-period). New riders can also start with the [best motorcycle app for beginners](/blog/best-motorcycle-app-for-beginners-2026).

## FAQ

**How often should you change the oil on a Yamaha MT-07?**
Every 10,000 km / 6,000 mi or once a year on the European-manual schedule, and every 6,000 km / 4,000 mi or six months on the US schedule. The first change is early, at 1,000 km / 600 mi, to flush out break-in debris. Hard or track use warrants shorter intervals of around 4,000–5,000 km.

**When does the MT-07 need a valve clearance check?**
At 40,000 km / 24,000 mi (European manual) or 26,600 mi / 42,000 km (US manual). The CP2's shim-under-bucket valves are durable and are often still in spec at the first check, but the inspection is not optional.

**How much oil does a Yamaha MT-07 take?**
2.60 litres with an oil filter change, or 2.30 litres without. Use 10W-40 JASO MA/MA2, torque the drain bolt to 43 Nm with a new washer, and confirm the level at the sight glass.

**Is the MT-07 service schedule the same for all years?**
Yes. The CP2 689 cc engine is essentially unchanged from 2014 to 2026, so oil capacity, torque values, filter part and service intervals carry across every MT-07 and the US-market FZ-07.

**What does an MT-07 major service cost?**
The valve-clearance service is the expensive one — commonly €350–€650 / $400–$700 at a dealer due to the labour to reach the cam cover. Minor oil-and-inspection services are far cheaper, and a DIY oil change costs little more than the oil and filter.

## Sources

- [Yamaha MT-07 / FZ-07 (2015+) Maintenance Schedule — maintenanceschedule.com](https://maintenanceschedule.com/yamaha-mt-07-fz-07-maintenance/) — US and European owner's-manual maintenance charts, torque values, tyre pressures, chain slack, consumable part numbers.
- [Yamaha MT-07 Engine Oil Capacity & Specifications — manualonline.net](https://www.manualonline.net/2024/02/yamaha-mt-07-engine-oil-capacity-and.html) — verbatim owner's-manual oil-change procedure and capacities.
- [Yamaha MT-07 / FZ-07 Oil Change Guide — MTP-Racing GmbH](https://mtp-racing.de/blog/yamaha-mt-07-oil-change) — independent master-mechanic reference confirming oil capacity, viscosity and torque.
- [Yamaha MT-07 Owner's Manual — ManualsLib](https://www.manualslib.com/manual/837941/Yamaha-Mt-07.html) — official periodic maintenance and lubrication chart.
- [Yamaha Owner's Manuals portal](https://www.yamahamotorsports.com/yamaha-manuals) — official model-year-specific manuals.
$body$,
    $txt$Yamaha MT-07 Service Intervals & Oil Change Schedule. The Yamaha MT-07 follows a simple service rhythm: change the engine oil at the first 1,000 km / 600 mi break-in service, then every 10,000 km / 6,000 mi (or once a year) on European-manual bikes, and have the valve clearances checked at 40,000 km / 24,000 mi. The CP2 689 cc parallel twin is one of the lowest-maintenance middleweight engines on the market, and the schedule has stayed unchanged across every MT-07 and FZ-07 from 2014 through 2026.

Yamaha maintenance schedule at a glance. Yamaha publishes two charts depending on region and the intervals differ. European/Australian/Asia-Pacific schedule (km): break-in at 1,000 km (change oil, replace filter); every 10,000 km or yearly change oil, inspect/clean plugs; 20,000 km replace filter and plugs; 40,000 km valve clearance check and adjust, replace air filter. US schedule (mi): break-in at 600 mi; every 4,000 mi or 6 months change oil; 8,000 mi replace filter and plugs; 24,000 mi replace air filter; 26,600 mi valve clearance check. Brake fluid every 2 years, brake hoses every 4 years, coolant every 3 years (verify by region).

Engine oil change. Capacity with filter change 2.60 L (2.75 US qt / 2.29 Imp qt); without filter 2.30 L. Viscosity 10W-40, JASO MA/MA2, API SG or higher. Drain bolt torque 43 Nm / 32 lb-ft with a new crush washer. Oil filter torque 17 Nm / 13 lb-ft (hand-tight plus three-quarter turn). Confirm level at the sight glass. Oil filter, washer and spec are identical across 2014 to 2026 including the FZ-07. The manual replaces the filter every second oil change (20,000 km / 8,000 mi); many owners fit a fresh filter every change.

Valve clearance check. Shim-under-bucket valve train. European manual every 40,000 km / 24,000 mi; US manual every 26,600 mi / 42,000 km. Often in spec at first check but the inspection is required; airbox, throttle bodies and cam cover come off with the engine cold.

Drive chain, tyres and consumables. Lubricate and check the chain every 1,000 km / 500 mi. Chain slack 51-56 mm. Front tyre 120/70 ZR17 at 2.5 bar / 250 kPa / 36 psi cold; rear 180/55 ZR17 at 2.9 bar / 290 kPa / 42 psi cold. Spark plug NGK LMAR9E-J, gap 0.6-0.7 mm. Rear axle nut 105 Nm / 77 lb-ft. Confirm pressures on the bike sticker.

Service costs (estimates). DIY oil and filter change often under 40 EUR / 45 USD in parts. Dealer minor service typically 120-250 EUR / 130-280 USD. Valve-clearance inspection at 40,000 km / 24,000 mi usually 350-650 EUR / 400-700 USD.

Model years. Gen 1 (2014-2017) original CP2, US FZ-07. Gen 2 (2018-2020) Euro 4. Gen 3 (2021-2024) Euro 5, 298 mm front discs, TFT/LCD, Michelin PR5. Gen 4 (2025-2026) Euro 5+, optional Y-AMT. The 2021 restyle did not change intervals, capacity or torque. Same engine intervals apply to XSR700, Tenere 700, YZF-R7 and Tracer 7.

FAQ. Oil change every 10,000 km / 6,000 mi or yearly (EU), 6,000 km / 4,000 mi or 6 months (US), first at 1,000 km / 600 mi. Valve check at 40,000 km / 24,000 mi (EU) or 26,600 mi / 42,000 km (US). Oil capacity 2.60 L with filter, 2.30 L without. Schedule is the same across all years. Major (valve) service commonly 350-650 EUR / 400-700 USD.

Sources: maintenanceschedule.com MT-07 page; manualonline.net oil capacity; MTP-Racing MT-07 oil change guide; ManualsLib Yamaha MT-07 owner's manual; Yamaha owner's manuals portal.$txt$,
    'mt-07 service intervals mt-07 oil change interval mt-07 maintenance schedule yamaha mt-07 valve clearance yamaha maintenance',
    $faq$[
      {"question":"How often should you change the oil on a Yamaha MT-07?","answer":"Every 10,000 km / 6,000 mi or once a year on the European-manual schedule, and every 6,000 km / 4,000 mi or six months on the US schedule. The first change is early, at 1,000 km / 600 mi, to flush out break-in debris. Hard or track use warrants shorter intervals of around 4,000-5,000 km."},
      {"question":"When does the MT-07 need a valve clearance check?","answer":"At 40,000 km / 24,000 mi (European manual) or 26,600 mi / 42,000 km (US manual). The CP2's shim-under-bucket valves are durable and are often still in spec at the first check, but the inspection is not optional."},
      {"question":"How much oil does a Yamaha MT-07 take?","answer":"2.60 litres with an oil filter change, or 2.30 litres without. Use 10W-40 JASO MA/MA2, torque the drain bolt to 43 Nm with a new washer, and confirm the level at the sight glass."},
      {"question":"Is the MT-07 service schedule the same for all years?","answer":"Yes. The CP2 689 cc engine is essentially unchanged from 2014 to 2026, so oil capacity, torque values, filter part and service intervals carry across every MT-07 and the US-market FZ-07."},
      {"question":"What does an MT-07 major service cost?","answer":"The valve-clearance service is the expensive one, commonly 350-650 EUR / 400-700 USD at a dealer due to the labour to reach the cam cover. Minor oil-and-inspection services are far cheaper, and a DIY oil change costs little more than the oil and filter."}
    ]$faq$::jsonb,
    '8 min', 1736
  FROM new_post
  ON CONFLICT (post_id, locale) DO UPDATE SET
    title=EXCLUDED.title, excerpt=EXCLUDED.excerpt, seo_title=EXCLUDED.seo_title,
    seo_description=EXCLUDED.seo_description, body_raw=EXCLUDED.body_raw, body_text=EXCLUDED.body_text,
    keyword_text=EXCLUDED.keyword_text, faq=EXCLUDED.faq, reading_time=EXCLUDED.reading_time,
    word_count=EXCLUDED.word_count, updated_at=now()
  RETURNING post_id
),
cat_primary AS (
  INSERT INTO blog_post_categories (post_id, category_id, is_primary)
  SELECT np.id, c.id, true FROM new_post np, categories c WHERE c.slug='maintenance'
  ON CONFLICT DO NOTHING
  RETURNING post_id
),
cat_secondary AS (
  INSERT INTO blog_post_categories (post_id, category_id, is_primary)
  SELECT np.id, c.id, false FROM new_post np, categories c WHERE c.slug='diy'
  ON CONFLICT DO NOTHING
  RETURNING post_id
)
SELECT id FROM new_post;

-- 2) Keywords (3-6) then attach
WITH kw AS (
  INSERT INTO keywords (slug, name) VALUES
    ('mt-07-service-intervals','mt-07 service intervals'),
    ('mt-07-oil-change-interval','mt-07 oil change interval'),
    ('mt-07-maintenance-schedule','mt-07 maintenance schedule'),
    ('yamaha-mt-07-valve-clearance','yamaha mt-07 valve clearance'),
    ('yamaha-maintenance','yamaha maintenance')
  ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name
  RETURNING id
)
INSERT INTO blog_post_keywords (post_id, keyword_id)
SELECT (SELECT id FROM blog_posts WHERE slug='mt-07-service-intervals'), id FROM kw
ON CONFLICT DO NOTHING;

-- 3) SPEC provenance — record each source manual (maintenance_data_sources)
INSERT INTO maintenance_data_sources
  (source_type, title, edition_language, market_applicability, reference, source_url)
VALUES
  ('owner_manual', 'Yamaha MT-07 Owner''s Manual (2021, Europe)', 'English', 'EU', NULL,
   'https://www.yamahamotorsports.com/yamaha-manuals'),
  ('owner_manual', 'Yamaha FZ-07/MT-07 Owner''s Manual (2015-2021, US)', 'English', 'US', NULL,
   'https://www.manualslib.com/manual/837941/Yamaha-Mt-07.html'),
  ('community', 'maintenanceschedule.com — Yamaha MT-07/FZ-07 (2015+) Maintenance Schedule', 'English', 'Global', NULL,
   'https://maintenanceschedule.com/yamaha-mt-07-fz-07-maintenance/')
ON CONFLICT DO NOTHING;

-- 4) (SPEC value staging) The skill asks to stage extracted numeric spec values
--    with is_verified=false + source_id in the maintenance spec-values table.
--    That table's schema is NOT documented in references/db-schema.md and could
--    not be inspected live (MCP lacked project access). A human should run:
--        SELECT table_name FROM information_schema.tables
--        WHERE table_schema='public' AND table_name ILIKE '%maint%';
--    identify the spec-values table, then stage the numbers from the article
--    tables above (oil 2.60/2.30 L, drain 43 Nm, filter 17 Nm, valve 40,000 km EU /
--    42,000 km US, chain slack 51-56 mm, tyres 250/290 kPa) referencing the
--    maintenance_data_sources.id rows created in step 3, with is_verified=false.
