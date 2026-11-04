"""pt-BR, fr-FR, it, de-DE, fil. Each written natively; Apple and Play share a body
with platform-specific blocks (CarPlay on Apple only; Play gets the canonical
free-tier sentence and the Google Play disclosure)."""

SEP = '--------------------------'

L = {}

# ---------------------------------------------------------------- pt-BR
L['pt-BR'] = dict(
    captions={
        'ride_tracking': (['Grave cada rolê.', 'Guarde cada estrada.'], 'Rota GPS, distância, subida e inclinação máxima, no automático.'),
        'ride_stats': (['Cada rolê,', 'em números.'], '{route_name}: distância, tempo rodando, subida e inclinação.'),
        'expenses': (['Saiba quanto sua', 'moto custa de verdade.'], 'Gasolina, peças, equipamento e oficina num só lugar. Grátis.'),
        'receipt_scan': (['Fotografe a nota.', 'Esqueça a digitação.'], 'O MotoVault lê peças, mão de obra e total, e preenche o gasto.'),
        'maintenance_reminders': (['Nunca perca', 'uma revisão.'], 'Lembretes por km ou por data: óleo, corrente, pneu e mais.'),
        'service_history': (['Cada revisão,', 'registrada.'], 'Histórico completo de manutenção que valoriza a moto na revenda.'),
        'garage': (['Sua moto,', 'tudo num só lugar.'], 'Ficha, hodômetro, próxima revisão e custos num relance.'),
        'trip_planning': (['Planeje a viagem.', 'Depois, é só rodar.'], 'Trace a rota, marque paradas e compartilhe com a galera.'),
        'season_summary': (['Sua temporada,', 'num resumo só.'], '{distance} em {ride_count} rolês, o mais longo e por onde você passou.'),
        'costs_overview': (['Cada quilômetro', 'tem seu preço.'], 'Custo por km, tendência mensal e {currency_amount} gastos no ano.'),
    },
    assets=dict(header='Sua moto, sob controle', search='Rolês, gastos e revisões num app só', feature_graphic='Sua moto, sob controle'),
    hook=("Grave cada rolê, anote cada gasto e nunca perca uma revisão da sua moto, num app feito para motociclistas, não para carros.\n\n"
          "O MotoVault grava seus trajetos com GPS, mostra quanto a moto custa de verdade e avisa antes da próxima revisão. "
          "Rolês, gastos e histórico de manutenção num garagem de bolso.").replace('num garagem', 'numa garagem'),
    play_hook=("MotoVault é o app de manutenção de moto para motociclistas e motoqueiros: grave seus rolês com GPS, controle os gastos escaneando a nota e receba lembretes de revisão, num app feito para motos, não para carros.\n\n"
               "Anote cada abastecimento e cada conta da oficina, guarde o histórico de manutenção e nunca mais esqueça a troca de óleo, o licenciamento ou o seguro."),
    feats=[
        "* GRAVE CADA ROLÊ - Toque em gravar e rode. O MotoVault registra a rota GPS, a distância, o tempo rodando, a subida e a inclinação máxima, e monta um diário de cada quilômetro. Exporte qualquer trajeto em GPX.",
        "* CONTROLE CADA GASTO - Cada abastecimento, cada peça, cada visita à oficina. Veja quanto a moto custa por km, por mês e por ano. Registrar é grátis e sem limite, sempre.",
        "* ESCANEIE A NOTA EM VEZ DE DIGITAR - Aponte a câmera para a nota do posto, da loja de peças ou da oficina. O MotoVault lê as peças, a mão de obra, o total e a data, e preenche o gasto para você.",
        "* NUNCA PERCA UMA REVISÃO - Troca de óleo, ajuste da corrente, troca de pneu, regulagem de válvulas. Crie lembretes por quilometragem ou por data e receba o aviso antes do próximo intervalo.",
        "* HISTÓRICO COMPLETO - Cada serviço com data, hodômetro e custo. Um registro completo que valoriza a moto na hora de vender.",
        "* SUA GARAGEM - Ficha técnica, hodômetro, próxima revisão e custos da sua moto numa tela só. Mais de 12.000 modelos no catálogo.",
        "* PLANEJE CADA VIAGEM - O bate-volta de domingo ou a viagem da sua vida. Salve rotas, marque paradas e compartilhe com a galera.",
        "* SUA TEMPORADA NUM RESUMO - Quilômetros rodados, rolês, o trajeto mais longo e os países por onde você passou, prontos para compartilhar.",
    ],
    carplay="* MOTOVAULT NO CARPLAY - Comece, pause e encerre um trajeto pela tela do carro, com distância e tempo rodando fáceis de ler num relance.",
    why=['- Um app só no lugar de três: gravador de rolês, controle de gastos e caderno de manutenção',
         '- Lembretes por km ou por data, para nunca mais chutar quando vence a troca de óleo',
         '- Lembretes por data para o licenciamento, o seguro ou o que vencer uma vez por ano',
         '- O scanner lê peças, mão de obra e total: registrar um gasto leva segundos',
         '- Quilômetros ou milhas, tema claro ou escuro: o app segue sua escolha',
         '- Seus dados são seus: privados, exportáveis, nunca vendidos'],
    who=['- Quem usa a moto todo dia e quer ela sempre em dia', '- Quem sai no fim de semana atrás da próxima estrada boa',
         '- Quem faz viagem longa e quer registrar tudo', '- Quem mete a mão na própria moto', '- Quem cansou de app feito para carro'],
    h=dict(what='O QUE VOCÊ PODE FAZER', built='FEITO PARA QUEM RODA', why='POR QUE TROCAR PARA O MOTOVAULT', who='PARA QUEM É', free='GRÁTIS E PRO'),
    built=['- Quilômetros ou milhas: sua garagem inteira segue sua escolha', '- Tema claro e escuro, pensado para ler na oficina',
           '- Seus dados são seus: privados, exportáveis, nunca vendidos', '- Feito para quem roda no Brasil e no mundo'],
    apple_free=['O MotoVault é grátis e registrar nunca tem limite: uma moto, gastos ilimitados, histórico de manutenção e lembretes ilimitados, e gravação de trajetos e viagens ilimitada. Todo mês você também tem 3 escaneamentos de notas e 1 exportação GPX.',
                'O MotoVault Pro libera motos ilimitadas, escaneamentos ilimitados, exportações GPX ilimitadas, mapas de viagem offline e mais ajuda com IA. Mensal, anual ou pagamento único vitalício: os preços aparecem no app na sua moeda.',
                'As assinaturas são renovadas automaticamente, salvo cancelamento com pelo menos 24 horas de antecedência do fim do período atual. Gerencie ou cancele quando quiser nos ajustes da sua conta da App Store.'],
    play_pro=('Pro libera mais motos.\nDiagnósticos IA e escaneamentos de\nrecibos ilimitados, exportações GPX ilimitadas e mapas de\nviagem offline. Plano mensal ou anual; o preço aparece no app antes de você confirmar.'),
    play_disc='A assinatura é renovada automaticamente, salvo cancelamento com pelo menos 24 horas de antecedência do fim do período. Gerencie ou cancele nas configurações da sua conta Google Play.',
    legal=['Privacidade: https://motovault.app/privacy', 'Termos: https://motovault.app/terms'],
    contact='Dúvidas ou ideias? Lemos cada e-mail: support@motovault.app', sign='Duas rodas. Um app. Rode melhor.',
    apple=dict(
        name='MotoVault: Manutenção de Moto', subtitle='Rotas GPS, gastos e revisão',
        keywords='motoqueiro,motociclista,gasolina,combustivel,oleo,pneu,corrente,lembrete,nota,km,viagem,oficina,role',
        promotional_text='Grave o rolê, fotografe a nota e receba o aviso da próxima revisão. Rolês, gastos e manutenção da sua moto num app só.',
        whats_new='Gravação de rolês mais estável, leitura de notas mais rápida e várias correções. Obrigado por cada mensagem: lemos todas.',
        rationale='Brazil hints: "moto manutenção", "controle de manutenção"; competitors title themselves "Manutenção de moto" (Garagely, MotorApp) and MotoVault is #56 for "manutenção moto" with a subtitle that says "Serviço". Name now carries the phrase. Brazilian riders say rolê, revisão, nota (not recibo), motoqueiro. pt-BR is also indexed in the US storefront, so no English words.'),
    play=dict(title='MotoVault: Manutenção de Moto', short_description='Manutenção da moto, controle de gastos e rolês com GPS num app só.',
              rationale='Brazil is the #2 growth market. Title = exact search phrase; body uses rolê, revisão, troca de óleo, nota, abastecimento, licenciamento.'),
)

