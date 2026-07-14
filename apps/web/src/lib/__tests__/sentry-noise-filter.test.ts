import type { ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { shouldDropClientEvent } from '../sentry-noise-filter';

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
