"""Free-tier claim accuracy for the Play listing — data plus guard.

WHY THIS EXISTS
---------------
On 2026-08-24 an audit found that **43 of 46** Play locales advertised a free tier
that does not ship: 40 promised "unlimited bikes" and "5 AI diagnostic scans per
month" as free, and fr-FR / id / hi-IN promised "3 AI diagnostics per month".
The real free tier is 1 bike and 1 AI diagnostic per month. The claims survived a
version rewrite that fixed the same defect class on iOS, because the only thing
checking them was a person remembering to.

An earlier scrape of the live listings reported only 31 affected locales and
cleared pl-PL, hu-HU and others that were in fact broken — it pattern-matched
English-shaped phrasing and missed the rest. That false negative is the reason
this module does NOT rely on pattern-matching to decide whether a claim is true.

THE DESIGN — two independent checks, not one
--------------------------------------------
1. GENERATED CLAIM (strong, no linguistics involved).
   The free-tier sentence is *rendered* per locale from FREE_TIER_BLOCKS, with the
   numbers substituted from `packages/types/src/constants/limits.ts`. The rendered
   string must appear in `full_description.txt` verbatim. A number cannot drift
   from its source because the source is the only place it is written. Reverting a
   locale by hand fails this immediately.

2. ACKNOWLEDGED-CLAIM BACKSTOP (catches claims made *elsewhere* in the file).
   Check 1 only proves the canonical sentence is right; it says nothing about a
   translator adding "unlimited bikes, free forever!" to a feature bullet — which
   is exactly what 16 locales also did, in a second place. So every *other*
   sentence that pairs an "unlimited"-word with a "bike"-word must be listed in
   ACKNOWLEDGED_CLAIMS by content hash, with a note saying why it is acceptable.
   An unrecognised one fails the gate.

   This is deliberately a review-forcing mechanism rather than a classifier.
   Deciding "is this sentence talking about the free tier or about Pro?" across
   Finnish, Japanese and Korean prose is not a solved problem, and a classifier
   that guesses wrong in the permissive direction is how the original bug shipped.
   Making a human write one line per risky sentence has no false negatives inside
   the pattern's reach, and the allowlist doubles as documentation.

3. AUTHORED_FOR TRIPWIRE.
   The prose is authored for specific constant values — "1 bike" is singular, and
   many of these 46 languages inflect the noun by number. If a constant changes,
   substituting the new number would silently produce broken grammar ("2 Motorrad")
   or, worse, a claim nobody reviewed. So the guard hard-fails when limits.ts and
   AUTHORED_FOR disagree, with an instruction to re-author rather than to bump a
   number. This is the one case where the right behaviour is to stop, not adapt.

WHAT THIS MODULE DOES NOT COVER
-------------------------------
Hardcoded prices, "App Store" on a Play listing, character limits, the required
URLs and the subscription disclosure are all enforced by `check-metadata.py`,
which calls into here. Don't duplicate those rules.

Run via: `pnpm check:store-copy` (or `python3 store/play/check-metadata.py`).
"""
import hashlib
import os
import re

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
LIMITS_TS = os.path.join(REPO_ROOT, 'packages', 'types', 'src', 'constants', 'limits.ts')

# The constant values this copy was written for. Checked against limits.ts on
# every run. See "AUTHORED_FOR TRIPWIRE" above for why a mismatch is fatal
# instead of self-correcting.
AUTHORED_FOR = {
    'MAX_BIKES': 1,
    'MAX_AI_DIAGNOSTICS_PER_MONTH': 1,
    'MAX_RECEIPT_SCANS_PER_MONTH': 3,
}

# Placeholder name -> constant name in limits.ts.
PLACEHOLDERS = {
    'bikes': 'MAX_BIKES',
    'ai': 'MAX_AI_DIAGNOSTICS_PER_MONTH',
    'scans': 'MAX_RECEIPT_SCANS_PER_MONTH',
}


def read_limits(path=LIMITS_TS):
    """Pull the free-tier numerals straight out of the TypeScript source.

    Parsed rather than duplicated: limits.ts is what the app actually enforces
    (apps/api motorcycles.service.ts, ai-budget.service.ts, receipt-scan.service.ts
    and apps/mobile use-pro-gate.ts all read it), so it is the only defensible
    source of truth for what the store may promise. A copy here would be one more
    thing to drift.
    """
    with open(path, encoding='utf-8') as fh:
        source = fh.read()
    # FREE_TIER_LIMITS is the only block these three keys appear in, and each is a
    # bare integer literal. Comments inside the object are skipped because the
    # pattern requires `KEY: <digits>`.
    found = {}
    for key in AUTHORED_FOR:
        match = re.search(rf'\b{key}\s*:\s*(\d+)', source)
        if match:
            found[key] = int(match.group(1))
    return found


