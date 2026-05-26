import * as Haptics from 'expo-haptics';
import { ActionSheetIOS, Alert } from 'react-native';

interface ActionSheetOption {
  label: string;
  onPress: () => void;
  style?: 'destructive' | 'cancel';
}

export function showActionSheet(title: string, options: ActionSheetOption[], message?: string) {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const labels = options.map((o) => o.label);
    const destructiveIndex = options.findIndex((o) => o.style === 'destructive');
    const cancelIndex = options.findIndex((o) => o.style === 'cancel');

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: labels,
        destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
        cancelButtonIndex: cancelIndex >= 0 ? cancelIndex : undefined,
      },
      (index) => {
        options[index]?.onPress();
      },
    );
  } else {
    const buttons = options.map((o) => ({
      text: o.label,
      onPress: o.onPress,
      style: o.style as 'destructive' | 'cancel' | 'default' | undefined,
    }));
    Alert.alert(title, message, buttons);
  }
}
