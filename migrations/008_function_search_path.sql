-- 008: pin search_path on SECURITY-relevant functions (Supabase linter
-- 0011_function_search_path_mutable). Both bodies only reference pg_catalog
-- builtins (now(), current_setting()), which stays resolvable with an empty
-- search_path, so this is purely a hardening no-op.
alter function public.set_updated_at() set search_path = '';
alter function public.request_sync_key() set search_path = '';
