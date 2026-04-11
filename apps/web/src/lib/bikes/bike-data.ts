import { makeSlug, modelSlug } from './slug-map';

/**
 * The five leaf page types that collapse into a single route file under
 * `/bikes/[make]/[model]/[year]/[pageType]`.
 */
export type PageType =
  | 'overview'
  | 'maintenance-schedule'
  | 'common-problems'
  | 'cost-of-ownership'
  | 'service-intervals';

export const PAGE_TYPES: readonly PageType[] = [
  'overview',
  'maintenance-schedule',
  'common-problems',
  'cost-of-ownership',
  'service-intervals',
] as const;

export interface BikeSpec {
  label: string;
  value: string;
}

export interface BikeTelemetry {
  label: string;
  value: string;
  source: string;
}

export interface BikeFaqItem {
  question: string;
  answer: string;
}

export interface BikePageData {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  year: number;
  pageType: PageType;
  title: string;
  description: string;
  h1: string;
  bodyParagraphs: string[];
  specs: BikeSpec[];
  telemetry?: BikeTelemetry[];
  faqItems: BikeFaqItem[];
}

// ---------------------------------------------------------------------------
// MVP fixture data
// ---------------------------------------------------------------------------
// Two bikes × five page types = 10 entries. Each body has ≥500 words of
// genuinely useful, bike-specific prose. Real NHTSA data and real MotoVault
// telemetry will replace this in a follow-up PR.
// ---------------------------------------------------------------------------

const R1_SPECS: BikeSpec[] = [
  { label: 'Engine', value: '998 cc inline-four, crossplane crankshaft' },
  { label: 'Bore x Stroke', value: '79.0 x 50.9 mm' },
  { label: 'Compression ratio', value: '13.0:1' },
  { label: 'Peak power', value: '~200 hp @ 13,500 rpm (unrestricted)' },
  { label: 'Peak torque', value: '112.4 Nm @ 11,500 rpm' },
  { label: 'Transmission', value: '6-speed with quickshifter' },
  { label: 'Frame', value: 'Aluminum Deltabox' },
  { label: 'Front suspension', value: 'KYB 43 mm fully-adjustable inverted fork' },
  { label: 'Wet weight', value: '201 kg (443 lb)' },
  { label: 'Fuel capacity', value: '17 L (4.5 US gal)' },
];

const R1_TELEMETRY: BikeTelemetry[] = [
  {
    label: 'Median chain adjustment interval',
    value: '3,100 km',
    source: 'MotoVault internal data (seeded placeholder)',
  },
  {
    label: 'Median annual mileage',
    value: '4,800 km/year',
    source: 'MotoVault internal data (seeded placeholder)',
  },
];

const GS_SPECS: BikeSpec[] = [
  { label: 'Engine', value: '1,254 cc air/liquid-cooled boxer twin, ShiftCam' },
  { label: 'Bore x Stroke', value: '102.5 x 76.0 mm' },
  { label: 'Compression ratio', value: '12.5:1' },
  { label: 'Peak power', value: '136 hp @ 7,750 rpm' },
  { label: 'Peak torque', value: '143 Nm @ 6,250 rpm' },
  { label: 'Transmission', value: '6-speed, shaft final drive' },
  { label: 'Frame', value: 'Tubular steel bridge frame with load-bearing engine' },
  { label: 'Front suspension', value: 'Telelever with semi-active ESA (optional)' },
  { label: 'Wet weight', value: '249 kg (549 lb)' },
  { label: 'Fuel capacity', value: '20 L (5.3 US gal)' },
];

const GS_TELEMETRY: BikeTelemetry[] = [
  {
    label: 'Median annual mileage',
    value: '11,200 km/year',
    source: 'MotoVault internal data (seeded placeholder)',
  },
  {
    label: 'Typical first-owner tenure',
    value: '4.3 years',
    source: 'MotoVault internal data (seeded placeholder)',
  },
];

// ---------- Yamaha YZF-R1 2023 ----------

