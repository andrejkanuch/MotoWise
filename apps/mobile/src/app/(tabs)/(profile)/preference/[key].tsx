import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';
import {
  APP_PREFERENCE_KEY,
  type AppPreferenceKey,
} from '../../../../components/profile/constants';
import { useAppPreferences } from '../../../../components/profile/use-app-preferences';
import { EOptionRow, ESettingsGroup } from '../../../../components/ui/editorial';
import { useEditorialTheme } from '../../../../theme/editorial';
import { GUTTER, space } from '../../../../theme/type';

const KEYS = Object.values(APP_PREFERENCE_KEY) as readonly string[];

function isPreferenceKey(value: string | undefined): value is AppPreferenceKey {
  return value !== undefined && KEYS.includes(value);
}

/** Single-choice list for one app setting; a pick applies at once and goes back. */
export default function PreferenceScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { t: theme } = useEditorialTheme();
  const preferences = useAppPreferences();
  const preference = isPreferenceKey(key) ? preferences[key] : preferences.language;

  return (
    <>
      <Stack.Screen options={{ title: preference.title }} />
      <ScrollView
        testID={`preference-${key}`}
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingTop: space.md,
          paddingBottom: space.xxxl,
        }}
      >
        <ESettingsGroup>
          {preference.options.map((option) => (
            <EOptionRow
              key={option.value}
              testID={`preference-option-${option.value}`}
              title={option.label}
              subtitle={option.subtitle}
              selected={option.value === preference.selected}
              onPress={() => {
                if (option.value !== preference.selected) preference.select(option.value);
                router.back();
              }}
            />
          ))}
        </ESettingsGroup>
      </ScrollView>
    </>
  );
}
