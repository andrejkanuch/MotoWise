import Anthropic from '@anthropic-ai/sdk';
import { ArticleContentSchema } from '@motolearn/types';
import type { Tables } from '@motolearn/types/database';
import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { Article } from './models/article.model';

const MODEL = 'claude-sonnet-4-20250514';
const INPUT_COST_PER_MTOK = 3;
const OUTPUT_COST_PER_MTOK = 15;

@Injectable()
export class ArticleGeneratorService {
  private readonly logger = new Logger(ArticleGeneratorService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.getOrThrow('ANTHROPIC_API_KEY'),
    });
  }

  async generate(topic: string, category?: string, difficulty?: string): Promise<Article> {
    const systemPrompt = `You are a motorcycle expert writing educational articles for riders.
You write clear, accurate, and practical content that helps riders understand their motorcycles better.
Always prioritize safety information when relevant.`;

    const userPrompt = `Write an educational article about: "${topic}"
${category ? `Target category: ${category}` : ''}
${difficulty ? `Target difficulty level: ${difficulty}` : 'Choose an appropriate difficulty level.'}

Requirements:
- Generate 3-5 detailed sections with clear headings
- Include 3-5 key takeaways
- Suggest 2-4 related topics for further reading
- Generate a URL-friendly slug from the title
- If the topic is safety-related, note that in your content`;

    try {
      const response = await this.anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [
          {
            name: 'create_article',
            description: 'Create a structured motorcycle educational article',
            input_schema: {
              type: 'object' as const,
              properties: {
                title: { type: 'string', description: 'Article title' },
                slug: {
                  type: 'string',
                  description: 'URL-friendly slug (kebab-case)',
                },
                difficulty: {
                  type: 'string',
                  enum: ['beginner', 'intermediate', 'advanced'],
                },
                category: {
                  type: 'string',
                  enum: [
                    'engine',
                    'brakes',
                    'electrical',
                    'suspension',
                    'drivetrain',
                    'tires',
                    'fuel',
                    'general',
                  ],
                },
                sections: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      heading: { type: 'string' },
                      body: { type: 'string' },
                    },
                    required: ['heading', 'body'],
                  },
                  minItems: 3,
                  maxItems: 5,
                },
                keyTakeaways: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 3,
                  maxItems: 5,
                },
                relatedTopics: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 2,
                  maxItems: 4,
                },
              },
              required: [
                'title',
                'slug',
                'difficulty',
                'category',
                'sections',
                'keyTakeaways',
                'relatedTopics',
              ],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'create_article' },
      });

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;

      const toolBlock = response.content.find((block) => block.type === 'tool_use');
      if (!toolBlock || toolBlock.type !== 'tool_use') {
        throw new InternalServerErrorException('AI did not return structured article content');
      }

      const parsed = ArticleContentSchema.safeParse(toolBlock.input);
      if (!parsed.success) {
        this.logger.error('AI output validation failed', parsed.error.flatten());
        throw new InternalServerErrorException('AI generated invalid article structure');
      }

      const content = parsed.data;
      const uniqueSuffix = Math.random().toString(36).substring(2, 6);
      const slug = `${content.slug}-${uniqueSuffix}`;

      const rawText = content.sections.map((s) => `${s.heading}\n${s.body}`).join('\n\n');
      const readTimeMinutes = Math.max(1, Math.ceil(rawText.split(/\s+/).length / 200));

      const isSafetyCritical =
        topic.toLowerCase().includes('safety') ||
        rawText.toLowerCase().includes('safety critical') ||
        content.category === 'brakes';

      const { data, error } = await this.adminClient
        .from('articles')
        .insert({
          title: content.title,
          slug,
          content_json: content as unknown as Record<string, unknown>,
          raw_text: rawText,
          difficulty: content.difficulty,
          category: content.category,
          read_time_minutes: readTimeMinutes,
          is_safety_critical: isSafetyCritical,
          generated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !data) {
        this.logger.error('Failed to insert article', error);
        throw new InternalServerErrorException('Failed to save generated article');
      }

      const costCents = Math.round(
        (inputTokens * INPUT_COST_PER_MTOK + outputTokens * OUTPUT_COST_PER_MTOK) / 10000,
      );

      // Log generation (fire-and-forget)
      this.adminClient
        .from('content_generation_log')
        .insert({
          content_type: 'article',
          content_id: data.id,
          model: MODEL,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_cents: costCents,
          status: 'success',
        })
        .then();

      return this.mapRow(data);
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error('Article generation failed', err);

      // Log failure (fire-and-forget)
      this.adminClient
        .from('content_generation_log')
        .insert({
          content_type: 'article',
          model: MODEL,
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .then();

      throw new InternalServerErrorException('Article generation failed');
    }
  }

  private mapRow(
    row: Pick<
      Tables<'articles'>,
      | 'id'
      | 'slug'
      | 'title'
      | 'difficulty'
      | 'category'
      | 'view_count'
      | 'is_safety_critical'
      | 'generated_at'
      | 'updated_at'
      | 'content_json'
      | 'read_time_minutes'
    >,
  ): Article {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      difficulty: row.difficulty,
      category: row.category,
      viewCount: row.view_count,
      isSafetyCritical: row.is_safety_critical,
      generatedAt: row.generated_at,
      updatedAt: row.updated_at,
      contentJson: row.content_json as Record<string, unknown> | undefined,
      readTime: row.read_time_minutes ?? undefined,
    };
  }
}
