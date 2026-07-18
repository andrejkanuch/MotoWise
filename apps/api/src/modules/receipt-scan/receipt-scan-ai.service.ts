import { type ReceiptExtraction, ReceiptExtractionSchema } from '@motovault/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { AI_CLIENT, AI_MODELS } from '../../config/constants';
import { RECEIPT_EXTRACTION_SYSTEM_PROMPT } from './prompts/receipt-extraction.prompt';

const MODEL = AI_MODELS.RECEIPT_SCAN;
const MAX_TOKENS = 1024;

/** JPEG magic bytes: FF D8 FF */
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
/** PNG magic bytes: 89 50 4E 47 */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
/** WebP/RIFF: "RIFF" at offset 0 (52 49 46 46) + "WEBP" at offset 8 (57 45 42 50). */
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46];
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50];

const IMAGE_MIME = {
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
} as const;

type ImageMime = (typeof IMAGE_MIME)[keyof typeof IMAGE_MIME];

/** Discriminated extraction outcome — never throws for a bad/refused result. */
export type ExtractionOutcome =
  | {
      ok: true;
      extraction: ReceiptExtraction;
      inputTokens: number;
      outputTokens: number;
    }
  | { ok: false };

@Injectable()
export class ReceiptScanAiService {
  private readonly logger = new Logger(ReceiptScanAiService.name);
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.getOrThrow('OPENAI_API_KEY'),
      maxRetries: AI_CLIENT.MAX_RETRIES,
      timeout: AI_CLIENT.TIMEOUT_MS,
    });
  }

  /**
   * Detect a supported image type by magic bytes (JPEG / PNG / WebP). Returns the
   * MIME string on success, or null when the bytes are not a supported image.
   * WebP/RIFF is net-new here (diagnostics only accepts JPEG/PNG).
   */
  detectImageMime(buffer: Buffer): ImageMime | null {
    const startsWith = (magic: number[], offset = 0) =>
      magic.every((b, i) => buffer[offset + i] === b);

    if (startsWith(JPEG_MAGIC)) return IMAGE_MIME.JPEG;
    if (startsWith(PNG_MAGIC)) return IMAGE_MIME.PNG;
    if (buffer.length >= 12 && startsWith(RIFF_MAGIC) && startsWith(WEBP_MAGIC, 8)) {
      return IMAGE_MIME.WEBP;
    }
    return null;
  }

  /**
   * Run the vision extraction. Returns a discriminated outcome — a refusal,
   * missing parsed payload, or any OpenAI/parse error resolves to `{ ok: false }`
   * (the service maps that to EXTRACTION_FAILED) rather than throwing a 500.
   */
  async extract(buffer: Buffer, mime: ImageMime): Promise<ExtractionOutcome> {
    const base64 = buffer.toString('base64');

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: RECEIPT_EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mime};base64,${base64}`, detail: 'high' },
          },
          { type: 'text', text: 'Extract the structured data from this receipt.' },
        ],
      },
    ];

    try {
      const completion = await this.openai.chat.completions.parse({
        model: MODEL,
        messages,
        response_format: zodResponseFormat(ReceiptExtractionSchema, 'receipt'),
        max_tokens: MAX_TOKENS,
      });

      const parsed = completion.choices[0]?.message.parsed;
      if (!parsed) {
        const refusal = completion.choices[0]?.message.refusal;
        if (refusal) this.logger.warn(`Receipt extraction refused: ${refusal}`);
        else this.logger.warn('Receipt extraction returned no parsed payload');
        return { ok: false };
      }

      return {
        ok: true,
        extraction: parsed,
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      this.logger.error('Receipt extraction model call failed', err);
      return { ok: false };
    }
  }

  /** Model id used for this extraction (for content_generation_log accounting). */
  get model() {
    return MODEL;
  }
}
