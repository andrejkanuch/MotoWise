import type { DiagnosticResult } from '@motovault/types';
import { DiagnosticAiResultSchema, MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH } from '@motovault/types';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { AiBudgetService } from '../ai-budget/ai-budget.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { EXPERIENCE_PROMPTS, MAINTENANCE_PROMPTS, URGENCY_PROMPTS } from './prompt-templates';

const MODEL = 'gpt-4.1';
const INPUT_COST_PER_MTOK = 3;
const OUTPUT_COST_PER_MTOK = 12;

/** JPEG magic bytes: FF D8 FF */
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
/** PNG magic bytes: 89 50 4E 47 */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

interface AnalyzeContext {
  make?: string;
  model?: string;
  year?: number;
  freeTextDescription?: string;
  additionalNotes?: string;
  wizardAnswers?: { symptoms?: string; location?: string; timing?: string };
  experienceLevel?: string;
  maintenanceStyle?: string;
  ridingFrequency?: string;
  urgency?: string;
  motorcycleType?: string;
  mileage?: number;
  mileageUnit?: string;
  engineCc?: number;
  hasPhoto?: boolean;
}

@Injectable()
export class DiagnosticAiService {
  private readonly logger = new Logger(DiagnosticAiService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly aiBudgetService: AiBudgetService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.getOrThrow('OPENAI_API_KEY'),
      maxRetries: 3,
      timeout: 60_000,
    });
  }

  private buildSystemPrompt(context: AnalyzeContext): string {
    const parts: string[] = [
      'You are an expert motorcycle mechanic and diagnostician.',
      'Analyze the provided information (and photo if available) to diagnose potential issues.',
      'Be specific about the part affected, potential issues with probabilities, severity, tools needed, difficulty level, and recommended next steps.',
      'Always err on the side of caution — if something could be dangerous, flag it as high or critical severity.',
    ];

    if (context.experienceLevel && EXPERIENCE_PROMPTS[context.experienceLevel]) {
      parts.push(EXPERIENCE_PROMPTS[context.experienceLevel]);
    }

    if (context.maintenanceStyle && MAINTENANCE_PROMPTS[context.maintenanceStyle]) {
      parts.push(MAINTENANCE_PROMPTS[context.maintenanceStyle]);
    }

    if (context.urgency && URGENCY_PROMPTS[context.urgency]) {
      parts.push(URGENCY_PROMPTS[context.urgency]);
    }

    if (context.motorcycleType) {
      parts.push(`Motorcycle type: ${context.motorcycleType}.`);
    }

    if (context.engineCc) {
      parts.push(`Engine displacement: ${context.engineCc}cc.`);
    }

    if (context.mileage && context.mileageUnit) {
      parts.push(`Current mileage: ${context.mileage} ${context.mileageUnit}.`);
    }

    if (context.ridingFrequency) {
      parts.push(`Riding frequency: ${context.ridingFrequency}.`);
    }

    return parts.join('\n');
  }

  private validateImageMimeType(photoBase64: string): void {
    const raw = Buffer.from(photoBase64.slice(0, 8), 'base64');
    const bytes = Array.from(raw);

    const isJpeg = JPEG_MAGIC.every((b, i) => bytes[i] === b);
    const isPng = PNG_MAGIC.every((b, i) => bytes[i] === b);

    if (!isJpeg && !isPng) {
      throw new BadRequestException('Unsupported image format. Only JPEG and PNG are accepted.');
    }
  }

  async analyze(
    diagnosticId: string,
    userId: string,
    photoBase64: string | undefined,
    context: AnalyzeContext,
  ): Promise<DiagnosticResult> {
    // Check AI budget before processing
    await this.aiBudgetService.checkBudgetForUser(userId);

    // Validate image size before processing
    if (photoBase64 && photoBase64.length > MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH) {
      this.logger.warn(
        `Rejected oversized diagnostic image upload: ${photoBase64.length} chars (max ${MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH}), diagnosticId=${diagnosticId}`,
      );
      await this.updateDiagnosticStatus(diagnosticId, 'failed');
      throw new HttpException('Image exceeds maximum size of 5 MB', HttpStatus.PAYLOAD_TOO_LARGE);
    }

    // Validate MIME type if photo is provided
    if (photoBase64) {
      this.validateImageMimeType(photoBase64);
    }

    const systemPrompt = this.buildSystemPrompt(context);

    // Build user content blocks
    const userContent: OpenAI.ChatCompletionContentPart[] = [];

    // Add image if provided
    if (photoBase64) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${photoBase64}`,
          detail: 'high',
        },
      });
    }

    // Build text prompt
    const bikeInfo =
      context.year && context.make && context.model
        ? `${context.year} ${context.make} ${context.model}`
        : context.make && context.model
          ? `${context.make} ${context.model}`
          : (context.motorcycleType ?? 'motorcycle');

    const textParts: string[] = [`Diagnose the issue with this ${bikeInfo}.`];

    if (context.freeTextDescription?.trim()) {
      textParts.push(
        `\n<user_description>${context.freeTextDescription.trim()}</user_description>`,
      );
    }

    if (context.additionalNotes?.trim()) {
      textParts.push(`\n<additional_notes>${context.additionalNotes.trim()}</additional_notes>`);
    }

    if (context.wizardAnswers) {
      const wa = context.wizardAnswers;
      const wizardParts: string[] = [];
      if (wa.symptoms?.trim()) wizardParts.push(`Symptoms: ${wa.symptoms.trim()}`);
      if (wa.location?.trim()) wizardParts.push(`Location on bike: ${wa.location.trim()}`);
      if (wa.timing?.trim()) wizardParts.push(`When it happens: ${wa.timing.trim()}`);
      if (wizardParts.length > 0) {
        textParts.push(`\n<wizard_answers>\n${wizardParts.join('\n')}\n</wizard_answers>`);
      }
    }

    if (photoBase64) {
      textParts.push('\nAnalyze the image carefully and provide your diagnosis.');
    } else {
      textParts.push('\nProvide your diagnosis based on the description provided.');
    }

    userContent.push({ type: 'text', text: textParts.join('') });

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];

    try {
      const completion = await this.openai.chat.completions.parse({
        model: MODEL,
        messages,
        response_format: zodResponseFormat(DiagnosticAiResultSchema, 'diagnosis'),
        max_tokens: 2048,
      });

      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;

      const parsed = completion.choices[0].message.parsed;

      if (!parsed) {
        const refusal = completion.choices[0].message.refusal;
        if (refusal) {
          this.logger.warn(`AI refused diagnostic request: ${refusal}`);
        }
        await this.updateDiagnosticStatus(diagnosticId, 'failed');
        throw new InternalServerErrorException('AI did not return structured diagnostic result');
      }

      const result: DiagnosticResult = {
        part: parsed.part,
        issues: parsed.issues,
        severity: parsed.severity as DiagnosticResult['severity'],
        toolsNeeded: parsed.toolsNeeded,
        difficulty: parsed.difficulty as DiagnosticResult['difficulty'],
        nextSteps: parsed.nextSteps,
        confidence: parsed.confidence,
        relatedArticleId: parsed.relatedArticleId,
      };

      // Update diagnostic record with results
      const { error: updateError } = await this.adminClient
        .from('diagnostics')
        .update({
          result_json: result as unknown as Record<string, unknown>,
          severity: result.severity,
          confidence: result.confidence,
          related_article_id: result.relatedArticleId,
          status: 'completed',
        })
        .eq('id', diagnosticId);

      if (updateError) {
        this.logger.error('Failed to update diagnostic result', updateError);
        throw new InternalServerErrorException('Failed to save diagnostic result');
      }

      const costCents = Math.round(
        (inputTokens * INPUT_COST_PER_MTOK + outputTokens * OUTPUT_COST_PER_MTOK) / 10000,
      );

      // Log generation (fire-and-forget)
      this.adminClient
        .from('content_generation_log')
        .insert({
          user_id: userId,
          content_type: 'diagnostic',
          content_id: diagnosticId,
          model: MODEL,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_cents: costCents,
          status: 'success',
        })
        .then();

      return result;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      if (err instanceof HttpException) throw err;
      this.logger.error('Diagnostic AI analysis failed', err);

      await this.updateDiagnosticStatus(diagnosticId, 'failed');

      // Log failure (fire-and-forget)
      this.adminClient
        .from('content_generation_log')
        .insert({
          user_id: userId,
          content_type: 'diagnostic',
          content_id: diagnosticId,
          model: MODEL,
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .then();

      throw new InternalServerErrorException('Diagnostic analysis failed');
    }
  }

  private async updateDiagnosticStatus(diagnosticId: string, status: string): Promise<void> {
    await this.adminClient.from('diagnostics').update({ status }).eq('id', diagnosticId);
  }
}
