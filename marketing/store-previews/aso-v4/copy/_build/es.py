"""Spanish variants. Written per market, not translated:
es-MX  Mexico (Apple; also serves Colombia and Argentina on the App Store)
es-419 Latin America, neutral (Play default)
es-US  US Hispanic riders (Play default; miles first)
es-ES  Spain
es-MX-play, es-CO, es-AR  Play custom store listings by country (AR in voseo)
"""

SEP = '--------------------------'

# Vocabulary per market.
V = {
    'es-MX': dict(fuel='gasolina', fill='cada carga de gasolina', parts='refacciones', parts_sg='refacción', tire='llantas', shop='taller',
                  ride='rodada', rides='rodadas', rider='motociclista', dist='kilómetro', dists='kilómetros', unit='km',
                  service='servicio', yearly='la verificación, la tenencia o el seguro', vos=False),
    'es-419': dict(fuel='combustible', fill='cada tanqueo', parts='repuestos', parts_sg='repuesto', tire='llantas', shop='taller',
                   ride='rodada', rides='rodadas', rider='motociclista', dist='kilómetro', dists='kilómetros', unit='km',
                   service='mantenimiento', yearly='el seguro, la revisión técnica o el registro', vos=False),
    'es-US': dict(fuel='gasolina', fill='cada carga de gasolina', parts='refacciones', parts_sg='refacción', tire='llantas', shop='taller',
                  ride='rodada', rides='rodadas', rider='motociclista', dist='milla', dists='millas', unit='milla',
                  service='servicio', yearly='el registro, la inspección o el seguro', vos=False),
    'es-ES': dict(fuel='gasolina', fill='cada repostaje', parts='recambios', parts_sg='recambio', tire='neumáticos', shop='taller',
                  ride='ruta', rides='rutas', rider='motero', dist='kilómetro', dists='kilómetros', unit='km',
                  service='revisión', yearly='la ITV, el seguro o el impuesto de circulación', vos=False),
    'es-CO': dict(fuel='gasolina', fill='cada tanqueada', parts='repuestos', parts_sg='repuesto', tire='llantas', shop='taller',
                  ride='rodada', rides='rodadas', rider='motero', dist='kilómetro', dists='kilómetros', unit='km',
                  service='mantenimiento', yearly='el SOAT y la tecnomecánica', yearly_ni='el SOAT ni la tecnomecánica', vos=False),
    'es-AR': dict(fuel='nafta', fill='cada carga de nafta', parts='repuestos', parts_sg='repuesto', tire='cubiertas', shop='taller',
                  ride='salida', rides='salidas', rider='motoquero', dist='kilómetro', dists='kilómetros', unit='km',
                  service='service', yearly='la VTV, el seguro o la patente', yearly_ni='la VTV ni el seguro', vos=True),
}
V['es-MX-play'] = V['es-MX']


def _t(loc, tu, vos):
    """Pick the tú or the voseo form."""
    return vos if V[loc]['vos'] else tu


