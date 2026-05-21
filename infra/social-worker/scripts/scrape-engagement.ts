#!/usr/bin/env tsx
/**
 * scrape-engagement.ts — pull engagement metrics from Meta Graph API and
 * backfill performance-log.json with real reach/likes/comments/shares data.
 *
 * Run locally. Requires env vars:
 *   META_API_KEY        — Page access token with pages_read_engagement
 *   META_PAGE_ID        — Facebook Page ID
 *   META_IG_USER_ID     — Instagram Business Account ID
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   tsx infra/social-worker/scripts/scrape-engagement.ts
 *   # optionally pass --days=N to look back N days (default 30)
 *
 * What it does:
 *   1. Fetches published rows from social_post_queue (last N days)
 *   2. For each row with post_results containing a post_id / media_id:
 *      - Fetches Facebook post insights (reach, reactions, comments, shares)
 *      - Fetches Instagram media insights (reach, likes, comments, saves, shares)
 *   3. Updates performance-log.json with the engagement data
 *   4. Computes top-performing posts by engagement score for the drafter
 *
 * The performance log is used by the Gemini drafter (via content-references.ts)
 * to understand what content resonates — closing the feedback loop.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GRAPH_API = 'https://graph.facebook.com/v22.0';

const META_API_KEY = env('META_API_KEY');
// META_PAGE_ID and META_IG_USER_ID are used indirectly via post_results IDs
// from the queue, but kept here for future direct-fetch use cases.
const SUPABASE_URL = env('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');

const DAYS_BACK = Number.parseInt(
  process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] ?? '30',
  10,
);

function env(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return val;
}

// ---------------------------------------------------------------------------
// Meta Graph API helpers
// ---------------------------------------------------------------------------

interface FbInsights {
  reach: number;
  reactions: number;
  comments: number;
  shares: number;
}

interface IgInsights {
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
}

async function fetchFbPostInsights(postId: string): Promise<FbInsights | null> {
  try {
    const metrics =
      'post_impressions_unique,post_reactions_by_type_total,post_activity_by_action_type';
    const url = `${GRAPH_API}/${postId}/insights?metric=${metrics}&access_token=${META_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      data?: Array<{ name: string; values: Array<{ value: unknown }> }>;
    };
    if (!data.data?.length) return null;

    const byName = Object.fromEntries(data.data.map((d) => [d.name, d.values[0]?.value]));

    const reactions = byName.post_reactions_by_type_total;
    const totalReactions =
      reactions && typeof reactions === 'object'
        ? Object.values(reactions as Record<string, number>).reduce((a, b) => a + b, 0)
        : 0;

    const activity = byName.post_activity_by_action_type;
    const comments =
      activity && typeof activity === 'object'
        ? ((activity as Record<string, number>).comment ?? 0)
        : 0;
    const shares =
      activity && typeof activity === 'object'
        ? ((activity as Record<string, number>).share ?? 0)
        : 0;

    return {
      reach:
        typeof byName.post_impressions_unique === 'number' ? byName.post_impressions_unique : 0,
      reactions: totalReactions,
      comments,
      shares,
    };
  } catch {
    return null;
  }
}

async function fetchIgMediaInsights(mediaId: string): Promise<IgInsights | null> {
  try {
    const metrics = 'reach,likes,comments,saved,shares';
    const url = `${GRAPH_API}/${mediaId}/insights?metric=${metrics}&access_token=${META_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      data?: Array<{ name: string; values: Array<{ value: number }> }>;
    };
    if (!data.data?.length) return null;

    const byName = Object.fromEntries(data.data.map((d) => [d.name, d.values[0]?.value ?? 0]));

    return {
      reach: byName.reach ?? 0,
      likes: byName.likes ?? 0,
      comments: byName.comments ?? 0,
      saves: byName.saved ?? 0,
      shares: byName.shares ?? 0,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

interface PublishedRow {
  id: string;
  angle: string;
  caption: string;
  slot: string;
  published_at: string;
  post_results: {
    facebook?: { post_id?: string; success?: boolean };
    instagram?: { media_id?: string; success?: boolean };
  } | null;
  story_results: unknown;
}

async function fetchPublishedRows(): Promise<PublishedRow[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - DAYS_BACK);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const url =
    `${SUPABASE_URL}/rest/v1/social_post_queue` +
    `?select=id,angle,caption,slot,published_at,post_results,story_results` +
    `&status=eq.published` +
    `&published_at=gte.${cutoffDate}T00:00:00Z` +
    `&order=published_at.desc`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch published rows: ${res.status} ${body}`);
  }

  return (await res.json()) as PublishedRow[];
}

// ---------------------------------------------------------------------------
// Engagement scoring — used to rank posts for the drafter
// ---------------------------------------------------------------------------

interface ScoredPost {
  id: string;
  caption_preview: string;
  platform: string;
  post_type: string;
  published_at: string;
  angle: string;
  slot: string;
  metrics: {
    facebook?: FbInsights;
    instagram?: IgInsights;
  };
  engagement_score: number;
  classification: {
    hook_type: string;
    content_category: string;
    time_slot: string;
    caption_length: string;
  };
}

/**
 * Engagement score weights (optimized for algorithm reach):
 *   shares × 5 + saves × 4 + comments × 3 + likes/reactions × 1 + reach × 0.01
 *
 * Shares and saves are weighted highest because they're the top algorithm
 * signals (per Meta's own statements).
 */
