import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CommentsResolver } from './comments.resolver';
import type { CommentsService } from './comments.service';

describe('CommentsResolver', () => {
  let resolver: CommentsResolver;
  let service: { getComments: ReturnType<typeof vi.fn> };
  const user = { id: 'u1' } as AuthUser;
  const rideId = '11111111-1111-1111-1111-111111111111';
  const routeId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    service = { getComments: vi.fn().mockResolvedValue({ edges: [], pageInfo: {} }) };
    resolver = new CommentsResolver(service as unknown as CommentsService);
  });

  describe('getComments target guard', () => {
    it('throws BadRequest when no target is provided', async () => {
      await expect(resolver.getComments(user)).rejects.toThrow(BadRequestException);
      expect(service.getComments).not.toHaveBeenCalled();
    });

    it('throws BadRequest when more than one target is provided', async () => {
      await expect(resolver.getComments(user, rideId, routeId)).rejects.toThrow(
        BadRequestException,
      );
      expect(service.getComments).not.toHaveBeenCalled();
    });

    it('passes the resolved target field + id through for a single valid target', async () => {
      await resolver.getComments(user, rideId);
      expect(service.getComments).toHaveBeenCalledWith('ride_id', rideId, 20, undefined);
    });

    it('rejects a malformed (non-uuid) target', async () => {
      await expect(resolver.getComments(user, 'not-a-uuid')).rejects.toThrow(BadRequestException);
    });
  });
});
