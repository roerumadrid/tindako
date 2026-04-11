-- Run once on existing TindaKo databases (Supabase SQL Editor).
-- New installs can rely on updated schema.sql instead.

alter table public.products
  add column if not exists category text not null default '';

alter table public.products
  add column if not exists cost_price numeric(12, 2) not null default 0;

alter table public.products
  add column if not exists unit text not null default 'pc';