function computeEngagementScore(fb: FbInsights | null, ig: IgInsights | null): number {
  let score = 0;
  if (fb) {
    score += fb.shares * 5 + fb.comments * 3 + fb.reactions * 1 + fb.reach * 0.01;
  }
  if (ig) {
    score += ig.shares * 5 + ig.saves * 4 + ig.comments * 3 + ig.likes * 1 + ig.reach * 0.01;
  }
  return Math.round(score * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Map angle slug prefix to content pillar. */
const ANGLE_PILLAR_MAP: Record<string, string> = {
  'multi-bike': 'garage',
  garage: 'garage',
  fleet: 'garage',
  primary: 'garage',
  ownership: 'garage',
  'by-the': 'garage',
  service: 'maintenance',
  mileage: 'maintenance',
  oil: 'maintenance',
  chain: 'maintenance',
  tire: 'maintenance',
  brake: 'maintenance',
  valve: 'maintenance',
  major: 'maintenance',
  maintenance: 'maintenance',
  overdue: 'maintenance',
  cost: 'expenses',
  fuel: 'expenses',
  gear: 'expenses',
  monthly: 'expenses',
  second: 'expenses',
  insurance: 'expenses',
  expense: 'expenses',
  add: 'expenses',
  'multi-day': 'trips',
  waypoint: 'trips',
  gpx: 'trips',
  group: 'trips',
  scenic: 'trips',
  pass: 'trips',
  draft: 'trips',
  curvy: 'routes',
  country: 'routes',
  editors: 'routes',
  'day-by': 'trips',
  difficulty: 'trips',
  live: 'rides',
  lean: 'rides',
  ride: 'rides',
  weekly: 'rides',
  'all-time': 'rides',
  quick: 'rides',
  elevation: 'rides',
  activity: 'rides',
  photo: 'diagnostics',
  text: 'diagnostics',
  claude: 'diagnostics',
  'no-obd': 'diagnostics',
  'sub-5': 'diagnostics',
  recent: 'diagnostics',
  severity: 'diagnostics',
  rider: 'community',
  share: 'community',
  follow: 'community',
  learning: 'learning',
  progress: 'learning',
  beginner: 'learning',
  returning: 'learning',
  pro: 'pro',
  spring: 'seasonal',
  winter: 'seasonal',
  riding: 'seasonal',
  holiday: 'seasonal',
  anniversary: 'seasonal',
  first: 'seasonal',
};

function inferPillar(angle: string): string {
  const prefix = angle.split('-').slice(0, 2).join('-');
  if (ANGLE_PILLAR_MAP[prefix]) return ANGLE_PILLAR_MAP[prefix];
  const firstWord = angle.split('-')[0];
  return ANGLE_PILLAR_MAP[firstWord] ?? '';
}

async function main(): Promise<void> {
  console.log(`Fetching published posts from last ${DAYS_BACK} days...`);
  const rows = await fetchPublishedRows();
  console.log(`Found ${rows.length} published posts`);

  if (rows.length === 0) {
    console.log('No published posts to scrape. Exiting.');
    return;
  }

  const scoredPosts: ScoredPost[] = [];

  for (const row of rows) {
    const fbPostId = row.post_results?.facebook?.post_id;
    const igMediaId = row.post_results?.instagram?.media_id;

    // Fetch FB + IG insights in parallel — both are independent GET calls.
    const [fbInsights, igInsights] = await Promise.all([
      fbPostId ? fetchFbPostInsights(fbPostId) : Promise.resolve(null),
      igMediaId ? fetchIgMediaInsights(igMediaId) : Promise.resolve(null),
    ]);

    if (fbPostId) {
      console.log(`  FB ${fbPostId}: ${fbInsights ? `reach=${fbInsights.reach}` : '(no data)'}`);
    }
    if (igMediaId) {
      console.log(`  IG ${igMediaId}: ${igInsights ? `reach=${igInsights.reach}` : '(no data)'}`);
    }

    const captionLen = row.caption?.length ?? 0;

    scoredPosts.push({
      id: row.id,
      caption_preview: row.caption?.slice(0, 140) ?? '',
      platform: fbPostId && igMediaId ? 'both' : fbPostId ? 'facebook' : 'instagram',
      post_type: 'photo',
      published_at: row.published_at,
      angle: row.angle ?? '',
      slot: row.slot,
      metrics: {
        ...(fbInsights ? { facebook: fbInsights } : {}),
        ...(igInsights ? { instagram: igInsights } : {}),
      },
      engagement_score: computeEngagementScore(fbInsights, igInsights),
      classification: {
        hook_type: '',
        content_category: inferPillar(row.angle ?? ''),
        time_slot: row.slot,
        caption_length: captionLen < 100 ? 'short' : captionLen < 250 ? 'medium' : 'long',
      },
    });

    // Rate limiting — 2 parallel calls per iteration, 300ms pause = ~6.6 calls/s
    // (well under Meta's 200 calls/hour limit).
    await new Promise((r) => setTimeout(r, 300));
  }

  // Sort by engagement score (highest first).
  scoredPosts.sort((a, b) => b.engagement_score - a.engagement_score);

  const performanceLog = {
    last_updated: new Date().toISOString(),
    scrape_source: `Meta Graph API v22 — last ${DAYS_BACK} days (automated scrape)`,
    posts: scoredPosts,
  };

  const outPath = resolve(
    import.meta.dirname ?? '.',
    '../../../marketing/motovault-social/data/performance-log.json',
  );
  writeFileSync(outPath, `${JSON.stringify(performanceLog, null, 2)}\n`);

  console.log(`\nWrote ${scoredPosts.length} posts to ${outPath}`);
  console.log(`Top 5 by engagement score:`);
  for (const post of scoredPosts.slice(0, 5)) {
    console.log(
      `  ${post.engagement_score.toFixed(1)} | ${post.angle} | ${post.caption_preview.slice(0, 60)}...`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
