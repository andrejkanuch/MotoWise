import { MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH } from '@motovault/types';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiBudgetService } from '../ai-budget/ai-budget.service';
import { DiagnosticAiService } from './diagnostic-ai.service';

// Mock OpenAI SDK
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        parse: vi.fn(),
      },
    },
  })),
}));

vi.mock('openai/helpers/zod', () => ({
  zodResponseFormat: vi.fn().mockReturnValue({ type: 'json_schema', json_schema: {} }),
}));

describe('DiagnosticAiService', () => {
  let service: DiagnosticAiService;
  const mockAdminClient = {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
  const mockAiBudgetService = {
    checkBudgetForUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as AiBudgetService;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockConfigService = {
      getOrThrow: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as ConfigService;

    service = new DiagnosticAiService(
      mockConfigService,
      mockAdminClient as never,
      mockAiBudgetService,
    );
  });

  describe('image size validation', () => {
    const context = {
      make: 'Honda',
      model: 'CB500F',
      year: 2023,
    };
    const userId = 'user-123';

    it('should reject images exceeding the maximum base64 size with HTTP 413', async () => {
      const oversizedBase64 = 'A'.repeat(MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH + 1);

      await expect(
        service.analyze('test-diagnostic-id', userId, oversizedBase64, context),
      ).rejects.toThrow(HttpException);

      try {
        await service.analyze('test-diagnostic-id', userId, oversizedBase64, context);
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
        expect((err as HttpException).message).toBe('Image exceeds maximum size of 5 MB');
      }
    });

    it('should update diagnostic status to failed when image is oversized', async () => {
      const oversizedBase64 = 'A'.repeat(MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH + 1);

      try {
        await service.analyze('diag-123', userId, oversizedBase64, context);
      } catch {
        // expected
      }

      expect(mockAdminClient.from).toHaveBeenCalledWith('diagnostics');
    });

    it('should accept images within the size limit (does not throw 413)', async () => {
      // Valid JPEG magic bytes (FF D8 FF) encoded as base64
      const jpegMagicBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64');
      const validBase64 = jpegMagicBase64 + 'A'.repeat(1000);

      // This will throw because the mock OpenAI client returns undefined,
      // but it should NOT throw a 413 PayloadTooLarge error.
      try {
        await service.analyze('test-id', userId, validBase64, context);
      } catch (err) {
        if (err instanceof HttpException) {
          expect((err as HttpException).getStatus()).not.toBe(HttpStatus.PAYLOAD_TOO_LARGE);
        }
      }
    });

    it('should reject unsupported image formats', async () => {
      // GIF magic bytes — not JPEG or PNG
      const gifBase64 = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).toString('base64');

      await expect(service.analyze('test-id', userId, gifBase64, context)).rejects.toThrow(
        'Unsupported image format',
      );
    });

    it('should check AI budget before processing', async () => {
      const jpegMagicBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64');
      const validBase64 = jpegMagicBase64 + 'A'.repeat(1000);

      try {
        await service.analyze('test-id', userId, validBase64, context);
      } catch {
        // expected - will fail at AI call
      }

      expect(mockAiBudgetService.checkBudgetForUser).toHaveBeenCalledWith(userId);
    });

    it('should work without a photo (text-only diagnosis)', async () => {
      try {
        await service.analyze('test-id', userId, undefined, {
          ...context,
          freeTextDescription: 'My bike makes a clicking noise',
        });
      } catch (err) {
        // Will fail at OpenAI call, but should not throw 413
        expect(err).not.toBeInstanceOf(HttpException);
      }
    });
  });
});
