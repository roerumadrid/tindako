-- TindaKo — run in Supabase SQL Editor (or via migrations)
-- Requires: Auth enabled (email/password)

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  unique (user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create index categories_name_idx on public.categories (name);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  category text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  selling_price numeric(12, 2) not null default 0 check (selling_price >= 0),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  reorder_level integer not null default 5 check (reorder_level >= 0),
  unit text not null default 'pc',
  created_at timestamptz not null default now()
);

create index products_store_id_idx on public.products (store_id);
create index products_category_id_idx on public.products (category_id);

-- Inserts may omit store_id; it is filled from the current user’s store (or the sole store in dev).
create or replace function public.products_set_store_id ()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_sid uuid;
  v_cnt bigint;
begin
  if new.store_id is not null then
    return new;
  end if;

  if auth.uid() is not null then
    select s.id
      into v_sid
    from public.stores s
    where s.user_id = auth.uid()
    order by s.id
    limit 1;

    if v_sid is null then
      raise exception 'Create a store before adding products.';
    end if;

    new.store_id := v_sid;
    return new;
  end if;

  select count(*) into v_cnt from public.stores;

  if v_cnt = 1 then
    select s.id into v_sid from public.stores s limit 1;
    new.store_id := v_sid;
    return new;
  end if;

  raise exception 'Sign in to add products, or keep exactly one store row for unauthenticated dev inserts.';
end;
$$;

create trigger trg_products_set_store_id
before insert on public.products
for each row
execute function public.products_set_store_id ();

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  created_at timestamptz not null default now()
);

create index sales_store_id_idx on public.sales (store_id);
create index sales_store_created_idx on public.sales (store_id, created_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  line_total numeric(12, 2) not null
);

create index sale_items_sale_id_idx on public.sale_items (sale_id);

-- Atomic checkout: validates stock and decrements in one transaction
create or replace function public.complete_sale (p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_sale_id uuid;
  v_total numeric(12, 2) := 0;
  r record;
  v_avail integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_store_id from public.stores where user_id = auth.uid() limit 1;
  if v_store_id is null then
    raise exception 'no store';
  end if;

  for r in
    select *
    from jsonb_to_recordset(p_items) as t(product_id uuid, quantity integer, unit_price numeric(12,2))
  loop
    if r.quantity is null or r.quantity <= 0 then
      raise exception 'invalid quantity';
    end if;
    select p.stock_qty into v_avail
    from public.products p
    where p.id = r.product_id and p.store_id = v_store_id;
    if v_avail is null then
      raise exception 'product not found';
    end if;
    if v_avail < r.quantity then
      raise exception 'insufficient stock';
    end if;
    v_total := v_total + (r.quantity * coalesce(r.unit_price, 0));
  end loop;

  insert into public.sales (store_id, total_amount)
  values (v_store_id, v_total)
  returning id into v_sale_id;

  for r in
    select *
    from jsonb_to_recordset(p_items) as t(product_id uuid, quantity integer, unit_price numeric(12,2))
  loop
    insert into public.sale_items (sale_id, product_id, quantity, unit_price, line_total)
    values (
      v_sale_id,
      r.product_id,
      r.quantity,
      coalesce(r.unit_price, 0),
      r.quantity * coalesce(r.unit_price, 0)
    );
    update public.products
    set stock_qty = stock_qty - r.quantity
    where id = r.product_id and store_id = v_store_id;
  end loop;

  return v_sale_id;
end;
$$;

revoke all on function public.complete_sale (jsonb) from public;
grant execute on function public.complete_sale (jsonb) to authenticated;

alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create policy "stores_own"
on public.stores
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Bootstrap + reads: permissive for `authenticated` (ORs with `stores_own` in default mode).
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

create policy "categories_authenticated_all"
on public.categories
for all
to authenticated
using (true)
with check (true);

create policy "categories_select_anon"
on public.categories
for select
to anon
using (true);

create policy "categories_insert_anon"
on public.categories
for insert
to anon
with check (true);

create policy "products_own_store"
on public.products
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.user_id = auth.uid()
  )
);

create policy "sales_own_store"
on public.sales
for all
using (
  exists (
    select 1 from public.stores s
    where s.id = sales.store_id and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = sales.store_id and s.user_id = auth.uid()
  )
);

create policy "sale_items_own_store"
on public.sale_items
for all
using (
  exists (
    select 1 from public.sales sa
    join public.stores st on st.id = sa.store_id
    where sa.id = sale_items.sale_id and st.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.sales sa
    join public.stores st on st.id = sa.store_id
    where sa.id = sale_items.sale_id and st.user_id = auth.uid()
  )
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.stores to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert on public.categories to anon;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.sale_items to authenticated;
