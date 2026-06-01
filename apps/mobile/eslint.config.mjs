// i18n-ONLY ESLint config.
//
// The repo standardizes on Biome for all general linting + formatting (see CLAUDE.md).
// ESLint is intentionally scoped here to a SINGLE concern Biome cannot cover:
// detecting hard-coded, untranslated UI strings in React Native JSX
// (e.g. `<Text>Save</Text>` instead of `<Text>{t('save')}</Text>`).
//
// - i18next-cli's linter only understands web/DOM JSX (<p>, <button>) and silently
//   ignores capitalized RN components like <Text>, so it cannot guard this codebase.
// - Biome has no equivalent rule.
// - eslint-plugin-i18next/no-literal-string DOES understand RN components.
//
// Do NOT extend any general ESLint rule sets here — that would overlap/fight Biome.
// This file enables exactly one rule.
import i18next from 'eslint-plugin-i18next';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/**/*.test.{ts,tsx}',
      'src/**/__tests__/**',
      'src/**/__mocks__/**',
      'src/**/mocks/**',
      'src/i18n/**', // locale files + i18n init are not display surfaces
      'src/**/*.d.ts',
    ],
    plugins: { i18next },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // jsx-text-only = flag literal text rendered as JSX children (the highest-signal,
      // lowest-false-positive case). Escalate to 'jsx-only' (adds attributes like
      // placeholder/accessibilityLabel) or 'all' (adds JS string args, e.g. Alert.alert)
      // once the backlog is clean — see the excludes you'll likely need below.
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-text-only',
          // Components whose string children are NOT user-facing copy.
          // <Trans> is excluded by default; add icon/data/mono components as needed.
          'jsx-components': { exclude: ['Trans'] },
        },
      ],
    },
  },
];