const R1_OVERVIEW: string[] = [
  'The 2023 Yamaha YZF-R1 remains one of the most uncompromising liter-class superbikes you can buy. Built around a 998 cc crossplane-crankshaft inline-four, it is the production bike that comes closest to Yamaha’s M1 MotoGP machine in both firing order and throttle character. Where a conventional flat-plane inline-four produces a linear, turbine-like delivery, the crossplane R1 pulses with a V4-like cadence that gives the rider a direct read of available rear grip — a quality that matters most when leaning the bike onto the edge of its Bridgestone RS11 tires.',
  'For the 2023 model year the R1 carries over the package that was substantially updated in 2020: Brembo Stylema front calipers, a KYB 43 mm inverted fork, an APSG ride-by-wire throttle, and the full suite of IMU-driven electronics. That suite is the part most owners learn to respect first — slide control, lift control, launch control, cornering ABS and traction control, a quickshifter with blipper, and three engine power modes are all adjustable from the left-bar switches. Once dialled in for a favourite road or circuit, the settings are stored and recalled per ride mode.',
  'On the street the R1 is unambiguously a track tool that tolerates commuting rather than the other way around. The seating position is aggressive, the mirrors are tiny, and the fuel tank is narrow where it meets the rider’s thighs. Heat from the inline-four is noticeable at stop-lights in hot weather, and the clutch is heavier than a naked bike of the same displacement. None of this is a surprise to buyers who have shopped the category; what surprises most owners is how composed the R1 becomes once speeds climb. The steering is neutral, the brakes are immensely powerful without being grabby, and the engine pulls cleanly from 4,000 rpm in the mid-gears.',
  'Reliability is one of the quiet strengths of the R1. Yamaha’s valve-clearance interval is long (see the maintenance-schedule page for this bike), the gearbox is robust, and the fueling is forgiving of indifferent fuel quality. The weak points — and every owner should know them — are the stock battery, which struggles after three winters of short trips, and the OEM chain, which benefits from tighter adjustment intervals than the service book implies.',
  'If you are shopping for a 2023 R1, pay attention to whether the bike has been tracked. Track use is not automatically a red flag — in fact a track-prepped R1 with fresh consumables is often a better buy than a one-owner road bike with neglected chain and brake fluid — but it changes which checks matter. This overview page is the jumping-off point for the four deeper guides below: maintenance schedule, common problems, cost of ownership, and service intervals.',
  'The electronics package on the 2023 R1 deserves a closer look because it is the feature new owners most often under-use. The six-axis IMU feeds a control stack that includes Lean-Sensitive Traction Control, Slide Control, Lift Control, Launch Control, Brake Control, Engine Brake Management and quickshifter blipper. Each of these is adjustable across multiple levels within four user-configurable ride modes. Most owners default to a middle-of-the-road setting and never touch the menus again, which is a shame — the R1 rewards a rider who spends a weekend learning which combinations work for their roads, their tyres, and their riding style. A careful dial-in of TCS level, SCS level, and the engine map transforms the bike from a fast sport bike into a fast sport bike that genuinely feels like it is on your side.',
  'Finally, a note on what the R1 is not. It is not a sport-tourer, not a commuter, not a pillion bike, and not a first big bike for most riders. It is a focused, uncompromising, circuit-derived liter-class sport bike that happens to be road legal. Buyers who accept that framing are almost universally happy with the bike. Buyers who expected one of the other categories and bought an R1 because it was fast usually sell within a year. Know which camp you are in before you put a deposit down, and the rest of the ownership experience takes care of itself.',
];

const R1_MAINTENANCE: string[] = [
  'Maintaining a 2023 Yamaha YZF-R1 is straightforward if you treat the service manual as a floor rather than a ceiling. Yamaha’s published schedule calls for oil and filter changes every 10,000 km or annually, whichever comes first. Most hard-riding owners halve that to 5,000 km — a 998 cc crossplane four that regularly sees 13,000 rpm shears oil fast, especially if the bike sees track days. Use a JASO MA2-rated 10W-40 synthetic; the wet clutch will not tolerate friction-modified automotive oils.',
  'Valve clearance inspection is scheduled at 42,000 km for the R1, an unusually long interval that reflects both the quality of the valve train and the reality that most sport-bike owners never reach that mileage on one bike. When the inspection is due it is a meaningful job: the fuel tank, airbox, throttle bodies and cam cover must all come off, and shimming the buckets requires either a full cam pull or a specialised spring-compression tool. Budget 6–9 hours of shop labour even when no shims need to change.',
  'Chain maintenance is the single item most owners under-service. The OEM 530-pitch chain on the R1 stretches most in its first 2,000 km, then settles. Checking tension with the bike on a rear stand every 500–800 km, cleaning with a chain-specific solvent and relubing with a wax-based lube is the routine that gets the most life out of the stock sprockets. If you track the bike, inspect the chain and both sprockets after every track day — aggressive drive out of slow corners is hard on the front sprocket in particular.',
  'Brake fluid is on a two-year replacement interval; do not skip it. The R1’s front brakes are strong enough to force a novice rider to re-learn how to trail-brake, and their effectiveness depends on fluid that has not absorbed atmospheric moisture. Use DOT 4 rated for a dry boiling point above 260°C, and bleed both front calipers individually (not through the shared banjo) if you want a firm lever after a hard day.',
  'Coolant should be changed every three years regardless of mileage, and the reservoir tank should be checked before any long ride. Air-filter replacement is scheduled at 40,000 km but should be earlier if the bike has been ridden in dust. Spark plugs — iridium from the factory — are good for 40,000 km as well; they rarely fail but should be pulled and inspected at the valve-clearance service. Finally, the fork oil has no scheduled replacement in the service book, but the KYB 43 mm inverted fork benefits from a fluid change every 25,000 km; the difference in small-bump compliance is noticeable even on street tyres.',
  'The non-scheduled items that matter most on an R1 are the ones most owners only learn about after something goes wrong. Check the steering-head bearing preload once a season — the triple clamps on a 200 hp sport bike see real loads and a bearing that has settled will cause a subtle headshake at highway speeds. Inspect the swingarm pivot bearings any time the rear wheel is off the bike; they are easy to overlook and expensive to replace once they have seized. The rear shock linkage bearings are even more overlooked and should be cleaned and regreased every 20,000 km. Finally, pay attention to the condition of the rubber intake boots on the throttle bodies; a split boot will cause an intermittent lean condition that is easy to misdiagnose as a fuel-pump or sensor problem. None of these items are in the service book. All of them are in the collective experience of long-term R1 owners, and all of them cost less than an hour of attention per season to manage.',
];

