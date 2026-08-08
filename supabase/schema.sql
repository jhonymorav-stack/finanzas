-- ── Finanzas · esquema de Supabase ──────────────────────────────────────────
-- Cómo usarlo:
--  1. Entra a tu proyecto en https://supabase.com/dashboard
--  2. Ve a "SQL Editor" → "New query"
--  3. Pega todo este archivo y dale "Run"

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('ingreso', 'egreso')),
  amount      numeric not null check (amount > 0),
  currency    text not null default 'COP',
  category    text not null,
  note        text,
  tx_date     date not null,
  created_at  timestamptz not null default now()
);

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
