-- ===========================================================================
-- M7 · ALMACÉN: GESTIÓN DE LOTES Y CADUCIDAD (FIFO)
-- ===========================================================================
-- Instrucciones: Pega esto en el "SQL Editor" de Supabase y presiona "Run".
-- ===========================================================================

-- 1. Crear tabla para rastrear lotes de ingreso
CREATE TABLE IF NOT EXISTS public.supply_batches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    supply_id text NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
    cantidad numeric NOT NULL,
    cantidad_restante numeric NOT NULL,
    fecha_ingreso date DEFAULT CURRENT_DATE,
    fecha_caducidad date NOT NULL,
    proveedor text,
    created_at timestamptz DEFAULT now()
);

-- 2. Insertar algunos lotes de prueba a punto de vencer para probar la automatización
-- NOTA: Asumimos que hoy es Julio 2026, pondremos caducidades para mañana
INSERT INTO public.supply_batches (supply_id, cantidad, cantidad_restante, fecha_caducidad, proveedor)
VALUES 
    ('LECHUGA', 12, 12, (CURRENT_DATE + interval '1 day')::date, 'Mercado Central'),
    ('TOMATE', 5, 5, (CURRENT_DATE + interval '2 days')::date, 'Mercado Central'),
    ('PAPA', 20, 20, (CURRENT_DATE + interval '15 days')::date, 'Mercado Central')
ON CONFLICT DO NOTHING;