def captions(loc):
    v = V[loc]
    t = lambda a, b: _t(loc, a, b)
    caps = {
        'ride_tracking': ([t('Registra cada', 'Registrá cada'), f"{v['ride']}."] if loc != 'es-ES' else ['Graba cada ruta.', 'Guarda cada curva.'],
                          'Trazo GPS, distancia, desnivel e inclinación máxima, en automático.' if loc != 'es-ES'
                          else 'Trazado GPS, distancia, desnivel e inclinación máxima, solo.'),
        'ride_stats': (['Cada ' + v['ride'] + ',', 'en números.'],
                       '{route_name}: distancia, tiempo en marcha, desnivel e inclinación.'),
        'expenses': ([t('Conoce lo que', 'Conocé lo que'), 'cuesta tu moto.'],
                     f"{v['fuel'].capitalize()}, {v['parts']}, equipo y {v['shop']} en un lugar. Gratis." if loc != 'es-ES'
                     else f"Gasolina, recambios, equipación y taller en un solo sitio. Gratis."),
        'receipt_scan': ([t('Fotografía el ticket.', 'Sacale foto al ticket.') if loc in ('es-ES', 'es-AR') else 'Fotografía el recibo.', 'Olvídate de teclear.' if loc == 'es-ES' else t('Olvídate de escribir.', 'Olvidate de escribir.')],
                         t('MotoVault lee repuestos, mano de obra y total, y llena el gasto.', 'MotoVault lee repuestos, mano de obra y total, y carga el gasto.')
                         .replace('repuestos', v['parts']).replace('llena', 'rellena' if loc == 'es-ES' else 'llena')),
        'maintenance_reminders': (['Nunca te pierdas' if not v['vos'] else 'Que no se te pase', 'un ' + v['service'] + '.' if v['service'] != 'revisión' else 'una revisión.'],
                                  f"Recordatorios por {v['unit'] if v['unit']=='km' else 'millas'} o por fecha, según los intervalos de tu moto."),
        'service_history': (['Cada ' + ('servicio' if loc not in ('es-ES',) else 'revisión') + ',', 'bien registrad' + ('a.' if loc == 'es-ES' else 'o.')],
                            'Un historial completo que te respalda cuando vendas la moto.' if not v['vos'] else 'Un historial completo que te respalda cuando vendas la moto.'),
        'garage': (['Tu moto,', 'todo en un lugar.' if loc != 'es-ES' else 'todo en un sitio.'],
                   'Ficha, odómetro, próximo ' + ('servicio' if v['service'] != 'revisión' else 'mantenimiento') + ' y costos de un vistazo.' if loc != 'es-ES'
                   else 'Ficha, cuentakilómetros, próxima revisión y costes de un vistazo.'),
        'trip_planning': ([t('Planea el viaje.', 'Armá el viaje.') if loc != 'es-ES' else 'Planifica el viaje.', t('Rueda el plan.', 'Rodá el plan.') if loc != 'es-ES' else 'Rueda el plan.'],
                          t('Traza la ruta, agrega paradas y compártela con tu grupo.', 'Trazá la ruta, sumá paradas y compartila con tu grupo.') if loc != 'es-ES'
                          else 'Traza la ruta, añade paradas y compártela con tu grupo.'),
        'season_summary': (['Tu temporada,', 'en un resumen.'],
                           '{distance} en {ride_count} ' + v['rides'] + ', tu más larga y por dónde pasaste.'),
        'costs_overview': (['Cada ' + ('kilómetro' if v['unit'] == 'km' else 'milla'), 'tiene su precio.'],
                           f"Costo por {v['unit']}, tendencia mensual y {{currency_amount}} este año." if loc != 'es-ES'
                           else 'Coste por km, tendencia mensual y {currency_amount} este año.'),
    }
    latam = loc != 'es-ES'
    caps['expenses'] = (['Lo que tu moto', 'cuesta de verdad.'], caps['expenses'][1])
    if latam:
        caps['ride_tracking'] = ([t('Graba cada', 'Grabá cada') + ' ' + v['ride'] + '.', t('Guarda cada camino.', 'Guardá cada ruta.')], caps['ride_tracking'][1])
        caps['trip_planning'] = ([t('Planea el viaje.', 'Armá el viaje.'), t('Luego, a rodar.', 'Después, a rodar.')], caps['trip_planning'][1])
        caps['maintenance_reminders'] = (['Que no se te pase', 'el ' + v['service'] + '.'], caps['maintenance_reminders'][1])
    else:
        caps['ride_tracking'] = (caps['ride_tracking'][0], 'Trazado GPS, distancia, desnivel e inclinación máxima, sin tocar nada.')
        caps['trip_planning'] = (['Planifica el viaje.', 'Luego, a rodar.'], caps['trip_planning'][1])
    if v['vos']:
        caps['service_history'] = (['Cada service,', 'bien anotado.'], caps['service_history'][1])
        caps['garage'] = (caps['garage'][0], 'Ficha, odómetro, próximo service y costos de un vistazo.')
    if loc == 'es-CO':
        caps['maintenance_reminders'] = (['Que no se te pase', 'el mantenimiento.'],
                                         'Recordatorios por km o por fecha: aceite, cadena, SOAT, tecno.')
    if loc == 'es-AR':
        caps['maintenance_reminders'] = (['Que no se te pase', 'el service.'],
                                         'Recordatorios por km o por fecha: aceite, cadena, VTV y más.')
    if loc == 'es-ES':
        caps['maintenance_reminders'] = (['Que no se te pase', 'ninguna revisión.'],
                                         'Avisos por km o por fecha: aceite, cadena, ITV y lo que haga falta.')
    return caps


