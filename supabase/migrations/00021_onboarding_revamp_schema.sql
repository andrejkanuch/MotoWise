-- Migration: Onboarding Revamp & Paywall Schema
-- Adds subscription columns, onboarding tracking, RLS protection, and atomic RPC

-- 1. Set defaults on EXISTING motorcycle columns (00005 added them without defaults)
ALTER TABLE public.motorcycles
  ALTER COLUMN type SET DEFAULT 'other'::motorcycle_type,
  ALTER COLUMN current_mileage SET DEFAULT 0;

ALTER TABLE public.motorcycles
  ADD CONSTRAINT chk_motorcycles_mileage_nonneg
  CHECK (current_mileage >= 0 OR current_mileage IS NULL);

-- 2. Add subscription + onboarding columns to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'pro')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- 3. Backfill onboarding_completed_at for existing users who completed old onboarding
UPDATE public.users
SET onboarding_completed_at = updated_at
WHERE (preferences->>'onboardingCompleted')::boolean = true
  AND onboarding_completed_at IS NULL;

-- 4. Protect subscription fields from client-side manipulation via RLS
DROP POLICY IF EXISTS "Users update own data" ON public.users;
CREATE POLICY "Users update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND email = (SELECT email FROM public.users WHERE id = auth.uid())
    AND subscription_tier = (SELECT subscription_tier FROM public.users WHERE id = auth.uid())
    AND subscription_expires_at IS NOT DISTINCT FROM
        (SELECT subscription_expires_at FROM public.users WHERE id = auth.uid())
    AND trial_started_at IS NOT DISTINCT FROM
        (SELECT trial_started_at FROM public.users WHERE id = auth.uid())
  );

-- 5. Indexes for subscription queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier
  ON public.users (subscription_tier) WHERE subscription_tier != 'free';
CREATE INDEX IF NOT EXISTS idx_users_subscription_expires_at
  ON public.users (subscription_expires_at) WHERE subscription_expires_at IS NOT NULL;

-- 6. Atomic onboarding completion RPC (idempotent)
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id UUID,
  p_preferences JSONB,
  p_bike_make TEXT DEFAULT NULL,
  p_bike_model TEXT DEFAULT NULL,
  p_bike_year INTEGER DEFAULT NULL,
  p_bike_type motorcycle_type DEFAULT NULL,
  p_bike_mileage INTEGER DEFAULT NULL,
  p_bike_nickname TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bike_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user mismatch';
  END IF;

  UPDATE public.users
  SET preferences = COALESCE(preferences, '{}'::jsonb) || p_preferences,
      onboarding_completed_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'User not found: %', p_user_id; END IF;

  -- Idempotent bike creation (skip if same bike already exists)
  IF p_bike_make IS NOT NULL AND p_bike_model IS NOT NULL AND p_bike_year IS NOT NULL THEN
    SELECT id INTO v_bike_id FROM public.motorcycles
    WHERE user_id = p_user_id AND make = p_bike_make
      AND model = p_bike_model AND year = p_bike_year
    LIMIT 1;

    IF v_bike_id IS NULL THEN
      INSERT INTO public.motorcycles (user_id, make, model, year, type, current_mileage, nickname, is_primary)
      VALUES (p_user_id, p_bike_make, p_bike_model, p_bike_year,
              COALESCE(p_bike_type, 'other'::motorcycle_type),
              COALESCE(p_bike_mileage, 0), p_bike_nickname, true)
      RETURNING id INTO v_bike_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('user_id', p_user_id, 'motorcycle_id', v_bike_id);
END;
$$;
