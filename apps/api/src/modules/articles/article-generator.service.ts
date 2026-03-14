import { ArticleContentSchema, FREE_TIER_LIMITS } from '@motovault/types';
import type { Tables } from '@motovault/types/database';
import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { AiBudgetService } from '../ai-budget/ai-budget.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { Article } from './models/article.model';

const MODEL = 'gpt-4.1';
const INPUT_COST_PER_MTOK = 3;
const OUTPUT_COST_PER_MTOK = 12;

// zodResponseFormat-compatible schema (no .optional(), no .refine())
const ArticleAiResponseSchema = z.object({
  title: z.string().describe('Article title'),
  slug: z.string().describe('URL-friendly slug in kebab-case'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  category: z.enum([
    'engine',
    'brakes',
    'electrical',
    'suspension',
    'drivetrain',
    'tires',
    'fuel',
    'general',
  ]),
  sections: z
    .array(
      z.object({
        heading: z.string().describe('Section heading'),
        body: z.string().describe('Section body text'),
      }),
    )
    .describe('3-5 detailed sections'),
  keyTakeaways: z.array(z.string()).describe('3-5 key takeaways'),
  relatedTopics: z.array(z.string()).describe('2-4 related topic suggestions'),
});

@Injectable()
export class ArticleGeneratorService {
  private readonly logger = new Logger(ArticleGeneratorService.name);
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

  async generate(
    userId: string,
    topic: string,
    category?: string,
    difficulty?: string,
  ): Promise<Article> {
    // Enforce free tier weekly article limit
    await this.enforceFreeTierArticleLimit(userId);

    // Check AI budget before generating
    await this.aiBudgetService.checkBudgetForUser(userId);
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
      const completion = await this.openai.chat.completions.parse({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: zodResponseFormat(ArticleAiResponseSchema, 'article'),
        max_tokens: 4096,
      });

      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;

      const parsed = completion.choices[0].message.parsed;
      if (!parsed) {
        throw new InternalServerErrorException('AI did not return structured article content');
      }

      // Validate with the existing ArticleContentSchema for consistency
      const validated = ArticleContentSchema.safeParse(parsed);
      if (!validated.success) {
        this.logger.error('AI output validation failed', validated.error.flatten());
        throw new InternalServerErrorException('AI generated invalid article structure');
      }

      const content = validated.data;
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
          user_id: userId,
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
      if (err instanceof ForbiddenException) throw err;
      this.logger.error('Article generation failed', err);

      // Log failure (fire-and-forget)
      this.adminClient
        .from('content_generation_log')
        .insert({
          user_id: userId,
          content_type: 'article',
          model: MODEL,
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .then();

      throw new InternalServerErrorException('Article generation failed');
    }
  }

  private async enforceFreeTierArticleLimit(userId: string): Promise<void> {
    const { data: userData } = await this.adminClient
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const tier = (userData?.subscription_tier as 'free' | 'pro') ?? 'free';
    if (tier === 'pro') return;

    // Calculate start of current week (Monday 00:00 UTC)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysSinceMonday);
    weekStart.setUTCHours(0, 0, 0, 0);

    const { count, error } = await this.adminClient
      .from('content_generation_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('content_type', 'article')
      .eq('status', 'success')
      .gte('created_at', weekStart.toISOString());

    if (error) {
      this.logger.error('Failed to count weekly articles for tier check', error);
      // Fail open — don't block generation if count check fails
      return;
    }

    if ((count ?? 0) >= FREE_TIER_LIMITS.MAX_ARTICLES_PER_WEEK) {
      this.logger.warn(
        `User ${userId} hit free tier weekly article limit: ${count}/${FREE_TIER_LIMITS.MAX_ARTICLES_PER_WEEK}`,
      );
      throw new ForbiddenException(
        `Free plan allows up to ${FREE_TIER_LIMITS.MAX_ARTICLES_PER_WEEK} articles per week. Upgrade to Pro for unlimited articles.`,
      );
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