ASSETS = {
    'es-MX': dict(header='Tu moto, bajo control', search='Rodadas, gastos y servicio en una app', feature_graphic='Rodadas, gastos y servicio. Controlados.'),
    'es-419': dict(header='Tu moto, bajo control', search='Rodadas, gastos y mantenimiento', feature_graphic='Tu moto, bajo control'),
    'es-US': dict(header='Tu moto, bajo control', search='Rodadas, gastos y servicio', feature_graphic='Tu moto, bajo control'),
    'es-ES': dict(header='Tu moto, bajo control', search='Rutas, gastos y revisiones en una app', feature_graphic='Rutas, gastos y revisiones. Controlados.'),
    'es-MX-play': dict(feature_graphic='Tu moto, bajo control'),
    'es-CO': dict(feature_graphic='Tu moto, al día'),
    'es-AR': dict(feature_graphic='Tu moto, al día'),
}


def _hook(loc, platform):
    v = V[loc]
    t = lambda a, b: _t(loc, a, b)
    if loc == 'es-ES':
        return ("Graba cada ruta, apunta cada gasto y no se te pase ninguna revisión, en una app hecha para moteros, no para coches.\n\n"
                "MotoVault registra tus rutas con GPS, te enseña lo que te cuesta de verdad la moto y te avisa antes de la próxima revisión. "
                "Rutas, gastos e historial de mantenimiento, todo en un garaje que llevas en el bolsillo.")
    return (t(f"Registra cada {v['ride']}, cada gasto y cada {v['service']} de tu moto, en una app hecha para motos, no para autos.",
              f"Registrá cada {v['ride']}, cada gasto y cada {v['service']} de tu moto, en una app hecha para motos, no para autos.") + "\n\n" +
            t(f"MotoVault graba tus {v['rides']} con GPS, te muestra lo que de verdad te cuesta la moto y te avisa antes del próximo {v['service']}. "
              f"Tus {v['rides']}, tus gastos y tu historial de mantenimiento, en un garaje que llevas en el bolsillo.",
              f"MotoVault graba tus {v['rides']} con GPS, te muestra lo que de verdad te cuesta la moto y te avisa antes del próximo {v['service']}. "
              f"Tus {v['rides']}, tus gastos y tu historial de mantenimiento, en un garaje que llevás en el bolsillo."))


