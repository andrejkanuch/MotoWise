-- Migration: 00113_discover_trips_gin_index
--
-- Creates the GIN index on search_tsv AFTER data migration (00112).
-- Using regular CREATE INDEX (not CONCURRENTLY) because Supabase
-- may wrap migrations in implicit transactions. The table is new and
-- small at migration time, so blocking is negligible.

CREATE INDEX IF NOT EXISTS idx_discover_trips_search
  ON public.discover_trips USING GIN (search_tsv);
