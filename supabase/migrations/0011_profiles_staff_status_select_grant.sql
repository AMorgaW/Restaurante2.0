-- 0011: permite a authenticated leer staff_status de filas ya visibles por RLS.
-- Append-only. No modifica 0001–0010.
--
-- Contexto: getServerSessionContext() selecciona role + staff_status para
-- discriminar staff active → /empleado|admin vs suspended/inactive → /cuenta.
-- role ya tenía GRANT de columna (0002); staff_status se añadió en 0005 sin grant.
-- private.current_staff_status() existe pero está revocada a clientes.
--
-- Solución mínima: GRANT SELECT (staff_status) únicamente.
-- No GRANT SELECT de tabla completa. No cambia policies. No SECURITY DEFINER.
-- RLS profiles_read (0009) sigue limitando filas a:
--   id = auth.uid() OR private.current_role() IN ('owner', 'admin').

begin;

grant select (staff_status) on public.profiles to authenticated;

comment on column public.profiles.staff_status is
  'Estado de personal (invited|active|suspended|inactive). Readable by authenticated only on RLS-visible rows; customers keep NULL.';

commit;
