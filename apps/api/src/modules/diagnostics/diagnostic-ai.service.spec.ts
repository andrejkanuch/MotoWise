import { MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH } from '@motolearn/types';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagnosticAiService } from './diagnostic-ai.service';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
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

  beforeEach(() => {
    vi.clearAllMocks();
    const mockConfigService = {
      getOrThrow: vi.fn().mockReturnValue('test-api-key'),
    } as unknown as ConfigService;

    service = new DiagnosticAiService(mockConfigService, mockAdminClient as never);
  });

  describe('image size validation', () => {
    const context = {
      make: 'Honda',
      model: 'CB500F',
      year: 2023,
    };

    it('should reject images exceeding the maximum base64 size with HTTP 413', async () => {
      const oversizedBase64 = 'A'.repeat(MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH + 1);

      await expect(service.analyze('test-diagnostic-id', oversizedBase64, context)).rejects.toThrow(
        HttpException,
      );

      try {
        await service.analyze('test-diagnostic-id', oversizedBase64, context);
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
        expect((err as HttpException).message).toBe('Image exceeds maximum size of 5 MB');
      }
    });

    it('should update diagnostic status to failed when image is oversized', async () => {
      const oversizedBase64 = 'A'.repeat(MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH + 1);

      try {
        await service.analyze('diag-123', oversizedBase64, context);
      } catch {
        // expected
      }

      expect(mockAdminClient.from).toHaveBeenCalledWith('diagnostics');
    });

    it('should accept images within the size limit (does not throw 413)', async () => {
      // A valid-sized base64 string (small). Will fail later at AI call, but not at size check.
      const validBase64 = 'A'.repeat(1000);

      // This will throw because the mock Anthropic client returns undefined,
      // but it should NOT throw a 413 PayloadTooLarge error.
      try {
        await service.analyze('test-id', validBase64, context);
      } catch (err) {
        expect(err).not.toBeInstanceOf(HttpException);
      }
    });
  });
});
