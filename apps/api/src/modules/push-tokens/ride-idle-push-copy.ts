// Localized copy for the idle-ride sweep. Same constraint as the maintenance
// push: the API can't read the mobile i18n bundles, so the 13 supported locales
// are mirrored here with `en` as the fallback.
//
// Two stages, deliberately different in tone:
//   * nudge   — a question, not an instruction. The rider may genuinely still be
//               out (a long lunch, a ferry), so it must never imply we know best.
//   * ended   — a statement of what we already did, and the reassurance that
//               matters most to someone who just lost control of their data:
//               the ride was SAVED, trimmed to where the GPS actually stopped.

export interface RideIdlePushCopy {
  nudgeTitle: string;
  /** `hours` = whole hours since the last GPS signal. */
  nudgeBody: (hours: number) => string;
  endedTitle: string;
  endedBody: string;
}

export const DEFAULT_RIDE_IDLE_LOCALE = 'en';

const COPY = {
  en: {
    nudgeTitle: 'Still riding?',
    nudgeBody: (h: number) =>
      `Your ride is still recording but hasn't moved in ${h}h. Tap to stop and save it.`,
    endedTitle: 'Ride saved',
    endedBody:
      "We stopped your ride where the GPS did — it's saved with the right distance and time.",
  },
  de: {
    nudgeTitle: 'Noch unterwegs?',
    nudgeBody: (h: number) =>
      `Deine Fahrt zeichnet noch auf, hat sich aber seit ${h} Std. nicht bewegt. Zum Beenden tippen.`,
    endedTitle: 'Fahrt gespeichert',
    endedBody:
      'Wir haben deine Fahrt dort beendet, wo das GPS endete — mit korrekter Strecke und Zeit gespeichert.',
  },
  es: {
    nudgeTitle: '¿Sigues rodando?',
    nudgeBody: (h: number) =>
      `Tu ruta sigue grabando pero no se ha movido en ${h} h. Toca para detenerla y guardarla.`,
    endedTitle: 'Ruta guardada',
    endedBody:
      'Detuvimos tu ruta donde se detuvo el GPS: se guardó con la distancia y el tiempo correctos.',
  },
  fr: {
    nudgeTitle: 'Toujours en route ?',
    nudgeBody: (h: number) =>
      `Ton trajet enregistre encore mais n'a pas bougé depuis ${h} h. Touche pour l'arrêter et l'enregistrer.`,
    endedTitle: 'Trajet enregistré',
    endedBody:
      "Nous avons arrêté ton trajet là où le GPS s'est arrêté — enregistré avec la bonne distance et durée.",
  },
  it: {
    nudgeTitle: 'Ancora in viaggio?',
    nudgeBody: (h: number) =>
      `Il tuo giro sta ancora registrando ma non si muove da ${h} h. Tocca per fermarlo e salvarlo.`,
    endedTitle: 'Giro salvato',
    endedBody:
      'Abbiamo fermato il giro dove si è fermato il GPS — salvato con distanza e tempo corretti.',
  },
  pl: {
    nudgeTitle: 'Nadal jedziesz?',
    nudgeBody: (h: number) =>
      `Twoja trasa nadal się nagrywa, ale nie ruszyła się od ${h} godz. Dotknij, aby zakończyć i zapisać.`,
    endedTitle: 'Trasa zapisana',
    endedBody:
      'Zakończyliśmy trasę tam, gdzie skończył się GPS — zapisana z prawidłowym dystansem i czasem.',
  },
  'pt-br': {
    nudgeTitle: 'Ainda pilotando?',
    nudgeBody: (h: number) =>
      `Sua pilotagem ainda está gravando, mas não se move há ${h} h. Toque para parar e salvar.`,
    endedTitle: 'Pilotagem salva',
    endedBody: 'Paramos sua pilotagem onde o GPS parou — salva com a distância e o tempo corretos.',
  },
  sk: {
    nudgeTitle: 'Stále na cestách?',
    nudgeBody: (h: number) =>
      `Tvoja jazda sa stále nahráva, ale nepohnula sa už ${h} h. Ťuknutím ju ukončíš a uložíš.`,
    endedTitle: 'Jazda uložená',
    endedBody:
      'Ukončili sme tvoju jazdu tam, kde skončilo GPS — uložená so správnou vzdialenosťou a časom.',
  },
  ja: {
    nudgeTitle: 'まだ走行中ですか？',
    nudgeBody: (h: number) =>
      `ライドは記録中ですが、${h}時間動いていません。タップして停止・保存できます。`,
    endedTitle: 'ライドを保存しました',
    endedBody: 'GPSが止まった時点でライドを終了しました。距離と時間は正しく保存されています。',
  },
  tr: {
    nudgeTitle: 'Hâlâ yolda mısın?',
    nudgeBody: (h: number) =>
      `Sürüşün hâlâ kaydediyor ama ${h} saattir hareket etmedi. Durdurup kaydetmek için dokun.`,
    endedTitle: 'Sürüş kaydedildi',
    endedBody: 'Sürüşünü GPS’in durduğu yerde bitirdik — doğru mesafe ve süreyle kaydedildi.',
  },
  id: {
    nudgeTitle: 'Masih berkendara?',
    nudgeBody: (h: number) =>
      `Perjalananmu masih merekam tetapi tidak bergerak selama ${h} jam. Ketuk untuk menghentikan dan menyimpannya.`,
    endedTitle: 'Perjalanan disimpan',
    endedBody:
      'Kami menghentikan perjalananmu di tempat GPS berhenti — tersimpan dengan jarak dan waktu yang benar.',
  },
  hi: {
    nudgeTitle: 'अभी भी राइड पर हैं?',
    nudgeBody: (h: number) =>
      `आपकी राइड रिकॉर्ड हो रही है लेकिन ${h} घंटे से नहीं चली। रोकने और सेव करने के लिए टैप करें।`,
    endedTitle: 'राइड सेव हो गई',
    endedBody: 'हमने आपकी राइड वहीं समाप्त कर दी जहाँ GPS रुका था — सही दूरी और समय के साथ सेव है।',
  },
  th: {
    nudgeTitle: 'ยังขี่อยู่ไหม?',
    nudgeBody: (h: number) => `การขี่ของคุณยังบันทึกอยู่แต่ไม่ขยับมา ${h} ชม. แตะเพื่อหยุดและบันทึก`,
    endedTitle: 'บันทึกการขี่แล้ว',
    endedBody: 'เราหยุดการขี่ของคุณตรงจุดที่ GPS หยุด — บันทึกด้วยระยะทางและเวลาที่ถูกต้อง',
  },
} as const satisfies Record<string, RideIdlePushCopy>;

type SupportedLocale = keyof typeof COPY;

/**
 * Resolve idle-ride copy for a user's stored locale. Same normalization as
 * `resolveMaintenancePushCopy`: tolerant of device-style locales (`en_US`,
 * `pt_BR`), falls back to the base language, then to English.
 */
export function resolveRideIdlePushCopy(locale: string | null | undefined): RideIdlePushCopy {
  if (!locale) return COPY[DEFAULT_RIDE_IDLE_LOCALE];

  const normalized = locale.replace('_', '-').toLowerCase();
  if (normalized in COPY) return COPY[normalized as SupportedLocale];

  const base = normalized.split('-')[0]?.toLowerCase();
  if (base && base in COPY) return COPY[base as SupportedLocale];

  return COPY[DEFAULT_RIDE_IDLE_LOCALE];
}