const R1_PROBLEMS: string[] = [
  'The 2023 YZF-R1 is, by sport-bike standards, a low-drama motorcycle. The problems owners actually encounter cluster into a small handful of categories, and none of them are catastrophic engine or transmission failures. The most common issue by far is a flat or degraded battery after the bike’s second winter — the stock sealed battery is small, the R1 draws parasitic current from the ECU and the dash, and a month of cold garage storage without a tender is enough to leave many owners jumping the bike in spring. A quality lithium replacement or a permanent tender lead solves it.',
  'The second recurring complaint is heat soak at low speed. The crossplane inline-four routes a lot of thermal energy into the upper frame spars and the rider’s right leg, and stop-and-go commuting on a hot day is uncomfortable enough that many owners add aftermarket header wraps or choose a different bike for daily transport. This is not a defect — it is the physical consequence of packaging a 200 hp engine into a fairing sized for aerodynamics — but it is worth knowing about before you buy.',
  'Electronics quirks are the third category. The TFT dash occasionally fails to fully boot after a battery disconnect, requiring a second ignition cycle to show all warning icons. The quickshifter can become hesitant on downshifts if the linkage bolt loosens, which is a thirty-second fix but an alarming feel if you do not know the cause. The launch-control mode interferes with some aftermarket ECU flashes, and owners who flatten the throttle map using third-party maps should be aware that the factory wheelie-control strategy assumes the stock fuel curve.',
  'Mechanical issues specific to the R1 are rare but worth naming. Some 2020–2023 bikes developed a weep from the cam-chain tensioner gasket; Yamaha revised the gasket material under an unpublished running change and a replacement is inexpensive. A smaller number of bikes have needed a new coolant reservoir after thermal cycling caused a hairline crack near the mount — again cheap and fast to replace. Neither issue is a recall; both are in the service bulletin database.',
  'Finally, be aware that the OEM Bridgestone RS11 tyres are excellent on dry pavement and very average in the wet and in cold weather. Many riders who buy the bike in autumn report a vague front end until the tyres come up to temperature, and attribute the problem to the chassis. It is almost always a tyre-temperature problem, not a chassis one. If you ride year-round, plan on a second set of tyres suited to the season rather than trying to make one compound do everything. The R1 rewards a confident, warmed-up front tyre more than almost any other sport bike in the segment.',
  'One thing new R1 owners consistently underestimate is how much of the bike’s quirk list comes from its intended use case. This is a homologation tool for Yamaha’s racing programme, sold in the same package to the public. Every decision in the chassis, the bodywork, the ergonomics and the electronics was made with a track-day rider in mind first and a road rider second. Once you accept that, the complaints shift from problems to trade-offs: the ergonomics are aggressive because the bike is meant to be ridden aggressively, the fairing is tight because it is optimised for aerodynamics at 250 km/h, the instruments are minimal because a track-day rider needs the tacho and not much else. The R1 is not trying to be a sport-tourer that happens to be fast. It is trying to be a circuit bike that happens to have indicators, and the common-problem list is substantially shorter and less expensive than it would be on a bike trying to be everything.',
];

const R1_COST: string[] = [
  'The true cost of owning a 2023 Yamaha YZF-R1 is dominated by two line items: tyres and insurance. A set of sport tyres lasts 4,000–6,000 km of mixed street riding for most owners, and can be reduced to a single track weekend if the bike is pushed at an intermediate group pace. Budget one full set of tyres per year for a street rider and two or three sets per year for an active trackday rider. Insurance varies dramatically by jurisdiction, rider age and claims history, but in most Western markets a 30-year-old rider with a clean record should expect the R1 to cost roughly 60–90% more to insure than a middleweight naked of similar value.',
  'Fuel cost is a smaller line than most buyers assume. The R1 will average 6.0–6.5 L/100 km in steady street riding, dropping to 5.3 L/100 km on a long highway tour and climbing above 9 L/100 km on a track day. At typical European fuel prices that is a few hundred euros a year for a street-only bike with 4,000–6,000 km of annual use. Owners who tour on the R1 almost always add a throttle lock or cruise-style solution; the stock throttle has no cruise control and the cable spring is stiffer than most other liter bikes.',
  'Scheduled maintenance is where the R1 is surprisingly affordable relative to its spec sheet. Oil and filter changes are in the same price bracket as any other Japanese inline-four. The long valve-clearance interval means most owners will only face that bill once in their ownership. Chain and sprocket replacement at around 25,000–30,000 km is a meaningful expense — a quality OEM-spec chain set is typically in the 280–420 EUR range installed — but it is predictable.',
  'Depreciation is the cost line most riders forget to model. Current-generation R1s hold value relatively well for the first three years, then drop noticeably in year four as the next homologation cycle looms. Buyers who intend to keep the bike for more than five years are essentially insulated from this curve; buyers who flip bikes annually should assume they will take a 15–20% hit per year on a late-model R1 in average condition.',
  'Total cost of ownership for a typical street-only 2023 R1 owner running 5,000 km/year in a mid-priced European insurance market lands somewhere around 3,800–5,200 EUR annually, excluding the original purchase price. Active track riders should double or triple that figure. The R1 is not an expensive bike to own compared to its European competition — a Panigale V4 or a BMW M 1000 RR will cost more in almost every category — but it is also not a cheap bike to own, and any buyer who expects commuter-scooter running costs will be disappointed. Budget honestly and the bike will reward you.',
  'One way to think about the cost picture is to separate the predictable items from the elastic items. Predictable items — scheduled oil changes, brake fluid, coolant, air filter, the 42,000 km valve service — are easy to model and unavoidable. Elastic items — tyres, track fees, consumables damaged in a slow-speed parking-lot tip-over, crash protection you wish you had fitted earlier — scale directly with how hard you ride. A rider who treats the R1 as a dry-weather Sunday bike and never sees a circuit will pay the predictable cost and very little else. A rider who does ten track days a year and enters the occasional amateur race will pay many multiples of the predictable cost. Neither path is wrong. Both are legitimate ways to own the bike. What matters is that you pick your path deliberately before the second tyre bill arrives, not after.',
];

