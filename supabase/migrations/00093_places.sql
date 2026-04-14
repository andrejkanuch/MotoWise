-- GeoNames places taxonomy: countries, regions, cities
-- Reference data for route discovery and location search.

CREATE TABLE public.places (
  id          BIGINT PRIMARY KEY,  -- GeoNames ID (not UUID)
  kind        TEXT NOT NULL CHECK (kind IN ('country', 'region', 'city')),
  name        TEXT NOT NULL,
  country_code TEXT NOT NULL,      -- ISO 3166-1 alpha-2
  region_code TEXT,                -- ISO 3166-2 (null for countries)
  latitude    FLOAT NOT NULL,
  longitude   FLOAT NOT NULL,
  population  INT DEFAULT 0,
  search_tsv  TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(name, ''))
  ) STORED
);

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

-- Public read-only (reference data)
CREATE POLICY "places_select" ON public.places FOR SELECT USING (true);

-- Indexes
CREATE INDEX idx_places_search_tsv ON public.places USING GIN (search_tsv);
CREATE INDEX idx_places_name_trgm ON public.places USING GIN (name gin_trgm_ops);
CREATE INDEX idx_places_country_region ON public.places (country_code, region_code);
CREATE INDEX idx_places_kind ON public.places (kind);
CREATE INDEX idx_places_geo ON public.places USING GIST (ll_to_earth(latitude, longitude));
