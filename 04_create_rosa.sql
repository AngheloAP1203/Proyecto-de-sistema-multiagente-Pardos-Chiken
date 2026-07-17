-- ===========================================================================
-- CREAR AL LÍDER DE ALMACÉN (Rosa Núñez) — MÉTODO CORRECTO
-- ===========================================================================
-- IMPORTANTE: NO insertes usuarios directo en auth.users. Esa vía deja el
-- usuario malformado (sin fila en auth.identities), rompe el login con error
-- 500 y ni siquiera se puede borrar desde el panel. Este archivo documenta el
-- camino correcto + la limpieza si ya caíste en la trampa.
-- ===========================================================================

-- ── PASO 0 (solo si ya insertaste un almacen@pardos.com roto) — LIMPIAR ──
-- Ejecútalo si el panel muestra "Database error loading user" al intentar
-- borrarlo. El DELETE por SQL sí funciona.
DELETE FROM public.profiles  WHERE email = 'almacen@pardos.com';
DELETE FROM auth.identities  WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'almacen@pardos.com');
DELETE FROM auth.users       WHERE email = 'almacen@pardos.com';

-- ── PASO 1 — Crear el usuario desde el PANEL (no por SQL) ──
--   Authentication → Users → Add user
--   Email:    almacen@pardos.com
--   Password: almacen123
--   ✅ Auto Confirm User
-- Esto crea auth.users Y auth.identities correctamente (login funcional).

-- ── PASO 2 — Permitir el rol nuevo en profiles (una sola vez) ──
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin','cajero','mozo','hostess','jefe_cocina','lider_almacen'));

-- ── PASO 3 — Crear el perfil con el rol (usa el UID que dio el PASO 1) ──
-- Reemplaza 'EL-NUEVO-UID' por el UID que aparece en Authentication → Users.
-- INSERT INTO public.profiles (id, name, email, role, sucursal)
-- VALUES ('EL-NUEVO-UID', 'Rosa Núñez', 'almacen@pardos.com', 'lider_almacen', 'Miraflores');
-- ===========================================================================
