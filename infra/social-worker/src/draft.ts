/**
 * Gemini-powered caption + image-prompt drafter.
 *
 * Called from `scheduled.ts` when `claim_next_social_post` returns null —
 * meaning no manually-seeded row exists for the current slot. Produces a
 * fresh {angle, caption, postPrompt, storyPrompt} payload ready to insert
 * into `social_post_queue` as status='ready'.
 *
 * Design notes:
 *   - Reuses the existing GOOGLE_AI_STUDIO_KEY wrangler secret that
 *     `publish.ts:generateImage` already uses for image gen. Same vendor,
 *     same key, same auth pattern (`?key=${...}` in query string).
 *   - Uses structured JSON output (`responseMimeType: 'application/json'` +
 *     `responseJsonSchema`) so no regex/markdown parsing of the response.
 *   - Primary model: gemini-3-flash-preview. Fallback: gemini-2.5-flash.
 *     Falls through on HTTP errors AND on non-STOP finishReason
 *     (SAFETY/RECITATION/PROHIBITED_CONTENT/MALFORMED_FUNCTION_CALL).
 *   - No zod dep in the worker package — validateDraft is hand-rolled to
 *     match the existing fill-queue.ts validation style and avoid adding
 *     ~30KB to the bundle.
 *
 * Cost (Gemini 3 Flash Preview paid tier as of 2026-04):
 *   Input  $0.50 / 1M tokens. Output $3.00 / 1M tokens.
 *   ~10k input + ~800 output per call ≈ $0.0074 per call.
 *   3 calls/day × 30 = 90 calls/month ≈ $0.67/month.
 *   Likely $0 on free tier (3 RPD << 100 RPD limit).
 */
import { APP_FEATURES_MD, DESIGN_SYSTEM_MD, PERFORMANCE_LOG } from './content-references';
import type { Env } from './env';
import { DRAFT_RESPONSE_SCHEMA, DRAFT_SYSTEM_PROMPT } from './prompts';
import type { SlotName } from './queue';

export interface DraftedPost {
  angle: string;
  caption: string;
  postPrompt: string; // prompt for 4:5 post image
  storyPrompt: string; // prompt for 9:16 story image
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
  finishReason?: string;
}

interface GeminiTextResponse {
  candidates?: GeminiCandidate[];
  /**
   * Fires when the *input* prompt is blocked by safety filters before any
   * generation happens. Distinct from `candidate.finishReason` which fires
   * mid-generation. If set, `candidates` is typically absent — so we must
   * check this BEFORE falling through to the "no text" error path.
   */
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

const PRIMARY_MODEL = 'gemini-3-flash-preview';
const FALLBACK_MODEL = 'gemini-2.5-flash';

// Non-STOP finishReasons that should trigger the fallback model. STOP is
// normal completion. MAX_TOKENS means truncation — we treat that as a soft
// failure too since structured output may be incomplete.
const RETRYABLE_FINISH_REASONS = new Set([
  'SAFETY',
  'RECITATION',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'MALFORMED_FUNCTION_CALL',
  'MAX_TOKENS',
]);

/**
 * Generate a fresh post for the given slot via Gemini.
 *
 * `recentAngles` are angle slugs from rows scheduled in the last ~5 days —
 * passed to the model so it doesn't repeat recent themes.
 */
export async function draftPost(
  env: Env,
  slot: SlotName,
  recentAngles: string[],
): Promise<DraftedPost> {
  // Slim the performance log to the last 14 entries (~5 days of 3x daily)
  // and strip heavy fields. The full PERFORMANCE_LOG JSON is embedded in
  // the bundle but only this excerpt reaches the Gemini prompt, keeping
  // token usage bounded.
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
    '## App features reference',
    APP_FEATURES_MD,
    '',
    '## Design system reference',
    DESIGN_SYSTEM_MD,
    '',
    '## Recent posts (for voice/style — avoid repeating these angles)',
    JSON.stringify(recentPosts, null, 2),
    '',
    'Draft one complete post for this slot now. Respond with JSON matching the schema.',
  ].join('\n');

  return callGemini(env, PRIMARY_MODEL, userPrompt);
}