# ---------------------------------------------------------------- fr-FR
L['fr-FR'] = dict(
    captions={
        'ride_tracking': (['Chaque balade', 'enregistrée.'], 'Tracé GPS, distance, dénivelé et angle maxi, sans rien toucher.'),
        'ride_stats': (['Chaque sortie,', 'en chiffres.'], '{route_name} : distance, temps de roulage, dénivelé et angle.'),
        'expenses': (['Ce que votre moto', 'vous coûte vraiment.'], 'Essence, pièces, équipement et garage au même endroit. Gratuit.'),
        'receipt_scan': (['Photographiez le reçu.', 'Fini la saisie.'], 'MotoVault lit pièces, main-d’œuvre et total, et remplit la dépense.'),
        'maintenance_reminders': (['Ne ratez plus', 'une révision.'], 'Rappels au kilométrage ou à la date : vidange, chaîne, pneus.'),
        'service_history': (['Votre carnet', 'd’entretien, complet.'], 'Chaque intervention notée : un vrai atout à la revente.'),
        'garage': (['Votre moto,', 'tout au même endroit.'], 'Fiche, compteur, prochaine révision et coûts en un coup d’œil.'),
        'trip_planning': (['Préparez le road trip.', 'Il ne reste qu’à rouler.'], 'Tracez l’itinéraire, ajoutez des étapes, partagez-le.'),
        'season_summary': (['Votre saison,', 'en un résumé.'], '{distance}, {ride_count} sorties, la plus longue, les pays traversés.'),
        'costs_overview': (['Chaque kilomètre', 'a son prix.'], 'Coût au km, tendance mensuelle et {currency_amount} cette année.'),
    },
    assets=dict(header='Votre moto, sous contrôle', search='Balades, frais et entretien dans une app', feature_graphic='Votre moto, sous contrôle'),
    hook=("Enregistrez chaque balade, notez chaque dépense et ne ratez plus une révision, dans une app pensée pour les motards, pas pour les voitures.\n\n"
          "MotoVault enregistre vos sorties au GPS, vous montre ce que votre moto vous coûte vraiment et vous prévient avant la prochaine révision. "
          "Balades, frais et carnet d’entretien, réunis dans un garage qui tient dans la poche."),
    play_hook=("MotoVault est l’app d’entretien moto pour les motards : enregistrez vos balades au GPS, suivez vos frais en scannant vos reçus et recevez les rappels de révision, dans une app faite pour la moto, pas pour la voiture.\n\n"
               "Notez chaque plein et chaque facture du garage, gardez un carnet d’entretien complet et ne laissez plus passer une vidange ni le contrôle technique."),
    feats=[
        "* ENREGISTREZ CHAQUE BALADE - Lancez l’enregistrement et roulez. MotoVault note le tracé GPS, la distance, le temps de roulage, le dénivelé et l’angle maximal, et tient le journal de chaque kilomètre. Exportez n’importe quelle sortie en GPX.",
        "* SUIVEZ CHAQUE DÉPENSE - Chaque plein, chaque pièce, chaque passage au garage. Voyez ce que votre moto coûte au kilomètre, au mois et à l’année. Noter vos frais est gratuit et sans limite, toujours.",
        "* SCANNEZ LE REÇU AU LIEU DE LE SAISIR - Visez un ticket de carburant, de pièces ou de garage. MotoVault lit les pièces, la main-d’œuvre, le total et la date, et remplit la dépense pour vous.",
        "* NE RATEZ PLUS UNE RÉVISION - Vidange, tension de chaîne, pneus, jeu aux soupapes. Programmez des rappels au kilométrage ou à la date et soyez prévenu avant la prochaine échéance.",
        "* UN CARNET D’ENTRETIEN COMPLET - Chaque intervention avec date, kilométrage et coût. Un historique solide qui rassure à la revente.",
        "* VOTRE GARAGE - Fiche technique, compteur, prochaine révision et coûts de votre moto sur un seul écran. Plus de 12 000 modèles au catalogue.",
        "* PRÉPAREZ CHAQUE ROAD TRIP - La boucle du dimanche ou le voyage d’une vie. Enregistrez des itinéraires, ajoutez des étapes et partagez-les avec votre groupe.",
        "* VOTRE SAISON EN UN RÉSUMÉ - Kilomètres parcourus, sorties, votre plus longue balade et les pays traversés, prêts à partager.",
    ],
    carplay="* MOTOVAULT SUR CARPLAY - Démarrez, mettez en pause et terminez une sortie depuis l’écran de la voiture, avec distance et temps de roulage lisibles d’un coup d’œil.",
    why=['- Une seule app au lieu de trois : journal de balades, suivi des frais et carnet d’entretien',
         '- Rappels au kilométrage ou à la date, pour ne plus deviner quand tombe la vidange',
         '- Rappels à date pour le contrôle technique, l’assurance ou tout ce qui revient chaque année',
         '- Le scan des reçus lit pièces, main-d’œuvre et total : noter une dépense prend quelques secondes',
         '- Kilomètres ou miles, thème clair ou sombre : l’app suit votre choix',
         '- Vos données vous appartiennent : privées, exportables, jamais vendues'],
    who=['- Les motards du quotidien qui veulent une moto toujours au top', '- Les motards du week-end à la recherche de la prochaine belle route',
         '- Les voyageurs au long cours qui veulent tout garder', '- Ceux qui mettent les mains dans le cambouis', '- Tous ceux qui en ont assez des apps pensées pour la voiture'],
    h=dict(what='CE QUE VOUS POUVEZ FAIRE', built='PENSÉE POUR LES MOTARDS', why='POURQUOI LES MOTARDS PASSENT À MOTOVAULT', who='POUR QUI', free='GRATUIT ET PRO'),
    built=['- Kilomètres ou miles : tout votre garage suit votre choix', '- Thème clair et sombre, lisible même au garage',
           '- Vos données vous appartiennent : privées, exportables, jamais vendues', '- Conçue pour les motards de France et d’Europe'],
    apple_free=['MotoVault est gratuit et la saisie n’est jamais limitée : une moto, dépenses illimitées, carnet d’entretien et rappels illimités, enregistrement des balades et voyages illimité. Chaque mois, vous avez aussi 3 scans de reçus et 1 export GPX.',
                'MotoVault Pro ajoute motos illimitées, scans illimités, exports GPX illimités, cartes de voyage hors ligne et plus d’aide par IA. Au mois, à l’année ou en achat unique à vie : les prix s’affichent dans l’app dans votre devise.',
                'Les abonnements se renouvellent automatiquement sauf annulation au moins 24 heures avant la fin de la période en cours. Gérez ou annulez à tout moment dans les réglages de votre compte App Store.'],
    play_pro="Débloquez un nombre illimité de motos et de diagnostics IA, des scans de reçus illimités, l'export GPX illimité et les cartes d'itinéraire hors ligne. Au mois ou à l’année. Le prix est indiqué dans l’app avant la confirmation.",
    play_disc='L’abonnement se renouvelle automatiquement sauf annulation au moins 24 heures avant la fin de la période en cours. Gérez ou annulez à tout moment dans les paramètres de votre compte Google Play.',
    legal=['Confidentialité : https://motovault.app/privacy', 'Conditions : https://motovault.app/terms'],
    contact='Une question, une idée ? Nous lisons chaque e-mail : support@motovault.app', sign='Deux roues. Une app. Roulez mieux.',
    apple=dict(
        name='MotoVault: Entretien Moto', subtitle='Balades GPS, frais et carnet',
        keywords='motard,revision,vidange,pneu,chaine,essence,carburant,rappel,recu,depense,kilometrage,roadtrip,suivi',
        promotional_text='Enregistrez la balade, photographiez le reçu, recevez le rappel de révision. Balades, frais et entretien de votre moto dans une seule app.',
        whats_new='Enregistrement des balades plus fluide, scan des reçus plus rapide et plusieurs corrections. Merci pour chaque message : nous les lisons tous.',
        rationale='France hints: "entretien moto" (8 competitors title themselves "X : Entretien Moto"), "entretien moto : carnet", "balade moto", "moto trip". MotoVault is #64 for "entretien moto" with "Garage Moto" in its name. Name now carries the exact phrase; subtitle adds balade, GPS, frais, carnet. Keywords add motard, révision, vidange (top French maintenance words). fr-FR is also indexed in the US storefront, so English terms are left to en-US.'),
    play=dict(title='MotoVault: Entretien Moto', short_description='Entretien moto, suivi des frais et balades GPS dans une seule app.',
              rationale='Title = exact French search phrase. Body uses motard, vidange, révision, carnet d’entretien, contrôle technique, plein.'),
)

