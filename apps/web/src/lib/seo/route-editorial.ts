export interface RouteEditorialSection {
  heading: string;
  content: string;
}

export interface RouteEditorialFaq {
  question: string;
  answer: string;
}

export interface RouteEditorial {
  introduction: string;
  sections: RouteEditorialSection[];
  faqs: RouteEditorialFaq[];
}

/**
 * Expanded editorial content for featured routes.
 * Key format: "{country}/{region}/{slug}" (lowercase).
 */
export const ROUTE_EDITORIAL: Record<string, RouteEditorial> = {
  'us/ca/pacific-coast-highway': {
    introduction:
      "California's Pacific Coast Highway through Big Sur is one of the world's most iconic motorcycle rides. This stretch of Highway 1 between Carmel-by-the-Sea and San Simeon winds along 90 miles of rugged coastline where the Santa Lucia Mountains plunge directly into the Pacific Ocean. The road is a masterclass in coastal engineering — carved into cliff faces, crossing dramatic bridges over deep ravines, and offering pull-offs with views that stretch to the horizon. For motorcyclists, the combination of sweeping curves, moderate elevation changes, and constantly shifting ocean vistas makes this a ride that rewards both skill and patience.",
    sections: [
      {
        heading: 'What to Expect',
        content:
          'The Big Sur section covers approximately 90 miles (145 km) with elevation changes between sea level and 1,000 feet. The road surface is generally good but can deteriorate quickly after winter storms — Caltrans performs frequent repairs but landslides occasionally close sections for weeks or months. Check the Caltrans Highway 1 closure page before riding. The road is predominantly two lanes with limited passing opportunities. Blind corners are common, and oncoming traffic can drift into your lane around tight bends. Pullouts are limited and often full, especially on weekends.',
      },
      {
        heading: 'Practical Tips',
        content:
          'Ride on a weekday morning for the best experience — weekend traffic from San Francisco day-trippers can turn Big Sur into a slow procession behind RVs. Start from the north (Carmel) heading south for the best ocean views from your riding position. Nepenthe restaurant at mile 29 is a legendary lunch stop with terrace views 800 feet above the ocean. Fuel up in Carmel or Cambria — there are no reliable fuel stations through the heart of Big Sur. Wind is constant along the coast and can be strong enough to push a loaded touring bike across the lane. Coastal fog is common in summer mornings, typically burning off by midday. The best weather window is September through November — warm, clear, and past the summer fog season.',
      },
    ],
    faqs: [
      {
        question: 'Is Pacific Coast Highway safe for motorcycles?',
        answer:
          'Yes, but it demands respect. The road has tight blind corners, no guardrails in many sections, and frequent gravel or debris after storms. Ride within your limits, stay in your lane through blind corners, and watch for distracted tourists pulling over without warning. The biggest hazard is other drivers, not the road itself.',
      },
      {
        question: 'When is the best time to ride Pacific Coast Highway?',
        answer:
          'September through November offers the clearest weather with warm temperatures and minimal coastal fog. Summer (June–August) brings heavy fog in the mornings that typically burns off by noon. Winter brings rain and increased landslide risk.',
      },
      {
        question: 'How long does it take to ride Big Sur by motorcycle?',
        answer:
          'The 90-mile Big Sur section takes 2–3 hours of riding time, but plan a full day to enjoy photo stops, Nepenthe lunch, and the numerous viewpoints. Rushing through Big Sur defeats the purpose.',
      },
    ],
  },
  'us/tn/tail-of-the-dragon': {
    introduction:
      "The Tail of the Dragon — US Route 129 through Deals Gap — is the most famous motorcycle road in the eastern United States and arguably the most intense paved road in North America. Its reputation is built on a simple statistic: 318 curves in 11 miles, with no intersections, no driveways, and no commercial traffic. The road drops 1,500 feet through the Great Smoky Mountains along a narrow valley carved by the Little Tennessee River, delivering a relentless sequence of tight switchbacks, decreasing-radius turns, and high-speed sweepers that test every aspect of a rider's cornering technique.",
    sections: [
      {
        heading: 'What to Expect',
        content:
          'The 11-mile section runs between Deals Gap (on the North Carolina–Tennessee border) and Tabcat Creek at the Chilhowee Lake dam. The road is well-paved and maintained, with a consistent two-lane width. There are no fuel stops, restaurants, or intersections along the route. Elevation changes are significant but the gradient is smooth — this is about cornering, not climbing. The road demands full attention for every second of the ride. Turns arrive at 3–5 second intervals with no straight sections long enough to relax. Corner exits sometimes have gravel washed down from hillside runoff. Yellow centerline violations by oncoming traffic are the primary hazard — stay firmly in your lane.',
      },
      {
        heading: 'Practical Tips',
        content:
          "Arrive before 10am on weekends to avoid the heaviest traffic — the Dragon attracts hundreds of motorcycles and sports cars on summer Saturdays. Weekday mornings are significantly calmer. Start from the Deals Gap side (south end) for a downhill run that flows naturally with the curves. The Tree of Shame at Deals Gap Resort displays broken motorcycle parts from riders who exceeded their limits — it's a sobering reminder to ride within yours. Professional photographers station themselves at key corners and sell photos online — check Killboy.com after your run. The connecting Cherohala Skyway (Route 143) is a completely different experience — sweeping high-altitude curves with mountain panoramas — and makes an excellent return loop.",
      },
    ],
    faqs: [
      {
        question: 'Is the Tail of the Dragon suitable for beginners?',
        answer:
          'No. The Tail of the Dragon is an advanced road that punishes mistakes. New riders should build skills on less intense twisty roads before attempting the Dragon. The Cherohala Skyway nearby is a much better choice for intermediate riders — wider, more forgiving, and equally scenic.',
      },
      {
        question: 'What is the best time to ride the Tail of the Dragon?',
        answer:
          'Weekday mornings from April through October offer the best conditions. Early morning (before 9am) has the least traffic. Autumn (October) brings spectacular fall colors. Avoid summer holiday weekends when the road is dangerously crowded.',
      },
      {
        question: 'Are there speed limits on the Tail of the Dragon?',
        answer:
          'Yes — the posted speed limit is 30 mph for most of the route. Local law enforcement actively patrols the area, especially on busy weekends. The road is technical enough that 30 mph feels fast in many corners.',
      },
    ],
  },
  'it/taa/stelvio-pass': {
    introduction:
      "Stelvio Pass (Passo dello Stelvio) at 2,758 metres is the highest paved pass in the Eastern Alps and one of the most celebrated motorcycle roads on earth. Its 48 numbered hairpins on the Bormio side — stacked in tight switchbacks visible from the summit like a giant zigzag carved into the mountainside — have appeared on countless magazine covers and bucket lists. Top Gear and Stelvio share a mutual history, and the pass regularly tops 'greatest driving road' polls worldwide. But Stelvio is more than a postcard — it's a demanding, altitude-tested ride that rewards preparation and punishes overconfidence.",
    sections: [
      {
        heading: 'What to Expect',
        content:
          'From Bormio (south side) the climb begins immediately, rising 1,533 metres over 24.3 kilometres with 48 numbered hairpin turns. The Prato side (north, from Südtirol) has 34 hairpins over 24.7 kilometres. Both sides have excellent road surfaces maintained by Italian and South Tyrolean authorities. The road is wide enough for two-way traffic on most hairpins, but tour buses use the route heavily in summer — passing a bus on a hairpin requires patience and timing. Altitude effects are real above 2,500 metres: reduced engine power (noticeable on naturally aspirated bikes), cooler temperatures (expect 5–15°C at the summit even in August), and rapid weather changes. Snow walls line the road through early July.',
      },
      {
        heading: 'Practical Tips',
        content:
          'Ride from Bormio early in the morning (before 9am) to have the hairpins largely to yourself — tour buses start arriving by 10am. The Bormio side is the more dramatic approach with the famous numbered hairpin sequence visible from above. June and September offer the best balance of clear weather and low traffic. July and August are busy but rideable on weekday mornings. The summit has restaurants, gift shops, and usually a cluster of other motorcyclists. Fuel up in Bormio or Prato allo Stelvio — there is nothing on the pass itself. For an extended loop, continue over the Umbrail Pass into Switzerland and return via the Ofenpass — a spectacular day circuit. Layer your gear: the temperature difference between Bormio (25°C) and the summit (8°C) can be dramatic.',
      },
    ],
    faqs: [
      {
        question: 'When is Stelvio Pass open for motorcycles?',
        answer:
          'Stelvio Pass is typically open from early June through late October, depending on snowfall. The exact opening and closing dates vary each year — check the Stelvio road status page (Provincia di Sondrio) for current conditions. The pass is gated and locked during winter.',
      },
      {
        question: 'How long does it take to ride Stelvio Pass?',
        answer:
          'The Bormio ascent takes 45–60 minutes of riding time depending on traffic and pace. Plan 2–3 hours including photo stops and a summit coffee break. A full Stelvio-Umbrail-Ofenpass loop takes a half day.',
      },
      {
        question: 'Is Stelvio Pass dangerous for motorcycles?',
        answer:
          'The road itself is well-maintained and well-marked. The main hazards are tour buses on hairpins, rapidly changing mountain weather, and rider fatigue from the altitude and concentration required. Ride within your limits and give buses right of way.',
      },
    ],
  },
  'at/k/grossglockner-hochalpenstrae': {
    introduction:
      "The Grossglockner High Alpine Road is Austria's crown jewel of motorcycle touring — a 48-kilometre toll road that climbs to 2,504 metres through the heart of the Hohe Tauern National Park with 36 hairpin turns, sweeping alpine curves, and views of the Grossglockner (3,798m), Austria's highest peak. Built in the 1930s as a showcase of Austrian engineering, the road is maintained to an immaculate standard that few alpine passes can match. Every metre of this road was designed to impress, and it delivers.",
    sections: [
      {
        heading: 'What to Expect',
        content:
          'The road runs between Fusch (north) and Heiligenblut (south) with a detour spur to the Edelweißspitze (2,571m), the highest accessible point. The main road peaks at the Hochtor tunnel (2,504m). Road surfaces are superb throughout — freshly paved and well-drained. The hairpins are wide and well-banked, making this a more flowing ride than the tight switchbacks of Stelvio. The Edelweißspitze detour adds a narrow, steeper section to a panoramic viewpoint — worthwhile but more demanding. Traffic is moderate on weekdays and heavy on summer weekends and holidays. The toll is approximately €30 for motorcycles (2026 prices) and funds the exceptional road maintenance.',
      },
      {
        heading: 'Practical Tips',
        content:
          'Ride before 9am to avoid tourist traffic — the road opens at 5am in peak season and early morning is magical with low-angle light on the peaks. The Edelweißspitze spur should not be missed — it adds only 15 minutes but offers the finest panoramic viewpoint on the entire road. Kaiser-Franz-Josefs-Höhe at the end of the Gletscherstraße spur offers close views of the Pasterze Glacier and the Grossglockner summit. Full rain gear is essential above 2,000 metres — afternoon thunderstorms are common in summer. The north approach from Fusch is the more gradual climb; the south from Heiligenblut is steeper and more dramatic. Both directions are spectacular. Zell am See and Lienz make excellent bases.',
      },
    ],
    faqs: [
      {
        question: 'When is the Grossglockner road open?',
        answer:
          'Typically early May through early November, weather permitting. The road opens earlier than many alpine passes due to aggressive snow clearing. Gates are open from 5am to 9:30pm in peak season. Check the official Grossglockner website for exact dates and daily status.',
      },
      {
        question: 'How much does it cost to ride the Grossglockner?',
        answer:
          'The motorcycle toll is approximately €30 (2026 prices). This grants access for one day. Multi-day and season passes are also available. The toll includes parking at all viewpoints and access to the Gletscherstraße spur road.',
      },
      {
        question: 'Can beginners ride the Grossglockner?',
        answer:
          'Yes — the Grossglockner is one of the more accessible alpine passes. The road is wide, well-surfaced, and the hairpins are banked and generous. Riders comfortable with mountain roads will enjoy it. The Edelweißspitze spur is the most demanding section.',
      },
    ],
  },
  'no/mr/trollstigen': {
    introduction:
      "Trollstigen — the Troll's Ladder — is Norway's most famous motorcycle road, an 11-hairpin climb up a near-vertical mountain wall in the Romsdal valley. The road was an engineering triumph when it opened in 1936 and remains a thrilling ride today, with hairpins stacked above a thundering waterfall (Stigfossen) and views that encompass the entire glacial valley below. The combination of dramatic elevation gain, narrow road width, and sheer exposure makes Trollstigen one of the most memorable motorcycle experiences in Scandinavia.",
    sections: [
      {
        heading: 'What to Expect',
        content:
          'The road climbs 858 metres over approximately 5 kilometres with 11 hairpin turns. The surface is good but the road is narrow — barely wide enough for two vehicles on the hairpins. Tour buses use the road regularly, and passing a bus on a hairpin requires one vehicle to stop. Gradient reaches 9% in places. At the top, a modern visitor centre with a cantilevered viewing platform offers dramatic views down the valley. The descent is equally spectacular. The road connects Åndalsnes (bottom) with Valldal (top) via the Stigrøra plateau.',
      },
      {
        heading: 'Practical Tips',
        content:
          'Ride early morning or late afternoon to avoid tour bus convoys — the visitor centre opens at 10am and buses arrive shortly after. During peak summer weekends, traffic management may implement one-way operation on the hairpins. The road is typically open from late May through October, though early and late season openings are weather-dependent. Combine Trollstigen with the Atlantic Road (Atlanterhavsveien) for a spectacular day — the two roads are roughly 80 kilometres apart and offer completely different experiences. The Atlantic Road crosses eight bridges between islands, with waves crashing over the road in stormy weather.',
      },
    ],
    faqs: [
      {
        question: 'When is Trollstigen open?',
        answer:
          'Usually late May or early June through mid-October. The exact dates depend on snow conditions. Check the Norwegian road authority (Statens vegvesen) for real-time road status.',
      },
      {
        question: 'Is Trollstigen safe for motorcycles?',
        answer:
          'Yes, but the narrow road and steep hairpins require confidence and competent slow-speed handling. The main challenge is sharing tight hairpins with tour buses and campervans. Stay alert for oncoming traffic around blind hairpins.',
      },
      {
        question: 'How long does it take to ride Trollstigen?',
        answer:
          'The climb takes about 20 minutes of riding time. Plan at least an hour including photo stops at the waterfall and the summit viewpoint. The full Trollstigen-to-Atlantic Road day loop takes 4-5 hours of riding.',
      },
    ],
  },
  'ro/ag/transfgran': {
    introduction:
      "The Transfagarasan (DN7C) is a 90-kilometre mountain road crossing the Fagaras Mountains in central Romania — the highest and most rugged range in the Carpathians. Built by military decree under Ceausescu in the 1970s as a strategic military route, the road was carved through seemingly impossible terrain at the cost of many lives. Jeremy Clarkson declared it 'the best road in the world' on Top Gear in 2009, and while that claim launched a tourist industry, the road genuinely delivers. The northern descent from Balea Lake through cascading switchbacks is one of motorcycling's great experiences.",
    sections: [
      {
        heading: 'What to Expect',
        content:
          'The road crosses the Fagaras massif at the Balea Lake tunnel (2,042m). The south side from Curtea de Arges climbs through forest with sweeping curves and long straights — dramatic but not intensely technical. The star section is the north side descending from Balea Lake to Cartisoara — approximately 27 kilometres of tight switchbacks dropping over 1,200 metres through an alpine landscape of bare rock, waterfalls, and glacial lakes. Road surface quality varies: the south side is generally good, while the north side can have patches of rough asphalt, gravel on corner exits, and water running across the road from mountain streams.',
      },
      {
        heading: 'Practical Tips',
        content:
          'Ride south to north for the most dramatic experience — the reveal of Balea Lake and the subsequent descent through the switchbacks is more impressive in this direction. Start early (before 9am) to beat the tour buses and cars that congest the narrow switchbacks around Balea Lake. July and August are peak season — September offers fewer tourists and often better weather. The south approach is the easier, more flowing ride; the north descent demands full attention with tight switchbacks and variable surfaces. Fuel up in Curtea de Arges (south) or Sibiu (north) — there is nothing on the mountain. Balea Lake has a restaurant and cable car station. Temperatures at the summit can be 15°C cooler than the valleys. The Transalpina (DN67C) is an equally dramatic alternative with far less traffic.',
      },
    ],
    faqs: [
      {
        question: 'When is the Transfagarasan open?',
        answer:
          'Typically early July through late October. Heavy snowfall keeps the summit section closed for most of the year. The south approach opens earlier (sometimes June) but the full crossing requires the tunnel section to be clear. Check Romanian road authority (CNAIR) for daily status.',
      },
      {
        question: 'Is the Transfagarasan really the best road in the world?',
        answer:
          "It's certainly one of the most dramatic. The northern descent is genuinely extraordinary — tight switchbacks through an alpine moonscape with Balea Lake appearing above. Whether it is the 'best' depends on what you value. For technical mountain switchbacks with dramatic scenery, it's hard to beat.",
      },
      {
        question: 'How long does it take to ride the Transfagarasan?',
        answer:
          'The full 90km crossing takes 2-3 hours of riding time. Plan at least 4 hours with photo stops, a Balea Lake break, and time to soak in the scenery. The north side descent alone deserves an hour.',
      },
    ],
  },
  'fr/paca/col-du-galibier': {
    introduction:
      'The Col du Galibier at 2,642 metres is one of the highest and most revered mountain passes in the French Alps, made legendary by the Tour de France which has climbed it over 60 times since 1911. For motorcyclists, the Galibier delivers a long, rewarding climb through alpine meadows and barren high-altitude terrain, culminating in a summit panorama that stretches from Mont Blanc to the Écrins massif. The pass is the centrepiece of a classic Alps loop that combines the Col du Télégraphe, Galibier, and Col du Lautaret — one of the finest day rides in Europe.',
    sections: [
      {
        heading: 'What to Expect',
        content:
          'From Valloire (north), the climb begins immediately after the Col du Télégraphe (1,566m) descent, rising 1,076 metres over 18 kilometres to the summit. The road is well-surfaced with modern barriers on exposed sections. Wide sweeping turns dominate the lower section through alpine pastures, while the final 5 kilometres above the treeline deliver tighter hairpins through barren, dramatic terrain. The summit area offers panoramic views and a memorial to Tour de France founder Henri Desgrange. Traffic is moderate — mostly other motorcycles and cyclists, with fewer tour buses than Stelvio or Grossglockner.',
      },
      {
        heading: 'Practical Tips',
        content:
          "Fuel in Valloire (north) or Briançon (south) — there is nothing on the mountain. The north approach via Col du Télégraphe is the classic Tour de France direction and the more dramatic ascent. For a full day loop, ride Galibier from Valloire, descend to Briançon, then climb the Col d'Izoard (2,360m) — a completely different character with its rocky moonscape of the Casse Déserte. This Galibier-Izoard loop is one of the great Alpine motorcycle circuits. June through October is the riding season; July is peak but manageable on a motorcycle. Early morning offers the best light for photography and the calmest wind. Temperatures can be near freezing at the summit even in summer — layer your gear.",
      },
    ],
    faqs: [
      {
        question: 'When is the Col du Galibier open?',
        answer:
          'Typically early June through mid-October. The exact dates vary with snowfall. The south side (from Lautaret) often opens earlier than the north (from Valloire) as it has less snow accumulation.',
      },
      {
        question: 'How difficult is the Col du Galibier by motorcycle?',
        answer:
          'Moderate to intermediate. The road is well-maintained with good surfaces and generous width. The hairpins are less tight than Stelvio or Transfagarasan. The main challenges are altitude (reduced engine power), wind exposure near the summit, and the long continuous climb.',
      },
      {
        question: 'Can I combine Galibier with other passes in a day?',
        answer:
          "Absolutely. The classic loop combines Col du Télégraphe, Col du Galibier, and Col du Lautaret in the morning, then Col d'Izoard in the afternoon, returning to Briançon. This is roughly 180 km and takes a full day with stops.",
      },
    ],
  },
  'es/ib/sa-calobra': {
    introduction:
      'The road to Sa Calobra in northwest Mallorca is a 14-kilometre descent from the Col dels Reis (682m) to sea level through 26 hairpin turns — including the famous 270-degree corkscrew knot where the road passes under itself. Carved into the limestone cliffs of the Serra de Tramuntana mountains in 1932, this is one of the most technically demanding and visually spectacular roads in the Mediterranean. For motorcyclists, the tight switchbacks, dramatic elevation changes, and limestone cliff scenery create a ride that demands skill and rewards precision.',
    sections: [
      {
        heading: 'What to Expect',
        content:
          "The road drops 682 metres over 14 kilometres — an average gradient of nearly 5% with sections exceeding 7%. The 26 hairpins are tight, with most requiring first or second gear. The signature feature is the 270-degree 'Nus de Sa Corbata' (the Tie Knot) — a corkscrew where the road loops over itself in a dramatic spiral. Road surface is good but the road is narrow — barely two lanes in places. The descent ends at a small cove (Cala Tuent/Sa Calobra) with a restaurant and beach. Remember: every metre you descend, you must climb back out on the same road.",
      },
      {
        heading: 'Practical Tips',
        content:
          "Ride early morning — very early. Tourist buses start descending from about 9:30am and the road is barely wide enough for a bus and a motorcycle on the hairpins. Before 8am you may have the road almost to yourself. Cyclists also use the road heavily (it's a famous cycling climb) — expect groups of riders on the ascent. The approach from Pollença via the MA-10 coastal road is spectacular in its own right. Combine Sa Calobra with Cap de Formentor — Mallorca's northernmost point — for a full day of the island's best riding. Fuel up in Sóller or Pollença. The road is open year-round but winter rain can make the limestone surface slippery.",
      },
    ],
    faqs: [
      {
        question: 'How early should I ride Sa Calobra to avoid buses?',
        answer:
          'Before 8:30am. The first tour buses typically arrive around 9:30-10am. By 10:30am the road can be congested with buses, cyclists, and rental cars. The climb back up is less busy than the descent as buses leave at staggered times.',
      },
      {
        question: 'Is Sa Calobra a dead-end road?',
        answer:
          'Yes — the same road in and out. You descend to the cove and must ride back up the same 26 hairpins. This actually works well for motorcycles as you experience the road in both directions, which feel very different.',
      },
      {
        question: 'What is the best season to ride Sa Calobra?',
        answer:
          'Spring (March-May) and autumn (October-November) offer the best combination of comfortable temperatures and manageable traffic. Summer is hot and very busy. Winter is quiet but rain can make the road slippery.',
      },
    ],
  },
  'ch/vs/furka-pass': {
    introduction:
      "Furka Pass at 2,429 metres is the most famous of Switzerland's alpine passes, immortalised in the James Bond film Goldfinger where Sean Connery's Aston Martin DB5 was pursued along its sweeping curves. The pass connects the Valais and Uri cantons across a dramatic high-altitude landscape of glacial moraines, bare rock, and the rapidly retreating Rhône Glacier. For motorcyclists, Furka is the cornerstone of the legendary Swiss Three Passes day — a circuit combining Furka, Grimsel, and Susten that many consider the finest single-day motorcycle route in the Alps.",
    sections: [
      {
        heading: 'What to Expect',
        content:
          'The pass road climbs from Gletsch (west, 1,757m) or Realp (east, 1,538m) to the summit at 2,429 metres. Both approaches feature well-maintained Swiss road surfaces with flowing medium-speed curves and moderate hairpins — less tight than Stelvio, more technical than Grossglockner. The west side from Gletsch is shorter and steeper with views of the Rhône Glacier. The east side from Realp is longer with more sweeping alpine curves. The summit area offers a hotel (Hotel Furka Passhöhe) and views in every direction. The Rhône Glacier viewpoint (marked by a blue ice grotto sign) is a short detour worth taking.',
      },
      {
        heading: 'Practical Tips',
        content:
          'For the classic Three Passes circuit, ride Furka from west to east (Gletsch to Realp), then Susten (east to west, Wassen to Innertkirchen), then Grimsel (north to south, Innertkirchen to Gletsch), completing the triangle back at your starting point. This direction gives you the best combination of views and road flow. Start early (8am) from Gletsch or Andermatt to complete the circuit by afternoon. Each pass takes about 45 minutes of riding time, plus stops. The Rhône Glacier has retreated dramatically and is now barely visible from the road — the ice grotto still exists but the glacier may not survive the decade. Fuel in Andermatt, Innertkirchen, or Gletsch. The pass is open June through October.',
      },
    ],
    faqs: [
      {
        question: 'When is Furka Pass open?',
        answer:
          'Typically early June through mid-October. Snow clearing begins in May. The Furka Tunnel (Realp to Oberwald) is open year-round as an alternative. Check TCS (Touring Club Schweiz) for real-time pass status.',
      },
      {
        question: 'What is the Three Passes ride?',
        answer:
          'A circuit combining Furka, Grimsel, and Susten passes — approximately 120 km forming a triangle in the Bernese/Uri Alps. It is widely considered the finest single-day motorcycle route in Switzerland and can be completed in 4-5 hours of riding time.',
      },
      {
        question: 'Is the Furka Pass road from the James Bond film?',
        answer:
          'Yes — the opening car chase in Goldfinger (1964) was filmed on the Furka Pass road. The Aston Martin DB5 vs Ford Mustang pursuit used the east side hairpins. The Hotel Belvédère (now closed) above the Rhône Glacier also appeared in the film.',
      },
    ],
  },
  'ch/vs/grimsel-pass': {
    introduction:
      'Grimsel Pass at 2,165 metres is the most dramatic of the Swiss Three Passes trio — a road through a barren, almost lunar landscape of granite, reservoir lakes, and hydroelectric infrastructure that feels more like Iceland than central Europe. Where Furka and Susten are celebrated for their flowing curves and green alpine meadows, Grimsel delivers raw, austere beauty: dark rock walls, turquoise dam lakes, and a sense of elemental power. The road is arguably the most underrated alpine pass in Switzerland, overshadowed by its more photogenic neighbours but offering a riding experience that many consider superior.',
    sections: [
      {
        heading: 'What to Expect',
        content:
          "The pass connects Innertkirchen (north, 625m) with Gletsch (south, 1,757m), climbing 1,540 metres over 33 kilometres from the north side. The road is excellent Swiss quality throughout. The northern approach from Innertkirchen climbs through the dramatic Aar Gorge and past the Handegg waterfall before reaching the reservoir-dotted high plateau. Multiple dam structures (Räterichsbodensee, Grimselsee, Totensee) create striking turquoise lakes against dark granite. The south descent to Gletsch is shorter and steeper with tighter hairpins. Traffic is lighter than Furka or Susten — Grimsel's austere landscape attracts fewer tourists.",
      },
      {
        heading: 'Practical Tips',
        content:
          'If riding the Three Passes circuit, save Grimsel for the third pass — riding north to south with the afternoon light illuminating the reservoir lakes is magical. The Handegg waterfall viewpoint on the north side is worth a 5-minute stop. The Grimsel Hospiz hotel at the summit offers a restaurant with lakeside terrace. The road has several tunnels (well-lit) and avalanche galleries that provide shelter from rain. Fuel in Innertkirchen or Gletsch. The pass is open June through October, often opening slightly earlier than Furka due to its lower elevation. Combine with Susten Pass for a spectacular half-day if time is limited.',
      },
    ],
    faqs: [
      {
        question: 'When is Grimsel Pass open?',
        answer:
          'Typically late May through late October — it often opens and closes slightly earlier/later than the higher Furka and Susten passes. Check TCS for real-time status.',
      },
      {
        question: 'Is Grimsel Pass part of the Three Passes route?',
        answer:
          'Yes — Grimsel forms the southern leg of the Furka-Susten-Grimsel triangle. The full circuit is approximately 120 km and can be ridden in 4-5 hours plus stops.',
      },
      {
        question: 'Why is Grimsel Pass less famous than Furka?',
        answer:
          "Grimsel's barren, almost industrial landscape (reservoirs, dams, tunnels) lacks the chocolate-box alpine charm that photographs well. But this is exactly what makes it special — the raw, austere beauty is unlike any other Swiss pass and the riding is excellent with less traffic than its neighbours.",
      },
    ],
  },
};
