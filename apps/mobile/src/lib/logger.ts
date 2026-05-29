/**
 * Dev-gated logging.
 *
 * `log`/`info`/`warn`/`debug` are no-ops in production builds, so diagnostic
 * noise never ships. For errors that must reach Sentry in production, use
 * `captureException` from `lib/analytics` instead — this logger is for local
 * diagnostics only.
 *
 * Built from a method list (no per-method branching): in dev each name binds to
 * the matching `console` method; in production each binds to a no-op.
 */
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

const noop = (): void => {};

type LogMethod = 'log' | 'info' | 'warn' | 'debug';
const LOG_METHODS: readonly LogMethod[] = ['log', 'info', 'warn', 'debug'];

export const logger = Object.fromEntries(
  LOG_METHODS.map((name) => [name, isDev ? console[name].bind(console) : noop]),
) as Record<LogMethod, (...args: unknown[]) => void>;
