"""English variants: en-US, en-CA, en-GB, en-AU, and the PH Play custom listing."""

V = {
    'en-US': dict(dist='mile', dists='miles', tire='tire', fuel='gas', shop='shop', labor='labor',
                  region='the US and Canada', reg='registration', check='inspection',
                  favor='favorite', color='color'),
    'en-CA': dict(dist='kilometre', dists='kilometres', tire='tire', fuel='gas', shop='shop', labor='labour',
                  region='Canada and the US', reg='registration', check='safety inspection',
                  favor='favourite', color='colour'),
    'en-GB': dict(dist='mile', dists='miles', tire='tyre', fuel='petrol', shop='garage', labor='labour',
                  region='the UK and Europe', reg='MOT', check='MOT',
                  favor='favourite', color='colour'),
    'en-AU': dict(dist='kilometre', dists='kilometres', tire='tyre', fuel='fuel', shop='workshop', labor='labour',
                  region='Australia and New Zealand', reg='rego', check='rego check',
                  favor='favourite', color='colour'),
    'en-PH': dict(dist='kilometer', dists='kilometers', tire='tire', fuel='gas', shop='casa', labor='labor',
                  region='the Philippines', reg='LTO registration', check='LTO renewal',
                  favor='favorite', color='color'),
}


def captions(loc):
    v = V[loc]
    km = v['dist'] != 'mile'
    per = 'km' if km else 'mile'
    caps = {
        'ride_tracking': (['Track every ride.', 'Keep every road.'],
                          'GPS route, distance, climb and max lean, logged as you ride.'),
        'ride_stats': (['Every ride,', 'by the numbers.'],
                       '{route_name}: distance, moving time, climb and max lean.'),
        'expenses': (['Know what your', 'bike really costs.'],
                     f"{v['fuel'].capitalize()}, parts, gear and {v['shop']} bills in one place. Free to log."),
        'receipt_scan': (['Snap the receipt.', 'Skip the typing.'],
                         f"MotoVault reads the parts, {v['labor']} and total, then fills it in."),
        'maintenance_reminders': (['Never miss', 'a service.'],
                                  f"Reminders by {'km' if km else 'mileage'} or by date, set to your bike's intervals."),
        'service_history': (['Every service,', 'on the record.'],
                            'A full maintenance history that backs you up at resale.'),
        'garage': (['Your bike,', 'all in one place.'],
                   f"Specs, odometer, next service and running costs at a glance."),
        'trip_planning': (['Plan the trip.', 'Ride the plan.'],
                          'Map the route, drop waypoints, share it with your group.'),
        'season_summary': (['Your season,', 'in one recap.'],
                           '{distance} over {ride_count} rides, your longest, and where you went.'),
        'costs_overview': ([f"Every {'kilometre' if loc in ('en-CA','en-AU') else ('kilometer' if km else 'mile')}", 'has a price.'],
                           f"Cost per {per}, monthly trends and {{currency_amount}} spent this year."),
    }
    if loc == 'en-GB':
        caps['maintenance_reminders'] = (['Never miss', 'a service.'],
                                         'Reminders by mileage or by date: service, MOT, the lot.')
    if loc == 'en-AU':
        caps['maintenance_reminders'] = (['Never miss', 'a service.'],
                                         'Reminders by km or by date: servicing, rego, the lot.')
    if loc == 'en-PH':
        caps['maintenance_reminders'] = (['Never miss', 'your PMS.'],
                                         'Change oil and PMS reminders by km or by date.')
        caps['garage'] = (['Your motor,', 'all in one place.'], caps['garage'][1])
        caps['expenses'] = (['Know what your', 'motor really costs.'],
                            'Gas, parts, accessories and casa bills in one place. Free to log.')
    return caps


ASSETS = {
    'header': 'Your motorcycle, fully tracked',
    'search': 'Track every ride. Keep every road.',
    'feature_graphic': 'Rides. Costs. Service. Tracked.',
}


