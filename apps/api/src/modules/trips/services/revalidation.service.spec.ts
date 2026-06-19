import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RevalidationService } from './revalidation.service';

describe('RevalidationService', () => {
  describe('tripTemplatePaths', () => {
    const svc = new RevalidationService();

    it('returns only the explore hub when nothing is provided', () => {
      expect(svc.tripTemplatePaths()).toEqual(['/explore']);
      expect(svc.tripTemplatePaths(null, null, null)).toEqual(['/explore']);
    });

    it('adds the country explore hub + /trips/<cc> listing when a country is present', () => {
      expect(svc.tripTemplatePaths('CA')).toEqual(['/explore', '/explore/ca', '/trips/ca']);
    });

    it('adds the region explore page when country+region present (no slug => no trip detail)', () => {
      expect(svc.tripTemplatePaths('CA', 'BC')).toEqual([
        '/explore',
        '/explore/ca',
        '/trips/ca',
        '/explore/ca/bc',
      ]);
    });

    it('adds the lowercased trip-detail path when country+region+slug are present', () => {
      expect(svc.tripTemplatePaths('CA', 'BC', 'Sea-To-Sky')).toEqual([
        '/explore',
        '/explore/ca',
        '/trips/ca',
        '/explore/ca/bc',
        '/trips/ca/bc/sea-to-sky',
      ]);
    });

    it('drops the trip-detail path when a slug is present but the region is missing', () => {
      expect(svc.tripTemplatePaths('CA', null, 'slug')).toEqual([
        '/explore',
        '/explore/ca',
        '/trips/ca',
      ]);
    });
  });

  describe('revalidateTripTemplate (best-effort, non-fatal)', () => {
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
      new RevalidationService().revalidateTripTemplate('ca', 'bc', 'slug');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('POSTs the secret header + payload to the stripped WEB_URL when configured', () => {
      vi.stubEnv('WEB_URL', 'https://example.test/');
      vi.stubEnv('REVALIDATE_SECRET', 's3cret');
      fetchSpy.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

      new RevalidationService().revalidateTripTemplate('CA', 'BC', 'sea-to-sky');

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, opts] = fetchSpy.mock.calls[0] as [
        string,
        RequestInit & { headers: Record<string, string> },
      ];
      expect(url).toBe('https://example.test/api/revalidate'); // trailing slash stripped
      expect(opts.method).toBe('POST');
      expect(opts.headers['x-revalidate-secret']).toBe('s3cret');
      const body = JSON.parse(opts.body as string);
      expect(body.tags).toEqual(['trips', 'places']);
      expect(body.paths).toContain('/explore/ca/bc');
      expect(body.paths).toContain('/trips/ca/bc/sea-to-sky');
    });

    it('never throws when the request rejects (non-fatal contract)', async () => {
      vi.stubEnv('WEB_URL', 'https://example.test');
      vi.stubEnv('REVALIDATE_SECRET', 's3cret');
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      expect(() =>
        new RevalidationService().revalidateTripTemplate('ca', 'bc', 'slug'),
      ).not.toThrow();
      // Flush the microtask queue so the rejection handler runs and is swallowed.
      await Promise.resolve();
    });
  });
});