def _features(loc, platform):
    v = V[loc]
    t = lambda a, b: _t(loc, a, b)
    es = loc == 'es-ES'
    f = [
        (f"* GRABA CADA RUTA - Dale a grabar y a rodar. MotoVault registra el trazado GPS, la distancia, el tiempo en marcha, el desnivel y la inclinación máxima, y crea un diario de cada kilómetro. Exporta cualquier ruta en GPX." if es else
         t(f"* REGISTRA CADA {v['ride'].upper()} - Toca grabar y arranca. MotoVault guarda el trazo GPS, la distancia, el tiempo en movimiento, el desnivel y la inclinación máxima, y arma una bitácora de cada {v['dist']} que recorres. Exporta cualquier {v['ride']} en GPX.",
           f"* REGISTRÁ CADA {v['ride'].upper()} - Tocá grabar y arrancá. MotoVault guarda el trazo GPS, la distancia, el tiempo en movimiento, el desnivel y la inclinación máxima, y arma una bitácora de cada kilómetro que hacés. Exportá cualquier salida en GPX.")),
        (f"* APUNTA CADA GASTO - Cada repostaje, cada recambio, cada visita al taller. Mira lo que te cuesta la moto por kilómetro, por mes y por año. Registrar es gratis e ilimitado, siempre." if es else
         t(f"* REGISTRA CADA GASTO - {v['fill'].capitalize()}, cada {v['parts_sg']}, cada visita al {v['shop']}. Mira lo que tu moto te cuesta por {v['unit']}, por mes y por año. Registrar es gratis e ilimitado, siempre.",
           f"* ANOTÁ CADA GASTO - {v['fill'].capitalize()}, cada repuesto, cada visita al taller. Mirá lo que te cuesta la moto por km, por mes y por año. Registrar es gratis e ilimitado, siempre.")),
        ("* ESCANEA EL TICKET EN VEZ DE TECLEARLO - Apunta la cámara a un ticket de gasolina, recambios o taller. MotoVault lee los recambios, la mano de obra, el total y la fecha, y rellena el gasto por ti." if es else
         t(f"* ESCANEA EL RECIBO EN LUGAR DE ESCRIBIRLO - Apunta la cámara a un recibo de {v['fuel']}, {v['parts']} o {v['shop']}. MotoVault lee las {v['parts']}, la mano de obra, el total y la fecha, y llena el gasto por ti.".replace('las repuestos', 'los repuestos'),
           "* ESCANEÁ EL TICKET EN VEZ DE TIPEARLO - Apuntá la cámara a un ticket de nafta, repuestos o taller. MotoVault lee los repuestos, la mano de obra, el total y la fecha, y carga el gasto por vos.")),
        ("* QUE NO SE TE PASE NINGUNA REVISIÓN - Cambio de aceite, tensado de cadena, neumáticos, reglaje de válvulas. Pon avisos por kilómetros o por fecha y te avisamos antes del próximo intervalo." if es else
         t(f"* NUNCA TE PIERDAS UN {v['service'].upper()} - Cambio de aceite, ajuste de cadena, cambio de {v['tire']}, calibración de válvulas. Crea recordatorios por {'kilómetros' if v['unit']=='km' else 'millas'} o por fecha y recibe un aviso antes del siguiente intervalo.",
           "* QUE NO SE TE PASE EL SERVICE - Cambio de aceite, tensado de cadena, cubiertas, calibración de válvulas. Poné recordatorios por kilómetros o por fecha y te avisamos antes del próximo intervalo.")),
        ("* EL HISTORIAL COMPLETO - Cada trabajo con fecha, kilómetros y coste. Un registro completo que te respalda cuando vendas la moto." if es else
         "* EL HISTORIAL COMPLETO - Cada trabajo con fecha, odómetro y costo. Un registro completo que te respalda cuando vendas la moto."),
        ("* TU GARAJE - Ficha técnica, cuentakilómetros, próxima revisión y costes de tu moto en una sola pantalla. Más de 12.000 modelos en el catálogo." if es else
         "* TU GARAJE - Ficha técnica, odómetro, próximo mantenimiento y costos de tu moto en una sola pantalla. Más de " + ('12,000' if loc in ('es-MX', 'es-MX-play', 'es-US') else '12.000') + " modelos en el catálogo." if not v['vos'] else
         "* TU GARAJE - Ficha técnica, odómetro, próximo service y costos de tu moto en una sola pantalla. Más de 12.000 modelos en el catálogo."),
        ("* PLANIFICA CADA VIAJE - La ruta del domingo o el viaje de tu vida. Guarda rutas, añade paradas y compártelas con tu grupo." if es else
         t("* PLANEA CADA VIAJE - La rodada del domingo o el viaje de tu vida. Guarda rutas, agrega paradas y compártelas con tu grupo.",
           "* ARMÁ CADA VIAJE - La salida del domingo o el viaje de tu vida. Guardá rutas, sumá paradas y compartilas con tu grupo.")),
        (f"* TU TEMPORADA EN UN RESUMEN - Kilómetros totales, rutas, tu ruta más larga y los países que recorriste, listo para compartir." if es else
         f"* TU TEMPORADA EN UN RESUMEN - {v['dists'].capitalize()} totales, {v['rides']}, tu {v['ride']} más larga y los países que recorriste, listo para compartir."),
    ]
    if platform == 'apple':
        f.insert(6, "* MOTOVAULT EN CARPLAY - Inicia, pausa y termina una ruta desde la pantalla del coche, con distancia y tiempo en marcha legibles de un vistazo." if es else
                 "* MOTOVAULT EN CARPLAY - Inicia, pausa y termina una rodada desde la pantalla del vehículo, con distancia y tiempo en movimiento legibles de un vistazo.")
    return f


def _who(loc):
    v = V[loc]
    if loc == 'es-ES':
        return ['- Quien va en moto a diario y la quiere siempre a punto', '- El motero de fin de semana que busca la próxima carretera de curvas',
                '- Quien hace viajes largos y quiere registrarlo todo', '- Quien le mete mano a su propia moto', '- Cualquiera harto de apps pensadas para coches']
    if v['vos']:
        return ['- Quien usa la moto todos los días y la quiere siempre a punto', '- El motoquero de fin de semana que sale a buscar ruta',
                '- Quien viaja largo y quiere registrar todo', '- Quien le mete mano a su propia moto', '- Cualquiera cansado de apps pensadas para autos']
    return ['- Quien usa la moto a diario y la quiere siempre a punto', f"- El {v['rider']} de fin de semana que busca la próxima buena carretera",
            '- Quien viaja largo y quiere registrarlo todo', '- Quien le mete mano a su propia moto', '- Cualquiera cansado de apps hechas para autos']


