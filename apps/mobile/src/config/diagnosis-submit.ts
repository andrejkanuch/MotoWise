/**
 * Issue 365 T17 (FS-PO2b): timings of a diagnosis submit. The client deadline
 * itself is `GQL_TIMEOUT_MS.DIAGNOSIS` (75 s) in `lib/graphql-client.ts`.
 */

/** "Still working…" replaces the in-flight label after this long. */
export const DIAGNOSIS_STILL_WORKING_MS = 10_000;

/**
 * The longest the API can still be working on a diagnosis after the client
 * gave up: the OpenAI client's `AI_CLIENT.TIMEOUT_MS` (60 000) for the first
 * try and each of `AI_CLIENT.MAX_RETRIES` (3) retries, in
 * apps/api/src/config/constants.ts. Keep in step with those values. Until this
 * much time has passed since the send, submit stays locked: a late answer
 * still uses the free diagnosis, and a second submit would race it.
 */
const API_AI_CLIENT_TIMEOUT_MS = 60_000;
const API_AI_CLIENT_MAX_RETRIES = 3;
export const DIAGNOSIS_SERVER_WINDOW_MS =
  API_AI_CLIENT_TIMEOUT_MS * (1 + API_AI_CLIENT_MAX_RETRIES);
