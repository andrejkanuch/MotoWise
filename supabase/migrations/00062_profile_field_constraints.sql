-- Migration: Add length constraints on user profile text fields
-- + Document ride_waypoints RLS privacy design decision

-- ==========================================
-- CONSTRAINTS: users table — bio, display_name, city
-- ==========================================
ALTER TABLE public.users
  ADD CONSTRAINT chk_users_bio_length CHECK (length(bio) <= 500),
  ADD CONSTRAINT chk_users_display_name_length CHECK (length(display_name) <= 50),
  ADD CONSTRAINT chk_users_city_length CHECK (length(city) <= 100);

-- ==========================================
-- DOCUMENTATION: ride_waypoints RLS privacy rationale
-- ==========================================
COMMENT ON TABLE public.ride_waypoints IS 'GPS waypoints for rides. RLS intentionally restricts to ride owner only - public rides expose route_thumbnail_uri but NOT raw GPS data for privacy.';

-- ==========================================
-- CONSTRAINTS: counter columns cannot go negative
-- ==========================================
ALTER TABLE public.users
  ADD CONSTRAINT chk_users_follower_count CHECK (follower_count >= 0),
  ADD CONSTRAINT chk_users_following_count CHECK (following_count >= 0);

ALTER TABLE public.rides
  ADD CONSTRAINT chk_rides_kudos_count CHECK (kudos_count >= 0);

-- ==========================================
-- INDEX: prevent duplicate IAP purchases for health reports
-- ==========================================
CREATE UNIQUE INDEX idx_health_reports_iap_transaction
  ON public.bike_health_reports (iap_transaction_id)
  WHERE iap_transaction_id IS NOT NULL;

-- ==========================================
-- RLS: Allow reading bikes of public profiles (for public rider profile pages)
-- ==========================================
CREATE POLICY "Public can read bikes of public profiles" ON public.motorcycles
  FOR SELECT TO authenticated, anon
  USING (
    deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.users WHERE id = user_id AND is_public = true)
  );