# ---------------------------------------------------------------------------
# The canonical free-tier sentence, per locale.
#
# Each value is the exact text that must appear in that locale's
# full_description.txt, with {bikes} / {ai} / {scans} substituted from limits.ts.
# Line breaks inside a value are significant: it-IT and pt-BR hard-wrap their
# descriptions at ~60 columns and both sit within 5 characters of the 4000-char
# field limit, so their blocks are wrapped to match and kept short.
#
# What every block asserts, and why it is true:
#   - N bike                       MAX_BIKES, enforced in motorcycles.service.ts
#   - unlimited maintenance and    no limit exists in code, and per a standing
#     expense logging              product constraint logging is never paywalled
#                                  or count-limited. This is the strategic
#                                  message, not a hedge.
#   - unlimited ride recording     no limit exists (RIDE_WAYPOINT_LIMITS is an
#                                  abuse guard on one ride, not a quota)
#   - N AI diagnostic / month      MAX_AI_DIAGNOSTICS_PER_MONTH, ai-budget.service
#   - N receipt scans / month      MAX_RECEIPT_SCANS_PER_MONTH, receipt-scan.service
#
# Receipt scan is newly named in all 46 locales: it shipped on Android in 3.19.0
# and no listing mentioned it.
#
# Locales whose paragraph structure already carries a separate "Pro unlocks…"
# sentence (de-DE, es-ES, it-IT, pt-BR) keep the free block short and do not
# repeat the Pro half.
# ---------------------------------------------------------------------------
FREE_TIER_BLOCKS = {
    # --- English ------------------------------------------------------------
    'en-US': (
        'Free forever includes {bikes} bike, unlimited maintenance and expense logging, '
        'unlimited ride recording, {ai} AI diagnostic scan per month, and {scans} receipt '
        'scans per month. MotoVault Pro unlocks additional bikes, unlimited AI diagnostics, '
        'unlimited receipt scans, advanced rider analytics, unlimited GPX exports, and '
        'extended ride statistics, on a monthly or annual plan. The price is shown in the '
        'app before you confirm.'
    ),
    'en-CA': (
        'Free forever includes {bikes} bike, unlimited maintenance and expense logging, '
        'unlimited ride recording, {ai} AI diagnostic scan per month, and {scans} receipt '
        'scans per month. MotoVault Pro unlocks additional bikes, unlimited AI diagnostics, '
        'unlimited receipt scans, advanced rider analytics, unlimited GPX exports, and '
        'extended ride statistics, on a monthly or annual plan. The price is shown in the '
        'app before you confirm.'
    ),
    'en-GB': (
        'Free forever includes {bikes} bike, unlimited maintenance and expense logging, '
        'unlimited ride recording, {ai} AI diagnostic scan per month and {scans} receipt '
        'scans per month. MotoVault Pro unlocks additional bikes, unlimited AI diagnostics, '
        'unlimited receipt scans, advanced rider analytics, unlimited GPX exports and '
        'extended ride statistics.'
    ),
    'en-AU': (
        'Free forever includes {bikes} bike, unlimited maintenance and expense logging, '
        'unlimited ride recording, {ai} AI diagnostic scan per month and {scans} receipt '
        'scans per month. MotoVault Pro unlocks additional bikes, unlimited AI diagnostics, '
        'unlimited receipt scans, advanced rider analytics, unlimited GPX exports and '
        'extended ride statistics.'
    ),
    'en-IN': (
        'Free forever includes {bikes} bike, unlimited maintenance and expense logging, '
        'unlimited ride recording, {ai} AI diagnostic scan per month and {scans} receipt '
        'scans per month. MotoVault Pro unlocks additional bikes, unlimited AI diagnostics, '
        'unlimited receipt scans, advanced rider analytics, unlimited GPX exports and '
        'extended ride statistics.'
    ),
    # --- Germanic -----------------------------------------------------------
    'de-DE': (
        'Kostenlos für immer: {bikes} Motorrad, unbegrenztes Wartungs- und Kostenprotokoll, '
        'unbegrenzte Tour-Aufzeichnung, {ai} KI-Diagnose und {scans} Beleg-Scans pro Monat.'
    ),
    'nl-NL': (
        'Gratis blijft gratis: {bikes} motor, onbeperkt onderhoud en kosten vastleggen, '
        'onbeperkt ritten opnemen, {ai} AI-diagnose en {scans} bonnetjes scannen per maand. '
        'MotoVault Pro geeft je meer motoren, onbeperkte AI-diagnoses, onbeperkt scannen, '
        'uitgebreide rijstatistieken, onbeperkte GPX-exports en extra ritgegevens.'
    ),
    'da-DK': (
        'Gratis for altid: {bikes} motorcykel, ubegrænset servicelog og udgifter, '
        'ubegrænset turoptagelse, {ai} AI-diagnose og {scans} kvitteringsscanninger om '
        'måneden. MotoVault Pro giver flere motorcykler, ubegrænsede AI-diagnoser, '
        'ubegrænsede scanninger, avanceret statistik, ubegrænset GPX-eksport og udvidede '
        'turdata.'
    ),
    'no-NO': (
        'Gratis for alltid: {bikes} motorsykkel, ubegrenset servicelogg og utgifter, '
        'ubegrenset turopptak, {ai} AI-diagnose og {scans} kvitteringsskanninger i måneden. '
        'MotoVault Pro gir flere motorsykler, ubegrensede AI-diagnoser, ubegrensede '
        'skanninger, avansert statistikk, ubegrenset GPX-eksport og utvidede turdata.'
    ),
    'sv-SE': (
        'Gratis för alltid: {bikes} motorcykel, obegränsad servicelogg och utgifter, '
        'obegränsad turinspelning, {ai} AI-diagnos och {scans} kvittoskanningar per månad. '
        'MotoVault Pro ger fler motorcyklar, obegränsade AI-diagnoser, obegränsade '
        'skanningar, avancerad statistik, obegränsad GPX-export och utökade turdata.'
    ),
    'fi-FI': (
        'Ilmainen ikuisesti: {bikes} pyörä, rajaton huoltokirja ja kulut, rajaton ajojen '
        'tallennus, {ai} AI-diagnoosi ja {scans} kuittiskannausta kuukaudessa. MotoVault '
        'Pro lisää useampia pyöriä, rajattomat AI-diagnoosit, rajattomat skannaukset, '
        'tarkat tilastot, rajattoman GPX-viennin ja laajemmat ajotiedot.'
    ),
    # --- Romance ------------------------------------------------------------
    'fr-FR': (
        'Gratuit pour toujours : {bikes} moto dans votre garage, suivi illimité de '
        "l'entretien et des dépenses, enregistrement illimité des trajets, {ai} diagnostic "
        'IA et {scans} scans de reçus par mois.'
    ),
    'es-ES': (
        'Gratis para siempre: {bikes} moto, registro ilimitado de mantenimiento y gastos, '
        'grabación ilimitada de rodadas, {ai} diagnóstico IA y {scans} escaneos de recibos '
        'al mes.'
    ),
    'es-419': (
        'Gratis para siempre incluye {bikes} moto, registro ilimitado de mantenimiento y '
        'gastos, grabación ilimitada de recorridos, {ai} diagnóstico con IA y {scans} '
        'escaneos de recibos por mes. MotoVault Pro agrega más motos, diagnósticos con IA '
        'ilimitados, escaneos ilimitados, estadísticas avanzadas, exportaciones GPX '
        'ilimitadas y más datos de tus recorridos.'
    ),
    'es-US': (
        'Gratis para siempre incluye {bikes} moto, registro ilimitado de mantenimiento y '
        'gastos, grabación ilimitada de recorridos, {ai} diagnóstico con IA y {scans} '
        'escaneos de recibos por mes. MotoVault Pro agrega más motos, diagnósticos con IA '
        'ilimitados, escaneos ilimitados, estadísticas avanzadas, exportaciones GPX '
        'ilimitadas y más datos de tus recorridos.'
    ),
    'it-IT': (
        'Gratis per sempre: {bikes} moto, gestione manutenzione e\n'
        'spese illimitata, registrazione delle uscite illimitata,\n'
        '{ai} diagnosi AI e {scans} scansioni di ricevute al mese.'
    ),
    'pt-BR': (
        'Grátis para sempre: {bikes} moto, registro de manutenção e\n'
        'gastos ilimitado, gravação de rolês ilimitada, {ai}\n'
        'diagnóstico IA e {scans} escaneamentos de recibos por mês.'
    ),
    'pt-PT': (
        'A versão gratuita inclui {bikes} mota, registo ilimitado de manutenção e despesas, '
        'gravação ilimitada de viagens, {ai} diagnóstico com IA e {scans} digitalizações de '
        'recibos por mês. O MotoVault Pro acrescenta mais motas, diagnósticos com IA '
        'ilimitados, digitalizações ilimitadas, estatísticas avançadas, exportações GPX '
        'ilimitadas e mais dados das viagens.'
    ),
    'ro': (
        'Gratuit pentru totdeauna include {bikes} motocicletă, jurnal nelimitat de '
        'întreținere și cheltuieli, înregistrare nelimitată a traseelor, {ai} diagnosticare '
        'AI și {scans} scanări de bonuri pe lună. MotoVault Pro adaugă mai multe '
        'motociclete, diagnosticări AI nelimitate, scanări nelimitate, statistici avansate, '
        'exporturi GPX nelimitate și date extinse despre trasee.'
    ),
    # --- Slavic -------------------------------------------------------------
    'cs-CZ': (
        'Zdarma navždy: {bikes} motorka, neomezený servisní zápis a výdaje, neomezený '
        'záznam jízd, {ai} AI diagnostika a {scans} skeny účtenek měsíčně. MotoVault Pro '
        'přidá další motorky, neomezené AI diagnostiky, neomezené skeny účtenek, podrobné '
        'statistiky, neomezený export GPX a rozšířené údaje o jízdách.'
    ),
    'sk': (
        'Zdarma navždy: {bikes} motorka, neobmedzený servisný záznam a výdavky, neobmedzený '
        'záznam jázd, {ai} AI diagnostika a {scans} skeny účteniek mesačne. MotoVault Pro '
        'pridá ďalšie motorky, neobmedzené AI diagnostiky, neobmedzené skeny účteniek, '
        'podrobné štatistiky, neobmedzený export GPX a rozšírené údaje o jazdách.'
    ),
    'pl-PL': (
        'Bezpłatnie na zawsze: {bikes} motocykl, nieograniczony rejestr serwisu i wydatków, '
        'nieograniczone zapisywanie tras, {ai} diagnostyka AI i {scans} skany paragonów '
        'miesięcznie.'
    ),
    'sl': (
        'Brezplačno za vedno: {bikes} motor, neomejen servisni dnevnik in stroški, '
        'neomejeno snemanje voženj, {ai} AI diagnostika in {scans} skeniranja računov na '
        'mesec. MotoVault Pro doda več motorjev, neomejene AI diagnostike, neomejena '
        'skeniranja, napredno statistiko, neomejen izvoz GPX in razširjene podatke o '
        'vožnjah.'
    ),
    'hr': (
        'Besplatno zauvijek uključuje {bikes} motocikl, neograničen servisni zapis i '
        'troškove, neograničeno snimanje vožnji, {ai} AI dijagnostiku i {scans} skeniranja '
        'računa mjesečno. MotoVault Pro dodaje više motocikala, neograničene AI '
        'dijagnostike, neograničena skeniranja, napredne statistike, neograničen GPX izvoz '
        'i dodatne podatke o vožnjama.'
    ),
    'sr': (
        'Бесплатно заувек: {bikes} мотоцикл, неограничен сервисни запис и трошкови, '
        'неограничено снимање вожњи, {ai} AI дијагностика и {scans} скенирања рачуна '
        'месечно. MotoVault Pro додаје још мотоцикала, неограничене AI дијагностике, '
        'неограничена скенирања, напредну статистику, неограничен GPX извоз и додатне '
        'податке о вожњама.'
    ),
    'mk-MK': (
        'Бесплатно засекогаш: {bikes} мотор, неограничен сервисен запис и трошоци, '
        'неограничено снимање возења, {ai} AI дијагностика и {scans} скенирања на фискални '
        'сметки месечно. MotoVault Pro додава повеќе мотори, неограничени AI дијагностики, '
        'неограничени скенирања, напредна статистика, неограничен GPX извоз и повеќе '
        'податоци за возењата.'
    ),
    'bg': (
        'Безплатно завинаги: {bikes} мотор, неограничен сервизен дневник и разходи, '
        'неограничен запис на пътувания, {ai} AI диагностика и {scans} сканирания на касови '
        'бележки на месец. MotoVault Pro добавя още мотори, неограничени AI диагностики, '
        'неограничени сканирания, разширена статистика, неограничен GPX експорт и повече '
        'данни за пътуванията.'
    ),
    'ru-RU': (
        'Бесплатно навсегда: {bikes} мотоцикл, неограниченный сервисный журнал и расходы, '
        'неограниченная запись поездок, {ai} AI-диагностика и {scans} сканирования чеков в '
        'месяц. MotoVault Pro добавляет больше мотоциклов, неограниченные AI-диагностики, '
        'неограниченные сканирования, расширенную статистику, неограниченный экспорт GPX и '
        'подробные данные поездок.'
    ),
    'uk': (
        'Безкоштовно назавжди: {bikes} мотоцикл, необмежений сервісний журнал і витрати, '
        'необмежений запис поїздок, {ai} AI-діагностика та {scans} сканування чеків на '
        'місяць. MotoVault Pro додає більше мотоциклів, необмежені AI-діагностики, '
        'необмежені сканування, розширену статистику, необмежений експорт GPX і докладніші '
        'дані поїздок.'
    ),
    # --- Baltic / Finno-Ugric ----------------------------------------------
    'lt': (
        'Nemokamai visada: {bikes} motociklas, neribota serviso ir išlaidų apskaita, '
        'neribotas važiavimų įrašymas, {ai} AI diagnostika ir {scans} kvitų nuskaitymai per '
        'mėnesį. MotoVault Pro suteikia daugiau motociklų, neribotas AI diagnostikas, '
        'neribotus nuskaitymus, išsamią statistiką, neribotą GPX eksportą ir platesnius '
        'važiavimų duomenis.'
    ),
    'lv': (
        'Bez maksas vienmēr: {bikes} motocikls, neierobežota servisa un izdevumu uzskaite, '
        'neierobežota braucienu ierakstīšana, {ai} AI diagnostika un {scans} kvīšu '
        'skenēšanas mēnesī. MotoVault Pro pievieno vairāk motociklu, neierobežotas AI '
        'diagnostikas, neierobežotu skenēšanu, detalizētu statistiku, neierobežotu GPX '
        'eksportu un plašākus braucienu datus.'
    ),
    'et': (
        'Tasuta igavesti: {bikes} ratas, piiramatu hooldus- ja kuluarvestus, piiramatu '
        'sõitude salvestamine, {ai} AI-diagnostika ja {scans} kviitungiskannimist kuus. '
        'MotoVault Pro lisab rohkem rattaid, piiramatud AI-diagnostikad, piiramatud '
        'skannimised, põhjaliku statistika, piiramatu GPX-ekspordi ja laiendatud '
        'sõiduandmed.'
    ),
    'hu-HU': (
        'Az ingyenes verzió {bikes} motort, korlátlan karbantartás- és költségnyilvántartást, '
        'korlátlan menetrögzítést, havi {ai} AI diagnosztikát és {scans} bizonylat-beolvasást '
        'tartalmaz. A MotoVault Pro további motorokat, korlátlan AI diagnosztikát, korlátlan '
        'beolvasást, részletes statisztikákat, korlátlan GPX exportot és bővített '
        'menetadatokat nyit meg.'
    ),
    # --- Greek / Turkish ----------------------------------------------------
    'el-GR': (
        'Δωρεάν για πάντα: {bikes} μοτοσυκλέτα, απεριόριστο ιστορικό σέρβις και εξόδων, '
        'απεριόριστη καταγραφή διαδρομών, {ai} διάγνωση AI και {scans} σαρώσεις αποδείξεων '
        'τον μήνα. Το MotoVault Pro προσθέτει περισσότερες μοτοσυκλέτες, απεριόριστες '
        'διαγνώσεις AI, απεριόριστες σαρώσεις, προηγμένα στατιστικά, απεριόριστες εξαγωγές '
        'GPX και εκτεταμένα δεδομένα διαδρομών.'
    ),
    'tr-TR': (
        'Sonsuza kadar ücretsiz: {bikes} motosiklet, sınırsız bakım ve masraf kaydı, '
        'sınırsız sürüş kaydı, ayda {ai} AI tanılama ve {scans} fiş taraması.'
    ),
    # --- Asian --------------------------------------------------------------
    'ja-JP': (
        '無料のままで、バイク{bikes}台、整備記録と費用管理は無制限、走行記録も無制限、AI診断が毎月{ai}回、'
        'レシートスキャンが毎月{scans}回使えます。MotoVault Proではバイクを追加でき、AI診断とレシート'
        'スキャンが無制限になり、詳細なライダー分析、GPXエクスポート無制限、拡張走行統計が使えます。'
    ),
    'ko-KR': (
        '무료로 계속 쓸 수 있습니다: 바이크 {bikes}대, 정비 기록과 지출 기록 무제한, 주행 기록 무제한, '
        '매월 AI 진단 {ai}회, 영수증 스캔 {scans}회. MotoVault Pro는 바이크 추가, 무제한 AI 진단, '
        '무제한 영수증 스캔, 상세 주행 분석, 무제한 GPX 내보내기, 확장 주행 통계를 제공합니다.'
    ),
    'zh-CN': (
        '永久免费包含：{bikes} 辆摩托车、不限次数的保养记录与费用记录、不限次数的骑行记录，'
        '以及每月 {ai} 次 AI 诊断和 {scans} 次收据扫描。MotoVault Pro 可添加更多摩托车，'
        '解锁不限次数的 AI 诊断和收据扫描、进阶骑行分析、不限次数的 GPX 导出和更详细的骑行统计。'
    ),
    'zh-TW': (
        '永久免費包含：{bikes} 輛機車、不限次數的保養紀錄與費用紀錄、不限次數的騎乘紀錄，'
        '以及每月 {ai} 次 AI 診斷和 {scans} 次收據掃描。MotoVault Pro 可新增更多機車，'
        '解鎖不限次數的 AI 診斷和收據掃描、進階騎乘分析、不限次數的 GPX 匯出與更詳細的騎乘統計。'
    ),
    'th': (
        'ฟรีตลอดไป: มอเตอร์ไซค์ {bikes} คัน บันทึกการซ่อมบำรุงและค่าใช้จ่ายไม่จำกัด '
        'บันทึกการขับขี่ไม่จำกัด วินิจฉัย AI {ai} ครั้งและสแกนใบเสร็จ {scans} ครั้งต่อเดือน'
    ),
    'vi': (
        'Miễn phí mãi mãi: {bikes} xe, ghi chép bảo dưỡng và chi phí không giới hạn, ghi '
        'hành trình không giới hạn, {ai} lần chẩn đoán AI và {scans} lần quét hóa đơn mỗi '
        'tháng. MotoVault Pro thêm nhiều xe hơn, chẩn đoán AI không giới hạn, quét không '
        'giới hạn, thống kê nâng cao, xuất GPX không giới hạn và dữ liệu hành trình mở rộng.'
    ),
    'id': (
        'Gratis selamanya: {bikes} motor di garasi Anda, pencatatan perawatan dan '
        'pengeluaran tanpa batas, perekaman perjalanan tanpa batas, {ai} diagnostik AI dan '
        '{scans} pemindaian struk per bulan.'
    ),
    'ms': (
        'Percuma selamanya: {bikes} motosikal, rekod penyelenggaraan dan perbelanjaan tanpa '
        'had, rakaman perjalanan tanpa had, {ai} diagnostik AI dan {scans} pengimbasan resit '
        'sebulan. MotoVault Pro menambah lebih banyak motosikal, diagnostik AI tanpa had, '
        'pengimbasan tanpa had, analitik lanjutan, eksport GPX tanpa had dan data perjalanan '
        'yang lebih lengkap.'
    ),
    'fil': (
        'Libre habambuhay: {bikes} motor, walang limitasyong maintenance at gastos record, '
        'walang limitasyong pagre-record ng ride, {ai} AI diagnostic at {scans} receipt scan '
        'kada buwan. Ang MotoVault Pro ay nagdadagdag ng mas maraming motor, walang '
        'limitasyong AI diagnostics, walang limitasyong scan, malalim na analytics, walang '
        'limitasyong GPX export at mas maraming datos ng ride.'
    ),
    'hi-IN': (
        'हमेशा मुफ्त: आपके गैराज में {bikes} बाइक, असीमित रखरखाव और खर्च रिकॉर्ड, असीमित राइड '
        'रिकॉर्डिंग, प्रति माह {ai} AI डायग्नोस्टिक और {scans} रसीद स्कैन।'
    ),
    'ar': (
        'المجاني للأبد يشمل {bikes} دراجة، وسجل صيانة ومصروفات غير محدود، وتسجيل رحلات غير '
        'محدود، و{ai} عملية تشخيص ذكي و{scans} عمليات مسح للفواتير شهريًا. ويمنحك MotoVault '
        'Pro دراجات إضافية وتشخيصًا ذكيًا غير محدود ومسحًا غير محدود للفواتير وتحليلات متقدمة '
        'وتصدير GPX غير محدود وإحصاءات رحلات موسّعة.'
    ),
}

