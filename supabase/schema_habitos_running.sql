-- ── Hábitos + Running · esquema adicional de Supabase ───────────────────────
-- No toca ninguna tabla existente de Finanzas (transactions, goals, etc).
-- Cómo usarlo:
--  1. Entra a tu proyecto en https://supabase.com/dashboard
--  2. Ve a "SQL Editor" → "New query"
--  3. Pega todo este archivo y dale "Run"

-- ── Hábitos diarios ──────────────────────────────────────────────────────────
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  meta        text,        -- ej. "10 min · respiración"
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.habits enable row level security;

drop policy if exists "select own habits" on public.habits;
create policy "select own habits" on public.habits for select using (auth.uid() = user_id);
drop policy if exists "insert own habits" on public.habits;
create policy "insert own habits" on public.habits for insert with check (auth.uid() = user_id);
drop policy if exists "update own habits" on public.habits;
create policy "update own habits" on public.habits for update using (auth.uid() = user_id);
drop policy if exists "delete own habits" on public.habits;
create policy "delete own habits" on public.habits for delete using (auth.uid() = user_id);

-- Un registro por hábito marcado en un día dado. Borrar la fila = "desmarcar".
create table if not exists public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  habit_id    uuid not null references public.habits(id) on delete cascade,
  log_date    date not null,
  created_at  timestamptz not null default now(),
  unique (habit_id, log_date)
);

create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, log_date desc);

alter table public.habit_logs enable row level security;

drop policy if exists "select own habit logs" on public.habit_logs;
create policy "select own habit logs" on public.habit_logs for select using (auth.uid() = user_id);
drop policy if exists "insert own habit logs" on public.habit_logs;
create policy "insert own habit logs" on public.habit_logs for insert with check (auth.uid() = user_id);
drop policy if exists "delete own habit logs" on public.habit_logs;
create policy "delete own habit logs" on public.habit_logs for delete using (auth.uid() = user_id);

-- ── Running: programa de intervalos (Pesas se integra en una fase posterior) ─
-- Los "bloques" son las filas de tu hoja (ej. "3 min de trote a 6.0 + 2 min de
-- caminata a 4.0. Repetir 5 veces."). day_number va de 1 a 4 — el Día 4 de tu
-- hoja repite el Día 2, así que la app simplemente reutiliza los bloques del
-- Día 2 cuando ves el Día 4 (no se duplican filas).
create table if not exists public.running_blocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  day_number  integer not null check (day_number between 1 and 4),
  sort_order  integer not null default 0,
  text        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists running_blocks_user_day_idx on public.running_blocks (user_id, day_number, sort_order);

alter table public.running_blocks enable row level security;

drop policy if exists "select own running blocks" on public.running_blocks;
create policy "select own running blocks" on public.running_blocks for select using (auth.uid() = user_id);
drop policy if exists "insert own running blocks" on public.running_blocks;
create policy "insert own running blocks" on public.running_blocks for insert with check (auth.uid() = user_id);
drop policy if exists "update own running blocks" on public.running_blocks;
create policy "update own running blocks" on public.running_blocks for update using (auth.uid() = user_id);
drop policy if exists "delete own running blocks" on public.running_blocks;
create policy "delete own running blocks" on public.running_blocks for delete using (auth.uid() = user_id);

-- Qué bloques completaste, qué día. Un registro = un bloque marcado en una fecha.
create table if not exists public.running_completions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  block_id    uuid not null references public.running_blocks(id) on delete cascade,
  done_date   date not null,
  created_at  timestamptz not null default now(),
  unique (block_id, done_date)
);

alter table public.running_completions enable row level security;

drop policy if exists "select own running completions" on public.running_completions;
create policy "select own running completions" on public.running_completions for select using (auth.uid() = user_id);
drop policy if exists "insert own running completions" on public.running_completions;
create policy "insert own running completions" on public.running_completions for insert with check (auth.uid() = user_id);
drop policy if exists "delete own running completions" on public.running_completions;
create policy "delete own running completions" on public.running_completions for delete using (auth.uid() = user_id);

-- Carreras sueltas (afuera del programa) — modo "Carrera libre".
create table if not exists public.running_free_runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  run_date          date not null,
  km                numeric not null check (km > 0),
  duration_seconds  integer not null check (duration_seconds > 0),
  terrain           text not null default 'Asfalto',
  created_at        timestamptz not null default now()
);

create index if not exists running_free_runs_user_date_idx on public.running_free_runs (user_id, run_date desc);

alter table public.running_free_runs enable row level security;

drop policy if exists "select own free runs" on public.running_free_runs;
create policy "select own free runs" on public.running_free_runs for select using (auth.uid() = user_id);
drop policy if exists "insert own free runs" on public.running_free_runs;
create policy "insert own free runs" on public.running_free_runs for insert with check (auth.uid() = user_id);
drop policy if exists "delete own free runs" on public.running_free_runs;
create policy "delete own free runs" on public.running_free_runs for delete using (auth.uid() = user_id);

-- Fase/semana actual del programa — se guarda en el perfil (ya existe la tabla).
alter table public.profiles add column if not exists running_fase text default 'Fase 1 · Adaptación deportiva';
alter table public.profiles add column if not exists running_week integer default 1;
alter table public.profiles add column if not exists running_total_weeks integer default 4;
-- Evita que la app vuelva a insertar los bloques de ejemplo si ya los borraste todos a propósito.
alter table public.profiles add column if not exists running_seeded boolean default false;