# ---------------------------------------------------------------- it
L['it'] = dict(
    captions={
        'ride_tracking': (['Registra ogni giro.', 'Ricorda ogni strada.'], 'Traccia GPS, distanza, dislivello e piega massima, in automatico.'),
        'ride_stats': (['Ogni uscita,', 'in numeri.'], '{route_name}: distanza, tempo in marcia, dislivello e piega.'),
        'expenses': (['Scopri quanto ti', 'costa davvero la moto.'], 'Benzina, ricambi, abbigliamento e officina in un posto. Gratis.'),
        'receipt_scan': (['Fotografa lo scontrino.', 'Niente da digitare.'], 'MotoVault legge ricambi, manodopera e totale, e compila la spesa.'),
        'maintenance_reminders': (['Mai più un tagliando', 'dimenticato.'], 'Promemoria a km o a data: olio, catena, gomme e revisione.'),
        'service_history': (['Ogni tagliando,', 'messo agli atti.'], 'Uno storico completo che vale oro quando vendi la moto.'),
        'garage': (['La tua moto,', 'tutta in un posto.'], 'Scheda, contachilometri, prossimo tagliando e costi a colpo d’occhio.'),
        'trip_planning': (['Pianifica il viaggio.', 'Poi si parte.'], 'Traccia il percorso, aggiungi tappe e condividilo col gruppo.'),
        'season_summary': (['La tua stagione,', 'in un riepilogo.'], '{distance} in {ride_count} uscite, la più lunga e dove sei stato.'),
        'costs_overview': (['Ogni chilometro', 'ha il suo prezzo.'], 'Costo al km, andamento mensile e {currency_amount} spesi quest’anno.'),
    },
    assets=dict(header='La tua moto, sotto controllo', search='Giri, spese e tagliandi in una sola app', feature_graphic='La tua moto, sotto controllo'),
    hook=("Registra ogni giro, ogni spesa e ogni tagliando della tua moto, in un’app pensata per i motociclisti, non per le auto.\n\n"
          "MotoVault registra le tue uscite col GPS, ti mostra quanto ti costa davvero la moto e ti avvisa prima del prossimo tagliando. "
          "Giri, spese e storico della manutenzione, tutto in un garage da tasca."),
    play_hook=("MotoVault è l’app di manutenzione moto per motociclisti: registra i tuoi giri col GPS, tieni sotto controllo le spese scansionando gli scontrini e ricevi i promemoria dei tagliandi, in un’app fatta per la moto, non per l’auto.\n\n"
               "Annota ogni pieno e ogni conto dell’officina, conserva lo storico della manutenzione e non dimenticare più cambio olio, revisione o bollo."),
    feats=[
        "* REGISTRA OGNI GIRO - Premi registra e parti. MotoVault salva la traccia GPS, la distanza, il tempo in marcia, il dislivello e l’angolo di piega massimo, e tiene il diario di ogni chilometro. Esporta qualsiasi uscita in GPX.",
        "* TIENI TRACCIA DI OGNI SPESA - Ogni pieno, ogni ricambio, ogni passaggio in officina. Scopri quanto ti costa la moto al km, al mese e all’anno. Registrare è gratis e senza limiti, sempre.",
        "* SCANSIONA LO SCONTRINO INVECE DI DIGITARLO - Inquadra uno scontrino di benzina, ricambi o officina. MotoVault legge i ricambi, la manodopera, il totale e la data, e compila la spesa per te.",
        "* MAI PIÙ UN TAGLIANDO DIMENTICATO - Cambio olio, tensionamento catena, cambio gomme, gioco valvole. Imposta promemoria a chilometri o a data e ricevi un avviso prima della prossima scadenza.",
        "* STORICO COMPLETO - Ogni intervento con data, chilometri e costo. Un libretto completo che ti dà forza quando vendi la moto.",
        "* IL TUO GARAGE - Scheda tecnica, contachilometri, prossimo tagliando e costi della tua moto in un’unica schermata. Oltre 12.000 modelli in catalogo.",
        "* PIANIFICA OGNI VIAGGIO - Il giro della domenica o il viaggio della vita. Salva percorsi, aggiungi tappe e condividili con il gruppo.",
        "* LA TUA STAGIONE IN UN RIEPILOGO - Chilometri totali, uscite, il giro più lungo e i paesi attraversati, pronti da condividere.",
    ],
    carplay="* MOTOVAULT SU CARPLAY - Avvia, metti in pausa e chiudi un giro dallo schermo dell’auto, con distanza e tempo in marcia leggibili al volo.",
    why=['- Un’app sola invece di tre: diario dei giri, controllo spese e libretto di manutenzione',
         '- Promemoria a km o a data, per non dover più indovinare quando tocca l’olio',
         '- Promemoria a data per revisione, bollo, assicurazione o qualsiasi scadenza annuale',
         '- La scansione legge ricambi, manodopera e totale: registrare una spesa richiede pochi secondi',
         '- Chilometri o miglia, tema chiaro o scuro: l’app segue la tua scelta',
         '- I tuoi dati sono tuoi: privati, esportabili, mai venduti'],
    who=['- Chi usa la moto tutti i giorni e la vuole sempre a posto', '- Chi esce nel weekend a cercare la prossima strada di curve',
         '- Chi fa viaggi lunghi e vuole registrare tutto', '- Chi mette le mani sulla propria moto', '- Chi è stanco di app pensate per le auto'],
    h=dict(what='COSA PUOI FARE', built='PENSATA PER I MOTOCICLISTI', why='PERCHÉ I MOTOCICLISTI SCELGONO MOTOVAULT', who='PER CHI È', free='GRATIS E PRO'),
    built=['- Chilometri o miglia: tutto il garage segue la tua scelta', '- Tema chiaro e scuro, leggibile anche in officina',
           '- I tuoi dati sono tuoi: privati, esportabili, mai venduti', '- Pensata per chi guida in Italia e in Europa'],
    apple_free=['MotoVault è gratis e registrare non ha mai limiti: una moto, spese illimitate, storico manutenzione e promemoria illimitati, registrazione di giri e viaggi illimitata. Ogni mese hai anche 3 scansioni di scontrini e 1 esportazione GPX.',
                'MotoVault Pro aggiunge moto illimitate, scansioni illimitate, esportazioni GPX illimitate, mappe di viaggio offline e più aiuto dall’IA. Mensile, annuale o un unico acquisto a vita: i prezzi sono mostrati nell’app nella tua valuta.',
                'Gli abbonamenti si rinnovano automaticamente se non vengono annullati almeno 24 ore prima della fine del periodo in corso. Gestiscili o annullali quando vuoi nelle impostazioni del tuo account App Store.'],
    play_pro='Pro sblocca altre moto.\nDiagnosi AI e scansioni ricevute\nillimitate, esportazioni GPX illimitate e mappe dei\nviaggi offline. Piano mensile o annuale; il prezzo è mostrato nell’app prima della conferma.',
    play_disc='L’abbonamento si rinnova automaticamente se non viene annullato almeno 24 ore prima della fine del periodo. Gestiscilo o annullalo quando vuoi nelle impostazioni del tuo account Google Play.',
    legal=['Privacy: https://motovault.app/privacy', 'Termini: https://motovault.app/terms'],
    contact='Domande o idee? Leggiamo ogni email: support@motovault.app', sign='Due ruote. Un’app. Guida meglio.',
    apple=dict(
        name='MotoVault: Manutenzione Moto', subtitle='Giri GPS, spese e tagliandi',
        keywords='motociclista,percorsi,piega,benzina,gomme,olio,catena,promemoria,scontrino,km,viaggio,officina,tour',
        promotional_text='Registra il giro, fotografa lo scontrino, ricevi il promemoria del tagliando. Giri, spese e manutenzione della tua moto in una sola app.',
        whats_new='Registrazione dei giri più fluida, scansione degli scontrini più veloce e varie correzioni. Grazie per ogni messaggio: li leggiamo tutti.',
        rationale='Italy hints: "manutenzione moto" (5 competitors use it as title), "moto manutenzione, spese, note", "giri in moto", "percorsi moto", "moto gps". MotoVault is #130 for "manutenzione moto" because the word is only in the keyword field. Name now carries it; "piega" is how Italians say lean angle.'),
    play=dict(title='MotoVault: Manutenzione Moto', short_description='Manutenzione moto, spese e giri GPS in un’unica app. Promemoria tagliandi.',
              rationale='Title = exact search phrase. Body uses tagliando, piega, scontrino, officina, revisione, bollo.'),
)