def apple_description(loc):
    es = loc == 'es-ES'
    parts = [_hook(loc, 'apple'), '', SEP, 'LO QUE PUEDES HACER', SEP, '', '\n\n'.join(_features(loc, 'apple')), '',
             SEP, 'HECHA PARA MOTEROS' if es else 'HECHA PARA QUIEN DE VERDAD RUEDA', SEP, '',
             '- Kilómetros o millas: todo tu garaje sigue tu elección',
             '- Tema claro y oscuro, pensado para leerse en el taller',
             '- Tus datos son tuyos: privados, exportables, nunca vendidos',
             '- Hecha para quien rueda en España y Europa' if es else '- Hecha para quien rueda en México y toda Latinoamérica', '',
             SEP, 'PARA QUIÉN ES', SEP, '', '\n'.join(_who(loc)), '',
             SEP, 'GRATIS Y PRO', SEP, '',
             ('MotoVault es gratis y registrar nunca tiene límite: una moto, gastos ilimitados, historial de mantenimiento y avisos ilimitados, y grabación de rutas y viajes ilimitada. Cada mes también tienes 3 escaneos de tickets y 1 exportación GPX.' if es else
              'MotoVault es gratis y registrar nunca tiene límite: una moto, gastos ilimitados, historial de servicio y recordatorios ilimitados, y grabación de rodadas y viajes ilimitada. Cada mes también tienes 3 escaneos de recibos y 1 exportación GPX.'),
             '',
             ('MotoVault Pro añade motos ilimitadas, escaneos ilimitados, exportaciones GPX ilimitadas, mapas de viaje sin conexión y más ayuda con IA. Mensual, anual o un único pago de por vida: los precios aparecen en la app en tu moneda.' if es else
              'MotoVault Pro agrega motos ilimitadas, escaneos ilimitados, exportaciones GPX ilimitadas, mapas de viaje sin conexión y más ayuda con IA. Mensual, anual o un solo pago de por vida: los precios se muestran en la app en tu moneda.'),
             '',
             ('Las suscripciones se renuevan automáticamente salvo que se cancelen al menos 24 horas antes de que termine el periodo en curso. Gestiónalas o cancélalas cuando quieras en los ajustes de tu cuenta del App Store.' if es else
              'Las suscripciones se renuevan automáticamente salvo que se cancelen al menos 24 horas antes de que termine el periodo en curso. Adminístralas o cancélalas cuando quieras en los ajustes de tu cuenta de App Store.'),
             '',
             'Privacidad: https://motovault.app/privacy',
             'Términos: https://motovault.app/terms', '',
             '¿Dudas o ideas? Leemos cada correo: support@motovault.app', '',
             'Dos ruedas. Una app. Rueda mejor.' if es else 'Dos ruedas. Una app. Rueda mejor.']
    return '\n'.join(parts)


