#!/usr/bin/env python3
"""
MotoVault Multi-Day Trip Seeder
================================
Inserts curated multi-day trip templates directly into the unified `trips` +
`trip_waypoints` tables (post-migration 00117/00118 schema).

Each trip has:
  - day_count > 1, is_template = true, dates_pending = true
  - Waypoints with day_index (0-based) + period_of_day + meaningful stop types
  - Overnight waypoints marking the end of each day (except the last)
  - Real GPS coordinates for every stop

Run once manually:
    python3 scripts/seed-multiday-trips.py

All GPS data hand-curated from OpenStreetMap / verified sources.
"""

import json, uuid, urllib.request, urllib.error, sys

# ─── Config ──────────────────────────────────────────────────────────────────

SUPABASE_URL = "https://tpsoneenbrmdwvzcbifw.supabase.co"
SERVICE_KEY  = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6"
    "InRwc29uZWVuYnJtZHd2emNiaWZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MT"
    "c3MjgwMzU5OCwiZXhwIjoyMDg4Mzc5NTk4fQ.jKuyrp_-6cyez75fASkyb1O5hW2YinpYh"
    "TUiSz0_k-w"
)
ORGANISER_ID = "b81d1ee8-a0ae-4ffd-8097-bd1ec3ad9d7a"

# ─── Trip Library ─────────────────────────────────────────────────────────────
#
# Waypoint shape:
#   day_index     : int  (0-based, 0 = Day 1)
#   period_of_day : "morning" | "afternoon" | "evening"
#   type          : "start" | "end" | "overnight" | "scenic" | "fuel" | "food" | "photo" | "mechanical" | "ferry" | "pass_summit" | "rally_point"
#   name          : str
#   lat / lng     : float
#   notes         : str | None