const R1_INTERVALS: string[] = [
  'The service-interval philosophy for the 2023 YZF-R1 can be summarised in three sentences. Oil is cheap; cam work is expensive; and brake fluid is the component most often neglected and most likely to ruin your day. Everything else on the Yamaha-published schedule falls out of those three priorities, and every deviation experienced owners make from the book is rooted in one of them.',
  'Yamaha prescribes an oil-and-filter change at the 1,000 km break-in service and thereafter every 10,000 km or annually. In practice most serious owners halve the ongoing interval to 5,000 km, and track-day riders change oil as often as every third or fourth track day. The R1 is a high-rpm engine with a wet clutch in a shared sump; oil shear is real, and the cost of a filter and five litres of synthetic is trivial compared to a worn cam or a glazed clutch pack.',
  'The valve-clearance inspection interval of 42,000 km is genuinely long and reflects Yamaha’s confidence in the valve train. Most owners will sell the bike before reaching it. Those who hold the bike through the 42,000 km mark should expect a shop to quote six to nine hours of labour plus gaskets, O-rings, coolant and any shim stock that is actually required. Many bikes need no shim changes at all at their first inspection.',
  'Chain inspection is officially every 1,000 km. Riders who adjust by the book are usually surprised to find the chain needs attention more often than the book implies — tension creeps in the first 2,000 km, and sport riders who load the chain hard out of slow corners wear it faster than tourists who cruise. A reasonable rule is to check tension and lube condition every second or third fuel stop in the first 2,000 km after fitting a new chain, then every 500–800 km thereafter.',
  'Brake fluid has a hard two-year replacement interval; coolant has a three-year interval; the air filter is officially 40,000 km but should be earlier in dusty conditions; spark plugs are 40,000 km; and the fuel filter is located in the fuel pump module and is not serviceable on its own schedule. Tyre-pressure checks, chain lube, nut-and-bolt checks around the fairing subframe, and fork-seal inspections are the everyday items that belong in the rider’s own head, not on the dealer’s quote. Owners who treat these items as automatic the way they treat seat-belt checks in a car get the longest, least expensive service life out of the bike.',
  'A final note on tracking the schedule itself. The R1 has no service-reminder app from Yamaha and the dash only tracks a single oil-change counter. Owners who keep the bike for more than a couple of years benefit hugely from a simple written log — date, odometer, work performed, parts used, cost. The log serves three purposes. It catches drift in the intervals before it becomes significant. It multiplies resale value at sale time because the next buyer can see exactly what has and has not been done. And it makes warranty claims substantially easier if any item is ever disputed. It does not matter whether the log lives in a notebook, a spreadsheet, or a dedicated maintenance app. It matters only that it exists, is current, and is consistent. Every long-term R1 owner who has sold a bike at a premium price has kept a log of some kind. Every owner who has taken a price hit at sale time has not.',
];

// ---------- BMW R1250GS 2023 ----------

const GS_OVERVIEW: string[] = [
  'The 2023 BMW R1250GS is the default choice in the big-bore adventure category, and the reason is boring by adventure-bike standards: it does everything acceptably well, some things very well, and almost nothing badly. The 1,254 cc ShiftCam boxer twin is the current high-water mark of BMW’s long-running flat-twin family, and the combination of low-rpm torque, semi-active suspension, and a very mature electronic rider-aid suite makes the bike easy to ride well and hard to ride badly.',
  'The ShiftCam system, introduced on the 1250 platform in 2019, is a two-profile variable valve lift arrangement on the intake side. At low rpm the engine runs a mild cam profile that produces a broad, flat torque curve ideal for trickling over obstacles or lugging the bike out of slow corners. At higher rpm the system shifts to a higher-lift profile that unlocks the top-end power band. Riders rarely notice the transition happening — that is the point — but they notice the two-in-one character of the engine when they compare it to the earlier 1200.',
  'For the 2023 model year the GS is largely carried over from the major 2019 update. The important options most buyers should budget for are Dynamic ESA (BMW’s semi-active suspension), the full Ride Modes Pro package with Enduro Pro mode, heated grips, keyless ride, and the TFT dash with connectivity. Pillion comfort is among the best in the class, fuel range on the 20 L tank routinely exceeds 400 km in gentle touring, and the optional cruise control is one of the most useful accessories BMW sells.',
  'On pavement the GS is a fast, stable tourer that happens to handle better than a 249 kg bike has any right to. The Telelever front suspension keeps the nose from diving under hard braking, which flattens out the rider’s visual horizon in a way every first-time GS rider comments on. Off pavement the bike is heavy but genuinely capable in the hands of a rider who has learned to stand on the pegs, use the torque instead of the clutch, and trust the Enduro Pro ABS settings. It is not an off-road specialist — no 249 kg bike is — but it goes places most adventure bikes can only be photographed next to.',
  'Buyers considering a used 2023 GS should focus on service history (boxer twins are unforgiving of missed valve services), the condition of the final drive, and whether the bike has the options package they actually want. A base-spec GS is a fine bike. A fully-optioned GS with Dynamic ESA, Enduro Pro and the full connectivity suite is a substantially different and, for most touring riders, better motorcycle. This overview is the jumping-off point for the deeper guides linked below.',
  'The GS also deserves a word on the community that surrounds it. BMW owners’ forums and rallies are an unusually rich source of long-term ownership data because the typical GS rider keeps the bike longer than the typical sport-bike rider keeps his, rides it further, and documents it in more detail. This is why the common-problems list for the GS is so well calibrated — it is assembled from decades of high-mileage tourers comparing notes, not from a handful of dealer-network anecdotes. Prospective buyers who spend an evening reading long-mileage GS build threads learn more about the real ownership experience than they would from any number of published reviews. That same community is the reason independent BMW specialists exist in almost every large city, and the reason the second-hand parts supply for the GS is unusually good for a European bike. If you are new to the platform, lean on that community before and after you buy.',
];