# ---------------------------------------------------------------------------
# Backstop vocabulary.
#
# These lists exist only to FIND candidate sentences for human review, never to
# decide whether one is acceptable. Missing a word here weakens the net; adding a
# wrong one costs one allowlist line. So they are deliberately over-inclusive.
# ---------------------------------------------------------------------------
UNLIMITED_WORDS = (
    r'unlimited|unbegrenzt\w*|illimit\w*|ilimitad\w*|illimitat\w*|onbeperkt\w*'
    r'|ubegrenset\w*|ubegrensede|ubegr[æa]nset\w*|obegr[äa]nsa\w*|rajato\w*|rajatt\w*'
    r'|rajaton|piiramatu\w*|neierobežot\w*|nerib\w*|nieograniczon\w*|neomezen\w*'
    r'|neobmedzen\w*|neomejen\w*|neograničen\w*|неограничен\w*|необмежен\w*'
    r'|nelimitat\w*|korlátlan\w*|απεριόριστ\w*|sınırsız|غير محدود|無制限|무제한'
    r'|不限|无限|無限|ไม่จำกัด|không giới hạn|tanpa batas|tak terbatas|tanpa had'
    r'|walang limitasyon|असीमित'
)
BIKE_WORDS = (
    r'bike|bikes|motorcycle\w*|Motorrad|Motorräder|moto|motos|motocicl\w*|motorcykl\w*'
    r'|motorcykel|motorsykl\w*|motorsykkel|motoren|motorje\w*|motorok|motort|motorka|motorky'
    r'|motoriek|motorki|motocykl\w*|pyöri\w*|pyörä|ratta\w*|ratas|motociklų|motociklu'
    r'|motociklas|motocikls|motocikala|мотоцикл\w*|мотори|мотор|バイク|바이크|摩托车|機車'
    r'|มอเตอร์ไซค์|xe|motosikal|motor|دراج\w*|मोटरसाइकिल|मोटरसाइकिलें|बाइक|mota|motas'
)
UNLIMITED_RX = re.compile(UNLIMITED_WORDS, re.IGNORECASE)
BIKE_RX = re.compile(BIKE_WORDS, re.IGNORECASE)

