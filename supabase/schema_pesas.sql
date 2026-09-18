-- ── Pesas (gimnasio) · esquema adicional de Supabase ────────────────────────
-- No toca ninguna tabla existente. Igual que Running: tú agregas tus propios
-- ejercicios con sus series/repeticiones objetivo, y marcas serie por serie
-- cuando las completas (cada serie marcada dispara el temporizador de
-- descanso en la app — eso vive solo en el navegador, no en la base de datos).
--
-- Cómo usarlo: SQL Editor de Supabase → pega esto → Run.

create table if not exists public.gym_exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  sets        integer not null default 3 check (sets between 1 and 20),
  reps        text not null default '10-12',   -- texto libre: "10", "8-12", "AMRAP", etc.
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.gym_exercises enable row level security;

drop policy if exists "select own gym exercises" on public.gym_exercises;
create policy "select own gym exercises" on public.gym_exercises for select using (auth.uid() = user_id);
drop policy if exists "insert own gym exercises" on public.gym_exercises;
create policy "insert own gym exercises" on public.gym_exercises for insert with check (auth.uid() = user_id);
drop policy if exists "update own gym exercises" on public.gym_exercises;
create policy "update own gym exercises" on public.gym_exercises for update using (auth.uid() = user_id);
drop policy if exists "delete own gym exercises" on public.gym_exercises;
create policy "delete own gym exercises" on public.gym_exercises for delete using (auth.uid() = user_id);

-- Qué serie de qué ejercicio marcaste, qué día (para poder ver el historial más
-- adelante, aunque hoy la app solo usa "hoy" para el checklist).
create table if not exists public.gym_set_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  exercise_id   uuid not null references public.gym_exercises(id) on delete cascade,
  set_number    integer not null,
  log_date      date not null,
  created_at    timestamptz not null default now(),
  unique (exercise_id, set_number, log_date)
);

create index if not exists gym_set_logs_user_date_idx on public.gym_set_logs (user_id, log_date desc);

alter table public.gym_set_logs enable row level security;

drop policy if exists "select own gym set logs" on public.gym_set_logs;
create policy "select own gym set logs" on public.gym_set_logs for select using (auth.uid() = user_id);
drop policy if exists "insert own gym set logs" on public.gym_set_logs;
create policy "insert own gym set logs" on public.gym_set_logs for insert with check (auth.uid() = user_id);
drop policy if exists "delete own gym set logs" on public.gym_set_logs;
create policy "delete own gym set logs" on public.gym_set_logs for delete using (auth.uid() = user_id);