def play_description(loc, free_block):
    v = V[loc]
    t = lambda a, b: _t(loc, a, b)
    es = loc == 'es-ES'
    if es:
        hook = ("MotoVault es la app de mantenimiento de moto para moteros: graba tus rutas con GPS, controla los gastos escaneando tickets y recibe avisos de revisión, en una app hecha para motos, no para coches.\n\n"
                "Apunta cada repostaje y cada factura del taller, guarda el historial de mantenimiento y no se te pase ni el cambio de aceite ni la ITV.")
    else:
        hook = t(f"MotoVault es la app de mantenimiento de moto para {v['rider']}s: registra tus {v['rides']} con GPS, controla tus gastos escaneando recibos y recibe recordatorios de {v['service']}, en una app hecha para motos, no para autos.\n\n"
                 f"Anota {v['fill']} y cada cuenta del {v['shop']}, guarda el historial de mantenimiento y que no se te pase el cambio de aceite ni {v.get('yearly_ni', v['yearly'])}.",
                 f"MotoVault es la app de mantenimiento de moto para motoqueros: registrá tus salidas con GPS, controlá tus gastos escaneando tickets y recibí recordatorios de service, en una app hecha para motos, no para autos.\n\n"
                 f"Anotá cada carga de nafta y cada cuenta del taller, guardá el historial de mantenimiento y que no se te pase el cambio de aceite ni {v.get('yearly_ni', v['yearly'])}.")
        if loc == 'es-CO':
            hook = hook.replace('motero' + 's', 'moteros y motociclistas')
    why = ([
        '- Una sola app en lugar de tres: registro de rutas, control de gastos y libro de mantenimiento',
        '- Avisos por kilómetros o por fecha, para dejar de adivinar cuándo toca el aceite',
        f"- Avisos por fecha para {v['yearly']}",
        '- El escáner de tickets lee recambios, mano de obra y total: apuntar un gasto lleva segundos',
        '- Kilómetros o millas, tema claro u oscuro: la app sigue tu elección',
        '- Tus datos son tuyos: privados, exportables, nunca vendidos'] if es else [
        t('- Una sola app en lugar de tres: registro de rodadas, control de gastos y bitácora de mantenimiento',
          '- Una sola app en lugar de tres: registro de salidas, control de gastos y libreta de service'),
        t(f"- Recordatorios por {'kilómetros' if v['unit']=='km' else 'millas'} o por fecha, para dejar de adivinar cuándo toca el aceite",
          '- Recordatorios por kilómetros o por fecha, para dejar de adivinar cuándo toca el aceite'),
        t(f"- Recordatorios por fecha para {v['yearly']}", f"- Recordatorios por fecha para {v['yearly']}"),
        t(f"- El escáner de recibos lee {v['parts']}, mano de obra y total: registrar un gasto toma segundos",
          '- El escáner de tickets lee repuestos, mano de obra y total: cargar un gasto lleva segundos'),
        ('- Millas o kilómetros' if v['unit'] != 'km' else '- Kilómetros o millas') + ', tema claro u oscuro: la app sigue tu elección',
        '- Tus datos son tuyos: privados, exportables, nunca vendidos'])
    disclosure = ('Las suscripciones se renuevan automáticamente salvo que se cancelen al menos 24 horas antes de que termine el periodo en curso. Gestiónalas o cancélalas cuando quieras en los ajustes de tu cuenta de Google Play.' if es else
                  t('Las suscripciones se renuevan automáticamente salvo que se cancelen al menos 24 horas antes de que termine el periodo en curso. Adminístralas o cancélalas cuando quieras en la configuración de tu cuenta de Google Play.',
                    'Las suscripciones se renuevan automáticamente salvo que las canceles al menos 24 horas antes de que termine el período en curso. Gestionalas o cancelalas cuando quieras en la configuración de tu cuenta de Google Play.'))
    price = ('El precio aparece en la app antes de confirmar.' if es else t('El precio se muestra en la app antes de confirmar.', 'El precio se muestra en la app antes de confirmar.'))
    parts = [hook, '', SEP, 'LO QUE PUEDES HACER' if not v['vos'] else 'LO QUE PODÉS HACER', SEP, '', '\n\n'.join(_features(loc, 'play')), '',
             SEP, 'POR QUÉ LOS MOTEROS SE PASAN A MOTOVAULT' if es else t('POR QUÉ ELEGIR MOTOVAULT', 'POR QUÉ ELEGIR MOTOVAULT'), SEP, '', '\n'.join(why), '',
             SEP, 'PARA QUIÉN ES', SEP, '', '\n'.join(_who(loc)), '',
             SEP, 'MOTOVAULT PRO', SEP, '', free_block + ('' if 'Pro' in free_block else '\n\nPro desbloquea: más motos, diagnósticos IA y escaneos de recibos ilimitados, exportaciones GPX ilimitadas y mapas de viaje sin conexión.') + ' Mensual o anual. ' + price, '',
             disclosure, '',
             'Privacidad: https://motovault.app/privacy',
             'Términos: https://motovault.app/terms', '', SEP, '',
             t('¿Dudas o comentarios? Leemos cada correo: support@motovault.app', '¿Dudas o comentarios? Leemos cada mail: support@motovault.app'), '',
             'Dos ruedas. Una app. Rueda mejor.' if not v['vos'] else 'Dos ruedas. Una app. Rodá mejor.']
    return '\n'.join(parts)


