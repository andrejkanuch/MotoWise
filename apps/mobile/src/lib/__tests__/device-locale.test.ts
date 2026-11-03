import { resolveSupportedLocale } from '../device-locale';

describe('resolveSupportedLocale', () => {
  it('gives a Brazilian or Portuguese phone the pt-BR UI, not English', () => {
    expect(resolveSupportedLocale([{ languageTag: 'pt-BR', languageCode: 'pt' }])).toBe('pt-BR');
    expect(resolveSupportedLocale([{ languageTag: 'pt-PT', languageCode: 'pt' }])).toBe('pt-BR');
    expect(resolveSupportedLocale([{ languageCode: 'pt' }])).toBe('pt-BR');
  });

  it('matches bare languages and regional tags of shipped languages', () => {
    expect(resolveSupportedLocale([{ languageTag: 'es-MX', languageCode: 'es' }])).toBe('es');
    expect(resolveSupportedLocale([{ languageTag: 'de-AT', languageCode: 'de' }])).toBe('de');
    expect(resolveSupportedLocale([{ languageTag: 'en-GB', languageCode: 'en' }])).toBe('en');
  });

  it('walks the preference list and falls back to English', () => {
    expect(
      resolveSupportedLocale([
        { languageTag: 'ca-ES', languageCode: 'ca' },
        { languageTag: 'fr-CA', languageCode: 'fr' },
      ]),
    ).toBe('fr');
    expect(resolveSupportedLocale([{ languageTag: 'ko-KR', languageCode: 'ko' }])).toBe('en');
    expect(resolveSupportedLocale([])).toBe('en');
  });
});
