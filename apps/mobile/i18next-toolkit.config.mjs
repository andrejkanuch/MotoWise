/** @type {import('i18next-cli').I18nextToolkitConfig} */
export default {
  locales: ['en', 'es', 'de', 'fr', 'it', 'pt-BR', 'ja', 'hi', 'th', 'id', 'tr', 'pl', 'sk'],
  extract: {
    input: ['src/**/*.{ts,tsx}'],
    output: 'src/i18n/locales/{{language}}.json',
    primaryLanguage: 'en',
    secondaryLanguages: ['es', 'de', 'fr', 'it', 'pt-BR', 'ja', 'hi', 'th', 'id', 'tr', 'pl', 'sk'],
    defaultValue: '',
  },
  lint: {
    ignoredTags: ['pre', 'code', 'script'],
    ignoredAttributes: ['data-testid', 'className', 'style', 'accessibilityLabel'],
    checkInterpolationParams: true,
    ignore: ['**/*.test.tsx', '**/mocks/**'],
  },
};