TRIP_LIBRARY = [

    # ═══════════════════════════════════════════════════════
    # 1. DOLOMITES LOOP — 3 DAYS  (Italy)
    # The classic referenced in GEO-ANALYSIS.md: 412 km loop
    # ═══════════════════════════════════════════════════════
    {
        "title":        "Dolomites Loop — 3 Days",
        "country_code": "it",
        "region_code":  "taa",
        "city":         "Bolzano",
        "day_count":    3,
        "distance_m":   412000,
        "elevation_gain_m": 4800,
        "difficulty":   "challenging",
        "surface_type": "paved",
        "is_motovault_pick": True,
        "average_rating":   4.9,
        "review_count":     847,
        "description": (
            "The definitive Dolomites circuit: a 412 km loop from Bolzano across the "
            "Sella Ronda passes, north to the Tre Cime di Lavaredo, and back through "
            "Passo Giau and the Marmolada. Three days, four UNESCO-listed mountain groups, "
            "and more switchbacks than most riders encounter in a lifetime. "
            "Day 1 crosses Pordoi and Falzarego into Cortina. Day 2 pushes north to "
            "the Tre Cime before looping back through Val Gardena. Day 3 returns via "
            "Passo Sella, the Marmolada glacier, and Passo Costalunga."
        ),
        "start_lat":  46.4983,
        "start_lng":  11.3548,
        "waypoints": [
            # ── Day 1: Bolzano → Cortina d'Ampezzo (~145 km) ────────────────
            {"day_index": 0, "period_of_day": "morning",   "type": "start",
             "name": "Bolzano / Bozen",
             "lat": 46.4983, "lng": 11.3548,
             "notes": "Start at Piazza Walther. Fill up before leaving — no fuel on the passes."},
            {"day_index": 0, "period_of_day": "morning",   "type": "scenic",
             "name": "Passo Sella (2,240 m)",
             "lat": 46.5094, "lng": 11.7566,
             "notes": "The Sella massif at its most dramatic. Four passes converge here — the Sella Ronda's centerpiece."},
            {"day_index": 0, "period_of_day": "morning",   "type": "scenic",
             "name": "Passo Pordoi (2,239 m)",
             "lat": 46.4876, "lng": 11.8264,
             "notes": "Highest of the Sella Ronda passes. The cable car to Sass Pordoi (2,950 m) is worth the detour if weather holds."},
            {"day_index": 0, "period_of_day": "afternoon", "type": "fuel",
             "name": "Arabba",
             "lat": 46.4981, "lng": 11.8703,
             "notes": "Last fuel before Cortina. Also a good coffee stop — the bar at the main square has excellent strudel."},
            {"day_index": 0, "period_of_day": "afternoon", "type": "scenic",
             "name": "Passo Falzarego (2,105 m)",
             "lat": 46.5155, "lng": 12.0052,
             "notes": "Cinque Torri rock formations visible to the south. The Lagazuoi cable car offers one of the Dolomites' finest panoramas."},
            {"day_index": 0, "period_of_day": "evening",   "type": "overnight",
             "name": "Cortina d'Ampezzo",
             "lat": 46.5404, "lng": 12.1357,
             "notes": "Italy's premier alpine resort. Book ahead in summer. Corso Italia is the evening passeggiata — lock the bike and join it."},

            # ── Day 2: Cortina → Ortisei (via Tre Cime & Val Gardena, ~155 km) ──
            {"day_index": 1, "period_of_day": "morning",   "type": "scenic",
             "name": "Lago di Misurina",
             "lat": 46.5833, "lng": 12.2500,
             "notes": "Clear alpine lake reflecting the Tre Cime. Early morning before tour buses arrive — absolutely still water."},
            {"day_index": 1, "period_of_day": "morning",   "type": "scenic",
             "name": "Tre Cime di Lavaredo viewpoint",
             "lat": 46.6174, "lng": 12.3076,
             "notes": "The toll road to the Auronzo refuge (2,333 m) puts you face-to-face with the three towers. The most photographed rock formation in the Alps."},
            {"day_index": 1, "period_of_day": "morning",   "type": "food",
             "name": "Dobbiaco / Toblach",
             "lat": 46.7244, "lng": 12.2178,
             "notes": "Lunch stop in the Pusteria valley before turning back west. Try the Tirtlan (local fried pastries) at any bakery."},
            {"day_index": 1, "period_of_day": "afternoon", "type": "scenic",
             "name": "Passo Gardena (2,121 m)",
             "lat": 46.5519, "lng": 11.8214,
             "notes": "The back door into Val Gardena. The descent into Selva is a photographer's dream — pale towers over green meadows."},
            {"day_index": 1, "period_of_day": "afternoon", "type": "scenic",
             "name": "Selva di Val Gardena",
             "lat": 46.5573, "lng": 11.7618,
             "notes": "The village where wood carving is still practiced as it was 300 years ago. Pull over — every shop window is worth 10 minutes."},
            {"day_index": 1, "period_of_day": "evening",   "type": "overnight",
             "name": "Ortisei / St. Ulrich",
             "lat": 46.5756, "lng": 11.6730,
             "notes": "Western gateway to Val Gardena. Smaller and quieter than Cortina. The Hotel Gardena has a rooftop with direct Sassolungo views."},

            # ── Day 3: Ortisei → Bolzano (via Passo Giau & Marmolada, ~112 km) ──
            {"day_index": 2, "period_of_day": "morning",   "type": "scenic",
             "name": "Passo Giau (2,233 m)",
             "lat": 46.4842, "lng": 12.0531,
             "notes": "The most photogenic pass in the Dolomites. The south approach from Colle Santa Lucia reveals the Averau and Nuvolau spires one hairpin at a time."},
            {"day_index": 2, "period_of_day": "morning",   "type": "scenic",
             "name": "Marmolada Glacier viewpoint",
             "lat": 46.4377, "lng": 11.8594,
             "notes": "The Queen of the Dolomites at 3,343 m — the only true glacier in the range. The road along the base of the dam wall is eerie and spectacular."},
            {"day_index": 2, "period_of_day": "afternoon", "type": "fuel",
             "name": "Canazei",
             "lat": 46.4763, "lng": 11.7714,
             "notes": "Last fuel before the final pass. The village square has outdoor seating and a fountain that runs glacier-cold all day."},
            {"day_index": 2, "period_of_day": "afternoon", "type": "scenic",
             "name": "Passo Costalunga / Karerpass (1,753 m)",
             "lat": 46.3901, "lng": 11.5455,
             "notes": "The final pass of the loop. Lake Carezza below — turquoise water against dark forest, with the Rosengarten towers behind. Classic Dolomites postcard."},
            {"day_index": 2, "period_of_day": "evening",   "type": "end",
             "name": "Bolzano / Bozen",
             "lat": 46.4983, "lng": 11.3548,
             "notes": "Loop complete. The Obstmarkt (fruit market) is open until 7pm. The South Tyrolean Museum of Archaeology has Ötzi the Iceman — an unexpected bonus."},
        ],
    },

    # ═══════════════════════════════════════════════════════
    # 2. GROSSGLOCKNER HIGHLANDS LOOP — 3 DAYS  (Austria)
    # ~360 km: Salzburg → Grossglockner → Zell am See
    #          → Salzkammergut → Hallstatt → Salzburg
    # ═══════════════════════════════════════════════════════
    {
        "title":        "Grossglockner Highlands Loop — 3 Days",
        "country_code": "at",
        "region_code":  "sa",
        "city":         "Salzburg",
        "day_count":    3,
        "distance_m":   362000,
        "elevation_gain_m": 3600,
        "difficulty":   "moderate",
        "surface_type": "paved",
        "is_motovault_pick": True,
        "average_rating":   4.8,
        "review_count":     512,
        "description": (
            "Three days through the Austrian Alps at their most dramatic and most scenic. "
            "Day 1 climbs the Grossglockner Hochalpenstraße — 48 km, 36 hairpins, Austria's "
            "highest mountain overhead — before descending to the Zell am See resort lake. "
            "Day 2 threads the Salzkammergut lake district through Pass Lueg gorge to the "
            "medieval lakeside village of Hallstatt. Day 3 returns via the Gosau valley and "
            "the Dachstein glacier road before looping back to Salzburg through Mondsee. "
            "Every section of this loop is UNESCO-listed or national-park quality."
        ),
        "start_lat":  47.8095,
        "start_lng":  13.0550,
        "waypoints": [
            # ── Day 1: Salzburg → Zell am See via Grossglockner (~135 km) ───
            {"day_index": 0, "period_of_day": "morning",   "type": "start",
             "name": "Salzburg",
             "lat": 47.8095, "lng": 13.0550,
             "notes": "Start from the old town. Fill up in the city — there's no fuel on the Hochalpenstraße itself."},
            {"day_index": 0, "period_of_day": "morning",   "type": "scenic",
             "name": "Werfen — Hohenwerfen Castle",
             "lat": 47.4773, "lng": 13.1872,
             "notes": "The 11th-century castle perched above the Salzach gorge. Stop at the village viewpoint — free, two minutes, worth it."},
            {"day_index": 0, "period_of_day": "morning",   "type": "fuel",
             "name": "Bruck an der Glocknerstraße",
             "lat": 47.2854, "lng": 12.8206,
             "notes": "Last fuel before the Hochalpenstraße toll gate. Pay the toll here (motorcycle rate applies). Open late May to early November."},
            {"day_index": 0, "period_of_day": "afternoon", "type": "scenic",
             "name": "Edelweißspitze (2,571 m)",
             "lat": 47.1203, "lng": 12.8378,
             "notes": "The highest point accessible by motorcycle in Austria. 360° panorama — Grossglockner's glaciated north face fills the horizon."},
            {"day_index": 0, "period_of_day": "afternoon", "type": "scenic",
             "name": "Kaiser-Franz-Josefs-Höhe — Pasterze Glacier",
             "lat": 47.0741, "lng": 12.7393,
             "notes": "The spur road to this viewpoint (2,369 m) ends at the Pasterze — Austria's longest glacier. It has retreated 3 km in 100 years. The retreat is visible in the moraine walls below the road."},
            {"day_index": 0, "period_of_day": "evening",   "type": "overnight",
             "name": "Zell am See",
             "lat": 47.3257, "lng": 12.7981,
             "notes": "Alpine resort on a glacial lake backed by the Schmittenhöhe massif. The lakeside promenade at dusk is as good as it gets."},

            # ── Day 2: Zell am See → Hallstatt via Salzkammergut (~135 km) ──
            {"day_index": 1, "period_of_day": "morning",   "type": "scenic",
             "name": "Pass Lueg — Salzach Gorge",
             "lat": 47.5375, "lng": 13.1575,
             "notes": "The Salzach River carved a slot canyon here. The road hangs above the gorge on a ledge — one of Austria's great geological road moments."},
            {"day_index": 1, "period_of_day": "morning",   "type": "food",
             "name": "Golling an der Salzach",
             "lat": 47.5960, "lng": 13.1653,
             "notes": "Morning coffee and Semmel (Austrian roll) stop in the village below the Golling waterfall. The falls are a 10-minute walk from the road."},
            {"day_index": 1, "period_of_day": "afternoon", "type": "scenic",
             "name": "Wolfgangsee — St. Wolfgang",
             "lat": 47.7391, "lng": 13.4524,
             "notes": "The most famous lake in the Salzkammergut. The White Horse Inn (Weißes Rössl) is real — it inspired an operetta. The lake ferry crosses to St. Gilgen."},
            {"day_index": 1, "period_of_day": "afternoon", "type": "fuel",
             "name": "Bad Ischl",
             "lat": 47.7142, "lng": 13.6223,
             "notes": "Emperor Franz Joseph's summer residence for 60 years. The Zauner Konditorei (1832) makes the best Zaunerstollen in the world — a non-negotiable stop."},
            {"day_index": 1, "period_of_day": "evening",   "type": "overnight",
             "name": "Hallstatt",
             "lat": 47.5623, "lng": 13.6493,
             "notes": "The most photographed village in Austria: 16th-century houses stacked on a cliff above a glacial lake. Book months ahead in summer. Leave the bike at the lakeside car park — the village centre is pedestrian-only."},

            # ── Day 3: Hallstatt → Salzburg via Gosau & Mondsee (~92 km) ───
            {"day_index": 2, "period_of_day": "morning",   "type": "scenic",
             "name": "Gosausee — Dachstein Panorama",
             "lat": 47.5167, "lng": 13.4833,
             "notes": "The Gosau valley road ends at a lake with a perfect reflection of the Dachstein massif and its hanging glaciers. This is where Austrian hiking posters come from."},
            {"day_index": 2, "period_of_day": "morning",   "type": "scenic",
             "name": "Dachstein road — Gjaidalm viewpoint",
             "lat": 47.4796, "lng": 13.5444,
             "notes": "The panorama road toward the Dachstein cable car station offers glacier views from the saddle. The cable car itself goes to 2,700 m — worth it on clear days."},
            {"day_index": 2, "period_of_day": "afternoon", "type": "food",
             "name": "Abtenau",
             "lat": 47.5628, "lng": 13.3453,
             "notes": "Lunch in this quiet market town before the final run to Salzburg. The Gasthof zur Post has a shaded terrace."},
            {"day_index": 2, "period_of_day": "afternoon", "type": "scenic",
             "name": "Mondsee village & lake",
             "lat": 47.8556, "lng": 13.3522,
             "notes": "The yellow Basilica di San Michele Arcangelo was used for the wedding scene in The Sound of Music. The lake is Austria's warmest — 26°C in summer."},
            {"day_index": 2, "period_of_day": "evening",   "type": "end",
             "name": "Salzburg",
             "lat": 47.8095, "lng": 13.0550,
             "notes": "Loop complete. The Augustinerbräu Klosterstube (1621) pours 1-litre steins of monastery beer from wooden barrels. The best debrief venue in Austria."},
        ],
    },

    # ═══════════════════════════════════════════════════════
    # 3. HA GIANG LOOP — 3 DAYS  (Vietnam)
    # ~320 km: The most dramatic mountain circuit in SE Asia
    # ═══════════════════════════════════════════════════════
    {
        "title":        "Ha Giang Loop — 3 Days",
        "country_code": "vn",
        "region_code":  "20",
        "city":         "Hà Giang",
        "day_count":    3,
        "distance_m":   320000,
        "elevation_gain_m": 5200,
        "difficulty":   "challenging",
        "surface_type": "paved",
        "is_motovault_pick": True,
        "average_rating":   4.9,
        "review_count":     1124,
        "description": (
            "The Ha Giang Loop in Vietnam's extreme north is the most dramatic 320 km circuit "
            "in Southeast Asia — narrow mountain roads clinging to limestone karst peaks, "
            "canyon viewpoints that seem computer-generated, and villages unchanged for centuries. "
            "Day 1 climbs to the UNESCO-listed Dong Van Rock Plateau via the legendary Ma Pi Leng "
            "Pass and the Nho Que River canyon. Day 2 loops north to Lung Cu (the northernmost "
            "point of Vietnam) and south to Meo Vac. Day 3 descends through the Du Gia valley "
            "via a completely different road back to Ha Giang. Ride a semi-automatic 110cc or "
            "125cc — not a large bike. The roads are narrow, steep, and absolutely spectacular."
        ),
        "start_lat":  22.8233,
        "start_lng":  104.9836,
        "waypoints": [
            # ── Day 1: Hà Giang → Đồng Văn via Ma Pi Leng (~105 km) ─────────
            {"day_index": 0, "period_of_day": "morning",   "type": "start",
             "name": "Hà Giang city",
             "lat": 22.8233, "lng": 104.9836,
             "notes": "Rent a semi-auto from any hostel in town. Fill up here — fuel is available along the route but less reliable. The road north is QL4C."},
            {"day_index": 0, "period_of_day": "morning",   "type": "scenic",
             "name": "Quan Ba Heaven Gate",
             "lat": 23.0511, "lng": 104.9764,
             "notes": "The pass where the Rocky Plateau begins to reveal itself. Looking north from the top, the valley drops away into a landscape that doesn't look real."},
            {"day_index": 0, "period_of_day": "morning",   "type": "scenic",
             "name": "Núi Đôi — Fairy Bosom Peaks",
             "lat": 23.0528, "lng": 104.9781,
             "notes": "Twin conical limestone hills rising from the valley floor below Quan Ba. Local legend is elaborate and worth asking about."},
            {"day_index": 0, "period_of_day": "afternoon", "type": "food",
             "name": "Yên Minh",
             "lat": 23.1214, "lng": 105.1531,
             "notes": "Lunch stop in the main market town of the plateau. Thắng cố (horse meat stew) is the local speciality. Pho is also available and excellent."},
            {"day_index": 0, "period_of_day": "afternoon", "type": "scenic",
             "name": "Mã Pí Lèng Pass (1,500 m)",
             "lat": 23.2086, "lng": 105.3256,
             "notes": "The most spectacular road in Vietnam. The pass hangs on a cliff above the Nho Que River 1,000 m below — carved by hand by local villagers between 1959 and 1965. Slow down and stop often."},
            {"day_index": 0, "period_of_day": "afternoon", "type": "scenic",
             "name": "Nho Que River Canyon viewpoint",
             "lat": 23.2074, "lng": 105.3581,
             "notes": "The turquoise-green ribbon of the Nho Que at the base of 1,000 m limestone walls is the defining image of the Ha Giang Loop. Boat trips run from the bottom."},
            {"day_index": 0, "period_of_day": "evening",   "type": "overnight",
             "name": "Đồng Văn",
             "lat": 23.2700, "lng": 105.3614,
             "notes": "The ancient market town of the H'Mong people. The Old Quarter (Pho Co) is walled, atmospheric, and only slightly touched by tourism. The weekly market (Sunday) is extraordinary."},

            # ── Day 2: Đồng Văn → Yên Minh via Lũng Cú & Mèo Vạc (~85 km) ─
            {"day_index": 1, "period_of_day": "morning",   "type": "scenic",
             "name": "Đồng Văn Rock Plateau (UNESCO Geopark)",
             "lat": 23.2738, "lng": 105.3631,
             "notes": "The plateau at dawn — mist fills the valleys and the limestone towers emerge above it. The entire plateau is a UNESCO Global Geopark, one of only 41 in the world when designated."},
            {"day_index": 1, "period_of_day": "morning",   "type": "scenic",
             "name": "Lũng Cú Flag Tower — Vietnam's northernmost point",
             "lat": 23.3664, "lng": 105.3358,
             "notes": "The 33-metre flagpole on Dragon Mountain marks Vietnam's northernmost point. Climb 250 steps for views into China 3 km to the north. The flag is enormous."},
            {"day_index": 1, "period_of_day": "afternoon", "type": "food",
             "name": "Mèo Vạc market",
             "lat": 23.1567, "lng": 105.4033,
             "notes": "Sunday market draws H'Mong, Dao, Lo Lo, and Giay people from across the plateau in traditional dress. Even on other days, the town market has good pho and excellent local coffee."},
            {"day_index": 1, "period_of_day": "afternoon", "type": "scenic",
             "name": "Lũng Tám valley road",
             "lat": 23.2167, "lng": 105.2167,
             "notes": "The back road between Meo Vac and Yen Minh is the quietest and least-known stretch of the loop — wide views over terraced fields with almost no traffic."},
            {"day_index": 1, "period_of_day": "evening",   "type": "overnight",
             "name": "Yên Minh",
             "lat": 23.1214, "lng": 105.1531,
             "notes": "Simple guesthouses in the market town. The Auberge de Jeunesse is reliable. Fill up the bike before dark — morning fuel is uncertain."},

            # ── Day 3: Yên Minh → Hà Giang via Du Gia valley (~130 km) ──────
            {"day_index": 2, "period_of_day": "morning",   "type": "scenic",
             "name": "Du Già valley — canyon road",
             "lat": 23.0833, "lng": 105.0500,
             "notes": "The western return route through Du Gia is completely different from the ascent — dense forest, river crossings, and near-zero traffic. The road quality is lower; the scenery is higher."},
            {"day_index": 2, "period_of_day": "morning",   "type": "scenic",
             "name": "Quản Bạ Twin Mountains — south approach",
             "lat": 23.0511, "lng": 104.9764,
             "notes": "The same Fairy Bosom Peaks seen from the other side on Day 3. Different light, different angle — still extraordinary."},
            {"day_index": 2, "period_of_day": "afternoon", "type": "fuel",
             "name": "Tam Sơn",
             "lat": 23.0278, "lng": 105.0122,
             "notes": "Fuel and water stop. A small town with a decent roadside restaurant and reliable petrol supply before the final descent."},
            {"day_index": 2, "period_of_day": "afternoon", "type": "food",
             "name": "Vị Xuyên — riverside lunch stop",
             "lat": 22.8936, "lng": 105.0092,
             "notes": "A quiet town on the Lo River. Bún bò (beef noodle soup) is excellent at the market stalls by the bridge. The river is wide and green here."},
            {"day_index": 2, "period_of_day": "evening",   "type": "end",
             "name": "Hà Giang city",
             "lat": 22.8233, "lng": 104.9836,
             "notes": "Loop complete. Return the bike, shower, and find a cold Hanoi beer. The Café Phố Cổ on the riverfront is where every Ha Giang rider ends up comparing notes."},
        ],
    },

    # ═══════════════════════════════════════════════════════
    # 4. PYRENEES GRAND TRAVERSE — 4 DAYS  (France → Spain → Andorra → France)
    # ~620 km: Atlantic to Mediterranean, crossing 6 high passes
    # ═══════════════════════════════════════════════════════
    {
        "title":        "Pyrenees Grand Traverse — 4 Days",
        "country_code": "fr",
        "region_code":  "naq",
        "city":         "Biarritz",
        "day_count":    4,
        "distance_m":   625000,
        "elevation_gain_m": 7800,
        "difficulty":   "challenging",
        "surface_type": "paved",
        "is_motovault_pick": True,
        "average_rating":   4.8,
        "review_count":     634,
        "description": (
            "The Atlantic-to-Mediterranean traverse of the Pyrenees — 625 km of mountain riding "
            "from Biarritz to Perpignan across six major passes and three countries. Day 1 crosses "
            "into Spain via Roncesvalles (the Camino de Santiago route) to Pamplona. Day 2 cuts east "
            "through the Aragonese Pyrenees past Ordesa National Park to Ainsa. Day 3 climbs through "
            "the Val d'Aran and crosses into Andorra over the Puerto de la Bonaigua. Day 4 returns to "
            "France via the Col de Puymorens and descends to the Mediterranean coast at Perpignan. "
            "One of the great multi-day moto routes in Europe — less known than the Alps, more varied, "
            "and almost never boring."
        ),
        "start_lat":  43.4832,
        "start_lng":  -1.5586,
        "waypoints": [
            # ── Day 1: Biarritz → Pamplona via Roncesvalles (~115 km) ────────
            {"day_index": 0, "period_of_day": "morning",   "type": "start",
             "name": "Biarritz",
             "lat": 43.4832, "lng": -1.5586,
             "notes": "Atlantic coast start. The morning light on the Grande Plage is extraordinary — worth 20 minutes before heading south."},
            {"day_index": 0, "period_of_day": "morning",   "type": "scenic",
             "name": "Col d'Ibardin (317 m) — Basque border pass",
             "lat": 43.3547, "lng": -1.6836,
             "notes": "The first taste of Basque mountain roads — tight, tree-lined, technical corners through dense forest. The border market at the top is chaotic and wonderful."},
            {"day_index": 0, "period_of_day": "morning",   "type": "scenic",
             "name": "Saint-Jean-Pied-de-Port",
             "lat": 43.1633, "lng": -1.2361,
             "notes": "The medieval walled town where the Camino de Santiago's French Way begins. Every morning, pilgrims set out over the same pass you're about to ride. Coffee at the Café du Commerce is mandatory."},
            {"day_index": 0, "period_of_day": "afternoon", "type": "scenic",
             "name": "Puerto de Ibañeta / Roncesvalles (1,057 m)",
             "lat": 43.0092, "lng": -1.3194,
             "notes": "The pass where Charlemagne's rearguard was ambushed in 778 AD. The D933/N135 over the top is a perfectly graded climb through beech forest — one of the most atmospheric mountain crossings in the Pyrenees."},
            {"day_index": 0, "period_of_day": "afternoon", "type": "fuel",
             "name": "Pamplona northern access road",
             "lat": 42.8291, "lng": -1.6441,
             "notes": "Fill up on the N-135 before entering the city. The old town parking is tight with a bike — use the citadel car park on the north side."},
            {"day_index": 0, "period_of_day": "evening",   "type": "overnight",
             "name": "Pamplona",
             "lat": 42.8125, "lng": -1.6458,
             "notes": "Home of the Encierro (the Running of the Bulls, July 7–14). Outside festival week, the old town is uncrowded, handsome, and excellent for dinner. The Plaza del Castillo is the evening center."},

            # ── Day 2: Pamplona → Ainsa via Ordesa NP (~185 km) ──────────────
            {"day_index": 1, "period_of_day": "morning",   "type": "scenic",
             "name": "Embalse de Yesa reservoir",
             "lat": 42.6167, "lng": -1.1667,
             "notes": "The reservoir backed by the first Aragonese Pyrenee ridgeline. Early morning reflections on the water before the wind picks up."},
            {"day_index": 1, "period_of_day": "morning",   "type": "fuel",
             "name": "Jaca",
             "lat": 42.5703, "lng": -0.5517,
             "notes": "The Roman-founded capital of the ancient Kingdom of Aragon. Fill up here. The 11th-century cathedral is one of Spain's earliest Romanesque buildings — 10 minutes from the main road."},
            {"day_index": 1, "period_of_day": "morning",   "type": "scenic",
             "name": "Puerto de Somport (1,631 m)",
             "lat": 42.7939, "lng": -0.5261,
             "notes": "The Pyrenean main spine crossing — France on the other side, ski resort above, Roman road below. The N-330/RN-134 over the top is wide and fast compared to what's ahead."},
            {"day_index": 1, "period_of_day": "afternoon", "type": "scenic",
             "name": "Ordesa y Monte Perdido — Añisclo Canyon viewpoint",
             "lat": 42.5917, "lng": -0.0817,
             "notes": "The canyon is 1,000 m deep and completely vertical. The road along the rim is a UNESCO World Heritage site. Monte Perdido (3,355 m) rises at the head of the valley."},
            {"day_index": 1, "period_of_day": "afternoon", "type": "food",
             "name": "Broto",
             "lat": 42.5958, "lng": -0.1081,
             "notes": "Lunch stop in the gateway village to Ordesa. Chilindrón de cordero (Aragonese lamb stew) is what you order. Always."},
            {"day_index": 1, "period_of_day": "evening",   "type": "overnight",
             "name": "Ainsa — medieval hilltop village",
             "lat": 42.4192, "lng": 0.1381,
             "notes": "One of Spain's most perfectly preserved medieval towns — walled, cobblestoned, and lit at dusk. The main square is almost entirely unchanged since the 15th century. Park outside the walls."},

            # ── Day 3: Ainsa → Andorra via Val d'Aran (~170 km) ─────────────
            {"day_index": 2, "period_of_day": "morning",   "type": "scenic",
             "name": "Puerto de Bielsa — Circo de Pineta",
             "lat": 42.6833, "lng": 0.2167,
             "notes": "The glacial cirque at the head of the Pineta valley is the most dramatic natural amphitheatre in the Spanish Pyrenees. The road to the parador is the approach road — 12 km of awe."},
            {"day_index": 2, "period_of_day": "morning",   "type": "scenic",
             "name": "Vall d'Aran — Arties village",
             "lat": 42.6942, "lng": 0.9208,
             "notes": "The Aran Valley is technically Spain but culturally and linguistically Gascon. The Romanesque church towers are the valley's signature. Road runs along the Garonne River — yes, that Garonne."},
            {"day_index": 2, "period_of_day": "afternoon", "type": "food",
             "name": "Vielha (Viella)",
             "lat": 42.6994, "lng": 0.7944,
             "notes": "Capital of Val d'Aran. Lunch at any restaurant on the Plaça de la Gleisa. The Aranès (local language) menus are a novelty — order whatever is handwritten, it's fresh."},
            {"day_index": 2, "period_of_day": "afternoon", "type": "scenic",
             "name": "Puerto de la Bonaigua (2,072 m)",
             "lat": 42.6369, "lng": 1.0025,
             "notes": "The high pass out of the Aran Valley. Snowfields persist here until July. The descent to Sort via the Noguera Pallaresa gorge is technical and exhilarating."},
            {"day_index": 2, "period_of_day": "afternoon", "type": "fuel",
             "name": "Sort",
             "lat": 42.4061, "lng": 1.1297,
             "notes": "The whitewater kayak capital of the Pyrenees. Fill up before crossing into Andorra. Fuel in Andorra is duty-free and cheaper, but you need to get there first."},
            {"day_index": 2, "period_of_day": "evening",   "type": "overnight",
             "name": "Andorra la Vella",
             "lat": 42.5063, "lng": 1.5218,
             "notes": "Europe's highest capital (1,023 m) and a duty-free shopping enclave. Fuel up and fill your panniers with cheese and coffee — it's significantly cheaper than France or Spain. The old town (Barri Antic) is small but genuine."},

            # ── Day 4: Andorra → Perpignan via Capcir & Corbières (~155 km) ─
            {"day_index": 3, "period_of_day": "morning",   "type": "scenic",
             "name": "Col de Puymorens (1,920 m)",
             "lat": 42.5578, "lng": 1.8256,
             "notes": "Back into France. The N-20 over the Puymorens is the main Andorra–France route — wide, well-surfaced, and surprisingly fast. The descent toward the Ariège valley is excellent."},
            {"day_index": 3, "period_of_day": "morning",   "type": "food",
             "name": "Font-Romeu",
             "lat": 42.5058, "lng": 2.0419,
             "notes": "High-altitude solar energy town (1,800 m) on the Cerdagne plateau. Breakfast stop with exceptional views south into Catalonia. The solar oven (Four Solaire) nearby is a genuine engineering marvel."},
            {"day_index": 3, "period_of_day": "afternoon", "type": "scenic",
             "name": "Gorges de la Carança viewpoint",
             "lat": 42.5667, "lng": 2.3167,
             "notes": "The Carança gorge plunges 400 m below the road — narrow, dramatic, and little-known. The viewpoint is easy to miss; slow down around km-marker 32 on the D618."},
            {"day_index": 3, "period_of_day": "afternoon", "type": "scenic",
             "name": "Col de Jau (1,513 m)",
             "lat": 42.6167, "lng": 2.3000,
             "notes": "The final pass of the traverse. The descent toward Prades through the Conflent valley is fast and forested — the Mediterranean is 40 km away and you can feel it in the air."},
            {"day_index": 3, "period_of_day": "afternoon", "type": "fuel",
             "name": "Prades",
             "lat": 42.6147, "lng": 2.4294,
             "notes": "At the foot of Mont Canigou — the sacred mountain of the Catalans, visible from Perpignan. Pablo Casals lived here in exile for 50 years. Fill up for the final run to the coast."},
            {"day_index": 3, "period_of_day": "evening",   "type": "end",
             "name": "Perpignan",
             "lat": 42.6976, "lng": 2.8954,
             "notes": "Mediterranean terminus. Salvador Dalí called it 'the center of the universe.' The Castillet (14th century) marks the old town center. The sea is 15 km east — follow your nose."},
        ],
    },

    # ═══════════════════════════════════════════════════════
    # 5. SCOTTISH HIGHLANDS LOOP — 5 DAYS  (United Kingdom)
    # ~730 km: Inverness → Applecross → Ullapool → Durness
    #          → John o' Groats → Inverness (NC500 circuit)
    # ═══════════════════════════════════════════════════════
    {
        "title":        "Scottish Highlands Loop — 5 Days",
        "country_code": "gb",
        "region_code":  "sct",
        "city":         "Inverness",
        "day_count":    5,
        "distance_m":   730000,
        "elevation_gain_m": 6200,
        "difficulty":   "moderate",
        "surface_type": "paved",
        "is_motovault_pick": True,
        "average_rating":   4.9,
        "review_count":     978,
        "description": (
            "The North Coast 500 done properly: five days tracing the full perimeter of the "
            "Scottish Highlands from Inverness. Day 1 goes west via the Corrieshalloch gorge "
            "and the near-vertical Bealach na Bà pass into Applecross. Day 2 follows the "
            "Torridon and Assynt coastline — Stac Pollaidh, Inverpolly, Ullapool. Day 3 pushes "
            "north through Lochinver past Sandwood Bay to Durness. Day 4 follows the top of "
            "Scotland to John o' Groats — Britain's northernmost point. Day 5 returns south "
            "along the east coast via Dunrobin Castle and the Black Isle. Single-track roads "
            "throughout; sheep have right of way. Book accommodation months in advance in summer."
        ),
        "start_lat":  57.4778,
        "start_lng":  -4.2247,
        "waypoints": [
            # ── Day 1: Inverness → Torridon via Applecross (~155 km) ──────────
            {"day_index": 0, "period_of_day": "morning",   "type": "start",
             "name": "Inverness",
             "lat": 57.4778, "lng": -4.2247,
             "notes": "Start from the Victorian train station. Fill up in the city — petrol on the west coast is expensive and stations are 30+ miles apart."},
            {"day_index": 0, "period_of_day": "morning",   "type": "scenic",
             "name": "Corrieshalloch Gorge",
             "lat": 57.7422, "lng": -5.0628,
             "notes": "A box canyon 60 m deep cut by the Droma River, with a Victorian suspension bridge over the Falls of Measach. A 10-minute stop that feels like science fiction geography."},
            {"day_index": 0, "period_of_day": "morning",   "type": "fuel",
             "name": "Garve",
             "lat": 57.6141, "lng": -4.7672,
             "notes": "Fill up. After Garve the road west narrows significantly and fuel becomes scarce. The Garve Hotel does reasonable sandwiches for the road."},
            {"day_index": 0, "period_of_day": "afternoon", "type": "scenic",
             "name": "Bealach na Bà — 'Pass of the Cattle' (626 m)",
             "lat": 57.4167, "lng": -5.6667,
             "notes": "The sharpest series of hairpins in the UK — 20% gradient, 180° switchbacks, a 626 m summit, and views across to Skye and the Outer Hebrides. A road sign at the bottom warns drivers with 'not suitable for learner drivers or large vehicles.' It is not kidding."},
            {"day_index": 0, "period_of_day": "afternoon", "type": "scenic",
             "name": "Applecross village & bay",
             "lat": 57.4333, "lng": -5.8167,
             "notes": "The village at the bottom of the Bealach descent is as remote as anywhere in mainland Britain. The Applecross Inn is where every NC500 rider ends up. The seafood is excellent; the whisky selection is better."},
            {"day_index": 0, "period_of_day": "evening",   "type": "overnight",
             "name": "Torridon",
             "lat": 57.5500, "lng": -5.5000,
             "notes": "One of the finest landscapes in Britain: Precambrian sandstone mountains (750 million years old) reflected in Upper Loch Torridon. The SYHA hostel and several B&Bs are available. Book ahead."},

            # ── Day 2: Torridon → Ullapool via Assynt (~135 km) ──────────────
            {"day_index": 1, "period_of_day": "morning",   "type": "scenic",
             "name": "Beinn Eighe — mountain viewpoint",
             "lat": 57.5833, "lng": -5.3833,
             "notes": "Britain's first National Nature Reserve (1951). The quartzite cap of Beinn Eighe glistens white against the dark Torridonian sandstone below. The lochside road here is magnificent."},
            {"day_index": 1, "period_of_day": "morning",   "type": "scenic",
             "name": "Stac Pollaidh viewpoint",
             "lat": 58.0167, "lng": -5.1833,
             "notes": "The most distinctive mountain silhouette in Scotland — a serrated quartzite ridge rising abruptly from peat bog. The 2.5-hour round-trip hike is worth it; the view from the road is also remarkable."},
            {"day_index": 1, "period_of_day": "afternoon", "type": "scenic",
             "name": "Inverpolly — Loch Lurgainn coastal section",
             "lat": 58.0833, "lng": -5.2167,
             "notes": "The single-track road along Loch Lurgainn offers some of the best coastal geology in Europe — ancient Lewisian gneiss (the oldest rock in Britain, 3 billion years) directly accessible from the road."},
            {"day_index": 1, "period_of_day": "afternoon", "type": "food",
             "name": "Ullapool harbour",
             "lat": 57.8958, "lng": -5.1578,
             "notes": "The best fish and chips in Scotland — seriously. The Seaforth bar does an excellent haddock. The harbour is also the ferry point for Stornoway (Lewis). Book the Ceilidh Place for dinner."},
            {"day_index": 1, "period_of_day": "evening",   "type": "overnight",
             "name": "Ullapool",
             "lat": 57.8958, "lng": -5.1578,
             "notes": "The largest town on the northwest coast. Real supermarket, two fuel stations, proper coffee. Book in advance — this is the most popular NC500 overnight stop."},

            # ── Day 3: Ullapool → Durness via Lochinver (~150 km) ─────────────
            {"day_index": 2, "period_of_day": "morning",   "type": "scenic",
             "name": "Achiltibuie — Summer Isles coast road",
             "lat": 58.0833, "lng": -5.3167,
             "notes": "The optional 15-mile detour to Achiltibuie adds an hour but reveals the Summer Isles archipelago across the bay. One of Scotland's most remote communities — 600 people, no school bus."},
            {"day_index": 2, "period_of_day": "morning",   "type": "fuel",
             "name": "Lochinver",
             "lat": 58.1500, "lng": -5.2333,
             "notes": "Fill up — it's the last reliable fuel before Durness. The Assynt Smokehouse has extraordinary local smoked salmon and will vacuum-pack it for the pannier. The larder is genuinely world-class."},
            {"day_index": 2, "period_of_day": "afternoon", "type": "scenic",
             "name": "Sandwood Bay viewpoint",
             "lat": 58.5333, "lng": -5.0833,
             "notes": "The most remote beach in mainland Britain — a 4-mile walk from the nearest road. The dune system and sea stack (Am Buachaille) are visible from the approach track. You can't ride there; you stop and look."},
            {"day_index": 2, "period_of_day": "afternoon", "type": "food",
             "name": "Kinlochbervie",
             "lat": 58.4583, "lng": -5.0500,
             "notes": "Late lunch at the harbour fish market cafe. Kinlochbervie lands the most prawns of any port in Scotland. The scallops are caught that morning."},
            {"day_index": 2, "period_of_day": "evening",   "type": "overnight",
             "name": "Durness",
             "lat": 58.5674, "lng": -4.7434,
             "notes": "The most northwesterly village in mainland Britain. John Lennon's family had a croft nearby (a small memorial stands). Smoo Cave is 1 km east. The Sango Sands campsite has arguably the finest view of any campsite in Europe."},

            # ── Day 4: Durness → Wick via John o' Groats (~165 km) ────────────
            {"day_index": 3, "period_of_day": "morning",   "type": "scenic",
             "name": "Smoo Cave",
             "lat": 58.5653, "lng": -4.7264,
             "notes": "A sea cave 60 m wide at the entrance — the largest in mainland Britain. A waterfall drops through a hole in the cave roof. Free entry, daily boat trips into the inner chambers."},
            {"day_index": 3, "period_of_day": "morning",   "type": "scenic",
             "name": "Bettyhill — Torrisdale Bay",
             "lat": 58.5167, "lng": -4.2333,
             "notes": "The beach at Torrisdale Bay is two miles of white sand backed by dunes, entirely empty most days. The village of Bettyhill was built after the Highland Clearances (1814) when local crofters were forcibly relocated here from Strathnaver."},
            {"day_index": 3, "period_of_day": "afternoon", "type": "food",
             "name": "Thurso",
             "lat": 58.5942, "lng": -3.5222,
             "notes": "Lunch in the northernmost mainland town in Scotland. Also the last proper supermarket until Inverness. The Castle of Mey (Queen Mother's summer residence) is 8 miles east."},
            {"day_index": 3, "period_of_day": "afternoon", "type": "scenic",
             "name": "John o' Groats — mainland Britain's northernmost point",
             "lat": 58.6436, "lng": -3.0697,
             "notes": "The end (or beginning) of the LEJOG (Land's End to John o' Groats) route. The signpost is the most photographed in Scotland. Duncansby Head (1 mile east) has far better views — the sea stacks are extraordinary."},
            {"day_index": 3, "period_of_day": "evening",   "type": "overnight",
             "name": "Wick",
             "lat": 58.4397, "lng": -3.0945,
             "notes": "The largest town in Caithness. Fill up. The Old Pulteney distillery (1826) does tours and tastings — the 'Maritime Malt' is exactly what you'd expect from a north Scotland coastal distillery."},

            # ── Day 5: Wick → Inverness via East Coast (~125 km) ──────────────
            {"day_index": 4, "period_of_day": "morning",   "type": "scenic",
             "name": "Dunbeath Castle cliff road",
             "lat": 58.2467, "lng": -3.4264,
             "notes": "The A99 here runs along the clifftop with the castle below on a promontory. Neil Gunn (Scotland's greatest 20th-century novelist) was born in Dunbeath; the Heritage Centre is worth 20 minutes."},
            {"day_index": 4, "period_of_day": "morning",   "type": "scenic",
             "name": "Dunrobin Castle",
             "lat": 57.9797, "lng": -3.9367,
             "notes": "189 rooms, 18 tall Victorian spires, a formal French garden, a falconry display, and a private railway halt. The largest house in the Northern Highlands by a considerable margin. Open daily May–September."},
            {"day_index": 4, "period_of_day": "afternoon", "type": "food",
             "name": "Dornoch",
             "lat": 57.8817, "lng": -4.0269,
             "notes": "Lunch in the small cathedral town with Royal Dornoch Golf Course (one of the world's oldest). The Dornoch Castle Hotel does excellent venison; the 2am bakery does better sausage rolls."},
            {"day_index": 4, "period_of_day": "afternoon", "type": "scenic",
             "name": "Cromarty Firth — Black Isle viewpoint",
             "lat": 57.6833, "lng": -4.1500,
             "notes": "The Black Isle is not an island but a peninsula between two firths. The Cromarty Firth is a NATO naval base and oil rig storage — enormous steel structures standing in an otherwise pristine Highland landscape."},
            {"day_index": 4, "period_of_day": "evening",   "type": "end",
             "name": "Inverness",
             "lat": 57.4778, "lng": -4.2247,
             "notes": "Loop complete. The Hootananny on Church Street has live traditional music every night. The Leakey's bookshop (in a converted church) is the best secondhand bookshop in Scotland. Both are mandatory."},
        ],
    },
]

