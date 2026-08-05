import type { ErrorEvent } from '@sentry/nextjs';
import type { CaptureResult } from 'posthog-js';
import { describe, expect, it } from 'vitest';
import { shouldDropClientEvent, shouldDropPostHogEvent } from '../sentry-noise-filter';

type Frame = { filename?: string; in_app?: boolean };

const eventWith = (
  value: string,
  opts: { type?: string; frames?: Frame[]; mechanismType?: string } = {},
): ErrorEvent =>
  ({
    exception: {
      values: [
        {
          type: opts.type ?? 'Error',
          value,
          ...(opts.frames ? { stacktrace: { frames: opts.frames } } : {}),
          ...(opts.mechanismType ? { mechanism: { type: opts.mechanismType } } : {}),
        },
      ],
    },
  }) as ErrorEvent;

type ExceptionSpec = { type?: string; value?: string; frames?: Frame[] };

const eventWithExceptions = (specs: ExceptionSpec[]): ErrorEvent =>
  ({
    exception: {
      values: specs.map((s) => ({
        type: s.type ?? 'Error',
        value: s.value,
        ...(s.frames ? { stacktrace: { frames: s.frames } } : {}),
      })),
    },
  }) as ErrorEvent;

describe('shouldDropClientEvent', () => {
  it('keeps events with no exception values', () => {
    expect(shouldDropClientEvent({} as ErrorEvent)).toBe(false);
    expect(shouldDropClientEvent({ exception: { values: [] } } as unknown as ErrorEvent)).toBe(
      false,
    );
  });

  it('drops ResizeObserver loop notifications', () => {
    expect(
      shouldDropClientEvent(
        eventWith('ResizeObserver loop completed with undelivered notifications'),
      ),
    ).toBe(true);
  });

  it('drops frameless third-party SecurityError but keeps ones with frames', () => {
    expect(
      shouldDropClientEvent(eventWith('The request was denied.', { type: 'SecurityError' })),
    ).toBe(true);
    expect(
      shouldDropClientEvent(
        eventWith('The request was denied.', {
          type: 'SecurityError',
          frames: [{ filename: '/_next/static/chunks/app.js', in_app: true }],
        }),
      ),
    ).toBe(false);
  });

  it('drops RSC "Connection closed." only for unhandledrejection mechanism', () => {
    expect(
      shouldDropClientEvent(
        eventWith('Connection closed.', { mechanismType: 'onunhandledrejection' }),
      ),
    ).toBe(true);
    // Same message via a different mechanism (e.g. a real thrown error) still reports.
    expect(
      shouldDropClientEvent(eventWith('Connection closed.', { mechanismType: 'generic' })),
    ).toBe(false);
  });

  describe('Maximum call stack size exceeded (MOTOVAULT-WEB-X)', () => {
    it('drops the in-app-browser event with a single filename-less frame', () => {
      // Mirrors the real event: one opaque `undefined:31:70` frame.
      expect(
        shouldDropClientEvent(eventWith('Maximum call stack size exceeded.', { frames: [{}] })),
      ).toBe(true);
    });

    it('drops it when it arrives completely frameless', () => {
      expect(
        shouldDropClientEvent(eventWith('RangeError: Maximum call stack size exceeded.')),
      ).toBe(true);
    });

    it('KEEPS a genuine recursion carrying first-party bundle frames', () => {
      expect(
        shouldDropClientEvent(
          eventWith('Maximum call stack size exceeded.', {
            frames: [
              { filename: 'https://motovault.app/_next/static/chunks/page.js', in_app: true },
              { filename: 'https://motovault.app/_next/static/chunks/page.js', in_app: true },
            ],
          }),
        ),
      ).toBe(false);
    });
  });

  describe('window.webkit.messageHandlers (MOTOVAULT-WEB-Y)', () => {
    it('drops the Meta in-app-browser bridge error (no first-party frames)', () => {
      expect(
        shouldDropClientEvent(
          eventWith("undefined is not an object (evaluating 'window.webkit.messageHandlers')", {
            type: 'TypeError',
            frames: [{ filename: 'app:///' }, { filename: 'app:///' }],
          }),
        ),
      ).toBe(true);
    });

    it('drops it when it arrives frameless', () => {
      expect(
        shouldDropClientEvent(
          eventWith("undefined is not an object (evaluating 'window.webkit.messageHandlers')", {
            type: 'TypeError',
          }),
        ),
      ).toBe(true);
    });

    it('KEEPS a first-party error that references the same message', () => {
      expect(
        shouldDropClientEvent(
          eventWith("undefined is not an object (evaluating 'window.webkit.messageHandlers')", {
            type: 'TypeError',
            frames: [
              { filename: 'https://motovault.app/_next/static/chunks/page.js', in_app: true },
            ],
          }),
        ),
      ).toBe(false);
    });

    it('KEEPS a non-TypeError exception carrying the same substring', () => {
      // The rule is scoped to TypeError; a differently-typed throw with the
      // same message must still report even without a first-party frame.
      expect(
        shouldDropClientEvent(
          eventWith('something about window.webkit.messageHandlers', { type: 'Error' }),
        ),
      ).toBe(false);
    });

    it('KEEPS a mixed event where another exception carries a first-party frame', () => {
      // The frameless bridge TypeError alone would match, but the chained
      // first-party exception means the event is genuinely actionable.
      expect(
        shouldDropClientEvent(
          eventWithExceptions([
            {
              type: 'TypeError',
              value: "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
            },
            {
              type: 'Error',
              value: 'Cannot read properties of undefined (reading "id")',
              frames: [
                { filename: 'https://motovault.app/_next/static/chunks/page.js', in_app: true },
              ],
            },
          ]),
        ),
      ).toBe(false);
    });
  });

  describe('browser-extension runtime.sendMessage (MOTOVAULT-WEB-11)', () => {
    it('drops an extension throw with no first-party frames', () => {
      expect(
        shouldDropClientEvent(
          eventWith('Invalid call to runtime.sendMessage(). Tab not found.', {
            frames: [{ filename: 'chrome-extension://abc/content.js' }],
          }),
        ),
      ).toBe(true);
    });

    it('drops it when it arrives frameless', () => {
      expect(
        shouldDropClientEvent(eventWith('Invalid call to runtime.sendMessage(). Tab not found.')),
      ).toBe(true);
    });

    it('KEEPS a first-party error mentioning runtime.sendMessage', () => {
      expect(
        shouldDropClientEvent(
          eventWith('runtime.sendMessage bridge failed', {
            frames: [{ filename: 'https://motovault.app/_next/static/chunk.js' }],
          }),
        ),
      ).toBe(false);
    });
  });

  describe('mapbox WebGL init failure (MOTOVAULT-WEB-12)', () => {
    it('drops it — the client cannot provide a WebGL context', () => {
      expect(shouldDropClientEvent(eventWith('Failed to initialize WebGL.'))).toBe(true);
    });

    it('drops it even with first-party frames, since mapbox runs inside our bundle', () => {
      expect(
        shouldDropClientEvent(
          eventWith('Failed to initialize WebGL.', {
            frames: [{ filename: 'https://motovault.app/_next/static/mapbox.js' }],
          }),
        ),
      ).toBe(true);
    });

    it('KEEPS other mapbox errors, which ARE actionable', () => {
      expect(
        shouldDropClientEvent(
          eventWith('An API access token is required to use Mapbox GL.', {
            frames: [{ filename: 'https://motovault.app/_next/static/mapbox.js' }],
          }),
        ),
      ).toBe(false);
    });
  });

  it('keeps unrelated first-party errors', () => {
    expect(
      shouldDropClientEvent(
        eventWith('Cannot read properties of undefined (reading "id")', {
          frames: [{ filename: '/_next/static/chunks/app.js', in_app: true }],
        }),
      ),
    ).toBe(false);
  });
});

