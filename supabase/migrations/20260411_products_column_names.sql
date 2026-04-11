-- Align products columns with app schema (run after prior product migrations).

alter table public.products rename column unit_price to selling_price;
alter table public.products rename column quantity to stock_qty;
alter table public.products rename column low_stock_threshold to reorder_level;

-- Recreate RPC to use stock_qty on products
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