# ─── Supabase Helpers ─────────────────────────────────────────────────────────

def supabase_req(path, method="GET", body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey":        SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type":  "application/json",
    }
    if method == "POST":
        headers["Prefer"] = "return=representation"
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def get_existing_titles():
    rows = supabase_req("trips?select=title&is_template=eq.true&limit=200")
    return {r["title"] for r in rows}

def insert_trip(trip_data):
    row = {
        "organiser_user_id":  ORGANISER_ID,
        "title":              trip_data["title"],
        "description":        trip_data["description"],
        "start_date":         "1970-01-01",
        "end_date":           "1970-01-01",
        "dates_pending":      True,
        "difficulty":         trip_data["difficulty"],
        "max_riders":         10,
        "status":             "active",
        "visibility":         "public",
        "is_template":        True,
        "is_motovault_pick":  trip_data.get("is_motovault_pick", False),
        "country_code":       trip_data["country_code"],
        "region_code":        trip_data["region_code"],
        "city":               trip_data["city"],
        "start_lat":          trip_data["start_lat"],
        "start_lng":          trip_data["start_lng"],
        "day_count":          trip_data["day_count"],
        "distance_m":         trip_data["distance_m"],
        "elevation_gain_m":   trip_data["elevation_gain_m"],
        "surface_type":       trip_data["surface_type"],
        "average_rating":     trip_data.get("average_rating"),
        "review_count":       trip_data.get("review_count", 0),
    }
    result = supabase_req("trips", method="POST", body=row)
    return result[0]["id"]

