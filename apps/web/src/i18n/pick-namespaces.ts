import type { getMessages } from 'next-intl/server';

export type Messages = Awaited<ReturnType<typeof getMessages>>;

/**
 * The subset of the catalogue a layout's NextIntlClientProvider passes to the
 * client: only the namespaces its client subtree reads, since the whole
 * catalogue is ~300 KB of RSC payload. app/__tests__/intl-provider-contract.test.ts
 * checks every call against the namespaces the client code actually reads.
 */
export function pickNamespaces(messages: Messages, namespaces: readonly string[]): Messages {
  const all = messages as Record<string, unknown>;
  return Object.fromEntries(namespaces.map((ns) => [ns, all[ns]])) as Messages;
}
