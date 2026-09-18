-- ── Tareas (checklist simple) ────────────────────────────────────────────────
-- Distinta de Hábitos: no se resetea cada día ni lleva racha — es una lista
-- normal de pendientes. Agregas, tachas, y se queda tachada hasta que la
-- borres. Ya se aplicó directo en tu base de datos real (vía el MCP de
-- Supabase), así que NO hace falta correr esto a mano. Queda como referencia.

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  text         text not null,
  done         boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.tasks enable row level security;

drop policy if exists "select own tasks" on public.tasks;
create policy "select own tasks" on public.tasks for select using (auth.uid() = user_id);
drop policy if exists "insert own tasks" on public.tasks;
create policy "insert own tasks" on public.tasks for insert with check (auth.uid() = user_id);
drop policy if exists "update own tasks" on public.tasks;
create policy "update own tasks" on public.tasks for update using (auth.uid() = user_id);
drop policy if exists "delete own tasks" on public.tasks;
create policy "delete own tasks" on public.tasks for delete using (auth.uid() = user_id);

create index if not exists tasks_user_idx on public.tasks (user_id, done, sort_order);
