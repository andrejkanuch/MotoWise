import { MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH } from '@motovault/types';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { configureBodyParser, JSON_BODY_LIMIT_BYTES } from '../body-parser';

/**
 * Boots a real Nest Express app, because the regression this guards is wiring:
 * without configureBodyParser, Express's 100 KB default returned 413 for every
 * diagnostic photo (MOTO-VAULT-NODE-NESTJS-D).
 */
class EmptyModule {}
Module({})(EmptyModule);

describe('configureBodyParser', () => {
  let app: NestExpressApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  /** Posts `{ photo }` of the given length; resolves the status and parsed length. */
  const post = async (
    registerParser: (app: NestExpressApplication) => void,
    photoLength: number,
  ) => {
    app = await NestFactory.create<NestExpressApplication>(EmptyModule, { logger: false });
    registerParser(app);
    app.use('/echo', (req: Request, res: Response) => {
      res.json({ length: (req.body as { photo: string }).photo.length });
    });
    await app.listen(0, '127.0.0.1');
    const response = await fetch(`${await app.getUrl()}/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photo: 'a'.repeat(photoLength) }),
    });
    const body = response.ok ? ((await response.json()) as { length: number }) : null;
    return { status: response.status, length: body?.length };
  };

  it('sizes the limit to the largest photo the resolver accepts', () => {
    expect(JSON_BODY_LIMIT_BYTES).toBeGreaterThan(MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH);
  });

  it('is what lets a typical photo through: the default limit refuses it', async () => {
    const withoutFix = await post((a) => a.useBodyParser('json'), 1_000_000);

    expect(withoutFix.status).toBe(413);
  });

  it('accepts a photo at the resolver cap', async () => {
    await expect(post(configureBodyParser, MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH)).resolves.toEqual({
      status: 200,
      length: MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH,
    });
  });

  it('still parses a small webhook-sized body', async () => {
    await expect(post(configureBodyParser, 200)).resolves.toEqual({ status: 200, length: 200 });
  });

  it('refuses a body over the limit with 413', async () => {
    const { status } = await post(configureBodyParser, JSON_BODY_LIMIT_BYTES);

    expect(status).toBe(413);
  });
});
