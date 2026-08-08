-- ── Finanzas · esquema de Supabase ──────────────────────────────────────────
-- Cómo usarlo:
--  1. Entra a tu proyecto en https://supabase.com/dashboard
--  2. Ve a "SQL Editor" → "New query"
--  3. Pega todo este archivo y dale "Run"

-- ── Perfil ───────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  age         integer check (age > 0 and age < 130),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "select own profile" on public.profiles;
create policy "select own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('ingreso', 'egreso')),
  amount        numeric not null check (amount > 0),
  currency      text not null default 'COP',
  category      text not null,
  account       text,        -- id de cuenta/medio de pago (built-in o personalizada); null = sin especificar
  receipt_path  text,        -- ruta del archivo en el bucket 'receipts'; null = sin foto
  note          text,
  tx_date       date not null,
  created_at    timestamptz not null default now()
);

-- Si ya tenías la tabla creada de antes, esto agrega las columnas nuevas sin perder datos.
alter table public.transactions add column if not exists account text;
alter table public.transactions add column if not exists receipt_path text;

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, tx_date desc);

alter table public.transactions enable row level security;

-- Cada usuario solo puede ver/crear/editar/borrar SUS PROPIAS transacciones.
drop policy if exists "select own transactions" on public.transactions;
create policy "select own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "insert own transactions" on public.transactions;
create policy "insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own transactions" on public.transactions;
create policy "update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

drop policy if exists "delete own transactions" on public.transactions;
create policy "delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- ── Metas (ahorro / reducción de gastos / inversión) ────────────────────────
create table if not exists public.goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            text not null check (type in ('ahorro', 'reduccion', 'inversion')),
  title           text not null,
  target_amount   numeric not null check (target_amount > 0),
  current_amount  numeric not null default 0,
  category        text,        -- solo para 'reduccion'; null = todas las categorías
  target_date     date,        -- opcional, para 'ahorro' / 'inversion'
  created_at      timestamptz not null default now()
);

create index if not exists goals_user_idx on public.goals (user_id, created_at desc);

alter table public.goals enable row level security;

drop policy if exists "select own goals" on public.goals;
create policy "select own goals"
  on public.goals for select
  using (auth.uid() = user_id);

drop policy if exists "insert own goals" on public.goals;
create policy "insert own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own goals" on public.goals;
create policy "update own goals"
  on public.goals for update
  using (auth.uid() = user_id);

drop policy if exists "delete own goals" on public.goals;
create policy "delete own goals"
  on public.goals for delete
  using (auth.uid() = user_id);

-- ── Categorías personalizadas ────────────────────────────────────────────────
-- Las 9 categorías predeterminadas viven en js/categories.js (no en la base de
-- datos). Aquí solo se guardan las que el usuario crea además de esas.
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null,
  created_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

drop policy if exists "select own categories" on public.categories;
create policy "select own categories" on public.categories for select using (auth.uid() = user_id);
drop policy if exists "insert own categories" on public.categories;
create policy "insert own categories" on public.categories for insert with check (auth.uid() = user_id);
drop policy if exists "delete own categories" on public.categories;
create policy "delete own categories" on public.categories for delete using (auth.uid() = user_id);

-- ── Cuentas / medios de pago personalizados ─────────────────────────────────
-- Las 4 predeterminadas (Efectivo, Tarjeta, Cuenta bancaria, Otro) viven en
-- js/accounts.js. Aquí solo se guardan las que el usuario agrega.
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null,
  created_at  timestamptz not null default now()
);

alter table public.accounts enable row level security;

drop policy if exists "select own accounts" on public.accounts;
create policy "select own accounts" on public.accounts for select using (auth.uid() = user_id);
drop policy if exists "insert own accounts" on public.accounts;
create policy "insert own accounts" on public.accounts for insert with check (auth.uid() = user_id);
drop policy if exists "delete own accounts" on public.accounts;
create policy "delete own accounts" on public.accounts for delete using (auth.uid() = user_id);

-- ── Presupuestos mensuales por categoría ─────────────────────────────────────
-- Un presupuesto por categoría que se repite cada mes (no hay que redefinirlo
-- mes a mes). "category" guarda el id de una categoría built-in o personalizada.
create table if not exists public.budgets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  category        text not null,
  monthly_amount  numeric not null check (monthly_amount > 0),
  created_at      timestamptz not null default now(),
  unique (user_id, category)
);

alter table public.budgets enable row level security;

drop policy if exists "select own budgets" on public.budgets;
create policy "select own budgets" on public.budgets for select using (auth.uid() = user_id);
drop policy if exists "insert own budgets" on public.budgets;
create policy "insert own budgets" on public.budgets for insert with check (auth.uid() = user_id);
drop policy if exists "update own budgets" on public.budgets;
create policy "update own budgets" on public.budgets for update using (auth.uid() = user_id);
drop policy if exists "delete own budgets" on public.budgets;
create policy "delete own budgets" on public.budgets for delete using (auth.uid() = user_id);

-- ── Fotos de recibos (Storage) ───────────────────────────────────────────────
-- Bucket privado: cada archivo vive en la carpeta "<tu-user-id>/..." y solo tú
-- puedes leerlo (la app pide una URL firmada de corta duración para mostrarlo).
insert into storage.buckets (id, name, public)
  values ('receipts', 'receipts', false)
  on conflict (id) do nothing;

drop policy if exists "select own receipts" on storage.objects;
create policy "select own receipts" on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "insert own receipts" on storage.objects;
create policy "insert own receipts" on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "update own receipts" on storage.objects;
create policy "update own receipts" on storage.objects for update
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "delete own receipts" on storage.objects;
create policy "delete own receipts" on storage.objects for delete
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
