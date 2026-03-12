import Anthropic from '@anthropic-ai/sdk';
import type { DiagnosticResult } from '@motovault/types';
import { DiagnosticResultSchema } from '@motovault/types';
import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';

const MODEL = 'claude-sonnet-4-20250514';
const INPUT_COST_PER_MTOK = 3;
const OUTPUT_COST_PER_MTOK = 15;

@Injectable()
export class DiagnosticAiService {
  private readonly logger = new Logger(DiagnosticAiService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.getOrThrow('ANTHROPIC_API_KEY'),
    });
  }

  async analyze(
    diagnosticId: string,
    photoBase64: string,
    context: {
      make: string;
      model: string;
      year: number;
      description?: string;
      wizardAnswers?: Record<string, string>;
    },
  ): Promise<DiagnosticResult> {
    const systemPrompt = `You are an expert motorcycle mechanic and diagnostician.
Analyze the provided photo and context to diagnose potential issues.
Be specific about the part affected, potential issues with probabilities, severity, tools needed, difficulty level, and recommended next steps.
Always err on the side of caution — if something could be dangerous, flag it as high or critical severity.`;

    const wizardContext = context.wizardAnswers
      ? `\nWizard answers from user:\n${Object.entries(context.wizardAnswers)
          .map(([q, a]) => `- ${q}: ${a}`)
          .join('\n')}`
      : '';

    const descriptionContext = context.description
      ? `\nUser description: ${context.description}`
      : '';

    const userPrompt = `Diagnose the issue shown in this photo of a ${context.year} ${context.make} ${context.model}.${descriptionContext}${wizardContext}

Analyze the image carefully and provide your diagnosis.`;

    try {
      const response = await this.anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: photoBase64,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
        tools: [
          {
            name: 'submit_diagnosis',
            description: 'Submit a structured motorcycle diagnostic result',
            input_schema: {
              type: 'object' as const,
              properties: {
                part: {
                  type: 'string',
                  description: 'The motorcycle part/component affected',
                },
                issues: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      description: { type: 'string' },
                      probability: { type: 'number', minimum: 0, maximum: 1 },
                    },
                    required: ['description', 'probability'],
                  },
                },
                severity: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'critical'],
                },
                toolsNeeded: {
                  type: 'array',
                  items: { type: 'string' },
                },
                difficulty: {
                  type: 'string',
                  enum: ['easy', 'moderate', 'hard', 'professional'],
                },
                nextSteps: {
                  type: 'array',
                  items: { type: 'string' },
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                },
                relatedArticleId: {
                  type: 'string',
                  nullable: true,
                  description: 'UUID of a related article, or null if none',
                },
              },
              required: [
                'part',
                'issues',
                'severity',
                'toolsNeeded',
                'difficulty',
                'nextSteps',
                'confidence',
                'relatedArticleId',
              ],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'submit_diagnosis' },
      });

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;

      const toolBlock = response.content.find((block) => block.type === 'tool_use');
      if (!toolBlock || toolBlock.type !== 'tool_use') {
        await this.updateDiagnosticStatus(diagnosticId, 'failed');
        throw new InternalServerErrorException('AI did not return structured diagnostic result');
      }

      const parsed = DiagnosticResultSchema.safeParse(toolBlock.input);
      if (!parsed.success) {
        this.logger.error('AI diagnostic output validation failed', parsed.error.flatten());
        await this.updateDiagnosticStatus(diagnosticId, 'failed');
        throw new InternalServerErrorException('AI generated invalid diagnostic structure');
      }

      const result = parsed.data;

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
      this.logger.error('Diagnostic AI analysis failed', err);

      await this.updateDiagnosticStatus(diagnosticId, 'failed');

      // Log failure (fire-and-forget)
      this.adminClient
        .from('content_generation_log')
        .insert({
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
