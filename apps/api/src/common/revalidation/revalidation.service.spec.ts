import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RevalidationService } from './revalidation.service';

describe('RevalidationService', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    fetchSpy.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('no-ops (no fetch) when WEB_URL / REVALIDATE_SECRET are unset', () => {
    vi.stubEnv('WEB_URL', '');
    vi.stubEnv('REVALIDATE_SECRET', '');
    new RevalidationService().revalidate({ tags: ['places'], paths: ['/explore/ca'] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs the secret header + payload to the stripped WEB_URL when configured', () => {
    vi.stubEnv('WEB_URL', 'https://example.test/');
    vi.stubEnv('REVALIDATE_SECRET', 's3cret');
    fetchSpy.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

    new RevalidationService().revalidate({ tags: ['places'], paths: ['/explore/ca/bc'] });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe('https://example.test/api/revalidate'); // trailing slash stripped
    expect(opts.method).toBe('POST');
    expect(opts.headers['x-revalidate-secret']).toBe('s3cret');
    const body = JSON.parse(opts.body as string);
    expect(body.tags).toEqual(['places']);
    expect(body.paths).toEqual(['/explore/ca/bc']);
  });

  it('never throws when the request rejects (non-fatal contract)', async () => {
    vi.stubEnv('WEB_URL', 'https://example.test');
    vi.stubEnv('REVALIDATE_SECRET', 's3cret');
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    expect(() => new RevalidationService().revalidate({ paths: ['/explore'] })).not.toThrow();
    // Flush the microtask queue so the rejection handler runs and is swallowed.
    await Promise.resolve();
  });
});