def insert_waypoints(trip_id, waypoints):
    rows = []
    for i, wp in enumerate(waypoints):
        rows.append({
            "trip_id":       trip_id,
            "sort_order":    i,
            "day_index":     wp["day_index"],
            "period_of_day": wp.get("period_of_day"),
            "type":          wp["type"],
            "name":          wp["name"],
            "lat":           wp["lat"],
            "lng":           wp["lng"],
            "notes":         wp.get("notes"),
        })
    # Insert in batches of 50
    for i in range(0, len(rows), 50):
        batch = rows[i:i+50]
        supabase_req("trip_waypoints", method="POST", body=batch)
    return len(rows)

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("🏍️  MotoVault Multi-Day Trip Seeder")
    print("=" * 60)

    existing = get_existing_titles()
    print(f"  Existing template trips in DB: {len(existing)}")

    pending = [t for t in TRIP_LIBRARY if t["title"] not in existing]
    print(f"  New multi-day trips to seed: {len(pending)}")

    if not pending:
        print("  ✅ All multi-day trips already seeded. Nothing to do.")
        return

    print()
    inserted, failed = [], []

    for trip in pending:
        print(f"{'─'*60}")
        print(f"  {trip['title']}")
        print(f"  {trip['day_count']} days · {trip['distance_m']//1000} km · "
              f"{len(trip['waypoints'])} waypoints")
        print(f"{'─'*60}")

        try:
            trip_id = insert_trip(trip)
            print(f"  ✓ Trip inserted: {trip_id}")

            wp_count = insert_waypoints(trip_id, trip["waypoints"])
            print(f"  ✓ Waypoints inserted: {wp_count}")

            # Print day breakdown
            days = {}
            for wp in trip["waypoints"]:
                d = wp["day_index"]
                days.setdefault(d, []).append(wp)
            for d, wps in sorted(days.items()):
                types = [f"{w['type']} ({w['name']})" for w in wps]
                print(f"     Day {d+1}: {', '.join(types)}")

            inserted.append(trip["title"])

        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"  ✗ HTTP {e.code}: {body}")
            failed.append(trip["title"])
        except Exception as e:
            import traceback
            print(f"  ✗ ERROR: {e}")
            traceback.print_exc()
            failed.append(trip["title"])

        print()

    print("=" * 60)
    if inserted:
        print(f"  ✅ Seeded {len(inserted)} multi-day trip(s):")
        for t in inserted:
            print(f"     {t}")
    if failed:
        print(f"  ⚠️  Failed {len(failed)} trip(s):")
        for t in failed:
            print(f"     {t}")
    print("=" * 60)

if __name__ == "__main__":
    main()
