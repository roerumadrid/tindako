-- Allow anonymous clients to insert categories (local dev without auth).

grant insert on public.categories to anon;

create policy "categories_insert_anon"
on public.categories
for insert
to anon
with check (true);
