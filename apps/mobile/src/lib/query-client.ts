import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { extractGraphQLMessage, hasGraphQLCode } from './graphql-errors';
import { supabase } from './supabase';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /** When false, global query error UI is skipped (default: show on first-load failures only). */
      showErrorAlert?: boolean;
    };
    mutationMeta: {
      showErrorAlert?: boolean;
    };
  }
}

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
      retry: (failureCount, error) => {
        if (hasGraphQLCode(error, 'FORBIDDEN') || hasGraphQLCode(error, 'BAD_USER_INPUT')) {
          return false;
        }
        return failureCount < 1;
      },
      networkMode: 'offlineFirst',
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      const isAuthError = hasGraphQLCode(error, 'UNAUTHENTICATED');
      if (isAuthError) {
        supabase.auth.refreshSession();
        return;
      }
      if (query?.meta?.showErrorAlert === false) return;
      if (query?.state.data !== undefined) return;
      Alert.alert('Error', extractGraphQLMessage(error));
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return;
      if (mutation.meta?.showErrorAlert === false) return;
      Alert.alert('Error', extractGraphQLMessage(error));
    },
  }),
});