# Sentence-ish splitter. Covers Latin terminators plus the CJK/Devanagari ones,
# and the bullet/newline boundaries these descriptions actually use — several
# locales put each claim on its own line with no terminator at all.
SENTENCE_SPLIT = re.compile(r'(?<=[.!?。！？।])\s+|\n')


def _normalize(text):
    """Collapse whitespace so a re-wrap does not invalidate an allowlist entry."""
    return re.sub(r'\s+', ' ', text).strip()


def claim_hash(text):
    """Stable short hash of a normalized sentence, used as the allowlist key."""
    return hashlib.sha256(_normalize(text).encode('utf-8')).hexdigest()[:12]


# ---------------------------------------------------------------------------
# ACKNOWLEDGED_CLAIMS — every sentence outside the canonical block that pairs an
# "unlimited" word with a "bike" word, reviewed and accepted.
#
# Keyed by locale, then by claim_hash(sentence), with a note recording WHY it is
# acceptable. An unlisted match fails the gate; that is the point. If you edit one
# of these sentences the hash changes and CI will ask you to re-acknowledge it.
#
# Regenerate the hashes for a locale with:
#   python3 store/play/free_tier_claims.py --list-unacknowledged
# ---------------------------------------------------------------------------
ACKNOWLEDGED_CLAIMS = {
    # These three locales use an older description template whose "MOTOVAULT PRO"
    # section lists unlimited motorcycles as a Pro benefit. That is correct — Pro
    # really does lift MAX_BIKES — and the sentence sits under a Pro heading, so
    # the "unlimited" and the bike word co-occur legitimately. Reviewed 2026-08-24.
    'fr-FR': {
        '7d998b20f231': 'Pro benefit, under the MOTOVAULT PRO heading — correct.',
    },
    'hi-IN': {
        'af20fe7a730a': 'Pro benefit, under the MOTOVAULT PRO heading — correct.',
    },
    'id': {
        '6176b52de3c8': 'Pro benefit, under the MOTOVAULT PRO heading — correct.',
    },
    # NOTE: pt-PT is deliberately absent. This check found a false free-tier bullet
    # there ("Motas ilimitadas … sempre grátis") that a hand survey had missed
    # because its bike word was "motas". It was rewritten rather than acknowledged.
}


