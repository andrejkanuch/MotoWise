// MOT-278: localized copy for the server-sent maintenance-due push. The API can't
// use the mobile i18n bundles, so mirror the strings here keyed by the 13 supported
// locales, with `en` as the fallback for absent/unknown locales. Body interpolates
// the task title. Warm + factual tone, matching the rest of the app (no gamification).
// #365 T07a (D7): `combinedBody` is the one push per bike when several tasks fall due
// on the same day; it names the count and the bike.

export interface MaintenancePushCopy {
  title: string;
  body: (taskTitle: string) => string;
  combinedBody: (count: number, bikeName: string) => string;
}

export const DEFAULT_PUSH_LOCALE = 'en';

const COPY = {
  en: {
    title: 'Maintenance due soon',
    body: (t: string) => `${t} is due soon. Tap to review.`,
    combinedBody: (n: number, b: string) => `${n} services due on your ${b}. Tap to review.`,
  },
  de: {
    title: 'Wartung steht an',
    body: (t: string) => `${t} ist bald fällig. Zum Ansehen tippen.`,
    combinedBody: (n: number, b: string) =>
      `${n} Wartungen an deiner ${b} sind bald fällig. Zum Ansehen tippen.`,
  },
  es: {
    title: 'Mantenimiento próximo',
    body: (t: string) => `${t} vence pronto. Toca para revisar.`,
    combinedBody: (n: number, b: string) =>
      `${n} servicios de tu ${b} vencen pronto. Toca para revisar.`,
  },
  fr: {
    title: 'Entretien à prévoir',
    body: (t: string) => `${t} arrive à échéance. Touchez pour vérifier.`,
    combinedBody: (n: number, b: string) =>
      `${n} entretiens à prévoir sur votre ${b}. Touchez pour vérifier.`,
  },
  it: {
    title: 'Manutenzione in arrivo',
    body: (t: string) => `${t} è in scadenza. Tocca per controllare.`,
    combinedBody: (n: number, b: string) =>
      `${n} interventi in scadenza sulla tua ${b}. Tocca per controllare.`,
  },
  pl: {
    title: 'Zbliża się przegląd',
    body: (t: string) => `Zbliża się termin: ${t}. Dotknij, aby sprawdzić.`,
    combinedBody: (n: number, b: string) =>
      `Zbliża się termin czynności serwisowych (${n}) dla ${b}. Dotknij, aby sprawdzić.`,
  },
  'pt-br': {
    title: 'Manutenção em breve',
    body: (t: string) => `${t} está próxima do prazo. Toque para revisar.`,
    combinedBody: (n: number, b: string) =>
      `${n} serviços da sua ${b} estão próximos do prazo. Toque para revisar.`,
  },
  sk: {
    title: 'Blíži sa údržba',
    body: (t: string) => `Blíži sa termín: ${t}. Ťuknite na zobrazenie.`,
    combinedBody: (n: number, b: string) =>
      `Blíži sa termín servisných úkonov (${n}) pre ${b}. Ťuknite na zobrazenie.`,
  },
  ja: {
    title: 'メンテナンス時期です',
    body: (t: string) => `${t}の時期が近づいています。タップして確認。`,
    combinedBody: (n: number, b: string) =>
      `${b}のメンテナンス${n}件の時期が近づいています。タップして確認。`,
  },
  tr: {
    title: 'Bakım zamanı yaklaşıyor',
    body: (t: string) => `${t} yakında geliyor. İncelemek için dokun.`,
    combinedBody: (n: number, b: string) =>
      `${b} için ${n} bakım işlemi yaklaşıyor. İncelemek için dokun.`,
  },
  id: {
    title: 'Perawatan akan jatuh tempo',
    body: (t: string) => `${t} akan jatuh tempo. Ketuk untuk meninjau.`,
    combinedBody: (n: number, b: string) =>
      `${n} servis untuk ${b} akan jatuh tempo. Ketuk untuk meninjau.`,
  },
  hi: {
    title: 'रखरखाव जल्द ही देय',
    body: (t: string) => `${t} जल्द ही देय है। समीक्षा के लिए टैप करें।`,
    combinedBody: (n: number, b: string) =>
      `आपकी ${b} की ${n} सर्विस जल्द ही देय हैं। समीक्षा के लिए टैप करें।`,
  },
  th: {
    title: 'ใกล้ถึงกำหนดบำรุงรักษา',
    body: (t: string) => `${t} ใกล้ถึงกำหนดแล้ว แตะเพื่อตรวจสอบ`,
    combinedBody: (n: number, b: string) =>
      `${b} มีรายการบำรุงรักษา ${n} รายการใกล้ถึงกำหนด แตะเพื่อตรวจสอบ`,
  },
} as const satisfies Record<string, MaintenancePushCopy>;

type SupportedLocale = keyof typeof COPY;

/**
 * Resolve maintenance-push copy for a user's stored locale. Robust to device-style
 * locales (`en_US`, `pt_BR`) and unknown values: normalizes separators, tries an
 * exact match, then the base language, then falls back to English.
 */
export function resolveMaintenancePushCopy(locale: string | null | undefined): MaintenancePushCopy {
  if (!locale) return COPY[DEFAULT_PUSH_LOCALE];

  // Lowercase so device-style locales resolve regardless of case (pt-BR, pt-br, pt_BR).
  const normalized = locale.replace('_', '-').toLowerCase();
  if (normalized in COPY) return COPY[normalized as SupportedLocale];

  const base = normalized.split('-')[0]?.toLowerCase();
  if (base && base in COPY) return COPY[base as SupportedLocale];

  return COPY[DEFAULT_PUSH_LOCALE];
}