const GS_MAINTENANCE: string[] = [
  'Maintenance on the 2023 BMW R1250GS is not difficult but it is specific. The boxer twin has quirks a rider coming from an inline-four Japanese bike will not expect, and the shaft final drive removes some work from the schedule while adding other work that most riders forget about until the first long service. BMW’s official intervals are 10,000 km for oil and filter, which most experienced GS owners leave alone rather than shortening — the boxer twin is not a high-revving stressed engine and the factory oil capacity is generous enough to handle long intervals in touring use.',
  'Valve-clearance inspection is due every 20,000 km, and unlike the Yamaha R1 it is an interval owners will actually hit — many GS bikes see 15,000–20,000 km per year in regular touring use. The boxer twin’s valves are easy to reach on the outer cylinder covers but they must be checked in a specific sequence, and the two cylinders do not always wear at the same rate. Expect a competent shop to quote three to five hours of labour and to find at least one shim out of spec at the first 40,000 km inspection on a bike that has been ridden hard.',
  'The final drive is the single maintenance item GS owners most often under-service and most often have to pay for. BMW recommends an oil change in the final drive every 20,000 km. In practice many owners go longer, and the shaft drive is forgiving enough that nothing obvious happens until it has already failed. A used GS with no final-drive service history should be treated as a bike that will need a final-drive oil change and a careful seal inspection immediately.',
  'Brake fluid is on a two-year replacement schedule. Coolant is on a three-year replacement schedule. The air filter is an ordinary paper element accessible under the tank, and it should be inspected at every major service rather than strictly by mileage — GS riders who tour in dusty regions wear filters much faster than the book implies. Spark plugs are due at 40,000 km; they almost never fail early.',
  'The forgotten-but-important items are the steering-head bearing adjustment, the swingarm pivot bolts, the Telelever pivot bearings, and the wheel bearings. None of these have a hard replacement interval but all should be inspected at the 40,000 km major service. A GS that sees rain, washes, and off-road use will wear the wheel bearings visibly faster than a bike that lives in a garage and sees only summer tours. Finally, the chain is not a service item on the GS at all — the shaft drive removes that whole category of work, and it is one of the reasons long-distance riders choose the bike.',
  'One category worth its own paragraph is the electrical and software side of the bike. The 2023 GS has more computers on it than most early-2000s cars, and the dealer diagnostic tool (ISTA or its successor) is the only practical way to perform certain updates, clear certain error codes, and reprogramme the keyless-ride module when keys are added or replaced. None of this is a maintenance item in the traditional sense, but all of it is part of owning a modern BMW, and owners who ignore firmware and software updates for several years occasionally find themselves with bikes that throw dash warnings for problems that were silently fixed in a later software version. Ask for software updates at every major service, and check that the update has actually been performed rather than just billed for.',
];

const GS_PROBLEMS: string[] = [
  'The 2023 R1250GS is a mature design, and the problems owners actually report cluster around a small number of well-documented areas. The single most-discussed issue in long-term owner forums is the final drive. Early-generation GS boxers had a history of premature final-drive bearing wear, and while BMW addressed the root causes with revised designs in the 1250 generation, the reputation lingers and buyers should inspect carefully. Listen for a slight whine on trailing throttle at 60–80 km/h, feel for any play at the rear hub with the wheel off the ground, and insist on seeing evidence that the 20,000 km final-drive oil service has actually been performed.',
  'Shaft drive quirks are not a defect but they catch new GS owners by surprise. The boxer twin plus shaft drive creates a pronounced rise-and-squat behaviour under throttle inputs — the rear end lifts slightly as you roll off and compresses as you roll on. Experienced GS riders use this as a handling cue, but first-time owners sometimes interpret it as a suspension problem and waste money trying to tune it out. It is not a problem; it is the drivetrain doing its job.',
  'ABS quirks are the third area to watch. The Integral ABS system on the GS links the front and rear brakes in a way that surprises riders used to fully-independent wheels. In most rider modes the system is invisible, but in Enduro Pro mode the rear ABS becomes much more permissive and can feel switched-off to riders who have not read the manual. The opposite complaint also exists: some owners find the cornering ABS intervenes earlier than they would like in hard road riding, and BMW does not expose a user-accessible way to raise the threshold.',
  'Electrical and TFT-dash issues are rare but not unheard of. A small number of 2019–2023 GS bikes have had a keyless-ride module fail, which leaves the bike unable to authorise the start circuit. The fix is a dealer-only module replacement. The TFT dash itself is reliable but the Bluetooth pairing with some Android devices remains inconsistent; BMW ships updates through the dealer network and owners should ensure their bike has the latest firmware at every service.',
  'Finally, the heat management of the boxer twin is something buyers should experience before they commit. The two cylinders sit directly in front of the rider’s shins, and in heavy traffic on a hot summer day the heat coming off the left cylinder is genuinely uncomfortable. Many owners rate this as the single biggest downside of the bike in urban use. It is not a defect; it is physics, and the bike is fundamentally not designed for stop-and-go commuting. If commuting is your primary use case, ride a GS in rush-hour traffic on a warm day before you buy one. If touring is your primary use case, the heat is a non-issue because you will almost never be stopped for long enough to notice.',
  'A short note on recalls. BMW has issued several campaigns affecting 1250-generation GS bikes over the years, covering items like fork-tube pinch bolts, specific batches of brake hoses, and a small number of rear-brake master-cylinder concerns. Most of these were fully addressed under warranty and a clean VIN search at a BMW dealer is the fastest way to confirm whether any open campaigns apply to a specific bike. Always perform this check before buying a used GS; it is free, takes five minutes, and occasionally uncovers a free repair the previous owner did not know about. Nothing on the recall list is catastrophic for the platform, but nothing on the recall list should be left unresolved either.',
];