def _features(v, platform, loc):
    km = v['dist'] != 'mile'
    unit = v['dist']
    bike = 'motor' if loc == 'en-PH' else 'bike'
    lines = [
        f"* TRACK EVERY RIDE - Hit record and ride. MotoVault logs your GPS route, distance, moving time, climb and max lean angle, and builds a logbook of every {unit} you have ridden. Export any ride as GPX.",
        f"* TRACK EVERY EXPENSE - Every fill-up, every part, every {v['shop']} bill. See what your {bike} really costs per {'km' if km else 'mile'}, per month and per year. Logging is free and unlimited, always.",
        f"* SCAN A RECEIPT INSTEAD OF TYPING - Point your camera at a {v['fuel']}, parts or {v['shop']} receipt. MotoVault reads the parts, the {v['labor']}, the total and the date, and fills the expense in for you.",
        f"* NEVER MISS A SERVICE - Oil changes, chain adjustments, {v['tire']} swaps, valve checks. Set reminders by {'kilometres' if km and loc!='en-PH' else ('kilometers' if km else 'mileage')} or by date and get a heads-up before the next interval is due.",
        "* KEEP THE FULL SERVICE HISTORY - Every job logged with date, odometer and cost. A complete record that backs you up when you sell.",
        f"* YOUR GARAGE - Specs, odometer, next service and running costs for your {bike}, on one screen. 12,000+ motorcycle models in the catalog.",
        "* PLAN EVERY TRIP - Map the weekend loop or the big tour. Save routes, drop waypoints and share the plan with your group.",
        f"* YOUR SEASON IN ONE RECAP - Total {v['dists']}, rides, your longest ride and the countries you rode through, ready to share.",
    ]
    if platform == 'apple':
        lines.insert(6, "* MOTOVAULT ON CARPLAY - Start, pause and end a ride from your head unit, with distance and moving time big enough to read at a glance.")
    return lines


def _who(loc):
    if loc == 'en-PH':
        return ['- Daily riders who use their motor for work and the commute',
                '- Weekend riders chasing the next good road up north or down south',
                '- Touring riders logging long rides across Luzon, Visayas and Mindanao',
                '- DIY riders who do their own change oil and PMS',
                '- Anyone tired of car apps that treat motorcycles as an afterthought']
    return ['- Commuters who ride every day and want the bike kept right',
            '- Weekend riders chasing the next good road',
            '- Adventure and touring riders logging long trips',
            '- Home mechanics who do their own wrenching',
            '- Anyone tired of car apps that treat motorcycles as an afterthought']


def _hook(loc):
    v = V[loc]
    bike = 'motor' if loc == 'en-PH' else 'motorcycle'
    return (f"Track every ride, every expense and every service on your {bike}, in one app built for riders, not drivers.\n\n"
            f"MotoVault records your rides with GPS, shows you what your bike really costs, and reminds you before the next service is due. "
            f"Your rides, your costs and your maintenance history stay in one garage you carry in your pocket.")


SEP = '--------------------------'


def apple_description(loc):
    v = V[loc]
    parts = [_hook(loc), '', SEP, 'WHAT YOU CAN DO', SEP, '', '\n\n'.join(_features(v, 'apple', loc)), '',
             SEP, 'BUILT FOR RIDERS', SEP, '',
             f"- {'Kilometres' if v['dist']=='kilometre' else 'Miles'} or {'miles' if v['dist']=='kilometre' else ('kilometers' if loc == 'en-US' else 'kilometres')}: your whole garage follows your choice",
             '- Light and dark themes, built to be read in a garage',
             '- Your data is yours: private, exportable, never sold',
             f"- Made for riders in {v['region']}", '',
             SEP, "WHO IT'S FOR", SEP, '', '\n'.join(_who(loc)), '',
             SEP, 'FREE AND PRO', SEP, '',
             'MotoVault is free, and logging is never limited: one bike, unlimited expenses, unlimited service history and reminders, and unlimited ride recording and trips. Every month you also get 3 receipt scans and 1 GPX export.',
             '',
             'MotoVault Pro adds unlimited bikes, unlimited receipt scans, unlimited GPX exports, offline trip maps and more AI help. Choose monthly, annual or a one-time lifetime purchase. Prices are shown in the app in your local currency.',
             '',
             'Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store account settings.',
             '',
             'Privacy Policy: https://motovault.app/privacy',
             'Terms of Use: https://motovault.app/terms', '',
             'Questions or ideas? We read every email: support@motovault.app', '',
             'Two wheels. One app. Ride better.']
    return '\n'.join(parts)


