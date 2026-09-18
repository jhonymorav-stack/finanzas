-- ── Limpieza única: bloques de running duplicados ───────────────────────────
-- Un bug (ya corregido) insertó tu programa de running dos veces la primera
-- vez que entraste (9 bloques reales → 18 en la base). Este script borra las
-- copias de más y deja solo una fila por bloque real, quedándose con la más
-- antigua (created_at) de cada grupo (día + texto exacto).
--
-- Es seguro correrlo aunque no tengas duplicados: si no hay nada que borrar,
-- no hace nada. Pégalo en el SQL Editor de Supabase y dale "Run".

delete from public.running_blocks rb
using (
  select id,
         row_number() over (partition by user_id, day_number, text order by created_at asc) as rn
  from public.running_blocks
) dupes
where rb.id = dupes.id
  and dupes.rn > 1;
