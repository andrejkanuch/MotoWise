/**
 * Build-time bundling of brand-voice reference content for the Gemini drafter.
 *
 * These files live in the `marketing/motovault-social/` workspace and get
 * embedded into the Worker bundle at deploy time:
 *   - `.md` files are imported as raw text via the Text module rule in
 *     wrangler.toml ([[rules]] type="Text" globs=["**\/*.md"] fallthrough=true)
 *   - `.json` is imported as parsed JSON via wrangler's default JSON loader
 *
 * Total embedded size at time of writing: ~55KB raw, ~15KB gzipped — trivial
 * inside the Worker's 1MB free-tier bundle budget.
 *
 * IMPORTANT: these paths reach OUTSIDE the social-worker package boundary.
 * Don't relocate marketing/motovault-social/ without updating these imports.
 * The social-worker bundle depends on those files existing at build time.
 */

import PERFORMANCE_LOG_RAW from '../../../marketing/motovault-social/data/performance-log.json';
import APP_FEATURES_MD from '../../../marketing/motovault-social/references/app-features.md';
import DESIGN_SYSTEM_MD from '../../../marketing/motovault-social/references/design-system.md';

interface PerformanceLogPost {
  id: string;
  caption_preview: string;
  platform: string;
  post_type: string;
  published_at: string;
  classification?: {
    hook_type?: string;
    content_category?: string;
    time_slot?: string;
    caption_length?: string;
  };
}

interface PerformanceLog {
  last_updated: string;
  posts: PerformanceLogPost[];
}

// Cast the imported JSON to our typed shape. Done once at module load.
const PERFORMANCE_LOG = PERFORMANCE_LOG_RAW as unknown as PerformanceLog;

export { APP_FEATURES_MD, DESIGN_SYSTEM_MD, PERFORMANCE_LOG };
export type { PerformanceLogPost };
