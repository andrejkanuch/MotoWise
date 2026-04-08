-- Revoke direct access to update_route_geography from authenticated users.
-- This function should only be called via service-role (supabaseAdmin).
REVOKE EXECUTE ON FUNCTION public.update_route_geography FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_route_geography FROM anon;