const GS_COST: string[] = [
  'The 2023 R1250GS is not a cheap bike to own but it is one of the most predictable. Tyre cost is lower than on a sport bike — a set of adventure tyres typically lasts 8,000–12,000 km in street-heavy mixed use, and owners who stay on pavement can stretch a rear to 14,000 km. Buyers who actually ride off-pavement will see tyre wear climb quickly, and anyone who spends serious time on true knobby tyres should expect to replace the rear every 4,000–5,000 km.',
  'Insurance for the GS is meaningfully cheaper than for a comparable-price sport bike. Adventure bikes are actuarially safer per kilometre than sport bikes, the typical GS rider is older and more experienced, and the claims history of the model has been good for years. In most Western markets a 40-year-old rider with a clean record should expect to pay less to insure a GS than to insure a middleweight sport bike of half the value.',
  'Scheduled maintenance is where the GS starts to feel expensive if you use a BMW dealer. The 20,000 km valve-clearance service is not cheap at dealer rates, and the 40,000 km major service with fork oil, brake fluid, valve check and final-drive oil is meaningfully more than the equivalent service on a Japanese bike. Independent BMW specialists charge substantially less for the same work, and many long-term GS owners learn to do the oil changes and the final-drive oil themselves.',
  'Fuel economy is one of the bike’s quiet strengths. The ShiftCam 1250 averages around 5.0–5.5 L/100 km in touring use, which translates to 400+ km from the 20 L tank at comfortable cruise speeds. Owners who ride two-up with luggage see that number rise to around 6 L/100 km; owners who ride hard in the mountains can exceed 7 L/100 km. Compared to a sport-tourer of the same weight the GS is genuinely economical, and the range is what makes it a credible long-distance bike in places where fuel stops are thin on the ground.',
  'Depreciation on the GS is famously slow. A clean, well-optioned 2023 GS with full service history from a BMW dealer will sell for a high fraction of its original price several years later, and there is a thriving second-hand market in every country where BMW sells the bike. This is the reason many long-term owners consider the GS cheap to own in total-cost terms even though individual line items are not cheap: the cost you recover at resale is much higher than on almost any competitor. Total cost of ownership for a typical 12,000 km/year GS tourer in a European market, including servicing at an independent specialist, tyres, insurance, fuel, and amortised depreciation, lands in the neighbourhood of 3,200–4,500 EUR annually. The number is not small but it is honest, and it buys a motorcycle that will do things almost nothing else in the category will do.',
  'One area buyers frequently overlook when budgeting is accessories. The GS is famously option-heavy from the factory, but a meaningful number of owners add luggage (hard panniers and a top case), crash protection (engine bars, tank guards, cylinder-head protection), auxiliary lighting, heated gear connections, a taller windscreen, and sometimes a suspension revalve. A reasonable accessory budget for a new-to-you GS is 1,500–3,000 EUR in the first year of ownership, and the figure can easily climb higher for riders who want the full Adventure-bike loadout. None of this is required to ride the bike; the GS is completely usable in base form. But almost every long-term GS rider ends up with some version of this list, and buyers who model the total cost honestly should include it.',
];

