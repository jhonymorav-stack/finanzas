-- ── Pesas: peso por serie (para el gráfico de progreso) ─────────────────────
-- Hasta ahora solo se guardaba si marcaste una serie como hecha, sin cuánto
-- peso usaste — así que no había forma de ver progreso real. Agrega una
-- columna opcional de peso a cada registro de serie.
--
-- Ya se aplicó directo en tu base de datos real (vía el MCP de Supabase), así
-- que NO hace falta que corras esto a mano. Queda aquí solo como referencia.

alter table public.gym_set_logs add column if not exists weight numeric;
