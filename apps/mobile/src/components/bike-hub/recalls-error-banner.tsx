import { Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { GRAPHQL_ERROR_CODE } from '../../lib/graphql-error-classification';
import { hasGraphQLCode } from '../../lib/graphql-errors';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { space } from '../../theme/spacing';
import { radius, type } from '../../theme/type';

/**
 * The bike lacks what a recall lookup needs (model and year, or a VIN). Not a
 * failure: a calm, neutral prompt to fill the bike in, never the danger banner.
 */
export function RecallsNeedsDetailsNotice() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  return (
    <View
      testID="recalls-needs-details"
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.line,
        padding: space.md,
        borderRadius: radius.control,
        borderCurve: 'continuous',
        flexDirection: 'row',
        gap: space.sm,
        alignItems: 'flex-start',
      }}
    >
      <Info size={20} color={theme.ink3} strokeWidth={2} />
      <Text style={{ ...type.body, color: theme.ink2, flex: 1 }}>
        {t('recalls.needsDetails', {
          defaultValue: "Add your bike's model and year (or VIN) to check for recalls.",
        })}
      </Text>
    </View>
  );
}

/**
 * Why the recall lookup failed. The API answers 422 when the bike has no
 * model/year and no decodable VIN: nothing to retry, the rider has to fill in
 * the bike first. Anything else is an upstream failure worth retrying.
 */
export function RecallsErrorBanner({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  if (hasGraphQLCode(error, GRAPHQL_ERROR_CODE.UNPROCESSABLE_ENTITY)) {
    return <RecallsNeedsDetailsNotice />;
  }

  return (
    <View
      style={{
        backgroundColor: tint(theme.danger, 0.12),
        padding: space.md,
        borderRadius: radius.control,
        borderCurve: 'continuous',
      }}
    >
      <Text style={{ ...type.bodyStrong, color: theme.overdueInk }}>
        {t('recalls.error', {
          defaultValue: 'Could not reach the NHTSA database. Please try again.',
        })}
      </Text>
    </View>
  );
}