APPLE = {
    'es-MX': dict(
        name='MotoVault: Mantenimiento Moto',
        subtitle='Rodadas GPS, gastos y servicio',
        keywords='motociclista,motero,motoquero,recordatorio,recibo,gasolina,nafta,llanta,aceite,repuesto,ruta,viaje',
        promotional_text='Graba la rodada, fotografía el recibo y recibe el aviso del próximo servicio. Rodadas, gastos y mantenimiento de tu moto en una sola app.',
        whats_new='Grabación de rodadas más fluida, escaneo de recibos más rápido y varias correcciones. Gracias por cada mensaje: los leemos todos.',
        rationale='"Mantenimiento moto" is the exact phrase every ranking competitor puts in its title in MX, CO, AR and ES (hint "moto mantenimiento", "historial moto mantenimiento"); MotoVault sits at #22 in MX with a subtitle that says "Servicio". Name now carries it verbatim. es-MX is the App Store language for Mexico, Colombia AND Argentina, so keywords mix MX (gasolina, refacción via llanta/aceite), CO (repuesto, motero) and AR (nafta, motoquero) vocabulary. It is also indexed in the US storefront, so it holds the Spanish terms and avoids every en-US word. "Rodadas GPS" covers "moto gps" / "moto gps tracker" hints.'),
    'es-ES': dict(
        name='MotoVault: Mantenimiento Moto',
        subtitle='Rutas, gastos y revisiones',
        keywords='motero,gasolina,neumatico,itv,aceite,cadena,aviso,ticket,kilometro,inclinacion,viaje,curva,taller',
        promotional_text='Graba la ruta, fotografía el ticket y recibe el aviso de la próxima revisión. Rutas, gastos y mantenimiento de tu moto en una sola app.',
        whats_new='Grabación de rutas más fluida, escaneo de tickets más rápido y varias correcciones. Gracias por cada mensaje: los leemos todos.',
        rationale='Spain hints: "mantenimiento moto" (5 competitors title themselves exactly so), "rutas moto", "motero". Current es-ES has a bare "MotoVault" name and no description or keywords at all (it falls back to en-US), so this is the largest single gap on iOS. Castilian vocabulary: neumático, ITV, revisión, ticket, garaje.'),
}

PLAY = {
    'es-419': dict(title='MotoVault: Mantenimiento Moto',
                   short_description='Mantenimiento de moto, gastos y registro de rodadas GPS en una sola app.',
                   rationale='Neutral LatAm Spanish (tú). Title carries the exact competitor phrase "Mantenimiento Moto". Body uses repuestos, llantas, combustible so it reads natural from Mexico to Chile; country listings below sharpen MX, CO and AR.'),
    'es-US': dict(title='MotoVault: Mantenimiento Moto',
                  short_description='Mantenimiento de moto, gastos y rodadas GPS. Millas o kilómetros, tú eliges.',
                  rationale='US Hispanic riders: Mexican-leaning vocabulary (gasolina, refacciones) with miles first, since US bikes have mile odometers.'),
    'es-ES': dict(title='MotoVault: Mantenimiento Moto',
                  short_description='Mantenimiento de moto, gastos, rutas GPS y avisos de revisión e ITV.',
                  rationale='Castilian: rutas, revisión, ITV, neumáticos, repostaje, motero.'),
    'es-MX-play': dict(title='MotoVault: Mantenimiento Moto',
                       short_description='Servicio de tu moto, gastos y rodadas GPS. Recordatorios de verificación.',
                       rationale='Custom store listing, Mexico. Gasolina, refacciones, servicio, verificación and tenencia reminders, rodada.'),
    'es-CO': dict(title='MotoVault: Mantenimiento Moto',
                  short_description='Mantenimiento de tu moto, gastos y rodadas GPS. Avisos de SOAT y tecno.',
                  rationale='Custom store listing, Colombia (45 new users in 90 days, mostly Android). Colombian riders say tanqueada, repuestos and motero, and every bike needs SOAT and tecnomecánica renewed yearly, which a date reminder covers.'),
    'es-AR': dict(title='MotoVault: Service de tu Moto',
                  short_description='Service de tu moto, gastos y salidas con GPS. Recordatorios de VTV.',
                  rationale='Custom store listing, Argentina, in voseo. Argentines "hacen el service", cargan nafta, cambian cubiertas and renew the VTV. "Service" is the word they search for maintenance.'),
}