# ---------------------------------------------------------------- de-DE
L['de-DE'] = dict(
    captions={
        'ride_tracking': (['Jede Tour im Kasten.', 'Jede Kurve gemerkt.'], 'GPS-Strecke, Distanz, Höhenmeter und Schräglage, automatisch.'),
        'ride_stats': (['Jede Fahrt,', 'in Zahlen.'], '{route_name}: Distanz, Fahrzeit, Höhenmeter und Schräglage.'),
        'expenses': (['Was dein Motorrad', 'wirklich kostet.'], 'Sprit, Teile, Ausrüstung und Werkstatt an einem Ort. Kostenlos.'),
        'receipt_scan': (['Beleg fotografieren.', 'Fertig.'], 'MotoVault liest Teile, Arbeitslohn und Summe und füllt alles aus.'),
        'maintenance_reminders': (['Nie wieder', 'eine Inspektion verpassen.'], 'Erinnerungen nach Kilometern oder Datum: Öl, Kette, Reifen, TÜV.'),
        'service_history': (['Dein digitales', 'Scheckheft.'], 'Jede Wartung dokumentiert. Das zahlt sich beim Verkauf aus.'),
        'garage': (['Dein Motorrad,', 'alles an einem Ort.'], 'Daten, Kilometerstand, nächster Service und Kosten auf einen Blick.'),
        'trip_planning': (['Tour planen.', 'Tour fahren.'], 'Route zeichnen, Stopps setzen und mit der Gruppe teilen.'),
        'season_summary': (['Deine Saison', 'auf einen Blick.'], '{distance} in {ride_count} Fahrten, die längste und wo du warst.'),
        'costs_overview': (['Jeder Kilometer', 'hat seinen Preis.'], 'Kosten pro km, Monatsverlauf und {currency_amount} in diesem Jahr.'),
    },
    assets=dict(header='Dein Motorrad im Griff', search='Touren, Kosten und Wartung in einer App', feature_graphic='Dein Motorrad im Griff'),
    hook=("Zeichne jede Tour auf, erfasse jede Ausgabe und verpasse keine Inspektion mehr, in einer App für Motorradfahrer, nicht für Autofahrer.\n\n"
          "MotoVault zeichnet deine Fahrten per GPS auf, zeigt dir, was dein Motorrad wirklich kostet, und erinnert dich vor der nächsten Wartung. "
          "Touren, Kosten und Wartungshistorie in einer Garage für die Hosentasche."),
    play_hook=("MotoVault ist die Motorrad-App für Wartung, Kosten und Touren: Fahrten per GPS aufzeichnen, Ausgaben per Beleg-Scan erfassen und an die nächste Inspektion erinnert werden, gebaut für Motorräder, nicht für Autos.\n\n"
               "Tankbuch, Fahrtenbuch und digitales Scheckheft in einer App: jede Tankfüllung, jede Werkstattrechnung, jeder Ölwechsel und der TÜV-Termin."),
    feats=[
        "* JEDE TOUR AUFZEICHNEN - Aufnahme starten und losfahren. MotoVault speichert GPS-Strecke, Distanz, Fahrzeit, Höhenmeter und maximale Schräglage und führt ein Fahrtenbuch über jeden Kilometer. Jede Fahrt als GPX exportieren.",
        "* JEDE AUSGABE ERFASSEN - Jede Tankfüllung, jedes Ersatzteil, jeder Werkstattbesuch. Sieh, was dein Motorrad pro Kilometer, pro Monat und pro Jahr kostet. Erfassen ist kostenlos und unbegrenzt, immer.",
        "* BELEG SCANNEN STATT TIPPEN - Kamera auf den Tank-, Teile- oder Werkstattbeleg halten. MotoVault liest Teile, Arbeitslohn, Summe und Datum und füllt die Ausgabe für dich aus.",
        "* KEINE INSPEKTION MEHR VERPASSEN - Ölwechsel, Kette spannen, Reifenwechsel, Ventilspiel. Erinnerungen nach Kilometerstand oder Datum, rechtzeitig vor dem nächsten Intervall.",
        "* DEIN DIGITALES SCHECKHEFT - Jede Wartung mit Datum, Kilometerstand und Kosten. Eine lückenlose Historie, die beim Verkauf überzeugt.",
        "* DEINE GARAGE - Technische Daten, Kilometerstand, nächster Service und laufende Kosten deines Motorrads auf einem Bildschirm. Über 12.000 Modelle im Katalog.",
        "* JEDE TOUR PLANEN - Die Feierabendrunde oder die große Alpentour. Routen speichern, Wegpunkte setzen und mit der Gruppe teilen.",
        "* DEINE SAISON IN EINEM RÜCKBLICK - Gefahrene Kilometer, Fahrten, deine längste Tour und die Länder, durch die du gefahren bist, bereit zum Teilen.",
    ],
    carplay="* MOTOVAULT MIT CARPLAY - Fahrt am Display starten, pausieren und beenden, mit Distanz und Fahrzeit groß genug für einen schnellen Blick.",
    why=['- Eine App statt drei: Fahrtenbuch, Tankbuch und Wartungsheft zusammen',
         '- Erinnerungen nach Kilometern oder Datum, damit du nie mehr raten musst, wann das Öl fällig ist',
         '- Datums-Erinnerungen für TÜV, Versicherung oder alles, was einmal im Jahr ansteht',
         '- Der Beleg-Scan liest Teile, Arbeitslohn und Summe: eine Ausgabe ist in Sekunden erfasst',
         '- Kilometer oder Meilen, helles oder dunkles Design: die App folgt deiner Wahl',
         '- Deine Daten gehören dir: privat, exportierbar, nie verkauft'],
    who=['- Pendler, die ihr Motorrad täglich fahren und gut in Schuss halten', '- Wochenendfahrer auf der Suche nach der nächsten guten Kurvenstrecke',
         '- Reisende, die lange Touren festhalten wollen', '- Schrauber, die selbst Hand anlegen', '- Alle, die genug von Auto-Apps haben'],
    h=dict(what='WAS DU DAMIT MACHST', built='FÜR BIKER GEBAUT', why='WARUM BIKER ZU MOTOVAULT WECHSELN', who='FÜR WEN', free='KOSTENLOS UND PRO'),
    built=['- Kilometer oder Meilen: deine ganze Garage folgt deiner Wahl', '- Helles und dunkles Design, gut lesbar auch in der Werkstatt',
           '- Deine Daten gehören dir: privat, exportierbar, nie verkauft', '- Gemacht für Motorradfahrer in Deutschland und Europa'],
    apple_free=['MotoVault ist kostenlos, und Erfassen ist nie begrenzt: ein Motorrad, unbegrenzte Ausgaben, unbegrenzte Wartungshistorie und Erinnerungen, unbegrenzte Aufzeichnung von Fahrten und Touren. Jeden Monat dazu 3 Beleg-Scans und 1 GPX-Export.',
                'MotoVault Pro bringt unbegrenzt viele Motorräder, unbegrenzte Scans, unbegrenzte GPX-Exporte, Offline-Tourkarten und mehr KI-Hilfe. Monatlich, jährlich oder einmalig auf Lebenszeit: die Preise siehst du in der App in deiner Währung.',
                'Abos verlängern sich automatisch, sofern sie nicht mindestens 24 Stunden vor Ende des laufenden Zeitraums gekündigt werden. Verwalten oder kündigen jederzeit in den Einstellungen deines App-Store-Kontos.'],
    play_pro='Pro schaltet frei: weitere Motorräder, unbegrenzte KI-Diagnosen und Beleg-Scans, unbegrenzte GPX-Exports und Offline-Karten für Touren. Im Monats- oder Jahresabo. Den Preis siehst du in der App, bevor du bestätigst.',
    play_disc='Das Abo verlängert sich automatisch, sofern es nicht mindestens 24 Stunden vor Ende der Laufzeit gekündigt wird. Verwalten oder kündigen jederzeit in den Google-Play-Kontoeinstellungen.',
    legal=['Datenschutz: https://motovault.app/privacy', 'Nutzungsbedingungen: https://motovault.app/terms'],
    contact='Fragen oder Ideen? Wir lesen jede E-Mail: support@motovault.app', sign='Zwei Räder. Eine App. Besser fahren.',
    apple=dict(
        name='MotoVault: Motorrad Wartung', subtitle='Tracker, Touren & Kosten',
        keywords='schräglage,routen,fahrtenbuch,tankbuch,inspektion,scheckheft,ölwechsel,reifen,kette,beleg,tüv,km',
        promotional_text='Tour aufzeichnen, Beleg fotografieren, an die Inspektion erinnert werden. Touren, Kosten und Wartung deines Motorrads in einer App.',
        whats_new='Stabilere Tour-Aufzeichnung, schnellerer Beleg-Scan und einige Fehlerbehebungen. Danke für jede Nachricht: wir lesen alle.',
        rationale='Germany hints: "motorrad wartung" (5 competitors), "motorrad tracker", "motorrad touren", "motorrad routen", "motorrad schräglage", "tankbuch", "fahrtenbuch". MotoVault is #31 for "motorrad wartung" with the hyphenated "Motorrad-Garage"; the name drops the hyphen so "Motorrad" and "Wartung" index as separate words and combine with subtitle words into "motorrad tracker", "motorrad touren", "motorrad kosten".'),
    play=dict(title='MotoVault: Motorrad Wartung', short_description='Motorrad-Wartung, Kosten und Touren per GPS: Tankbuch und Scheckheft in einem.',
              rationale='Title = exact search phrase. Body uses Tankbuch, Fahrtenbuch, Scheckheft, Schräglage, Inspektion, TÜV.'),
)

