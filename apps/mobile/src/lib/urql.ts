import { authExchange } from '@urql/exchange-auth';
import { Client, cacheExchange, fetchExchange } from 'urql';
import { supabase } from './supabase';

export function createUrqlClient() {
  return new Client({
    url: process.env.EXPO_PUBLIC_API_URL!,
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
            if (!token) return operation;
            return utils.appendHeaders(operation, {
              Authorization: `Bearer ${token}`,
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