def render_block(locale, limits):
    """The exact free-tier text required in `locale`, numbers from limits.ts."""
    template = FREE_TIER_BLOCKS.get(locale)
    if template is None:
        return None
    values = {name: limits[const] for name, const in PLACEHOLDERS.items()}
    return template.format(**values)


def authored_for_problems(limits):
    """Fatal mismatch between the copy's assumptions and the real constants."""
    problems = []
    for key, authored in sorted(AUTHORED_FOR.items()):
        actual = limits.get(key)
        if actual is None:
            problems.append(
                f'limits.ts: could not read {key} — the store-copy guard cannot verify '
                'free-tier claims without it'
            )
        elif actual != authored:
            problems.append(
                f'limits.ts {key} is now {actual} but the store copy was authored for '
                f'{authored}. Do NOT just bump AUTHORED_FOR: {len(FREE_TIER_BLOCKS)} '
                'locale sentences state this number in prose that inflects by quantity, '
                'so they must be re-authored (and re-reviewed) first, then AUTHORED_FOR '
                'updated to match.'
            )
    return problems


def free_tier_problems(locale, full_description, limits):
    """Both checks for one locale. Returns a list of human-readable problems."""
    problems = []
    block = render_block(locale, limits)
    if block is None:
        problems.append(
            f'{locale}: no free-tier block defined in free_tier_claims.py — every locale '
            'must state what the free tier actually includes'
        )
        return problems

    # Check 1 — the generated claim must be present verbatim.
    if block not in full_description:
        problems.append(
            f'{locale}: the canonical free-tier sentence is missing or altered. Expected '
            f'verbatim:\n      {_normalize(block)[:300]}'
        )

    # Check 2 — anything else pairing "unlimited" with a bike word needs signing off.
    remainder = full_description.replace(block, ' ')
    acknowledged = ACKNOWLEDGED_CLAIMS.get(locale, {})
    for sentence in SENTENCE_SPLIT.split(remainder):
        if not sentence.strip():
            continue
        if UNLIMITED_RX.search(sentence) and BIKE_RX.search(sentence):
            digest = claim_hash(sentence)
            if digest not in acknowledged:
                problems.append(
                    f'{locale}: unreviewed "unlimited"+bike claim outside the free-tier '
                    f'block. If it describes Pro it is fine — add {digest!r} to '
                    f'ACKNOWLEDGED_CLAIMS[{locale!r}] with a note. If it describes the '
                    f'free tier it is false and must be rewritten.\n'
                    f'      {_normalize(sentence)[:220]}'
                )
    return problems


