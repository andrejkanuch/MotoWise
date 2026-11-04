"""Composer-ready captions (pipeline/SCHEMA.md section 3).

Headlines are capped at 18 characters per line because the composer sets them in
Barlow Condensed upper case and shrinks anything longer. Sublines carry no {placeholders}:
the composer does not fill them, so these lines describe the screen in general terms.
"""

# Store order from markets/README.md + _global.json (2026-11-03): rides, maintenance,
# expenses (receipt scan right after), trips, garage, then the rest. AI diagnosis is
# kept out by the positioning rule even though it ranks 4th in usage.
ORDER_GLOBAL = ['ride_tracking', 'maintenance_reminders', 'expenses', 'receipt_scan', 'trip_planning',
                'garage', 'ride_stats', 'service_history', 'costs_overview', 'season_summary']
# Mexico: expenses moves to slot 2 (MX top features: rides, diag, expenses). Play Mexico
# listing only: the App Store es-MX localization also serves CO and AR, so it keeps the
# global order (team-lead decision 2026-11-03; CO has the strongest ride share, MX n=60).
ORDER_MX = ['ride_tracking', 'expenses', 'receipt_scan', 'maintenance_reminders', 'trip_planning',
            'garage', 'ride_stats', 'service_history', 'costs_overview', 'season_summary']
ORDER_BY_FILE = {'es-MX-play': ORDER_MX}
APPLE_MAX, PLAY_MAX = 10, 8

EN = {
    'ride_tracking': ['Track every ride.', 'Keep every road.'],
    'ride_stats': ['Every ride,', 'by the numbers.'],
    'expenses': ['Know what', 'your bike costs.'],
    'receipt_scan': ['Snap the receipt.', 'Skip the typing.'],
    'maintenance_reminders': ['Never miss', 'a service.'],
    'service_history': ['Every service,', 'on the record.'],
    'garage': ['Your bike,', 'in one place.'],
    'trip_planning': ['Plan the trip.', 'Ride the plan.'],
    'season_summary': ['Your season,', 'in one recap.'],
    'costs_overview': ['Every mile', 'has a price.'],
}
ES_LATAM = {
    'ride_tracking': ['Graba tu rodada.', 'Guarda el camino.'],
    'ride_stats': ['Cada rodada,', 'en números.'],
    'expenses': ['Lo que tu moto', 'cuesta de verdad.'],
    'receipt_scan': ['Un recibo,', 'una foto.'],
    'maintenance_reminders': ['Que no se te pase', 'el servicio.'],
    'service_history': ['Cada servicio,', 'registrado.'],
    'garage': ['Tu moto,', 'en un solo lugar.'],
    'trip_planning': ['Planea el viaje.', 'Luego, a rodar.'],
    'season_summary': ['Tu temporada,', 'en un resumen.'],
    'costs_overview': ['Cada kilómetro', 'tiene su precio.'],
}

