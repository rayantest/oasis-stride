DROP FUNCTION IF EXISTS public.claim_legacy_data();
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM authenticated;