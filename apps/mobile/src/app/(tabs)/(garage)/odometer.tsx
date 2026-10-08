import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { OdometerSheet } from '../../../components/bike-hub/sheets/odometer-sheet';
import { useDiscardReadingGuard } from '../../../components/bike-hub/sheets/use-log-odometer';
import { useHubBike } from '../../../components/bike-hub/shell/use-hub-bike';
import { refreshToday } from '../../../components/bike-hub/shell/use-today';
import { hub } from '../../../components/bike-hub/ui/tokens';

const PLACEHOLDER_HEIGHT = 240;

/**
 * Odometer sheet route (formSheet, fit to contents). Opened from the header's
 * odometer chip and from the Log sheet. A typed reading is guarded: swipe-down
 * (iOS), Cancel and Android Back ask "Discard reading?" first; while it saves
 * the sheet cannot be left at all.
 */
export default function OdometerScreen() {
  const { motorcycleId } = useLocalSearchParams<{ motorcycleId: string }>();
  const { bike } = useHubBike(motorcycleId);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const guard = useDiscardReadingGuard(dirty, saving);
  // "Today" and the future-date check must use the day the sheet is opened on.
  useFocusEffect(useCallback(() => refreshToday(), []));
  if (!bike) {
    return (
      <View
        style={{
          height: PLACEHOLDER_HEIGHT,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hub.card,
        }}
      >
        <ActivityIndicator color={hub.copper} />
      </View>
    );
  }
  return (
    <OdometerSheet
      bike={bike}
      onClose={guard.closeAfterSave}
      onCancel={guard.cancel}
      onDirtyChange={setDirty}
      onSavingChange={setSaving}
    />
  );
}