def play_description(loc, free_block):
    v = V[loc]
    bike = 'motor' if loc == 'en-PH' else 'motorcycle'
    hook = (f"MotoVault is the {bike} tracker for riders: GPS ride tracking, expense tracking with receipt scanning, "
            f"and maintenance reminders, in one app built for motorcycles, not cars.\n\n"
            f"Record every ride, log every {v['fuel']} fill-up and {v['shop']} bill, and get reminded before your next service is due. "
            f"Your ride log, your costs and your service history live in one garage on your phone.")
    if loc == 'en-PH':
        hook += "\n\nBuilt for Filipino riders: change oil and PMS reminders, gas and parts expenses, and a ride log for every commute and long ride."
    feats = _features(v, 'play', loc)
    extra = [
        '',
        SEP, 'WHY RIDERS SWITCH TO MOTOVAULT', SEP, '',
        f"- One motorcycle app instead of three: ride tracker, expense tracker and maintenance log together",
        f"- Service reminders by {'km' if v['dist']!='mile' else 'mileage'} or by date, so you stop guessing when the oil is due",
        '- Receipt scanning reads the parts, the labour and the total so logging takes seconds'.replace('labour', v['labor']),
        f"- {'Kilometres' if v['dist']=='kilometre' else ('Kilometers' if v['dist']=='kilometer' else 'Miles')} or {'miles' if v['dist']!='mile' else 'kilometers'}, light or dark: the app follows your choice",
        '- Your data is yours: private, exportable, never sold',
    ]
    if loc == 'en-GB':
        extra.insert(6, '- Date reminders for the MOT, insurance or anything else that comes round once a year')
    if loc == 'en-AU':
        extra.insert(6, '- Date reminders for rego, insurance or anything else that comes round once a year')
    if loc == 'en-PH':
        extra.insert(6, '- Date reminders for your LTO registration renewal, insurance or anything that comes once a year')
    parts = [hook, '', SEP, 'WHAT YOU CAN DO', SEP, '', '\n\n'.join(feats)] + extra + ['',
             SEP, "WHO IT'S FOR", SEP, '', '\n'.join(_who(loc)), '',
             SEP, 'MOTOVAULT PRO', SEP, '',
             free_block, '',
             'Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your Google Play account settings.',
             '',
             'Privacy Policy: https://motovault.app/privacy',
             'Terms of Service: https://motovault.app/terms', '',
             SEP, '',
             'Questions? Feedback? We read every email: support@motovault.app', '',
             'Two wheels. One app. Ride better.']
    return '\n'.join(parts)


