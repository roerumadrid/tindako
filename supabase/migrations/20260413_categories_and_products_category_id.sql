-- Reference categories + optional FK on products. Legacy `products.category` text is unchanged.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create index categories_name_idx on public.categories (name);

alter table public.products
  add column category_id uuid references public.categories (id) on delete set null;

create index products_category_id_idx on public.products (category_id);

alter table public.categories enable row level security;

create policy "categories_authenticated_all"
on public.categories
for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.categories to authenticated;
