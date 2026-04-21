-- Migration: 00113_discover_trips_gin_index
--
-- Creates the GIN index on search_tsv AFTER data migration (00112).
-- This is a separate migration because CREATE INDEX CONCURRENTLY
-- cannot run inside a transaction block.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discover_trips_search
  ON public.discover_trips USING GIN (search_tsv);