HEAD = {
    'en-US': EN, 'en-CA': {**EN, 'costs_overview': ['Every kilometre', 'has a price.']},
    'en-GB': EN, 'en-AU': {**EN, 'costs_overview': ['Every kilometre', 'has a price.']},
    'en-PH': {**EN, 'expenses': ['Know what', 'your motor costs.'], 'maintenance_reminders': ['Never miss', 'your PMS.'],
              'garage': ['Your motor,', 'in one place.'], 'costs_overview': ['Every kilometer', 'has a price.']},
    'es-MX': ES_LATAM,
    'es-US': {**ES_LATAM, 'costs_overview': ['Cada milla', 'tiene su precio.']},
    'es-419': {**ES_LATAM, 'maintenance_reminders': ['Que no se te pase', 'el mantenimiento.']},
    'es-CO': {**ES_LATAM, 'maintenance_reminders': ['Que no se te pase', 'el mantenimiento.']},
    'es-AR': {**ES_LATAM, 'ride_tracking': ['Grabá tu salida.', 'Guardá la ruta.'], 'ride_stats': ['Cada salida,', 'en números.'],
              'receipt_scan': ['Un ticket,', 'una foto.'], 'maintenance_reminders': ['Que no se te pase', 'el service.'],
              'service_history': ['Cada service,', 'anotado.'], 'trip_planning': ['Armá el viaje.', 'Después, a rodar.']},
    'es-ES': {**ES_LATAM, 'ride_tracking': ['Graba cada ruta.', 'Guarda cada curva.'], 'ride_stats': ['Cada ruta,', 'en números.'],
              'receipt_scan': ['Un ticket,', 'una foto.'], 'maintenance_reminders': ['Que no se te pase', 'ninguna revisión.'],
              'service_history': ['Cada revisión,', 'registrada.'], 'garage': ['Tu moto,', 'en un solo sitio.'],
              'trip_planning': ['Prepara el viaje.', 'Luego, a rodar.']},
    'pt-BR': {
        'ride_tracking': ['Grave cada rolê.', 'Guarde a estrada.'], 'ride_stats': ['Cada rolê,', 'em números.'],
        'expenses': ['Quanto sua moto', 'custa de verdade.'], 'receipt_scan': ['Uma nota,', 'uma foto.'],
        'maintenance_reminders': ['Nunca perca', 'uma revisão.'], 'service_history': ['Cada revisão,', 'registrada.'],
        'garage': ['Sua moto,', 'num só lugar.'], 'trip_planning': ['Planeje a viagem.', 'Aí é só rodar.'],
        'season_summary': ['Sua temporada,', 'num resumo.'], 'costs_overview': ['Cada quilômetro', 'tem seu preço.']},
    'fr-FR': {
        'ride_tracking': ['Chaque balade', 'enregistrée.'], 'ride_stats': ['Chaque sortie,', 'en chiffres.'],
        'expenses': ['Ce que votre moto', 'coûte vraiment.'], 'receipt_scan': ['Un reçu,', 'une photo.'],
        'maintenance_reminders': ['Ne ratez plus', 'une révision.'], 'service_history': ['Votre carnet', 'd’entretien.'],
        'garage': ['Votre moto,', 'en un seul écran.'], 'trip_planning': ['Tracez la route.', 'Puis roulez.'],
        'season_summary': ['Votre saison,', 'en un résumé.'], 'costs_overview': ['Chaque kilomètre', 'a son prix.']},
    'it': {
        'ride_tracking': ['Registra il giro.', 'Ricorda la strada.'], 'ride_stats': ['Ogni uscita,', 'in numeri.'],
        'expenses': ['Quanto ti costa', 'davvero la moto.'], 'receipt_scan': ['Uno scontrino,', 'una foto.'],
        'maintenance_reminders': ['Mai più un', 'tagliando saltato.'], 'service_history': ['Ogni tagliando,', 'agli atti.'],
        'garage': ['La tua moto,', 'in un solo posto.'], 'trip_planning': ['Pianifica il giro.', 'Poi si parte.'],
        'season_summary': ['La tua stagione,', 'in un riepilogo.'], 'costs_overview': ['Ogni chilometro', 'ha il suo prezzo.']},
    'de-DE': {
        'ride_tracking': ['Jede Tour', 'im Kasten.'], 'ride_stats': ['Jede Fahrt,', 'in Zahlen.'],
        'expenses': ['Was dein Motorrad', 'wirklich kostet.'], 'receipt_scan': ['Beleg knipsen.', 'Fertig.'],
        'maintenance_reminders': ['Keine Inspektion', 'mehr verpassen.'], 'service_history': ['Dein digitales', 'Scheckheft.'],
        'garage': ['Dein Motorrad,', 'alles im Blick.'], 'trip_planning': ['Tour planen.', 'Tour fahren.'],
        'season_summary': ['Deine Saison', 'auf einen Blick.'], 'costs_overview': ['Jeder Kilometer', 'hat seinen Preis.']},
    'fil': {
        'ride_tracking': ['I-track ang ride.', 'Tandaan ang daan.'], 'ride_stats': ['Bawat ride,', 'sa numero.'],
        'expenses': ['Alamin ang gastos', 'ng motor mo.'], 'receipt_scan': ['Kunan ang resibo.', 'Tapos na.'],
        'maintenance_reminders': ['Wala nang', 'nakalimutang PMS.'], 'service_history': ['Bawat service,', 'nakatala.'],
        'garage': ['Ang motor mo,', 'nasa isang lugar.'], 'trip_planning': ['Planuhin ang ride.', 'Sakyan ang plano.'],
        'season_summary': ['Ang season mo,', 'sa isang recap.'], 'costs_overview': ['Bawat kilometro', 'may presyo.']},
}

# Placeholder-free sublines for the three slots that used {route_name}/{distance}/{currency_amount}.
_SUB_EN = {'ride_stats': 'Distance, moving time, climb and max lean for every ride.',
           'season_summary': 'Total distance, rides, your longest, and where you went.'}
_SUB_ES = {'ride_stats': 'Distancia, tiempo en marcha, desnivel e inclinación máxima.',
           'season_summary': 'Distancia total, tu rodada más larga y por dónde pasaste.',
           'costs_overview': 'Costo por km, tendencia mensual y lo gastado este año.'}
