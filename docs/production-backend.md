# Production backend configuration

Lythouse production uses Supabase project reference `anqgfdamsbvtfqzpxscp`.

The deployment must provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` through the hosting environment. Both values must belong to that same Supabase project.

Do not commit API keys or service-role credentials to this repository.

Existing data in the selected Supabase project must be preserved. Database migrations for Lythouse must be additive and must not drop unrelated existing tables.

Persistent Lythouse business data should be stored in the database. Temporary interface state such as open menus, loading indicators, selected tabs, and unsaved form input may remain client-side.
