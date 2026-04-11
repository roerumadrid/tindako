-- When inserting products without store_id, set it server-side (avoids null/undefined FK in client payloads).
-- Authenticated: use the row in public.stores for auth.uid().
-- Unauthenticated (e.g. local dev): if there is exactly one store, use it; otherwise fail with a clear error.

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
    order by s.created_at
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

drop trigger if exists trg_products_set_store_id on public.products;

create trigger trg_products_set_store_id
before insert on public.products
for each row
execute function public.products_set_store_id ();
