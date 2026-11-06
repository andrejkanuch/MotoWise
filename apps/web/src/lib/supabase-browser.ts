import { createBrowserClient } from '@supabase/ssr';

/**
 * Stand-in WebSocket for browsers that expose none (privacy-hardened or
 * embedded webviews). supabase-js builds its Realtime client eagerly in the
 * constructor, and realtime-js throws "Unknown JavaScript runtime without
 * WebSocket support" when it finds no `WebSocket` global — so a signed-out blog
 * reader on such a browser got an unhandled rejection from the navbar's session
 * check (MOTOVAULT-WEB-1X), even though the web app never opens a channel.
 * Auth uses fetch only, so it keeps working; a channel subscribe would fail on
 * connect, which is the honest outcome without WebSockets.
 */
class UnavailableWebSocket {
  constructor() {
    throw new Error('WebSocket is not available in this browser');
  }
}

function realtimeOptions() {
  return typeof globalThis.WebSocket === 'undefined'
    ? { realtime: { transport: UnavailableWebSocket as unknown as typeof WebSocket } }
    : {};
}

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    realtimeOptions(),
  );
}
