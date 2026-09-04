-- Remove the trigger and function that seed sample revenue data for new users.
-- New accounts now start with no revenue data — the user fills it in themselves.

DROP TRIGGER IF EXISTS on_auth_user_revenue_seed ON auth.users;
DROP FUNCTION IF EXISTS public.seed_revenue_for_new_user();
