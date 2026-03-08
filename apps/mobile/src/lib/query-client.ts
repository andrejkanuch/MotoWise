import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { supabase } from './supabase';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      const isAuthError = hasGraphQLCode(error, 'UNAUTHENTICATED');
      if (isAuthError) {
        supabase.auth.refreshSession();
        return;
      }
      Alert.alert('Error', error.message);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return;
      Alert.alert('Error', error.message);
    },
  }),
});

function hasGraphQLCode(error: unknown, code: string): boolean {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'errors' in error.response &&
    Array.isArray(error.response.errors)
  ) {
    return error.response.errors.some(
      (e: { extensions?: { code?: string } }) => e.extensions?.code === code,
    );
  }
  return false;
}
