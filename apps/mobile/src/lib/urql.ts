import { authExchange } from '@urql/exchange-auth';
import { Client, cacheExchange, fetchExchange } from 'urql';
import { supabase } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl) {
  throw new Error('Missing EXPO_PUBLIC_API_URL environment variable');
}

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
