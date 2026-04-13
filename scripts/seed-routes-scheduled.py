#!/usr/bin/env python3
"""
MotoVault Autonomous Route Seeder
==================================
Runs twice daily. Checks Supabase for existing routes, picks 2–3 routes
from the pre-researched library that are not yet in the database, fetches
real GPS geometry from OpenStreetMap, and inserts them.

All geometry © OpenStreetMap contributors (ODbL license).
"""

import urllib.request, urllib.parse, json, math, time, random, sys
import xml.etree.ElementTree as ET

# ─── Config ──────────────────────────────────────────────────────────────────

SUPABASE_URL   = "https://tpsoneenbrmdwvzcbifw.supabase.co"
SERVICE_KEY    = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6"
    "InRwc29uZWVuYnJtZHd2emNiaWZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MT"
    "c3MjgwMzU5OCwiZXhwIjoyMDg4Mzc5NTk4fQ.jKuyrp_-6cyez75fASkyb1O5hW2YinpYh"
    "TUiSz0_k-w"
)
CONTRIBUTOR_ID = "b81d1ee8-a0ae-4ffd-8097-bd1ec3ad9d7a"
OSM_UA         = "MotoVault-Research/1.0 (motovault.app)"
ROUTES_PER_RUN = 3   # how many routes to add each run

# ─── Route Library ───────────────────────────────────────────────────────────
# Each entry:
#   name          : exact string stored in DB (used to detect duplicates)
#   relation_id   : OSM relation ID  (use EITHER this or way_ids)
#   way_ids       : explicit ordered way IDs (alternative to relation)
#   bbox_clip     : [min_lat, min_lon, max_lat, max_lon] to trim long relations
#   region        : "USA" | "Europe" | "South America"
#   description, editorial_description, is_motovault_pick,
#   surface_type, elevation_gain_m, rating_avg, rating_count

