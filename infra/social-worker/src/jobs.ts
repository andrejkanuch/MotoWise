/**
 * KV-backed job state for async /publish-now pipeline.
 *
 * Jobs are stored in the JOBS KV namespace with a 24h TTL so stale
 * entries self-clean. The /publish-now handler creates a job, returns
 * the ID immediately, and runs the pipeline in ctx.waitUntil(). The
 * GET /job/:id endpoint reads the current state for polling.
 */

export type JobStep =
  | 'pending'
  | 'drafting'
  | 'generating_image'
  | 'fetching_screenshots'
  | 'publishing'
  | 'completed'
  | 'failed';

export interface JobState {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  topic: string;
  step: JobStep;
  result?: Record<string, unknown>;
  error?: string;
  created_at: string;
  updated_at: string;
}

const TTL = 86400; // 24 hours

export async function createJob(kv: KVNamespace, id: string, topic: string): Promise<JobState> {
  const now = new Date().toISOString();
  const job: JobState = {
    id,
    status: 'pending',
    topic,
    step: 'pending',
    created_at: now,
    updated_at: now,
  };
  await kv.put(`job:${id}`, JSON.stringify(job), { expirationTtl: TTL });
  return job;
}

export async function updateJob(
  kv: KVNamespace,
  id: string,
  patch: Partial<Pick<JobState, 'status' | 'step' | 'result' | 'error'>>,
): Promise<void> {
  const raw = await kv.get(`job:${id}`);
  if (!raw) return;
  const job = JSON.parse(raw) as JobState;
  Object.assign(job, patch, { updated_at: new Date().toISOString() });
  await kv.put(`job:${id}`, JSON.stringify(job), { expirationTtl: TTL });
}

export async function getJob(kv: KVNamespace, id: string): Promise<JobState | null> {
  const raw = await kv.get(`job:${id}`);
  return raw ? (JSON.parse(raw) as JobState) : null;
}
