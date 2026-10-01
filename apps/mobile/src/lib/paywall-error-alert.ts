// Shown when a paywall the rider asked for could not be presented. Without it an
// upgrade tap that fails looks like a dead button, and the rider taps it again and
// again (98 `paywall_result: error` events from three Android users at one gate).
import { Alert } from 'react-native';
import i18n from '../i18n';

export function showPaywallUnavailable(): void {
  Alert.alert(i18n.t('paywall.unavailableTitle'), i18n.t('paywall.unavailableMessage'));
}
