import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { HUB_FONT, HUB_TOUCH_TARGET, hub } from '../ui/tokens';

/** Grabber for Android, where the form sheet draws none of its own. */
export function SheetGrabber() {
  if (process.env.EXPO_OS !== 'android') return null;
  return (
    <View
      style={{
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: hub.track,
        alignSelf: 'center',
        marginBottom: 6,
      }}
    />
  );
}

interface SheetHeaderProps {
  title: string;
  onCancel: () => void;
}

/** Serif sheet title with "Cancel" on the right (Log and Odometer sheets). */
export function SheetHeader({ title, onCancel }: SheetHeaderProps) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingHorizontal: 2,
      }}
    >
      <Text
        accessibilityRole="header"
        numberOfLines={2}
        style={{
          flex: 1,
          fontFamily: HUB_FONT.serif,
          fontSize: 26,
          lineHeight: 30,
          color: hub.text,
        }}
      >
        {title}
      </Text>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        style={({ pressed }) => ({
          minHeight: HUB_TOUCH_TARGET,
          justifyContent: 'center',
          paddingHorizontal: 4,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 14, color: hub.dim }}>
          {t('common.cancel')}
        </Text>
      </Pressable>
    </View>
  );
}
