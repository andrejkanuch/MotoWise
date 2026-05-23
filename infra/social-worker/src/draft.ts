/**
 * AI SDK-powered caption + image-prompt drafter.
 *
 * Called from `scheduled.ts` when `claim_next_social_post` returns null —
 * meaning no manually-seeded row exists for the current slot. Produces a
 * fresh {angle, caption, postPrompt, storyPrompt, screenshotKeys} payload
 * ready to insert into `social_post_queue` as status='ready'.
 *
 * Uses the Vercel AI SDK with structured output (Zod schema) so validation
 * is built-in — no hand-rolled JSON parsing or responseJsonSchema needed.
 *
 * Primary model: Google Gemini 3 Flash. Fallback: Gemini 2.5 Flash.
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { APP_FEATURES_MD, DESIGN_SYSTEM_MD, PERFORMANCE_LOG } from './content-references';
import type { Env } from './env';
import { DRAFT_SYSTEM_PROMPT } from './prompts';
import type { SlotName } from './queue';
import { SCREENSHOT_CATALOG, screenshotCatalogForPrompt } from './screenshots';

export interface DraftedPost {
  angle: string;
  caption: string;
  facebookCaption: string;
  postPrompt: string;
  storyPrompt: string;
  screenshotKeys: string[];
}

const PRIMARY_MODEL = 'gemini-3-flash-preview';
const FALLBACK_MODEL = 'gemini-2.5-flash';

/** Valid screenshot keys — constrains Gemini to only pick real catalog entries. */
const VALID_SCREENSHOT_KEYS = Object.keys(SCREENSHOT_CATALOG) as [string, ...string[]];

/** Words that indicate a phone/device in the image prompt — must never appear. */
const DEVICE_WORDS_RE =
  /\b(smartphone|phone|mockup|device|screen|display(?:ing)|iphone|android|mobile|app\s*(?:screen|ui|interface|view)|tablet|hand(?:set|held))\b/gi;

/** Zod schema for structured output — replaces the hand-rolled JSON schema. */
const draftSchema = z.object({
  angle: z
    .string()
    .min(3)
    .max(80)
    .describe(
      'Short kebab-case slug describing the angle, drawn from the angle library (e.g. "cost-per-mile", "service-overdue-pain"). Must NOT repeat recent angles.',
    ),
  contentPillar: z
    .string()
    .describe(
      'Parent pillar. One of: garage, maintenance, expenses, trips, rides, diagnostics, community, learning, pro, seasonal.',
    ),
  caption: z
    .string()
    .min(40)
    .max(2200)
    .describe(
      'Instagram caption. Body 60-280 chars with hook + ONE benefit + ONE CTA (prefer engagement CTAs 3/4 of the time). Append 5-8 hashtags after a blank line, ending with #MotoVault.',
    ),
  facebookCaption: z
    .string()
    .min(40)
    .max(2200)
    .describe(
      'Facebook caption. Same angle as Instagram but more conversational and descriptive (100-400 char body). Facebook audience is 30-55, prefers more context. Use 3-5 hashtags.',
    ),
  postPrompt: z
    .string()
    .min(40)
    .max(1000)
    .describe('Reference 4:5 scene description. 80-200 characters.'),
  storyPrompt: z
    .string()
    .min(40)
    .max(1000)
    .describe(
      '9:16 photorealistic image prompt. 200-400 chars. MUST be purely atmospheric or lifestyle — NO phone, NO device, NO app screen, NO UI. Real screenshots are added separately as carousel slides.',
    ),
  screenshotKeys: z
    .array(z.enum(VALID_SCREENSHOT_KEYS))
    .min(1)
    .max(2)
    .describe(
      'Array of 1-2 screenshot catalog keys (must be exact keys from the catalog). ALWAYS include at least 1 screenshot — every post should showcase the real app UI as carousel slides. Pick the screenshot that best matches the angle.',
    ),
  altText: z
    .string()
    .max(220)
    .describe(
      'Accessibility alt text. 1-2 sentences describing the image factually for screen readers.',
    ),
});

