// The plugin removes the resource filter expo-localization adds for
// `supportedLocales`; see the header of with-all-locale-resources.js for why.
const { AndroidConfig } = require('expo/config-plugins');
const { stripLocaleResourceFilter } = require('../with-all-locale-resources');

const GRADLE = `android {
    defaultConfig {
        applicationId 'app.motovault'
        versionCode 120
    }
}
`;

// Writes the line exactly the way expo-localization's plugin does.
const withLocalizationFilter = (contents, qualifiers) =>
  AndroidConfig.CodeMod.appendContentsInsideDeclarationBlock(
    contents,
    'defaultConfig',
    `    resourceConfigurations += [${qualifiers.map((q) => `"${q}"`).join(', ')}]\n    `,
  );

it('removes the resourceConfigurations line expo-localization writes', () => {
  const gradle = withLocalizationFilter(GRADLE, ['b+en', 'b+es', 'b+pt+BR', 'b+id']);
  expect(gradle).toContain('resourceConfigurations');
  const stripped = stripLocaleResourceFilter(gradle);
  expect(stripped).not.toContain('resourceConfigurations');
  expect(stripped).toContain("applicationId 'app.motovault'");
  expect(stripped).toContain('versionCode 120');
});

it('leaves a build.gradle without the filter unchanged', () => {
  expect(stripLocaleResourceFilter(GRADLE)).toBe(GRADLE);
});

it('keeps a resourceConfigurations line that is not a locale filter', () => {
  const custom = GRADLE.replace(
    'versionCode 120',
    'versionCode 120\n        resourceConfigurations += ["xxhdpi"]',
  );
  expect(stripLocaleResourceFilter(custom)).toBe(custom);
});
