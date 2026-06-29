import type { SupabaseClientOptions } from '@supabase/supabase-js';
import ws from 'ws';

/**
 * Supabase realtime transport for Node.js < 22.
 *
 * As of @supabase/supabase-js v2.108, `createClient` eagerly initializes a
 * RealtimeClient whose WebSocketFactory throws on Node.js < 22 ("Node.js 20
 * detected without native WebSocket support"). The API runs on Node 20, so we
 * supply the `ws` package as the transport. The server never subscribes to
 * realtime channels — this only satisfies client construction.
 *
 * See: @supabase/realtime-js websocket-factory.ts.
 */
type RealtimeOptions = NonNullable<SupabaseClientOptions<'public'>['realtime']>;

export const supabaseRealtimeOptions: RealtimeOptions = {
  // Cast to realtime-js's own `WebSocketLikeConstructor` rather than the global
  // `WebSocket` type — the latter resolves to different shapes across
  // environments (DOM lib vs @types/node), which broke the Docker build.
  transport: ws as unknown as RealtimeOptions['transport'],
};
