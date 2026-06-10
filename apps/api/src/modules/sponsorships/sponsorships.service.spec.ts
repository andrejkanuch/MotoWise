import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipsService } from './sponsorships.service';

describe('SponsorshipsService', () => {
  let service: SponsorshipsService;
  let mockAdmin: { rpc: ReturnType<typeof vi.fn> };
  let mockUser: Record<string, unknown>;

  function build(featureEnabled: boolean) {
    mockAdmin = { rpc: vi.fn() };
    mockUser = {};
    const config = { get: vi.fn().mockReturnValue(featureEnabled ? 'true' : '') };
    service = new SponsorshipsService(mockUser as never, mockAdmin as never, config as never);
    // biome-ignore lint/suspicious/noExplicitAny: suppress logger noise
    (service as any).logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    build(true);
  });

  describe('trackImpression', () => {
    it('calls the service_role RPC (not a JS read-modify-write) and returns its result', async () => {
      mockAdmin.rpc.mockResolvedValue({ data: true, error: null });

      const result = await service.trackImpression('spon-1');

      expect(result).toBe(true);
      expect(mockAdmin.rpc).toHaveBeenCalledWith('track_sponsorship_impression', {
        p_id: 'spon-1',
      });
    });

    it('returns false (no active/in-window sponsorship matched) when RPC returns false', async () => {
      mockAdmin.rpc.mockResolvedValue({ data: false, error: null });
      expect(await service.trackImpression('spon-1')).toBe(false);
    });

    it('surfaces RPC errors as false', async () => {
      mockAdmin.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
      expect(await service.trackImpression('spon-1')).toBe(false);
    });

    it('no-ops (returns false, no RPC) when the feature flag is off', async () => {
      build(false);
      expect(await service.trackImpression('spon-1')).toBe(false);
      expect(mockAdmin.rpc).not.toHaveBeenCalled();
    });
  });

  describe('trackClick', () => {
    it('calls the track_sponsorship_click RPC', async () => {
      mockAdmin.rpc.mockResolvedValue({ data: true, error: null });

      const result = await service.trackClick('spon-2');

      expect(result).toBe(true);
      expect(mockAdmin.rpc).toHaveBeenCalledWith('track_sponsorship_click', { p_id: 'spon-2' });
    });
  });
});
