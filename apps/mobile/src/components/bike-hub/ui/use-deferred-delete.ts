import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { UNDO_WINDOW_MS } from '../../../lib/bike-hub/constants';
import { usePendingDeleteStore } from '../../../stores/pending-delete.store';

interface DeferredDeleteOptions {
  /** The real delete. Called once per id when its undo window closes. */
  commit: (id: string) => Promise<unknown>;
  /** A failed commit: the row is already back, tell the rider. */
  onError: (id: string, error: unknown) => void;
  windowMs?: number;
}

export interface DeferredDelete {
  /** Id inside its undo window, or `null`. Drives the Undo snackbar. */
  pendingId: string | null;
  /** Hide the row now and delete it when the window closes. Commits an earlier pending delete at once. */
  request: (id: string) => void;
  /** Cancel the pending delete: the row comes back, nothing was sent. */
  undo: () => void;
  /** Close the window now (screen blur, app to background). */
  flush: () => void;
}

/**
 * Delete with a short undo window, kept on the client: the row is hidden at
 * once and the server delete is sent only when the window closes. Undo cancels
 * it without a round trip. Fails safe — if the app dies inside the window the
 * row is simply still there. The window is closed early when a second delete
 * starts, the app goes to the background, or the owner unmounts.
 */
export function useDeferredDelete({
  commit,
  onError,
  windowMs = UNDO_WINDOW_MS,
}: DeferredDeleteOptions): DeferredDelete {
  const hide = usePendingDeleteStore((state) => state.hide);
  const unhide = usePendingDeleteStore((state) => state.unhide);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest callbacks, so a timer started earlier never calls stale ones.
  const callbacks = useRef({ commit, onError });
  callbacks.current = { commit, onError };

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const flush = useCallback(() => {
    const id = pendingRef.current;
    if (!id) return;
    clearTimer();
    pendingRef.current = null;
    setPendingId(null);
    callbacks.current
      .commit(id)
      .catch((error: unknown) => callbacks.current.onError(id, error))
      .finally(() => unhide(id));
  }, [clearTimer, unhide]);

  const request = useCallback(
    (id: string) => {
      flush();
      hide(id);
      pendingRef.current = id;
      setPendingId(id);
      timerRef.current = setTimeout(flush, windowMs);
    },
    [flush, hide, windowMs],
  );

  const undo = useCallback(() => {
    const id = pendingRef.current;
    if (!id) return;
    clearTimer();
    pendingRef.current = null;
    setPendingId(null);
    unhide(id);
  }, [clearTimer, unhide]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') flush();
    });
    return () => {
      subscription.remove();
      flush();
    };
  }, [flush]);

  return { pendingId, request, undo, flush };
}