APPLE = {
    'en-US': dict(
        name='MotoVault: Motorcycle Tracker',
        subtitle='Rides, Expenses & Maintenance',
        keywords='gps,route,planner,lean,angle,log,service,reminder,garage,receipt,fuel,mileage,cost,oil,tire,trip,map',
        promotional_text='Record the ride, snap the receipt, get the service reminder. Rides, costs and maintenance for your motorcycle, all in one place.',
        whats_new='Smoother ride tracking, faster receipt scanning and a round of fixes. Thanks for every message: we read them all.',
        rationale='Name moves from "Motorcycle Garage" (#1 but near-zero volume) to "Motorcycle Tracker": Apple hints show "motorcycle tracker" and "motorcycle ride tracker" as real queries and MotoVault ranks #176 / not at all for them. Combined with the subtitle, Apple can match "motorcycle ride tracker", "motorcycle expense tracker", "motorcycle maintenance tracker". Keywords pick up hinted terms: motorcycle gps, route planner, lean angle, motorcycle log, ride planner. "garage" stays in keywords to keep the #1 for "motorcycle garage". No Spanish words here: es-MX is indexed in the US storefront and carries them.'),
    'en-CA': dict(
        name='MotoVault: Motorcycle Tracker',
        subtitle='Rides, Expenses & Maintenance',
        keywords='gps,route,planner,lean,angle,log,service,reminder,garage,receipt,gas,km,cost,oil,tire,biker,carplay',
        promotional_text='Record the ride, snap the receipt, get the service reminder. Rides, costs and maintenance for your motorcycle, all in one place.',
        whats_new='Smoother ride tracking, faster receipt scanning and a round of fixes. Thanks for every message: we read them all.',
        rationale='New localization. Canada indexes only en-CA and fr-CA, so en-CA can mirror the US strategy, swapped to km and gas. Hints show "motorcycle routes", "motorcycle map" and "motorcycle speedometer" in CA; route and gps cover them.'),
    'en-GB': dict(
        name='MotoVault: Motorbike Tracker',
        subtitle='Ride Log, Costs & Servicing',
        keywords='motorcycle,maintenance,mot,petrol,tyre,route,planner,gps,lean,angle,reminder,receipt,motor,pms,map',
        promotional_text='Log the ride, snap the receipt, get the MOT and service reminders. Rides, costs and maintenance for your motorbike in one app.',
        whats_new='Smoother ride tracking, faster receipt scanning and a round of fixes. Thanks for every message: we read them all.',
        rationale='en-GB is the primary language in the UK and the Philippines and a secondary index in Australia, Mexico, Colombia, Argentina, Spain, Brazil, France, Italy and Germany, so its English keywords reach almost every target storefront. The name uses "motorbike" (UK) and the keywords add "motorcycle" + "maintenance" so both spellings match "motorcycle maintenance" and "motorbike maintenance" (UK hint, MotoVault #8). "mot" targets UK reminder intent; "motor" and "pms" are Filipino rider vocabulary (PH storefront uses en-GB).'),
    'en-AU': dict(
        name='MotoVault: Motorcycle Logbook',
        subtitle='Rides, Expenses & Maintenance',
        keywords='rego,fuel,odometer,touring,adventure,trip,service,history,cost,budget,carplay,chain,oil,biker,dirt',
        promotional_text='Log the ride, snap the receipt, get the service and rego reminders. Rides, costs and maintenance for your bike in one app.',
        whats_new='Smoother ride tracking, faster receipt scanning and a round of fixes. Thanks for every message: we read them all.',
        rationale='New localization. Australia indexes en-AU plus en-GB, so en-AU avoids every word already in en-GB name, subtitle and keywords (motorbike, tracker, maintenance is the one deliberate overlap via subtitle because it is the core intent). "Logbook" is how Australians talk about service records; "rego" is local. AU hints include "goez: motorcycle ride tracker" and "scenic motorcycle navigation", so ride and touring intent is live.'),
}

PLAY = {
    'en-US': dict(title='MotoVault: Motorcycle Tracker',
                  short_description='Motorcycle ride tracker, expense log and service reminders in one app.',
                  rationale='Title adds "tracker" (highest-weight Play field). Short description stacks motorcycle + ride tracker + expense + service reminders; full description repeats motorcycle maintenance, ride tracker, expense tracker, receipt scanning and service history 2-4 times each without stuffing.'),
    'en-CA': dict(title='MotoVault: Motorcycle Tracker',
                  short_description='Motorcycle ride tracker, expense log and service reminders in one app.',
                  rationale='Same strategy as en-US with Canadian spelling and km in the body.'),
    'en-GB': dict(title='MotoVault: Motorbike Tracker',
                  short_description='Motorbike ride tracker, running costs and service reminders in one app.',
                  rationale='"Motorbike" in the title for UK search; body uses both motorbike and motorcycle, petrol, tyre, MOT reminders.'),
    'en-AU': dict(title='MotoVault: Motorcycle Logbook',
                  short_description='Motorcycle logbook: ride tracker, expenses and service reminders.',
                  rationale='"Logbook" is the Australian word for service records; body adds rego reminders, tyres, km.'),
    'en-PH': dict(title='MotoVault: Motor PMS Tracker',
                  short_description='Ride tracker, gas and parts expenses, and change oil and PMS reminders.',
                  rationale='Custom store listing for the Philippines (country-targeted, English). Filipino riders say "motor", "PMS" and "change oil"; the default en-US listing uses none of them.'),
}
