-- Migration: Add length constraints on user profile text fields
-- + Document ride_waypoints RLS privacy design decision

-- ==========================================
-- CONSTRAINTS: users table — bio, display_name, city
-- ==========================================
ALTER TABLE public.users
  ADD CONSTRAINT chk_users_bio_length CHECK (length(bio) <= 500),
  ADD CONSTRAINT chk_users_display_name_length CHECK (length(display_name) <= 100),
  ADD CONSTRAINT chk_users_city_length CHECK (length(city) <= 100);

-- ==========================================
-- DOCUMENTATION: ride_waypoints RLS privacy rationale
-- ==========================================
COMMENT ON TABLE public.ride_waypoints IS 'GPS waypoints for rides. RLS intentionally restricts to ride owner only - public rides expose route_thumbnail_uri but NOT raw GPS data for privacy.';
