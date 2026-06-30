import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceDuePushController } from './maintenance-due-push.controller';
import type { MaintenancePushService } from './maintenance-push.service';

const SECRET = 'test-maintenance-secret';
const SUMMARY = { tasksDue: 2, pushed: 2, skipped: 0, failed: 0 };

function makeController(configSecret: string | undefined) {
  const sendDuePush = vi.fn().mockResolvedValue(SUMMARY);
  const service = { sendDuePush } as unknown as MaintenancePushService;
  const config = { get: vi.fn().mockReturnValue(configSecret) } as unknown as ConfigService;
  return { controller: new MaintenanceDuePushController(service, config), sendDuePush };
}

describe('MaintenanceDuePushController (HMAC, fail-closed)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401s when the secret env is unset (fails closed)', async () => {
    const { controller, sendDuePush } = makeController(undefined);
    await expect(controller.handle(SECRET, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sendDuePush).not.toHaveBeenCalled();
  });

  it('401s when the header is missing', async () => {
    const { controller, sendDuePush } = makeController(SECRET);
    await expect(controller.handle('', {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sendDuePush).not.toHaveBeenCalled();
  });

  it('401s when the header does not match the secret', async () => {
    const { controller, sendDuePush } = makeController(SECRET);
    await expect(controller.handle('wrong-secret', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sendDuePush).not.toHaveBeenCalled();
  });

  it('runs with the default daysBefore (1) on a valid secret + empty body', async () => {
    const { controller, sendDuePush } = makeController(SECRET);
    const res = await controller.handle(SECRET, {});
    expect(sendDuePush).toHaveBeenCalledWith(1);
    expect(res).toEqual({ ...SUMMARY, status: 'ok' });
  });

  it('honors a valid daysBefore from the body', async () => {
    const { controller, sendDuePush } = makeController(SECRET);
    await controller.handle(SECRET, { daysBefore: 7 });
    expect(sendDuePush).toHaveBeenCalledWith(7);
  });

  it('falls back to the default when daysBefore is invalid', async () => {
    const { controller, sendDuePush } = makeController(SECRET);
    await controller.handle(SECRET, { daysBefore: 'soon' });
    expect(sendDuePush).toHaveBeenCalledWith(1);
  });
});