# ---------------------------------------------------------------------------
# Self-test. Runs before the gate trusts itself, mirroring the discipline already
# in check-metadata.py: a guard whose own logic is untested is a guard that
# reports success for the wrong reason.
# ---------------------------------------------------------------------------
def self_test():
    problems = []
    fake_limits = {'MAX_BIKES': 1, 'MAX_AI_DIAGNOSTICS_PER_MONTH': 1,
                   'MAX_RECEIPT_SCANS_PER_MONTH': 3}

    # Numbers must come from the constants, not be hardcoded in the template.
    en = render_block('en-US', fake_limits)
    if '1 bike' not in en or '3 receipt' not in en:
        problems.append('render_block did not substitute the limits into en-US')
    bumped = render_block('en-US', {'MAX_BIKES': 9, 'MAX_AI_DIAGNOSTICS_PER_MONTH': 1,
                                    'MAX_RECEIPT_SCANS_PER_MONTH': 3})
    if '9 bike' not in bumped:
        problems.append('render_block ignores a changed MAX_BIKES')

    # No template may hardcode a free-tier numeral instead of a placeholder.
    for locale, template in FREE_TIER_BLOCKS.items():
        for name in PLACEHOLDERS:
            if '{' + name + '}' not in template:
                problems.append(
                    f'{locale}: free-tier block omits {{{name}}} — the number would not be '
                    'sourced from limits.ts'
                )

    # The tripwire must fire on a changed constant.
    if not authored_for_problems({'MAX_BIKES': 2, 'MAX_AI_DIAGNOSTICS_PER_MONTH': 1,
                                  'MAX_RECEIPT_SCANS_PER_MONTH': 3}):
        problems.append('authored_for_problems accepted a constant it was not authored for')
    if authored_for_problems(fake_limits):
        problems.append('authored_for_problems rejected the authored-for values')

    # Check 1 must fail on the exact regression this guard exists to stop, and the
    # reverted text must not be rescued by check 2.
    reverted = ('BUILT FOR RIDERS\n\nFree forever includes unlimited bikes, full '
                'maintenance tracking, expense logging, ride recording, and 5 AI '
                'diagnostic scans per month.')
    if not free_tier_problems('en-US', reverted, fake_limits):
        problems.append('a locale reverted to "unlimited bikes / 5 AI scans" passed the gate')

    # A truthful locale must pass cleanly.
    truthful = f'INTRO\n\n{en}\n\nMore text.'
    if free_tier_problems('en-US', truthful, fake_limits):
        problems.append('a locale carrying the correct rendered block failed the gate')

    # Check 2 must catch a false claim added somewhere else in the file, and must
    # accept it once acknowledged.
    second_site = f'{en}\n\n- Unlimited bikes, free forever\n'
    found = free_tier_problems('en-US', second_site, fake_limits)
    if not any('unreviewed' in p for p in found):
        problems.append('check 2 missed an "unlimited bikes" claim outside the block')
    digest = claim_hash('- Unlimited bikes, free forever')
    ACKNOWLEDGED_CLAIMS.setdefault('__selftest__', {})[digest] = 'fixture'
    saved = ACKNOWLEDGED_CLAIMS.get('en-US')
    ACKNOWLEDGED_CLAIMS['en-US'] = {digest: 'fixture'}
    try:
        if any('unreviewed' in p for p in free_tier_problems('en-US', second_site, fake_limits)):
            problems.append('check 2 ignored an acknowledged claim')
    finally:
        if saved is None:
            ACKNOWLEDGED_CLAIMS.pop('en-US', None)
        else:
            ACKNOWLEDGED_CLAIMS['en-US'] = saved
        ACKNOWLEDGED_CLAIMS.pop('__selftest__', None)

    # Whitespace-only reflow must not invalidate an acknowledgement.
    if claim_hash('a  b\nc') != claim_hash('a b c'):
        problems.append('claim_hash is sensitive to whitespace, so re-wrapping breaks the allowlist')

    return problems


def _list_unacknowledged():
    """Developer helper: print the hash and text of every unreviewed claim."""
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'metadata')
    limits = read_limits()
    for locale in sorted(os.listdir(base)):
        path = os.path.join(base, locale, 'full_description.txt')
        if not os.path.exists(path):
            continue
        text = open(path, encoding='utf-8').read()
        block = render_block(locale, limits)
        remainder = text.replace(block, ' ') if block else text
        for sentence in SENTENCE_SPLIT.split(remainder):
            if sentence.strip() and UNLIMITED_RX.search(sentence) and BIKE_RX.search(sentence):
                digest = claim_hash(sentence)
                if digest not in ACKNOWLEDGED_CLAIMS.get(locale, {}):
                    print(f"{locale}\n    '{digest}': '',  # {_normalize(sentence)[:160]}")


if __name__ == '__main__':
    import sys
    if '--list-unacknowledged' in sys.argv:
        _list_unacknowledged()
    else:
        failures = self_test()
        print(f'free-tier guard self-test: {len(failures)} failures')
        for failure in failures:
            print(' -', failure)
        sys.exit(1 if failures else 0)
