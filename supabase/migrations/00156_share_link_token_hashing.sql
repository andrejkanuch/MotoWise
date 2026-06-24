-- Migration: 00156_share_link_token_hashing
--
-- NOTE: originally authored as 00144, which collided with the already-applied
-- prod migration 00144_model_insights. Renumbered to 00156. This migration is NOT
-- yet applied to production. DEPLOY COUPLING: it must ship together with the API
-- code that hashes the presented token before lookup (resolve()) — applying it
-- ahead of that code would break every existing share link.
--
-- C7 follow-through (audit 2026-06-09): share_links.token was stored in PLAINTEXT
-- and (until 00141 dropped the anon policy) anon-dumpable. Hash-in-place chosen for
-- URL continuity — existing share URLs keep working because resolve() now hashes
-- the presented token before lookup. Token rotation flagged as a PR note (tokens
-- may already be exfiltrated) but intentionally NOT implemented here.
--
-- Encoding mirrors 00086 (trip_share_tokens): SHA-256 of lower(token), hex-encoded.
-- New tokens are minted in Node (crypto.randomBytes(32).toString('hex')); only the
-- hash is inserted. Tokens become show-once: plaintext is returned ONLY at creation.
--
-- ROLLBACK: there is none — hashes are one-way and the plaintext is discarded.
-- If this migration must be undone, REVOKE the links (set revoked_at) or rotate
-- tokens; the original plaintext tokens are unrecoverable by design.
--
-- Double-hash guard: plaintext tokens and SHA-256 hex digests are BOTH 64 hex
-- chars, so an accidental re-run would re-hash the hashes and brick every link.
-- token_hashed_at IS NULL makes the UPDATE idempotent.

BEGIN;

ALTER TABLE public.share_links
  ADD COLUMN IF NOT EXISTS token_hashed_at TIMESTAMPTZ;

UPDATE public.share_links
SET token = encode(extensions.digest(lower(token)::bytea, 'sha256'), 'hex'),
    token_hashed_at = now()
WHERE token_hashed_at IS NULL;

-- The old default minted plaintext tokens in the DB; tokens are now minted in the
-- service layer and only the hash is stored. An insert without a token must fail.
ALTER TABLE public.share_links
  ALTER COLUMN token DROP DEFAULT;

NOTIFY pgrst, 'reload schema';

COMMIT;
