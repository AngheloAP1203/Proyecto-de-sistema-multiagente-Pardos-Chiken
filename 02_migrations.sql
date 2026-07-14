-- 02_migrations.sql
-- Migración para eliminar dependencias de localStorage

-- 1. Tabla para Resoluciones Activas
CREATE TABLE IF NOT EXISTS public.resolutions (
    id text PRIMARY KEY,
    status text DEFAULT 'pendiente',
    timestamp timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. Tabla para Auditoría
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp timestamptz DEFAULT now(),
    actor text,
    tipo_actor text,
    accion text,
    nivel text,
    detalle jsonb
);

-- 3. Tabla para Historial de Agentes
CREATE TABLE IF NOT EXISTS public.agent_history (
    agent_name text PRIMARY KEY,
    history jsonb DEFAULT '[]'::jsonb,
    updated_at timestamptz DEFAULT now()
);

-- 4. Tabla para Configuraciones JSON Generales (Menu local, etc)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value jsonb DEFAULT '{}'::jsonb
);

-- Habilitar RLS (Row Level Security) y permitir acceso anónimo/público (para la demo)
ALTER TABLE public.resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for resolutions" ON public.resolutions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.agent_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for agent_history" ON public.agent_history FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