async function callGemini(env: Env, model: string, userPrompt: string): Promise<DraftedPost> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_AI_STUDIO_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: DRAFT_SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: DRAFT_RESPONSE_SCHEMA,
        temperature: 0.9,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (model === PRIMARY_MODEL) {
      console.warn(
        `[draft] ${PRIMARY_MODEL} http ${res.status}: ${body.slice(0, 200)} — retrying with ${FALLBACK_MODEL}`,
      );
      return callGemini(env, FALLBACK_MODEL, userPrompt);
    }
    throw new Error(`Gemini draft failed (${model}, ${res.status}): ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as GeminiTextResponse;

  // Input-level block: Gemini rejected the PROMPT before generating anything.
  // Distinct from candidate.finishReason (which fires mid-generation). When
  // present, `candidates` is typically absent, so we must handle this before
  // trying to read from candidates.
  const promptBlockReason = data.promptFeedback?.blockReason;
  if (promptBlockReason) {
    if (model === PRIMARY_MODEL) {
      console.warn(
        `[draft] ${PRIMARY_MODEL} promptFeedback.blockReason=${promptBlockReason} — retrying with ${FALLBACK_MODEL}`,
      );
      return callGemini(env, FALLBACK_MODEL, userPrompt);
    }
    throw new Error(`Gemini draft prompt blocked (${model}, blockReason=${promptBlockReason})`);
  }

  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason;

  // Fall through to fallback on non-STOP finishReasons. Only SAFETY/RECITATION/
  // PROHIBITED_CONTENT/BLOCKLIST/MAX_TOKENS/MALFORMED_FUNCTION_CALL are retryable;
  // an undefined finishReason is treated as STOP (some Gemini responses omit it
  // for successful short outputs).
  if (finishReason && finishReason !== 'STOP' && RETRYABLE_FINISH_REASONS.has(finishReason)) {
    if (model === PRIMARY_MODEL) {
      console.warn(
        `[draft] ${PRIMARY_MODEL} finishReason=${finishReason} — retrying with ${FALLBACK_MODEL}`,
      );
      return callGemini(env, FALLBACK_MODEL, userPrompt);
    }
    throw new Error(`Gemini draft blocked (${model}, finishReason=${finishReason})`);
  }

  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(
      `Gemini draft returned no text (${model}, finishReason=${finishReason ?? 'undefined'})`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Gemini draft returned invalid JSON (${model}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return validateDraft(parsed);
}

/**
 * Runtime validation of the Gemini structured output. Hand-rolled rather than
 * using zod to keep the worker bundle small (zod is ~30KB gzipped, which isn't
 * a lot but the worker package has no other zod consumer).
 *
 * Matches the validation style used in scripts/fill-queue.ts.
 */
function validateDraft(raw: unknown): DraftedPost {
  if (!raw || typeof raw !== 'object') {
    throw new Error('draft validation: response is not an object');
  }
  const d = raw as Record<string, unknown>;
  const fields = ['angle', 'caption', 'postPrompt', 'storyPrompt'] as const;
  for (const f of fields) {
    const v = d[f];
    if (typeof v !== 'string' || v.trim() === '') {
      throw new Error(`draft validation: field "${f}" missing or empty`);
    }
  }

  // Length bounds — enforced here since Gemini's responseJsonSchema doesn't
  // support minLength/maxLength on strings (see prompts.ts comment).
  const angle = (d.angle as string).trim();
  const caption = (d.caption as string).trim();
  const postPrompt = (d.postPrompt as string).trim();
  const storyPrompt = (d.storyPrompt as string).trim();

  // Caption bounds — IG hard limit is 2200, soft floor 40 to catch truncation.
  if (caption.length > 2200) {
    throw new Error(`draft validation: caption ${caption.length} chars exceeds IG 2200 limit`);
  }
  if (caption.length < 40) {
    throw new Error(`draft validation: caption ${caption.length} chars too short`);
  }

  // Prompt bounds — plan spec is 200-400 chars. We enforce [40, 1000] here:
  // the floor catches truncated model output, the ceiling prevents runaway
  // prompts (e.g. an adversarial or buggy Gemini response with a 50KB scene
  // description) from being passed downstream into generateImage() on every
  // cron tick and burning Gemini image-gen quota.
  if (postPrompt.length < 40) {
    throw new Error(`draft validation: postPrompt ${postPrompt.length} chars too short`);
  }
  if (postPrompt.length > 1000) {
    throw new Error(`draft validation: postPrompt ${postPrompt.length} chars exceeds 1000`);
  }
  if (storyPrompt.length < 40) {
    throw new Error(`draft validation: storyPrompt ${storyPrompt.length} chars too short`);
  }
  if (storyPrompt.length > 1000) {
    throw new Error(`draft validation: storyPrompt ${storyPrompt.length} chars exceeds 1000`);
  }

  if (angle.length < 3 || angle.length > 80) {
    throw new Error(`draft validation: angle length ${angle.length} out of range`);
  }

  return { angle, caption, postPrompt, storyPrompt };
}
