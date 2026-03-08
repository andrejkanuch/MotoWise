import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

export function setupOnlineManager() {
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(state.isConnected ?? true);
    });
    return () => subscription.remove();
  });
}

export function setupFocusManager() {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });
  return () => subscription.remove();
}
