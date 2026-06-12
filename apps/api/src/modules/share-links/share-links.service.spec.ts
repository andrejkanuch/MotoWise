import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareLinksService } from './share-links.service';

const HEX_TOKEN_64 = /^[a-f0-9]{64}$/;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value.toLowerCase()).digest('hex');
}

function createConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: vi.fn().mockImplementation((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('ShareLinksService', () => {
  let insertMock: ReturnType<typeof vi.fn>;
  let insertedPayload: Record<string, unknown> | undefined;

  function createService(
    rows: { linkRow?: Record<string, unknown>; listRows?: Record<string, unknown>[] } = {},
  ) {
    const linkRow = rows.linkRow ?? {
      id: 'link-1',
      token: 'stored-hash',
      motorcycle_id: 'moto-1',
      expires_at: '2026-07-09T00:00:00Z',
      created_at: '2026-06-09T00:00:00Z',
    };

    insertMock = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      insertedPayload = payload;
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { ...linkRow, ...payload }, error: null }),
        }),
      };
    });

    const userClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'motorcycles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'moto-1' }, error: null }),
                }),
              }),
            }),
          };
        }
        // share_links
        return {
          insert: insertMock,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    order: vi
                      .fn()
                      .mockResolvedValue({ data: rows.listRows ?? [linkRow], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }),
    };

    const tokenEq = vi.fn().mockReturnValue({
      gt: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    });

    const adminClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: tokenEq }),
      }),
    };

    const service = new ShareLinksService(
      userClient as never,
      adminClient as never,
      createConfig(),
    );
    return { service, tokenEq };
  }

  beforeEach(() => {
    insertedPayload = undefined;
  });

  describe('create', () => {
    it('mints a plaintext token, stores only its SHA-256 hash, and returns the plaintext once', async () => {
      const { service } = createService();

      const result = await service.create('user-1', 'moto-1', 30);

      expect(result.token).toMatch(HEX_TOKEN_64);
      expect(insertedPayload?.token).toBe(sha256Hex(result.token as string));
      expect(insertedPayload?.token).not.toBe(result.token);
      expect(insertedPayload?.token_hashed_at).toBeDefined();
      expect(result.url).toBe(`https://motovault.app/share/${result.token}`);
    });

    it('mints a unique token per link', async () => {
      const { service } = createService();

      const first = await service.create('user-1', 'moto-1', 30);
      const second = await service.create('user-1', 'moto-1', 30);

      expect(first.token).not.toBe(second.token);
    });
  });

  describe('resolve', () => {
    it('hashes the presented token before the lookup', async () => {
      const { service, tokenEq } = createService();
      const plaintext = 'a'.repeat(64);

      await expect(service.resolve(plaintext)).rejects.toThrow('Share link not found');

      expect(tokenEq).toHaveBeenCalledWith('token', sha256Hex(plaintext));
    });

    it('rejects tokens that fail the pattern pre-check without hitting the DB', async () => {
      const { service, tokenEq } = createService();

      await expect(service.resolve('not-a-token')).rejects.toThrow(BadRequestException);
      expect(tokenEq).not.toHaveBeenCalled();
    });
  });

  describe('findByMotorcycle', () => {
    it('never re-displays token or url for existing links (show-once)', async () => {
      const { service } = createService();

      const links = await service.findByMotorcycle('user-1', 'moto-1');

      expect(links).toHaveLength(1);
      expect(links[0].id).toBe('link-1');
      expect(links[0].token).toBeUndefined();
      expect(links[0].url).toBeUndefined();
    });
  });
});
