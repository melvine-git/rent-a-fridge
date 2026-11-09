-- Rent-a-Fridge storage. One table per record type; each row holds the record as JSON
-- (matching the TypeScript types in src/types). Only the server, using the secret key,
-- can read or write: RLS is on with no policies, and public roles get no grants.

create table if not exists public.staff (
  id text primary key,
  seq bigint generated always as identity,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.customers (like public.staff including all);
create table if not exists public.units (like public.staff including all);
create table if not exists public.bookings (like public.staff including all);
create table if not exists public.dockets (like public.staff including all);
create table if not exists public.serviceable_components (like public.staff including all);

do $$
declare t text;
begin
  foreach t in array array['staff', 'customers', 'units', 'bookings', 'dockets', 'serviceable_components'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

-- Private bucket for unit photos; served to staff through /api/uploads
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;