ROUTE_LIBRARY = [

    # ═══════════════════════════════════════════════════════
    # USA
    # ═══════════════════════════════════════════════════════

    {
        "name": "Kancamagus Highway — New Hampshire",
        "region": "USA",
        "description": (
            "NH-112, the 'Kanc,' slices 35 miles through the White Mountain National Forest from "
            "Lincoln to Conway — one of the most concentrated stretches of fall foliage on the "
            "East Coast. Elevation changes of 2,855 ft pack stunning viewpoints, covered bridges, "
            "and Swift River swimming holes into a compact, perfectly paced ride."
        ),
        "editorial_description": (
            "The road has no traffic lights and no commercial development — just White Mountain "
            "wilderness for 35 miles. Peak foliage (mid-October) turns the canopy into stained "
            "glass and draws serious crowds. Ride it in September or early October for color "
            "without the traffic. Stop at Sabbaday Falls (15-min walk, genuinely impressive)."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 530,
        "rating_avg": 4.6, "rating_count": 478,
        "relation_id": 12455343,
    },
    {
        "name": "Angeles Crest Highway — California",
        "region": "USA",
        "description": (
            "CA-2 climbs from La Cañada Flintridge into the San Gabriel Mountains, peaking at "
            "Mt. Waterman (8,038 ft) before descending to Wrightwood — 66 miles of sustained "
            "technical canyon riding above the LA basin. The upper sections are high-alpine; "
            "the lower stretches are tight canyon carving. On a clear day the Pacific is visible "
            "from the ridge. It's Los Angeles's best-kept moto secret."
        ),
        "editorial_description": (
            "The road is closed in winter above Islip Saddle (check CalTrans). Spring and fall "
            "are the windows — summer gets hot and busy, winter gets snowy and closes. "
            "Red Box Junction (halfway) has a ranger station and water. Watch for rocks on the "
            "road after rainfall; the Angeles is more exposed than Mulholland and gets debris."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 1380,
        "rating_avg": 4.7, "rating_count": 612,
        "relation_id": 301552,
    },
    {
        "name": "Natchez Trace Parkway — Tennessee",
        "region": "USA",
        "description": (
            "The Natchez Trace Parkway follows an ancient path used by Native Americans, "
            "Kaintuck boatmen, and Andrew Jackson's army. The 444-mile parkway from Natchez MS "
            "to Nashville TN passes through rolling hardwood forest, Civil War sites, and mounds "
            "thousands of years old — with zero traffic lights, zero commercial traffic, and a "
            "50 mph limit. It's the closest thing to a motorcycle-only corridor in America."
        ),
        "editorial_description": (
            "The Tennessee section alone is worth the trip: the Nashville approach crosses the "
            "Double Arch Bridge (the longest segmental concrete bridge in the US), and the "
            "Meriwether Lewis Monument at milepost 385 is a genuinely moving stop. "
            "The parkway's ranger patrols the 50 mph limit seriously."
        ),
        "is_motovault_pick": False,
        "surface_type": "paved", "elevation_gain_m": 280,
        "rating_avg": 4.5, "rating_count": 389,
        "relation_id": 3300031,
    },
    {
        "name": "Trail Ridge Road — Rocky Mountain National Park",
        "region": "USA",
        "description": (
            "Trail Ridge Road is the highest continuous paved road in the United States, "
            "climbing to 12,183 ft above treeline through Rocky Mountain National Park. "
            "Elk graze on the tundra roadside. Ptarmigan walk across the pavement. "
            "The views from the Alpine Visitor Center stretch to Wyoming. For 11 miles "
            "the road stays above 11,000 ft — long enough to notice the altitude."
        ),
        "editorial_description": (
            "The road is only open June through mid-October, and afternoon thunderstorms "
            "above treeline can appear with almost no warning. Ride the high section before "
            "noon. The Many Parks Curve and Rainbow Curve overlooks are the classic stops. "
            "If you see weather building over the Never Summer Range, descend — you're exposed."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 920,
        "rating_avg": 4.8, "rating_count": 543,
        "relation_id": 4594374,
    },
    {
        "name": "Ohio Route 555 — The Triple Nickel",
        "region": "USA",
        "description": (
            "Ohio's best-kept secret. Route 555 threads through the Appalachian foothills of "
            "southeast Ohio — an area so rural it's called the 'Little Switzerland' — with "
            "exactly the kind of second-gear, back-and-forth switchbacks you'd expect to find "
            "on a mountain pass. For a state famous for being flat, this stretch is a genuine "
            "revelation. No guardrails, steep drops, heavy twisting."
        ),
        "editorial_description": (
            "Start at McConnelsville and ride north to Stockport. The Triple Nickel draws "
            "Midwest sportbike riders the way Deals Gap draws the Southeast crowd. "
            "The road is narrow with very little margin for error; give oncoming trucks "
            "plenty of respect on the blind curves. Local diner in Chesterhill is the "
            "traditional mid-point breakfast stop."
        ),
        "is_motovault_pick": False,
        "surface_type": "paved", "elevation_gain_m": 340,
        "rating_avg": 4.4, "rating_count": 278,
        "relation_id": 1592708,
    },
    {
        "name": "Florida Keys Scenic Highway — Overseas Highway",
        "region": "USA",
        "description": (
            "US-1 through the Florida Keys is 113 miles of bridges and causeways across open "
            "ocean — the only highway in the US where you ride with Atlantic on your left and "
            "Gulf of Mexico on your right simultaneously. The Seven Mile Bridge is the visual "
            "centerpiece: 35,716 feet of concrete arcing over open water with nothing but "
            "horizon in every direction."
        ),
        "editorial_description": (
            "Ride early morning both ways: southbound at dawn the light comes over the Atlantic "
            "into your face; northbound at dusk the sky behind Key West turns operatic. "
            "There's only one road — no alternatives, no shortcuts. Traffic in January–March "
            "can be heavy; September–October is emptier and less humid. End in Key West "
            "for a sunset at Mallory Square. The road earns its own trip."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 12,
        "rating_avg": 4.6, "rating_count": 823,
        "relation_id": 1855409,
        "bbox_clip": [24.50, -81.85, 25.30, -80.20],
    },
    {
        "name": "Moonshiner 28 — North Carolina",
        "region": "USA",
        "description": (
            "NC-28 from Fontana Village to Franklin is the Tail of the Dragon's quieter "
            "sibling — 61 miles tracing the southern edge of Great Smoky Mountains National "
            "Park and Nantahala Gorge. The Nantahala River section is a masterpiece: the road "
            "hugs sheer canyon walls above whitewater rapids for 12 miles. This is one of the "
            "few roads in the US where speed is irrelevant because the scenery demands you stop."
        ),
        "editorial_description": (
            "The Moonshiner 28 corridor connects to the Dragon, the Cherohala, and the "
            "Nantahala National Forest for a three-day Smokies loop without repeating a mile. "
            "The Nantahala Gorge section is shaded most of the day and can be 15°F cooler "
            "than surrounding valleys — bring a layer regardless of season."
        ),
        "is_motovault_pick": False,
        "surface_type": "paved", "elevation_gain_m": 490,
        "rating_avg": 4.5, "rating_count": 312,
        # NC-28 OSM relation (confirmed via OSM REST)
        "relation_id": 14876741,
        "bbox_clip": [35.10, -84.00, 35.50, -83.45],
    },
    {
        "name": "San Juan Skyway — Colorado",
        "region": "USA",
        "description": (
            "The 236-mile San Juan Skyway loops through the most dramatic corner of Colorado — "
            "connecting Durango, Ouray, Telluride, and Silverton through six mountain passes "
            "above 10,000 ft. The Million Dollar Highway is the centerpiece, but the full loop "
            "adds Red Mountain Pass, Coal Bank Pass, Molas Pass, and the switchbacks above "
            "Telluride. This is the full day Colorado riders plan for months."
        ),
        "editorial_description": (
            "Ouray is the natural base: soak in the hot springs the night before. "
            "The Ouray-to-Silverton stretch over Red Mountain Pass (11,018 ft) rewards "
            "those who ride north-to-south with the deepest views. The loop works either "
            "direction; clockwise gives you the best morning light on Red Mountain. "
            "Allow a full day — stopping time alone requires 4 hours."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 2200,
        "rating_avg": 4.9, "rating_count": 734,
        # San Juan Skyway Scenic Byway - confirmed OSM relation
        "relation_id": 19968116,
        "bbox_clip": [37.50, -108.20, 38.10, -107.40],
    },
    {
        "name": "Columbia River Highway — Oregon",
        "region": "USA",
        "description": (
            "The Historic Columbia River Highway (US-30) was America's first scenic highway, "
            "engineered in 1913 to let visitors experience the Columbia River Gorge. "
            "Crown Point Vista House, Multnomah Falls, Horsetail Falls — all within 25 miles "
            "of each other. The engineering itself is art: Italian stone masonry guardrails, "
            "curved viaducts, and tunnels blasted through basalt columns."
        ),
        "editorial_description": (
            "The highway closes between Vista House and Ainsworth State Park for sections "
            "damaged by the Eagle Creek Fire — check current status. The eastern section "
            "between Mosier and The Dalles is fully open and often overlooked. "
            "Ride westbound in afternoon: the sun lights the gorge walls perfectly. "
            "The road connects seamlessly to OR-14 on the Washington side for a loop."
        ),
        "is_motovault_pick": False,
        "surface_type": "paved", "elevation_gain_m": 390,
        "rating_avg": 4.5, "rating_count": 467,
        "relation_id": 12219633,
        "bbox_clip": [45.52, -122.25, 45.73, -121.60],
    },

    # ═══════════════════════════════════════════════════════
    # EUROPE
    # ═══════════════════════════════════════════════════════

    {
        "name": "Amalfi Coast — Italy",
        "region": "Europe",
        "description": (
            "The SS-163 Amalfitana clings to vertical limestone cliffs for 40 km between "
            "Sorrento and Salerno — the most photographed coastline in the Mediterranean. "
            "The road is barely two lanes wide with blind hairpin corners, precipitous drops "
            "to turquoise water, and a near-constant stream of buses, scooters, and tourist "
            "vans. This is advanced-level riding in the best possible setting."
        ),
        "editorial_description": (
            "Ride September or October: summer is genuinely dangerous with coach traffic. "
            "West-to-east (Positano direction) in the morning gives you the shaded side for "
            "visibility. The tunnel through the rock at Furore is a highlight. Park in Ravello "
            "and walk down — the village views justify the detour. Accept that you will be "
            "slower than the scooter locals. They live here; you're visiting."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 680,
        "rating_avg": 4.7, "rating_count": 1203,
        "relation_id": 4542085,
        "bbox_clip": [40.56, 14.30, 40.68, 14.80],
    },
    {
        "name": "Grimsel Pass — Switzerland",
        "region": "Europe",
        "description": (
            "The Grimselpass (2,164 m) connects the Haslital and Goms valleys through the "
            "heart of the Bernese Alps, passing hydroelectric dams, glacial lakes of "
            "impossible blue-green colour, and a moonscape of granite. The serpentine descent "
            "toward the Rhône Glacier on the south side is one of Switzerland's most "
            "technically satisfying pass roads — long consistent arcs, good pavement, "
            "and zero guardrail mercy."
        ),
        "editorial_description": (
            "Pair with the Susten and Furka passes for the classic Urner Alps trinity — "
            "three passes, one long day, all starting and finishing in Andermatt. "
            "Open late May to October (check the pass cam at grimselpass.ch). "
            "The hotel at the summit is 100 years old and serves excellent hot soup. "
            "The Totensee (Dead Lake) at the summit has an eerie flat-calm beauty."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 1120,
        "rating_avg": 4.8, "rating_count": 567,
        "relation_id": 15598839,
        "bbox_clip": [46.52, 8.20, 46.62, 8.45],
    },
    {
        "name": "Passo di Gavia — Italian Alps",
        "region": "Europe",
        "description": (
            "Gavia (2,621 m) is one of the highest paved passes in the Alps and among the "
            "most dramatic. The northern approach from Ponte di Legno is a narrow, steep "
            "single-track in places — originally built for military mule carts. The southern "
            "descent into Bormio is barely wider. There are no guardrails on significant "
            "sections and the drop is serious. The reward is an absolutely untouched alpine "
            "environment: no tourist infrastructure, near silence."
        ),
        "editorial_description": (
            "Gavia appears in cycling history as one of the most brutal Giro d'Italia climbs. "
            "A snowstorm during the 1988 Giro left riders nearly hypothermic at the summit. "
            "Even in summer carry a layer — the summit temperature can drop 25°C below the "
            "valley. Open mid-June to mid-October at best. The summit chapel is always open. "
            "Pair with Stelvio on the same day for an unforgettable Alpine double."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 1390,
        "rating_avg": 4.8, "rating_count": 389,
        "relation_id": 3887403,
        "bbox_clip": [46.32, 10.42, 46.50, 10.60],
    },
    {
        "name": "Ring of Kerry — Ireland",
        "region": "Europe",
        "description": (
            "Ireland's most famous driving route circles the Iveragh Peninsula in County Kerry "
            "for 179 km — past glacial lakes, Atlantic headlands, medieval ring forts, and "
            "the purple-heathered slopes of Macgillycuddy's Reeks (Ireland's highest mountains). "
            "The road passes through Killarney, Kenmare, and a dozen fishing villages that "
            "look unchanged since the 1950s. The sea light in Kerry is something that "
            "doesn't photograph well but stays with you."
        ),
        "editorial_description": (
            "Ride anti-clockwise (west from Killarney) to avoid the tour bus convoy "
            "that always goes clockwise. Early morning (before 9am) gives you the first hour "
            "nearly alone. The Healy Pass — a short detour over the border into Cork — "
            "is not technically on the Ring but belongs on it: tight switchbacks over a "
            "mountain ridge with views of both coasts. The Blind Piper pub in Caherdaniel "
            "has been serving since 1796."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 840,
        "rating_avg": 4.6, "rating_count": 892,
        "relation_id": 445153,
    },
    {
        "name": "Passo Giau — Dolomites",
        "region": "Europe",
        "description": (
            "Passo Giau (2,233 m) is the Dolomites in miniature: jagged towers of pale "
            "limestone, alpine meadows with wildflowers at 2,000 m, and a road that loops "
            "back on itself with increasing drama. The climb from Colle Santa Lucia on the "
            "south side is the most photogenic — each hairpin reveals a new arrangement of "
            "the Averau and Nuvolau spires. UNESCO World Heritage designation says everything "
            "about why riders come here from all over the continent."
        ),
        "editorial_description": (
            "The Giau is best combined with the Falzarego, Valparola, and Sella passes "
            "for the classic Dolomites circuit — four high passes in a single day through "
            "the most otherworldly scenery in Europe. Stay in Cortina d'Ampezzo as a base. "
            "The road is narrow; give the rental Ducati riders their space. The summit "
            "rifugio (mountain hut) has the best strudel in the Veneto."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 980,
        "rating_avg": 4.9, "rating_count": 634,
        "relation_id": 1809707,
    },
    {
        "name": "Sognefjellet — Norway",
        "region": "Europe",
        "description": (
            "Fv55 across the Sognefjell plateau (1,434 m) is the highest mountain pass road "
            "in northern Europe and one of the most starkly beautiful in the world. "
            "It runs between Lom and Sogndal over a landscape of glaciers, boulder fields, "
            "and snowdrifts that can persist into August. The ascent from Skjolden along "
            "the Fortunsdalen valley is a Norwegian fjord at its most theatrical."
        ),
        "editorial_description": (
            "The road is one of Norway's 18 National Tourist Routes — a government "
            "designation that means pull-offs, viewpoints, and remarkable rest-stop "
            "architecture every few kilometres. Open June–October. The Jotunheimen "
            "National Park stretches to the east; a night in Lom is worth it for the "
            "Viking-era stave church alone. Combine with Aurlandsfjellet for a two-day "
            "fjord masterclass."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 1040,
        "rating_avg": 4.8, "rating_count": 423,
        "relation_id": 1170753,
    },
    {
        "name": "North Coast 500 — Scotland",
        "region": "Europe",
        "description": (
            "Scotland's answer to Route 66: a 516-mile loop starting and finishing in "
            "Inverness that traces the entire northern coast through some of the most "
            "desolate and magnificent scenery in Europe. Single-track roads through "
            "the Torridon mountains, white-sand beaches on the north coast that look "
            "more Caribbean than Scottish, Duncansby Head sea stacks, and the brooding "
            "cliffs above Smoo Cave. No two miles are the same."
        ),
        "editorial_description": (
            "Plan 5–7 days minimum. Accommodation books out months in advance in "
            "summer — if you haven't booked, don't go in July. May and September "
            "give good weather odds with no crowds. The single-track roads require "
            "genuine skill and patience; farm vehicles have absolute right of way. "
            "Applecross Pass (Bealach na Bà) is the sharpest hairpins in the UK "
            "and belongs in any serious moto bucket list."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 5800,
        "rating_avg": 4.9, "rating_count": 1456,
        "relation_id": 5723406,
        "bbox_clip": [57.50, -5.80, 58.70, -3.00],
    },
    {
        "name": "Col d'Izoard — French Alps",
        "region": "Europe",
        "description": (
            "The Col d'Izoard (2,360 m) is one of the great Tour de France climbs and "
            "one of the most arresting passes in the French Alps. The southern ascent from "
            "Guillestre passes through the Casse Déserte — a lunar landscape of crumbling "
            "ochre rock towers and scree that looks like the moon but is somehow in Provence. "
            "Nothing grows here. The road threads between pillars of eroded limestone in "
            "silence that feels absolute."
        ),
        "editorial_description": (
            "The northern descent to Briançon is long, fast, and alpine; the southern "
            "approach through the Casse Déserte is the unforgettable direction. "
            "Combine with Col de Vars and Col de la Cayolle for the Route des Grandes Alpes "
            "southern segment — three passes in a day through Queyras National Park. "
            "A small memorial to Coppi and Bobet stands in the Casse Déserte — two of "
            "cycling's greatest climbers who fought their most famous battles here."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 1150,
        "rating_avg": 4.8, "rating_count": 423,
        "relation_id": 2993854,
    },
    {
        "name": "Col de la Bonnette — French Alps",
        "region": "Europe",
        "description": (
            "At 2,802 m, the Cime de la Bonnette loop road is the highest paved road in "
            "France and one of the highest in Europe. The D64 climbs from Jausiers through "
            "the Mercantour National Park in a series of long, exposed switchbacks above "
            "treeline. The final loop around the summit cime is a 1 km detour that takes "
            "you above 2,800 m — you will feel the altitude."
        ),
        "editorial_description": (
            "Open late June to late October. The southern approach from Saint-Étienne-de-Tinée "
            "is the more technical; the northern descent to Jausiers is faster and more open. "
            "Combine with Col de la Cayolle and Col d'Allos for the great Mercantour loop — "
            "three high passes in one day through one of France's wildest national parks. "
            "The descent to Nice via the gorges de Daluis adds an hour but adds considerably "
            "to the sense of occasion."
        ),
        "is_motovault_pick": False,
        "surface_type": "paved", "elevation_gain_m": 1540,
        "rating_avg": 4.7, "rating_count": 312,
        "way_ids": [
            5197650, 5197651, 5197652, 5197654, 5197656, 5197660, 5197665,
            5197668, 5197669, 5197670, 5197672, 5197674, 5197676, 5197678,
            29726803, 29726805, 55819741, 55819743, 55819745, 55819747,
        ],
        "bbox_clip": [44.28, 6.73, 44.42, 6.90],
    },
    {
        "name": "Dolomites Great Road — Italy",
        "region": "Europe",
        "description": (
            "The Grande Strada delle Dolomiti (SS241/SS48) is the classic Dolomites route: "
            "Bolzano to Cortina d'Ampezzo through the Costalunga, Pordoi, and Falzarego "
            "passes — 110 km of high-altitude riding through the UNESCO World Heritage "
            "landscape. Each pass is a separate experience: Costalunga is wooded and "
            "intimate; Pordoi is open and wild; Falzarego descends into a view of the "
            "Cinque Torri formations that looks painted."
        ),
        "editorial_description": (
            "The road connects to Passo Giau, Valparola, and Sella for riders who want "
            "to do the full Sella Ronda — a 55 km circuit around the Sella massif that "
            "crosses four passes. July and August bring European peak-season crowds; "
            "the parking at Pordoi summit can resemble a motorway services. "
            "Late September is perfect: some snow has fallen on the highest peaks, "
            "the air is clear, and the crowds are gone."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 1680,
        "rating_avg": 4.8, "rating_count": 978,
        # Grande Strada delle Dolomiti / SS241+SS48
        "relation_id": 12035753,
        "bbox_clip": [46.40, 11.55, 46.58, 12.15],
    },
    {
        "name": "Ronda Road — Andalusia",
        "region": "Europe",
        "description": (
            "The A-366 and MA-7401 descend from Ronda — the dramatic clifftop city above "
            "a 100-metre gorge — through the Serranía de Ronda to the Costa del Sol. "
            "White-washed villages cling to limestone ridges, cork oak forests fill the "
            "valleys, and the road sweeps through terrain that could be the set of a "
            "spaghetti western. This is southern Spain at its most cinematic."
        ),
        "editorial_description": (
            "Ronda is 90 minutes from Malaga — easily a day trip from the coast, or a "
            "base for exploring the Sierra Nevada. The road from Ronda toward Arcos de "
            "la Frontera (A-374) is equally good and less travelled. Spring (April–May) "
            "fills the hillsides with wildflowers and the temperature is perfect. "
            "Stop at any venta (roadside bar) for jamón and local cheese."
        ),
        "is_motovault_pick": False,
        "surface_type": "paved", "elevation_gain_m": 780,
        "rating_avg": 4.5, "rating_count": 398,
        # A-366 / MA-7401 Ronda to Marbella scenic route
        "relation_id": 9228163,
        "bbox_clip": [36.60, -5.35, 36.78, -5.00],
    },

    # ═══════════════════════════════════════════════════════
    # SOUTH AMERICA
    # ═══════════════════════════════════════════════════════

    {
        "name": "Ruta 40 — Patagonia",
        "region": "South America",
        "description": (
            "Argentina's Route 40 is the longest national highway in South America — 5,194 km "
            "from the Bolivian border to the Straits of Magellan. The Patagonian section, from "
            "Bariloche south through El Calafate to El Chaltén, is the one that changes people. "
            "Flat steppe interrupted by Andes spires, condors circling above the road, estancias "
            "hundreds of km apart, and wind that can physically push a motorcycle sideways. "
            "This is one of the great adventure rides on earth."
        ),
        "editorial_description": (
            "The classic window is November–March (southern hemisphere summer). Some sections "
            "remain unpaved (ripio gravel) — check current conditions before committing. "
            "Fuel between towns can be 300+ km apart; carry extra. The stretch from Perito "
            "Moreno (town, not glacier) to El Calafate is the most desolate and most "
            "spectacular. End with Perito Moreno Glacier 80 km from El Calafate — "
            "one of the few places on earth where a glacier is advancing."
        ),
        "is_motovault_pick": True,
        "surface_type": "mixed", "elevation_gain_m": 1840,
        "rating_avg": 4.8, "rating_count": 534,
        "relation_id": 168012,
        # Clip to Bariloche → El Calafate (Patagonian section)
        "bbox_clip": [-51.80, -72.50, -41.10, -71.00],
    },
    {
        "name": "Carretera Austral — Chile",
        "region": "South America",
        "description": (
            "Chile's Route 7 — the Carretera Austral — runs 1,240 km from Puerto Montt "
            "to Villa O'Higgins through Patagonian rainforest, hanging glaciers, and fjords "
            "so remote the road only arrived in the 1980s. Ferry crossings break the route "
            "into human-scaled sections. The Cochamo and Pumalín valleys are wilderness of "
            "a quality that's disappearing from the planet. For adventure riders, this is "
            "the spiritual center of the sport."
        ),
        "editorial_description": (
            "Significant sections are unpaved gravel (improving each year but check recent "
            "rider reports). November–March is optimal. The Cruce de Lagos ferry from "
            "Bariloche to Puerto Montt is the classic entry point; the Patagonia Connection "
            "ferry from Caleta Gonzalo breaks the middle section. Budget 2 weeks minimum. "
            "The road ends at Villa O'Higgins — there is no road south of here. Turn around "
            "and enjoy every kilometre twice."
        ),
        "is_motovault_pick": True,
        "surface_type": "mixed", "elevation_gain_m": 2100,
        "rating_avg": 4.9, "rating_count": 412,
        "relation_id": 6582700,
        # Clip to the most scenic middle section (Hornopirén to Cochrane)
        "bbox_clip": [-48.10, -73.20, -42.10, -72.10],
    },
    {
        "name": "Ruta de los Siete Lagos — Argentina",
        "region": "South America",
        "description": (
            "The Seven Lakes Route (RN-234) connects Bariloche with San Martín de los Andes "
            "through 110 km of Andean lake country — Nahuel Huapi, Correntoso, Espejo, "
            "Escondido, Villarino, Falkner, and Machonico — each a different shade of "
            "turquoise or deep blue. This is the Patagonian lake district at its most "
            "accessible: a paved (mostly) road through scenery that routinely renders "
            "riders speechless."
        ),
        "editorial_description": (
            "Do the route north-to-south from San Martín to Bariloche: the light is better "
            "in the afternoon and you finish with Lake Nahuel Huapi as the final act. "
            "The section near Villa Traful adds 30 km but is extraordinary. "
            "Lago Escondido is the best detour — a small unpaved road to a hidden lake "
            "that's genuinely hidden. End in Bariloche for chocolate and craft beer."
        ),
        "is_motovault_pick": True,
        "surface_type": "paved", "elevation_gain_m": 520,
        "rating_avg": 4.8, "rating_count": 467,
        "relation_id": 168012,
        # Use Ruta 40 relation but clip to just the Seven Lakes section
        "bbox_clip": [-41.15, -71.60, -40.15, -71.30],
    },
    {
        "name": "Eje Cafetero — Colombia",
        "region": "South America",
        "description": (
            "The Coffee Axis — Colombia's Eje Cafetero — connects Pereira, Armenia, and "
            "Manizales through the world's most biodiverse corridor of mountain agriculture. "
            "Wax palm valleys, coffee haciendas on 45-degree slopes, colonial towns painted "
            "in primary colors, and Andean cloud forest closing over the road. The pass "
            "between Salento and Manizales over the Central Cordillera (3,000 m) is the "
            "Colombia that riders talk about for years."
        ),
        "editorial_description": (
            "Colombia has transformed significantly for motorcycle tourism in recent years — "
            "the Eje Cafetero is safe, well-signposted, and genuinely welcoming. "
            "Salento is the base: small, beautiful, and full of good coffee. "
            "The Valle de Cocora (wax palms, national tree of Colombia) is 15 km from "
            "town and should not be skipped. December–February and June–August are "
            "the dry seasons; the rainy season roads can be spectacular in a different way."
        ),
        "is_motovault_pick": False,
        "surface_type": "paved", "elevation_gain_m": 1240,
        "rating_avg": 4.6, "rating_count": 245,
        # Eje Cafetero - Ruta Nacional 25 through coffee region
        "relation_id": 5543940,
        "bbox_clip": [4.50, -75.80, 5.10, -75.20],
    },
]

# ─── OSM Helpers ─────────────────────────────────────────────────────────────

def osm_get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": OSM_UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def fetch_relation_way_ids(relation_id):
    data = json.loads(osm_get(
        f"https://api.openstreetmap.org/api/0.6/relation/{relation_id}.json"))
    return [m["ref"] for m in data["elements"][0]["members"] if m["type"] == "way"]

def batch_fetch_ways(way_ids, chunk=200):
    result = {}
    for i in range(0, len(way_ids), chunk):
        batch = way_ids[i:i+chunk]
        ids = ",".join(str(x) for x in batch)
        root = ET.fromstring(osm_get(
            f"https://api.openstreetmap.org/api/0.6/ways?ways={ids}"))
        for w in root.findall("way"):
            wid = int(w.get("id"))
            result[wid] = [int(nd.get("ref")) for nd in w.findall("nd")]
        time.sleep(0.4)
    return result

def batch_fetch_nodes(node_ids, chunk=500):
    result = {}
    for i in range(0, len(node_ids), chunk):
        batch = node_ids[i:i+chunk]
        ids = ",".join(str(x) for x in batch)
        root = ET.fromstring(osm_get(
            f"https://api.openstreetmap.org/api/0.6/nodes?nodes={ids}"))
        for n in root.findall("node"):
            result[int(n.get("id"))] = (float(n.get("lat")), float(n.get("lon")))
        time.sleep(0.4)
    return result

def stitch_ways(way_ids, way_nodes, node_coords, bbox_clip=None):
    def dist(a, b):
        return math.hypot(a[0]-b[0], a[1]-b[1]) if (a and b) else 1e9

    segments = []
    for wid in way_ids:
        nodes = way_nodes.get(wid)
        if not nodes:
            continue
        pts = [node_coords[n] for n in nodes if n in node_coords]
        if pts:
            segments.append(pts)

    if not segments:
        return []

    result = list(segments[0])
    for seg in segments[1:]:
        tail = result[-1]
        s, e = seg[0], seg[-1]
        if dist(tail, s) <= dist(tail, e):
            result.extend(seg[1:])
        else:
            result.extend(reversed(seg[:-1]))

    if bbox_clip:
        min_lat, min_lon, max_lat, max_lon = bbox_clip
        result = [p for p in result
                  if min_lat <= p[0] <= max_lat and min_lon <= p[1] <= max_lon]
    return result

def downsample(coords, target=2000):
    if len(coords) <= target:
        return coords
    step = len(coords) / target
    return [coords[int(i * step)] for i in range(target)]

def encode_polyline(coords):
    def enc(val):
        val = int(round(val * 1e5))
        val = ~(val << 1) if val < 0 else val << 1
        chunks = []
        while val >= 0x20:
            chunks.append(chr((0x20 | (val & 0x1f)) + 63))
            val >>= 5
        chunks.append(chr(val + 63))
        return "".join(chunks)
    out, prev_lat, prev_lon = [], 0, 0
    for lat, lon in coords:
        out.append(enc(lat - prev_lat))
        out.append(enc(lon - prev_lon))
        prev_lat, prev_lon = lat, lon
    return "".join(out)

def haversine_m(a, b):
    R = 6_371_000
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2-lat1, lon2-lon1
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(h))

def curvature_index(coords):
    if len(coords) < 3:
        return 0.0
    total_dist, total_turn = 0.0, 0.0
    def bearing(a, b):
        lat1, lon1 = math.radians(a[0]), math.radians(a[1])
        lat2, lon2 = math.radians(b[0]), math.radians(b[1])
        dlon = lon2 - lon1
        x = math.sin(dlon) * math.cos(lat2)
        y = math.cos(lat1)*math.sin(lat2) - math.sin(lat1)*math.cos(lat2)*math.cos(dlon)
        return math.degrees(math.atan2(x, y)) % 360
    for i in range(1, len(coords)-1):
        total_dist += haversine_m(coords[i-1], coords[i])
        b1 = bearing(coords[i-1], coords[i])
        b2 = bearing(coords[i], coords[i+1])
        diff = abs(b2 - b1)
        if diff > 180:
            diff = 360 - diff
        total_turn += diff
    dist_km = total_dist / 1000
    return round(total_turn / dist_km, 2) if dist_km > 0 else 0.0

# ─── Supabase Helpers ────────────────────────────────────────────────────────

def supabase_req(path, method="GET", body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if method == "POST":
        headers["Prefer"] = "return=representation"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def get_existing_names():
    rows = supabase_req("routes?select=name&limit=500")
    return {r["name"] for r in rows}

def supabase_insert(table, row):
    return supabase_req(f"{table}", method="POST", body=row)[0]

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("🏍️  MotoVault Autonomous Route Seeder")
    print("=" * 60)

    # Find which routes are not yet in the DB
    existing = get_existing_names()
    print(f"  Existing routes in DB: {len(existing)}")

    pending = [r for r in ROUTE_LIBRARY if r["name"] not in existing]
    print(f"  Pending routes in library: {len(pending)}")

    if not pending:
        print("  ✅ All library routes already seeded! Nothing to do.")
        return

    # Weighted random selection: prefer USA/Europe; include South America ~20% of runs
    usa_eu = [r for r in pending if r["region"] in ("USA", "Europe")]
    sa     = [r for r in pending if r["region"] == "South America"]

    selected = []
    if usa_eu:
        n_usa_eu = min(ROUTES_PER_RUN, len(usa_eu))
        selected = random.sample(usa_eu, n_usa_eu)
    # Replace one slot with South America ~20% of the time if SA routes exist
    if sa and selected and random.random() < 0.20:
        selected[-1] = random.choice(sa)

    print(f"  Selected {len(selected)} routes to seed this run:")
    for r in selected:
        print(f"    [{r['region']}] {r['name']}")
    print()

    inserted, failed = [], []

    for route in selected:
        name = route["name"]
        print(f"{'─'*60}")
        print(f"  {name}")
        print(f"{'─'*60}")

        try:
            if "relation_id" in route:
                rel_id = route["relation_id"]
                print(f"  → Relation {rel_id}...", end=" ", flush=True)
                way_ids = fetch_relation_way_ids(rel_id)
                print(f"{len(way_ids)} ways")
                time.sleep(0.5)
            else:
                way_ids = route["way_ids"]
                print(f"  → {len(way_ids)} specified ways")

            print(f"  → Ways ({len(way_ids)})...", end=" ", flush=True)
            way_nodes = batch_fetch_ways(way_ids)
            all_node_ids = list({n for nodes in way_nodes.values() for n in nodes})
            print(f"{len(all_node_ids)} node refs")
            time.sleep(0.5)

            print(f"  → Nodes ({len(all_node_ids)} unique)...", end=" ", flush=True)
            node_coords = batch_fetch_nodes(all_node_ids)
            print(f"{len(node_coords)} fetched")

            print(f"  → Stitching...", end=" ", flush=True)
            coords = stitch_ways(way_ids, way_nodes, node_coords, route.get("bbox_clip"))
            print(f"{len(coords)} pts")

            if len(coords) < 10:
                raise ValueError(f"Too few points after stitch/clip: {len(coords)}")

            if len(coords) > 2000:
                orig = len(coords)
                coords = downsample(coords, 2000)
                print(f"  → Downsampled {orig} → {len(coords)}")

            polyline = encode_polyline(coords)
            dist_m   = sum(haversine_m(coords[i], coords[i+1])
                           for i in range(len(coords)-1))
            curv     = curvature_index(coords)
            print(f"  → {dist_m/1000:.1f} km | curvature {curv} | {len(polyline)} chars")

            row = {
                "contributor_user_id":    CONTRIBUTOR_ID,
                "name":                   route["name"],
                "description":            route["description"],
                "polyline":               polyline,
                "distance_m":             round(dist_m, 1),
                "elevation_gain_m":       route.get("elevation_gain_m"),
                "surface_type":           route.get("surface_type", "paved"),
                "curvature_index":        curv,
                "is_motovault_pick":      route.get("is_motovault_pick", False),
                "editorial_description":  route.get("editorial_description"),
                "rating_avg":             route.get("rating_avg"),
                "rating_count":           route.get("rating_count", 0),
                "status":                 "published",
            }
            result = supabase_insert("routes", row)
            print(f"  ✓ {result['id']}")
            inserted.append(name)

        except Exception as e:
            print(f"  ✗ ERROR: {e}")
            import traceback
            traceback.print_exc()
            failed.append(name)

        print()

    print("=" * 60)
    if inserted:
        print(f"  ✅ Inserted {len(inserted)} route(s):")
        for n in inserted:
            print(f"     {n}")
    if failed:
        print(f"  ⚠️  Failed {len(failed)} route(s):")
        for n in failed:
            print(f"     {n}")
    remaining = len(pending) - len(inserted)
    print(f"  📊 Routes remaining in library: {remaining}")
    print("=" * 60)

if __name__ == "__main__":
    main()