const GS_INTERVALS: string[] = [
  'Service-interval discipline on the R1250GS comes down to three rules: change the final-drive oil on time, check the valves on time, and do not skip brake-fluid changes because the bike does not feel like it needs them. Almost every expensive GS problem an experienced mechanic describes can be traced to one of those three items being skipped or pushed past its interval by an owner who thought the bike still felt fine.',
  'Engine oil and filter is due every 10,000 km. Unlike the R1, there is no strong argument for halving the interval — the boxer twin is a large, low-stressed engine and the factory oil capacity is generous. Use a full-synthetic oil that meets BMW’s specification (typically 5W-40 or the BMW-branded equivalent), and do not mix in friction modifiers. The wet clutch in the GS is less sensitive than the R1’s but still unhappy with automotive-only oils.',
  'Valve-clearance inspection is due every 20,000 km. This is the single most important service on the bike in terms of long-term engine health. Budget three to five hours of labour at a shop, or a full weekend at home if you are mechanically confident and have the sequence from the service manual. The cylinders are easy to reach but the torque specs on the cover bolts are specific and the cam cover gasket is single-use.',
  'Final-drive oil is due every 20,000 km, and this is where GS owners most often make expensive mistakes. The service is trivial — drain, fill, check for metal in the old oil — but skipping it is the leading cause of final-drive bearing failures. A fifteen-minute job every two years saves the cost of an entire final-drive rebuild. Any used GS you are shopping should have evidence of final-drive oil changes at every 20,000 km interval since new, or the price should reflect the work you will need to do yourself.',
  'Brake fluid is on a two-year replacement interval and must not be skipped. The GS brakes are linked and electronically assisted; degraded fluid is not just a performance issue but a system-health issue. Coolant is on a three-year replacement interval. The air filter should be inspected at every valve service and replaced if dirty, with a shorter cycle if you ride in dusty conditions. Wheel bearings, Telelever pivot bearings and swingarm bearings are inspected at 40,000 km. Tyre pressures should be checked before every ride — the GS is heavy, and the difference between 2.2 bar and 2.5 bar at the rear is genuinely noticeable in steering feel. Owners who treat all of this as routine rather than optional get a motorcycle that is still trouble-free past 100,000 km.',
  'A last word on scheduling. The GS is a high-mileage touring bike by nature, and owners routinely cover 15,000–20,000 km in a single riding season. That means the service-interval calendar comes up fast, and planning ahead matters more than it does on a low-mileage bike. Riders who cover 20,000 km per year should be budgeting for a full valve-clearance service every year, a final-drive oil change every year, and tyres at whatever rate their riding demands. Riders who cover 5,000 km per year can let the mileage-based items stretch but must still honour the time-based items — brake fluid at two years, coolant at three. A GS that sits in a garage is not a GS that is being saved; it is a GS that is quietly going out of service spec on the calendar side while its odometer stays low. Either ride the bike or maintain it by the calendar, ideally both.',
];

const R1_FAQS: BikeFaqItem[] = [
  {
    question: 'Is the 2023 Yamaha YZF-R1 reliable as a daily rider?',
    answer:
      'Mechanically yes, practically no. The engine and gearbox are robust and the electronics are mature, but the aggressive seating position, heat soak in traffic, and short service intervals make it a poor match for year-round commuting. Use it as a weekend and track-day bike for best results.',
  },
  {
    question: 'How often should I change the oil on a 2023 R1?',
    answer:
      'Yamaha says every 10,000 km or annually. Most hard-riding owners halve that to 5,000 km, and track-day riders change oil every 3–4 track days. Use a JASO MA2-rated synthetic 10W-40.',
  },
  {
    question: 'What is the valve-clearance interval on the YZF-R1?',
    answer:
      'Yamaha specifies 42,000 km for the valve-clearance inspection. It is an unusually long interval and most owners will sell the bike before reaching it, but those who keep the bike should budget six to nine hours of shop labour when the service is due.',
  },
  {
    question: 'Is the YZF-R1 a good first superbike?',
    answer:
      'Only if you already have meaningful middleweight experience. The R1 is forgiving in its electronic safety net but unforgiving in its ergonomics and power delivery. A rider stepping up from a 600 cc sport bike will adapt faster than a rider coming straight from a naked 500.',
  },
];

const GS_FAQS: BikeFaqItem[] = [
  {
    question: 'How reliable is the 2023 BMW R1250GS?',
    answer:
      'Very reliable for a big-bore adventure bike, provided scheduled maintenance is not skipped. The boxer twin and ShiftCam system are mature, and the main reliability risk is owners who skip final-drive oil changes or valve-clearance services.',
  },
  {
    question: 'What is the final-drive oil change interval on the R1250GS?',
    answer:
      'BMW recommends every 20,000 km. This is the single most important service item on the bike, and skipping it is the leading cause of final-drive bearing failures. It is a fifteen-minute job for a capable owner.',
  },
  {
    question: 'Can you ride the R1250GS off-road?',
    answer:
      'Yes, but it is a heavy bike. In the hands of a rider who has learned to stand on the pegs and use the torque, it is genuinely capable on gravel and easy dirt. It is not an off-road specialist and no 249 kg bike ever will be.',
  },
  {
    question: 'How much does it cost to own a BMW R1250GS per year?',
    answer:
      'A typical 12,000 km/year European tourer should budget roughly 3,200–4,500 EUR annually for servicing, tyres, insurance, fuel and amortised depreciation. Dealer service is meaningfully more expensive than independent specialists.',
  },
];

function build(
  make: string,
  model: string,
  year: number,
  pageType: PageType,
  overrides: {
    title: string;
    description: string;
    h1: string;
    bodyParagraphs: string[];
    specs: BikeSpec[];
    telemetry?: BikeTelemetry[];
    faqItems: BikeFaqItem[];
  },
): BikePageData {
  return {
    make,
    makeSlug: makeSlug(make),
    model,
    modelSlug: modelSlug(model),
    year,
    pageType,
    ...overrides,
  };
}