describe('shouldDropPostHogEvent', () => {
  // Mirrors PostHog's `$exception` autocapture shape: the exception chain lives
  // on `properties.$exception_list`, entries carrying the same
  // type/value/mechanism/stacktrace fields as Sentry's exception values.
  const exceptionEvent = (
    value: string,
    opts: { type?: string; frames?: Frame[]; mechanismType?: string } = {},
  ): CaptureResult =>
    ({
      event: '$exception',
      properties: {
        $exception_list: [
          {
            type: opts.type ?? 'Error',
            value,
            ...(opts.frames ? { stacktrace: { type: 'raw', frames: opts.frames } } : {}),
            ...(opts.mechanismType ? { mechanism: { type: opts.mechanismType } } : {}),
          },
        ],
      },
    }) as unknown as CaptureResult;

  it('keeps a null event (before_send passes it through)', () => {
    expect(shouldDropPostHogEvent(null)).toBe(false);
  });

  it('keeps non-exception events with no $exception_list', () => {
    expect(
      shouldDropPostHogEvent({ event: '$pageview', properties: {} } as unknown as CaptureResult),
    ).toBe(false);
  });

  it('drops the benign RSC "Connection closed." unhandledrejection', () => {
    expect(
      shouldDropPostHogEvent(
        exceptionEvent('Connection closed.', { mechanismType: 'onunhandledrejection' }),
      ),
    ).toBe(true);
    // Same message via a different mechanism (a real thrown error) still reports.
    expect(
      shouldDropPostHogEvent(exceptionEvent('Connection closed.', { mechanismType: 'generic' })),
    ).toBe(false);
  });

  it('drops ResizeObserver loop notifications', () => {
    expect(
      shouldDropPostHogEvent(
        exceptionEvent('ResizeObserver loop completed with undelivered notifications'),
      ),
    ).toBe(true);
  });

  it('keeps unrelated first-party errors', () => {
    expect(
      shouldDropPostHogEvent(
        exceptionEvent('Cannot read properties of undefined (reading "id")', {
          frames: [{ filename: '/_next/static/chunks/app.js', in_app: true }],
        }),
      ),
    ).toBe(false);
  });
});