SUB = {
    'en-US': {**_SUB_EN, 'costs_overview': 'Cost per mile, monthly trends and what you spent this year.'},
    'en-GB': {**_SUB_EN, 'costs_overview': 'Cost per mile, monthly trends and what you spent this year.'},
    'en-CA': {**_SUB_EN, 'costs_overview': 'Cost per km, monthly trends and what you spent this year.'},
    'en-AU': {**_SUB_EN, 'costs_overview': 'Cost per km, monthly trends and what you spent this year.'},
    'en-PH': {**_SUB_EN, 'costs_overview': 'Cost per km, monthly trends and what you spent this year.'},
    'es-MX': _SUB_ES, 'es-419': _SUB_ES, 'es-CO': _SUB_ES,
    'es-US': {**_SUB_ES, 'costs_overview': 'Costo por milla, tendencia mensual y lo gastado este año.'},
    'es-AR': {**_SUB_ES, 'season_summary': 'Distancia total, tu salida más larga y por dónde pasaste.'},
    'es-ES': {**_SUB_ES, 'season_summary': 'Distancia total, tu ruta más larga y por dónde pasaste.',
              'costs_overview': 'Coste por km, tendencia mensual y lo gastado este año.'},
    'pt-BR': {'ride_stats': 'Distância, tempo rodando, subida e inclinação máxima.',
              'season_summary': 'Distância total, o rolê mais longo e por onde você passou.',
              'costs_overview': 'Custo por km, tendência mensal e o gasto do ano.'},
    'fr-FR': {'ride_stats': 'Distance, temps de roulage, dénivelé et angle maxi.',
              'season_summary': 'Distance totale, la plus longue sortie, les pays traversés.',
              'costs_overview': 'Coût au km, tendance mensuelle et dépenses de l’année.'},
    'it': {'ride_stats': 'Distanza, tempo in marcia, dislivello e piega massima.',
           'season_summary': 'Distanza totale, il giro più lungo e dove sei stato.',
           'costs_overview': 'Costo al km, andamento mensile e spese dell’anno.'},
    'de-DE': {'ride_stats': 'Distanz, Fahrzeit, Höhenmeter und maximale Schräglage.',
              'season_summary': 'Gesamtstrecke, deine längste Tour und wo du überall warst.',
              'costs_overview': 'Kosten pro km, Monatsverlauf und Ausgaben des Jahres.'},
    'fil': {'ride_stats': 'Layo, oras sa biyahe, akyat at max lean ng bawat ride.',
            'season_summary': 'Kabuuang layo, pinakamahabang ride at mga napuntahan.',
            'costs_overview': 'Gastos kada km, buwanang trend at gastos ngayong taon.'},
}

_A_EN = dict(header=['Your motorcycle,', 'fully tracked.'],
             search=(['Track every ride.', 'Keep every road.'], 'Rides · Expenses · Maintenance'),
             feature_graphic=['Rides. Costs.', 'Service. Tracked.'])
_A_ES = dict(header=['Tu moto,', 'bajo control.'], search=(['Rodadas, gastos', 'y servicio.'], 'Rodadas · Gastos · Mantenimiento'),
             feature_graphic=['Tu moto,', 'bajo control.'])
ASSETS = {
    'en-US': _A_EN, 'en-CA': _A_EN, 'en-GB': {**_A_EN, 'search': (['Track every ride.', 'Keep every road.'], 'Rides · Costs · Servicing')},
    'en-AU': _A_EN, 'en-PH': {**_A_EN, 'search': (['Track every ride.', 'Keep every road.'], 'Rides · Gas & parts · PMS')},
    'es-MX': _A_ES, 'es-US': _A_ES, 'es-419': _A_ES,
    'es-CO': {**_A_ES, 'feature_graphic': ['Tu moto,', 'al día.']},
    'es-AR': {**_A_ES, 'search': (['Salidas, gastos', 'y service.'], 'Salidas · Gastos · Service'), 'feature_graphic': ['Tu moto,', 'al día.']},
    'es-ES': {**_A_ES, 'search': (['Rutas, gastos', 'y revisiones.'], 'Rutas · Gastos · Mantenimiento')},
    'pt-BR': dict(header=['Sua moto,', 'sob controle.'], search=(['Rolês, gastos', 'e revisões.'], 'Rolês · Gastos · Manutenção'),
                  feature_graphic=['Sua moto,', 'sob controle.']),
    'fr-FR': dict(header=['Votre moto,', 'sous contrôle.'], search=(['Balades, frais', 'et entretien.'], 'Balades · Frais · Entretien'),
                  feature_graphic=['Votre moto,', 'sous contrôle.']),
    'it': dict(header=['La tua moto,', 'sotto controllo.'], search=(['Giri, spese', 'e tagliandi.'], 'Giri · Spese · Manutenzione'),
               feature_graphic=['La tua moto,', 'sotto controllo.']),
    'de-DE': dict(header=['Dein Motorrad', 'im Griff.'], search=(['Touren, Kosten', 'und Wartung.'], 'Touren · Kosten · Wartung'),
                  feature_graphic=['Dein Motorrad', 'im Griff.']),
    'fil': dict(header=['Motor mo,', 'kontrolado.'], search=(['I-track ang ride.', 'Tandaan ang daan.'], 'Ride · Gastos · PMS'),
                feature_graphic=['Motor mo,', 'kontrolado.']),
}


def apply(variant, caps):
    """Return caps (slot -> (headline, sub)) with the short headlines and fixed sublines."""
    out = {}
    for slot, (_, sub) in caps.items():
        out[slot] = (HEAD[variant][slot], SUB.get(variant, {}).get(slot, sub))
    return out
