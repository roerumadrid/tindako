-- Allow anonymous clients to read categories (e.g. local dev / Add Product dropdown without a session).

grant select on public.categories to anon;

create policy "categories_select_anon"
on public.categories
for select
to anon
using (true);
