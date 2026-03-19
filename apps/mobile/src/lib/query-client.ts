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
      retry: (failureCount, error) => {
        // Don't retry client errors (FORBIDDEN, BAD_REQUEST, etc.)
        if (hasGraphQLCode(error, 'FORBIDDEN') || hasGraphQLCode(error, 'BAD_USER_INPUT')) {
          return false;
        }
        return failureCount < 1;
      },
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
      Alert.alert('Error', extractGraphQLMessage(error));
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return;
      Alert.alert('Error', extractGraphQLMessage(error));
    },
  }),
});

function extractGraphQLMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'errors' in error.response &&
    Array.isArray(error.response.errors) &&
    error.response.errors[0]?.message
  ) {
    return error.response.errors[0].message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

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
