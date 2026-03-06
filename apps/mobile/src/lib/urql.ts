import { authExchange } from '@urql/exchange-auth';
import { Client, cacheExchange, fetchExchange } from 'urql';
import { useAuthStore } from '../stores/auth.store';
import { supabase } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

export function createUrqlClient() {
  return new Client({
    url: apiUrl,
    exchanges: [
      cacheExchange,
      authExchange(async (utils) => {
        let token: string | null = null;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token ?? null;

        return {
          addAuthToOperation(operation) {
            const locale = useAuthStore.getState().locale;
            if (!token) {
              return utils.appendHeaders(operation, { 'x-locale': locale });
            }
            return utils.appendHeaders(operation, {
              Authorization: `Bearer ${token}`,
              'x-locale': locale,
            });
          },
          willAuthError: () => !token,
          didAuthError: (error) =>
            error.graphQLErrors.some((e) => e.extensions?.code === 'UNAUTHENTICATED'),
          async refreshAuth() {
            const { data } = await supabase.auth.refreshSession();
            token = data.session?.access_token ?? null;
          },
        };
      }),
      fetchExchange,
    ],
  });
}
