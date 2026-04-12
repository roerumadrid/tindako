-- Fix store bootstrap: RLS must allow authenticated users to INSERT/SELECT `stores`
-- so `ensureDefaultStoreForUser` can run after login. These policies are permissive
-- and combine with existing `stores_own` via OR (default permissive mode).
--
-- Run in Supabase SQL Editor if not using `supabase db push`, or apply via migrations.

drop policy if exists "Allow insert for authenticated users" on public.stores;
drop policy if exists "Allow select for authenticated users" on public.stores;

create policy "Allow insert for authenticated users"
on public.stores
for insert
to authenticated
with check (true);

create policy "Allow select for authenticated users"
on public.stores
for select
to authenticated
using (true);
