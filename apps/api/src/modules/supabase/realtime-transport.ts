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
export const supabaseRealtimeOptions = {
  // ws's default export is a WebSocket-compatible constructor; the realtime-js
  // `WebSocketLikeConstructor` type is structurally looser than @types/ws.
  transport: ws as unknown as typeof WebSocket,
};