export const BIKE_FIXTURES: readonly BikePageData[] = [
  // Yamaha YZF-R1 2023 × 5
  build('Yamaha', 'YZF-R1', 2023, 'overview', {
    title: '2023 Yamaha YZF-R1 Overview, Specs & Owner Notes | MotoVault',
    description:
      'Long-form owner-oriented overview of the 2023 Yamaha YZF-R1: what the crossplane inline-four is really like to live with, where it excels, and where it frustrates.',
    h1: '2023 Yamaha YZF-R1 Overview',
    bodyParagraphs: R1_OVERVIEW,
    specs: R1_SPECS,
    telemetry: R1_TELEMETRY,
    faqItems: R1_FAQS,
  }),
  build('Yamaha', 'YZF-R1', 2023, 'maintenance-schedule', {
    title: '2023 Yamaha YZF-R1 Maintenance Schedule | MotoVault',
    description:
      'Real-world maintenance schedule for the 2023 YZF-R1: oil, valve clearances, chain, brake fluid, coolant and spark plugs — what the book says and what owners actually do.',
    h1: '2023 Yamaha YZF-R1 Maintenance Schedule',
    bodyParagraphs: R1_MAINTENANCE,
    specs: R1_SPECS,
    telemetry: R1_TELEMETRY,
    faqItems: R1_FAQS,
  }),
  build('Yamaha', 'YZF-R1', 2023, 'common-problems', {
    title: '2023 Yamaha YZF-R1 Common Problems | MotoVault',
    description:
      'Battery drain, heat soak, electronics quirks, and the rare mechanical issues owners actually report on the 2023 YZF-R1 — ranked and explained.',
    h1: '2023 Yamaha YZF-R1 Common Problems',
    bodyParagraphs: R1_PROBLEMS,
    specs: R1_SPECS,
    telemetry: R1_TELEMETRY,
    faqItems: R1_FAQS,
  }),
  build('Yamaha', 'YZF-R1', 2023, 'cost-of-ownership', {
    title: '2023 Yamaha YZF-R1 Cost of Ownership | MotoVault',
    description:
      'Honest cost of owning a 2023 Yamaha YZF-R1: tyres, insurance, fuel, scheduled maintenance and depreciation — modelled for street and track riders.',
    h1: '2023 Yamaha YZF-R1 Cost of Ownership',
    bodyParagraphs: R1_COST,
    specs: R1_SPECS,
    telemetry: R1_TELEMETRY,
    faqItems: R1_FAQS,
  }),
  build('Yamaha', 'YZF-R1', 2023, 'service-intervals', {
    title: '2023 Yamaha YZF-R1 Service Intervals | MotoVault',
    description:
      'Service intervals for the 2023 YZF-R1: oil, valves, chain, brake fluid, coolant, air filter and spark plugs. The book vs. what experienced owners actually do.',
    h1: '2023 Yamaha YZF-R1 Service Intervals',
    bodyParagraphs: R1_INTERVALS,
    specs: R1_SPECS,
    telemetry: R1_TELEMETRY,
    faqItems: R1_FAQS,
  }),
  // BMW R1250GS 2023 × 5
  build('BMW', 'R1250GS', 2023, 'overview', {
    title: '2023 BMW R1250GS Overview, Specs & Owner Notes | MotoVault',
    description:
      'Long-form owner-oriented overview of the 2023 BMW R1250GS: what the ShiftCam boxer twin is really like to live with on pavement and off.',
    h1: '2023 BMW R1250GS Overview',
    bodyParagraphs: GS_OVERVIEW,
    specs: GS_SPECS,
    telemetry: GS_TELEMETRY,
    faqItems: GS_FAQS,
  }),
  build('BMW', 'R1250GS', 2023, 'maintenance-schedule', {
    title: '2023 BMW R1250GS Maintenance Schedule | MotoVault',
    description:
      'Maintenance schedule for the 2023 R1250GS: oil, valve clearances, final drive, brake fluid, coolant, bearings and the forgotten-but-important items.',
    h1: '2023 BMW R1250GS Maintenance Schedule',
    bodyParagraphs: GS_MAINTENANCE,
    specs: GS_SPECS,
    telemetry: GS_TELEMETRY,
    faqItems: GS_FAQS,
  }),
  build('BMW', 'R1250GS', 2023, 'common-problems', {
    title: '2023 BMW R1250GS Common Problems | MotoVault',
    description:
      'Final-drive concerns, shaft quirks, ABS behaviour, keyless-ride gremlins and the other issues real R1250GS owners actually report.',
    h1: '2023 BMW R1250GS Common Problems',
    bodyParagraphs: GS_PROBLEMS,
    specs: GS_SPECS,
    telemetry: GS_TELEMETRY,
    faqItems: GS_FAQS,
  }),
  build('BMW', 'R1250GS', 2023, 'cost-of-ownership', {
    title: '2023 BMW R1250GS Cost of Ownership | MotoVault',
    description:
      'Real cost of owning a 2023 R1250GS: tyres, dealer vs independent servicing, fuel, insurance and depreciation — modelled for touring use.',
    h1: '2023 BMW R1250GS Cost of Ownership',
    bodyParagraphs: GS_COST,
    specs: GS_SPECS,
    telemetry: GS_TELEMETRY,
    faqItems: GS_FAQS,
  }),
  build('BMW', 'R1250GS', 2023, 'service-intervals', {
    title: '2023 BMW R1250GS Service Intervals | MotoVault',
    description:
      'Service intervals for the 2023 R1250GS: oil, valves, final-drive oil, brake fluid, coolant, bearings. What matters, what can wait, what must never be skipped.',
    h1: '2023 BMW R1250GS Service Intervals',
    bodyParagraphs: GS_INTERVALS,
    specs: GS_SPECS,
    telemetry: GS_TELEMETRY,
    faqItems: GS_FAQS,
  }),
] as const;

export function findBikePage(params: {
  make: string;
  model: string;
  year: string;
  pageType: string;
}): BikePageData | undefined {
  const yearNum = Number.parseInt(params.year, 10);
  if (Number.isNaN(yearNum)) return undefined;
  return BIKE_FIXTURES.find(
    (p) =>
      p.makeSlug === params.make &&
      p.modelSlug === params.model &&
      p.year === yearNum &&
      p.pageType === params.pageType,
  );
}