/**
 * Generate a fresh post for the given slot via the AI SDK.
 *
 * `recentAngles` are angle slugs from rows scheduled in the last ~5 days —
 * passed to the model so it doesn't repeat recent themes.
 */
export async function draftPost(
  env: Env,
  slot: SlotName,
  recentAngles: string[],
): Promise<DraftedPost> {
  const recentPosts = PERFORMANCE_LOG.posts.slice(0, 14).map((p) => ({
    date: p.published_at?.slice(0, 10),
    platform: p.platform,
    post_type: p.post_type,
    caption_preview: p.caption_preview?.slice(0, 140) ?? '',
    hook_type: p.classification?.hook_type ?? '',
    content_category: p.classification?.content_category ?? '',
  }));

  const userPrompt = [
    `Slot: ${slot}`,
    `Today (UTC): ${new Date().toISOString().slice(0, 10)}`,
    `Recent angles to AVOID (used within last 5 days): ${recentAngles.join(', ') || '(none)'}`,
    '',
    '## Current engagement crisis (IMPORTANT — shape your output around this)',
    'Our IG account gets 55K reach/month but only 7 comments and near-zero',
    'saves per post. The #1 goal of every caption is to provoke a RESPONSE.',
    'End EVERY post with a specific personal question. Not "thoughts?" but',
    '"What was YOUR first bike?" or "Drop your cost/km below."',
    'Posts that open with "MotoVault tracks..." get 0 engagement — NEVER',
    'lead with the app name. Lead with the rider, their bike, their money.',
    '',
    '## App features reference',
    APP_FEATURES_MD,
    '',
    '## Design system reference',
    DESIGN_SYSTEM_MD,
    '',
    '## Available app screenshots (pick 1-2 for screenshotKeys)',
    screenshotCatalogForPrompt(),
    '',
    '## Recent posts (for voice/style — avoid repeating these angles)',
    JSON.stringify(recentPosts, null, 2),
    '',
    'Draft one complete post for this slot now. Remember: CHALLENGE or PAIN',
    'hook, ONE benefit, end with a specific question riders can answer.',
  ].join('\n');

  return callModel(env, PRIMARY_MODEL, userPrompt);
}

async function callModel(env: Env, model: string, userPrompt: string): Promise<DraftedPost> {
  const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_STUDIO_KEY });

  try {
    const { output } = await generateText({
      model: google(model),
      system: DRAFT_SYSTEM_PROMPT,
      prompt: userPrompt,
      output: Output.object({ schema: draftSchema }),
      temperature: 0.7,
      maxOutputTokens: 2048,
    });

    if (!output) {
      throw new Error(`${model} returned no structured output`);
    }

    // Screenshot keys are already constrained by the z.enum — no silent
    // filtering needed.
    const screenshotKeys = output.screenshotKeys;

    // ALWAYS strip device words from the story prompt — the image generator
    // must never render phone/app screens regardless of whether screenshots
    // are present. When screenshotKeys is non-empty the real app UI ships as
    // carousel slides; when empty the image should still be purely atmospheric.
    let storyPrompt = output.storyPrompt;
    const scrubbed = storyPrompt
      .replace(DEVICE_WORDS_RE, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (scrubbed !== storyPrompt) {
      console.warn(`[draft] storyPrompt contains device words — scrubbing`);
      storyPrompt = scrubbed;
    }

    return {
      angle: output.angle,
      caption: output.caption,
      facebookCaption: output.facebookCaption,
      postPrompt: output.postPrompt,
      storyPrompt,
      screenshotKeys,
    };
  } catch (err) {
    if (model === PRIMARY_MODEL) {
      console.warn(
        `[draft] ${PRIMARY_MODEL} failed: ${err instanceof Error ? err.message : err} — retrying with ${FALLBACK_MODEL}`,
      );
      return callModel(env, FALLBACK_MODEL, userPrompt);
    }
    throw new Error(`Draft failed on ${model}: ${err instanceof Error ? err.message : err}`);
  }
}
