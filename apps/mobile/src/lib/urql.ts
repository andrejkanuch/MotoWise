import { authExchange } from '@urql/exchange-auth';
import * as SecureStore from 'expo-secure-store';
import { Client, cacheExchange, fetchExchange } from 'urql';

export function createUrqlClient() {
  return new Client({
    url: process.env.EXPO_PUBLIC_API_URL!,
    exchanges: [
      cacheExchange,
      authExchange(async (utils) => {
        let token = await SecureStore.getItemAsync('supabase_token');
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
            token = null;
          },
        };
      }),
      fetchExchange,
    ],
  });
}
