import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { RideStatsSweepController } from './ride-stats.controller';
import type { RideStatsService } from './ride-stats.service';

const SECRET = 'test-ride-stats-secret';
const SUMMARY = { examined: 2, written: 2, skipped: [], referenceMissing: 0, staleOverOneHour: 0 };

function makeController(configSecret: string | undefined) {
  const sweepStale = vi.fn().mockResolvedValue(SUMMARY);
  const config = { get: vi.fn().mockReturnValue(configSecret) } as unknown as ConfigService;
  return {
    controller: new RideStatsSweepController({ sweepStale } as unknown as RideStatsService, config),
    sweepStale,
  };
}

describe('RideStatsSweepController (secret header, fail-closed)', () => {
  it('401s when the secret env is unset', async () => {
    const { controller, sweepStale } = makeController(undefined);
    await expect(controller.handle(SECRET)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sweepStale).not.toHaveBeenCalled();
  });

  it('401s when the header is missing or wrong', async () => {
    const { controller, sweepStale } = makeController(SECRET);
    await expect(controller.handle('')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.handle('wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sweepStale).not.toHaveBeenCalled();
  });

  it('runs the sweep on the right secret', async () => {
    const { controller, sweepStale } = makeController(SECRET);
    expect(await controller.handle(SECRET)).toEqual({ ...SUMMARY, status: 'ok' });
    expect(sweepStale).toHaveBeenCalledTimes(1);
  });
});
