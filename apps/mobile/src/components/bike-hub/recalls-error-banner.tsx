import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { GRAPHQL_ERROR_CODE } from '../../lib/graphql-error-classification';
import { hasGraphQLCode } from '../../lib/graphql-errors';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';

/**
 * Why the recall lookup failed. The API answers 422 when the bike has no
 * model/year and no decodable VIN: nothing to retry, the rider has to fill in
 * the bike first. Anything else is an upstream failure worth retrying.
 */
export function RecallsErrorBanner({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const needsBikeDetails = hasGraphQLCode(error, GRAPHQL_ERROR_CODE.UNPROCESSABLE_ENTITY);

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
        {needsBikeDetails
          ? t('recalls.needsDetails', {
              defaultValue: "Add your bike's model and year (or VIN) to check for recalls.",
            })
          : t('recalls.error', {
              defaultValue: 'Could not reach the NHTSA database. Please try again.',
            })}
      </Text>
    </View>
  );
}
