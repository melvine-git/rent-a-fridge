-- Notification UI state (read / dismissed), keyed by the derived notification id.
-- Same row shape as the other tables; only the server, using the secret key, may touch it.
create table if not exists public.notifications (like public.staff including all);

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant all on table public.notifications to service_role;