# ---------------------------------------------------------------- fil (Play only)
L['fil'] = dict(
    captions={
        'ride_tracking': (['I-track ang bawat ride.', 'Tandaan ang bawat daan.'], 'GPS route, layo, akyat at max lean, kusang nire-record.'),
        'ride_stats': (['Bawat ride,', 'sa numero.'], '{route_name}: layo, oras sa biyahe, akyat at max lean.'),
        'expenses': (['Alamin ang tunay', 'na gastos ng motor mo.'], 'Gas, piyesa, gear at casa sa iisang lugar. Libre ang pag-log.'),
        'receipt_scan': (['Kunan ang resibo.', 'Wala nang type.'], 'Binabasa ng MotoVault ang piyesa, labor at total, saka pinupunan.'),
        'maintenance_reminders': (['Hindi na', 'malilimutan ang PMS.'], 'Paalala sa change oil at PMS, ayon sa km o petsa.'),
        'service_history': (['Bawat service,', 'nakatala.'], 'Kumpletong maintenance record na may halaga kapag ibebenta mo.'),
        'garage': (['Ang motor mo,', 'nasa iisang lugar.'], 'Specs, odometer, susunod na service at gastos, isang tingin lang.'),
        'trip_planning': (['Planuhin ang ride.', 'Sakyan ang plano.'], 'Gumuhit ng ruta, maglagay ng stop at i-share sa tropa.'),
        'season_summary': (['Ang season mo,', 'sa isang recap.'], '{distance} sa {ride_count} rides, ang pinakamahaba at mga napuntahan.'),
        'costs_overview': (['Bawat kilometro', 'may presyo.'], 'Gastos kada km, buwanang trend at {currency_amount} ngayong taon.'),
    },
    assets=dict(feature_graphic='Motor mo, kontrolado'),
    play_hook=("Ang MotoVault ay motorcycle tracker para sa mga rider: i-record ang ride gamit ang GPS, i-track ang gastos sa pag-scan ng resibo, at makakuha ng paalala sa PMS at change oil, sa app na gawa para sa motor, hindi para sa kotse.\n\n"
               "I-log ang bawat karga ng gas at bawat bayad sa casa, itabi ang kumpletong maintenance record, at huwag nang malimutan ang LTO registration."),
    feats=[
        "* I-TRACK ANG BAWAT RIDE - Pindutin ang record at umarangkada. Nire-record ng MotoVault ang GPS route, layo, oras sa biyahe, akyat at max lean angle, at gumagawa ng logbook ng bawat kilometro. I-export ang kahit anong ride bilang GPX.",
        "* I-TRACK ANG BAWAT GASTOS - Bawat karga ng gas, bawat piyesa, bawat punta sa casa. Tingnan kung magkano talaga ang gastos ng motor mo kada km, kada buwan at kada taon. Libre at walang limit ang pag-log, palagi.",
        "* I-SCAN ANG RESIBO, HINDI NA I-TYPE - Itutok ang camera sa resibo ng gas, piyesa o casa. Binabasa ng MotoVault ang piyesa, labor, total at petsa, at ito na ang magpupuno ng gastos.",
        "* HINDI NA MALILIMUTAN ANG PMS - Change oil, adjust ng kadena, palit gulong, valve clearance. Mag-set ng paalala ayon sa km o petsa at maaabisuhan ka bago ang susunod na interval.",
        "* KUMPLETONG SERVICE RECORD - Bawat trabaho may petsa, odometer at gastos. Isang record na makakatulong kapag ibebenta mo ang motor.",
        "* ANG GARAHE MO - Specs, odometer, susunod na service at gastos ng motor mo sa iisang screen. Mahigit 12,000 modelo sa catalog.",
        "* PLANUHIN ANG BAWAT TRIP - Ang Sunday ride o ang long ride ng buhay mo. Mag-save ng ruta, maglagay ng waypoint at i-share sa tropa.",
        "* ANG SEASON MO SA ISANG RECAP - Kabuuang kilometro, rides, ang pinakamahaba mong ride at mga bansang napuntahan, handang i-share.",
    ],
    why=['- Isang app imbes na tatlo: ride tracker, expense tracker at maintenance log',
         '- Paalala sa PMS ayon sa km o petsa, para hindi ka na manghula kung kailan ang change oil',
         '- Paalala sa petsa para sa LTO registration, insurance o anumang taunang bayarin',
         '- Binabasa ng scanner ang piyesa, labor at total: segundo lang ang pag-log ng gastos',
         '- Kilometro o milya, light o dark theme: sumusunod ang app sa gusto mo',
         '- Sa iyo ang data mo: pribado, puwedeng i-export, hindi ibinebenta'],
    who=['- Mga daily rider na gamit ang motor sa trabaho at commute', '- Weekend rider na naghahanap ng susunod na magandang daan',
         '- Touring rider na nagla-log ng mahahabang ride', '- Mga DIY na sila mismo ang nagcha-change oil at PMS', '- Kahit sinong sawa na sa mga app na para sa kotse'],
    h=dict(what='ANO ANG KAYA MONG GAWIN', why='BAKIT LUMILIPAT ANG MGA RIDER SA MOTOVAULT', who='PARA KANINO'),
    play_disc='Awtomatikong nagre-renew ang subscription maliban kung kinansela nang hindi bababa sa 24 oras bago matapos ang kasalukuyang period. I-manage o i-cancel anumang oras sa settings ng iyong Google Play account. Makikita ang presyo sa app bago ka mag-confirm.',
    legal=['Privacy Policy: https://motovault.app/privacy', 'Terms of Service: https://motovault.app/terms'],
    contact='May tanong o feedback? Binabasa namin ang bawat email: support@motovault.app', sign='Dalawang gulong. Isang app. Mas maayos na ride.',
    play=dict(title='MotoVault: Motor PMS Tracker', short_description='Ride tracker, gastos sa gas at piyesa, at paalala sa PMS at change oil.',
              rationale='Filipino-language default listing. Taglish is how PH riders actually write: "motor", "PMS", "change oil", "casa", "tropa", "LTO". Title carries "motor" + "PMS" which no current Play title in the niche uses.'),
)


