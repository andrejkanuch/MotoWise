import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

export function setupOnlineManager() {
  onlineManager.setEventListener((setOnline) => {
    let initialised = false;

    const subscription = Network.addNetworkStateListener((state) => {
      initialised = true;
      setOnline(state.isConnected ?? true);
    });

    // Seed initial state before first query fires (official TanStack pattern)
    Network.getNetworkStateAsync()
      .then((state) => {
        if (!initialised) {
          setOnline(state.isConnected ?? true);
        }
      })
      .catch(() => {
        // getNetworkStateAsync can reject on some platforms
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
