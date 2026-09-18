-- ── Pesas: varios "entrenos" (rutinas) ──────────────────────────────────────
-- Antes cada ejercicio vivía suelto. Ahora se agrupan en hasta 3 "entrenos"
-- (ej. "Empuje", "Tirón", "Pierna"), cada uno con sus propios ejercicios.
-- Si ya tenías ejercicios guardados, este script los migra automáticamente a
-- un "Entreno 1" nuevo — no se pierde nada.
--
-- Ya se aplicó directo en tu base de datos real (vía el MCP de Supabase), así
-- que NO hace falta que corras esto a mano. Queda aquí solo como referencia /
-- documentación, igual que los otros archivos de supabase/schema_*.sql.

create table if not exists public.gym_routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.gym_routines enable row level security;

drop policy if exists "select own gym routines" on public.gym_routines;
create policy "select own gym routines" on public.gym_routines for select using (auth.uid() = user_id);
drop policy if exists "insert own gym routines" on public.gym_routines;
create policy "insert own gym routines" on public.gym_routines for insert with check (auth.uid() = user_id);
drop policy if exists "update own gym routines" on public.gym_routines;
create policy "update own gym routines" on public.gym_routines for update using (auth.uid() = user_id);
drop policy if exists "delete own gym routines" on public.gym_routines;
create policy "delete own gym routines" on public.gym_routines for delete using (auth.uid() = user_id);

alter table public.gym_exercises add column if not exists routine_id uuid references public.gym_routines(id) on delete cascade;

do $$
declare
  uid uuid;
  rid uuid;
begin
  for uid in select distinct user_id from public.gym_exercises where routine_id is null loop
    insert into public.gym_routines (user_id, name, sort_order) values (uid, 'Entreno 1', 0)
    returning id into rid;
    update public.gym_exercises set routine_id = rid where user_id = uid and routine_id is null;
  end loop;
end $$;

create index if not exists gym_exercises_routine_idx on public.gym_exercises (routine_id, sort_order);