def captions(loc):
    return L[loc]['captions']


def apple_description(loc):
    d = L[loc]
    feats = list(d['feats']); feats.insert(6, d['carplay'])
    parts = [d['hook'], '', SEP, d['h']['what'], SEP, '', '\n\n'.join(feats), '',
             SEP, d['h']['built'], SEP, '', '\n'.join(d['built']), '',
             SEP, d['h']['who'], SEP, '', '\n'.join(d['who']), '',
             SEP, d['h']['free'], SEP, '', '\n\n'.join(d['apple_free']), '',
             '\n'.join(d['legal']), '', d['contact'], '', d['sign']]
    return '\n'.join(parts)


def play_description(loc, free_block):
    d = L[loc]
    pro = d.get('play_pro')
    parts = [d['play_hook'], '', SEP, d['h']['what'], SEP, '', '\n\n'.join(d['feats']), '',
             SEP, d['h']['why'], SEP, '', '\n'.join(d['why']), '',
             SEP, d['h']['who'], SEP, '', '\n'.join(d['who']), '',
             SEP, 'MOTOVAULT PRO', SEP, '', free_block] + (['', pro] if pro else []) + ['', d['play_disc'], '',
             '\n'.join(d['legal']), '', SEP, '', d['contact'], '', d['sign']]
    return '\n'.join(parts)
