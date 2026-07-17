-- ===========================================================================
-- M7 · ALMACÉN Y PLANIFICACIÓN DE COMPRAS (MIGRACIÓN)
-- ===========================================================================
-- Instrucciones: pega TODO en el "SQL Editor" de Supabase y presiona "Run".
-- Genera las tablas del almacén y las llena con el seed inicial.
-- Idempotente: puedes re-ejecutarlo (usa upsert por PK).
-- ===========================================================================

-- 1. INSUMOS (stock que cambia en el tiempo → fuente de verdad en la BD)
CREATE TABLE IF NOT EXISTS public.supplies (
    id text PRIMARY KEY,
    nombre text NOT NULL,
    unidad text NOT NULL,
    categoria text,
    stock_actual numeric DEFAULT 0,
    stock_minimo numeric DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

-- 2. RECETAS (lista de materiales / BOM): plato (código de carta) → insumo
CREATE TABLE IF NOT EXISTS public.recipes (
    menu_code text NOT NULL,           -- 'B01', 'PA01'… (itemId de la carta)
    supply_id text NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
    cantidad numeric NOT NULL,
    PRIMARY KEY (menu_code, supply_id)
);

-- 3. PROVEEDORES + sus precios por insumo
CREATE TABLE IF NOT EXISTS public.suppliers (
    id text PRIMARY KEY,
    nombre text NOT NULL,
    categoria text,
    telefono text,
    whatsapp text,
    web text,
    direccion text,
    fuente text,
    activo boolean DEFAULT true,
    precio_referencial boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.supplier_prices (
    supplier_id text NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    supply_id text NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
    precio numeric NOT NULL,
    unidad text,
    PRIMARY KEY (supplier_id, supply_id)
);

-- 4. FECHAS ESPECIALES (factor de demanda)
CREATE TABLE IF NOT EXISTS public.special_dates (
    id text PRIMARY KEY,
    nombre text NOT NULL,
    tipo text NOT NULL,                -- 'fija' | 'movil'
    mes integer NOT NULL,
    dia integer,                       -- para 'fija'
    dia_semana integer,                -- para 'movil' (0=domingo)
    ordinal integer,                   -- para 'movil' (1=primero…)
    factor numeric NOT NULL,
    nota text
);


-- ── SEED: supplies ──
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('POLLO_ENTERO', 'Pollo entero fresco (~2.4 kg)', 'unidad', 'proteina', 22, 10) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('CARNE_LOMO', 'Lomo de res', 'kg', 'proteina', 6, 3) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('CARNE_BIFE', 'Bife de res', 'kg', 'proteina', 5, 3) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('CORAZON_RES', 'Corazón de res (anticucho)', 'kg', 'proteina', 4, 2) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('MOLLEJA_POLLO', 'Mollejitas de pollo', 'kg', 'proteina', 3, 2) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('FILETE_POLLO', 'Filete de pollo (chicharrón/brocheta/panko)', 'kg', 'proteina', 8, 4) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('CHORIZO_CKTL', 'Chorizo cocktail', 'unidad', 'proteina', 60, 24) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('MASA_TEQUENO', 'Masa para tequeños (unidad)', 'unidad', 'abarrote', 90, 36) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('QUESO', 'Queso para tequeños', 'kg', 'abarrote', 2, 1) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('PANKO', 'Panko / apanadura', 'kg', 'abarrote', 3, 1) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('ACEITE', 'Aceite vegetal (fritura)', 'L', 'abarrote', 15, 8) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('CREMAS', 'Cremas y ajíes (mayonesa, ají, chimichurri)', 'kg', 'abarrote', 6, 3) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('AZUCAR', 'Azúcar rubia', 'kg', 'abarrote', 10, 5) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('PAPA', 'Papa para freír', 'kg', 'verdura', 40, 20) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('LECHUGA', 'Lechuga', 'unidad', 'verdura', 12, 6) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('TOMATE', 'Tomate', 'kg', 'verdura', 5, 3) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('ZANAHORIA', 'Zanahoria', 'kg', 'verdura', 4, 2) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('BETERRAGA', 'Beterraga', 'kg', 'verdura', 3, 2) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('VAINITA', 'Vainita', 'kg', 'verdura', 2, 1) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('CHOCLO', 'Choclo desgranado', 'kg', 'verdura', 3, 2) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('PALTA', 'Palta', 'unidad', 'verdura', 10, 5) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('PEPINO', 'Pepino', 'unidad', 'verdura', 8, 4) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('LIMON', 'Limón', 'kg', 'verdura', 3, 2) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('MAIZ_MORADO', 'Maíz morado (chicha)', 'kg', 'verdura', 6, 3) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('PINA', 'Piña (chicha)', 'unidad', 'verdura', 4, 2) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('ESPECIAS_CHICHA', 'Canela y clavo (chicha)', 'kg', 'abarrote', 1, 0.5) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('GASEOSA_500', 'Coca Cola / Inca Kola 500 ml', 'unidad', 'bebida', 48, 24) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('GASEOSA_15L', 'Coca Cola / Inca Kola 1.5 L', 'unidad', 'bebida', 24, 12) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('INKA_25L', 'Inca Kola 2.5 L sin azúcar', 'unidad', 'bebida', 12, 6) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('AGUA', 'Agua con/sin gas (botella)', 'unidad', 'bebida', 36, 18) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('POSTRE_TORTA_CHOC', 'Torta de chocolate (porción)', 'porcion', 'postre', 8, 4) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('POSTRE_TRES_LECHES', 'Tres leches (porción)', 'porcion', 'postre', 8, 4) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('POSTRE_PIE_LIMON', 'Pie de limón (porción)', 'porcion', 'postre', 8, 4) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('POSTRE_CHEESECAKE', 'Cheesecake de fresa (porción)', 'porcion', 'postre', 8, 4) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('CARBON', 'Carbón vegetal', 'kg', 'combustible', 50, 30) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('VASO_DESC', 'Vaso descartable (chicha/refresco)', 'unidad', 'descartable', 200, 100) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('CONT_DESC', 'Contenedor descartable (delivery/sobras)', 'unidad', 'descartable', 120, 60) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('SERVILLETA', 'Servilletas', 'unidad', 'descartable', 800, 400) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;
INSERT INTO public.supplies (id, nombre, unidad, categoria, stock_actual, stock_minimo) VALUES ('BOLSA', 'Bolsa para llevar', 'unidad', 'descartable', 150, 80) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, unidad=EXCLUDED.unidad, categoria=EXCLUDED.categoria;

-- ── SEED: recipes (BOM) ──
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A01', 'CHORIZO_CKTL', 4) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A01', 'CREMAS', 0.03) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A01', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A02', 'CORAZON_RES', 0.15) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A02', 'PAPA', 0.1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A02', 'CHOCLO', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A02', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A03', 'MASA_TEQUENO', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A03', 'QUESO', 0.06) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A03', 'ACEITE', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A03', 'CREMAS', 0.03) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A03', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A04', 'MASA_TEQUENO', 6) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A04', 'QUESO', 0.12) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A04', 'ACEITE', 0.08) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A04', 'CREMAS', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('A04', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P01', 'CHORIZO_CKTL', 6) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P01', 'PAPA', 0.15) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P01', 'CREMAS', 0.04) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P01', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P02', 'FILETE_POLLO', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P02', 'PAPA', 0.15) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P02', 'CREMAS', 0.04) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P02', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P03', 'MOLLEJA_POLLO', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P03', 'PAPA', 0.15) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P03', 'CREMAS', 0.04) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P03', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P04', 'CORAZON_RES', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P04', 'PAPA', 0.15) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P04', 'CREMAS', 0.04) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P04', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P05', 'FILETE_POLLO', 0.18) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P05', 'PANKO', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P05', 'ACEITE', 0.08) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P05', 'CREMAS', 0.03) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P05', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P06', 'FILETE_POLLO', 0.36) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P06', 'PANKO', 0.1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P06', 'ACEITE', 0.12) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P06', 'CREMAS', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P06', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P07', 'FILETE_POLLO', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P07', 'PANKO', 0.06) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P07', 'ACEITE', 0.1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P07', 'CREMAS', 0.04) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P07', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P08', 'FILETE_POLLO', 0.5) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P08', 'PANKO', 0.12) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P08', 'ACEITE', 0.15) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P08', 'CREMAS', 0.06) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('P08', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C01', 'CARNE_LOMO', 0.3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C01', 'PAPA', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C01', 'CARBON', 0.3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C01', 'CREMAS', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C01', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C02', 'CARNE_LOMO', 0.4) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C02', 'PAPA', 0.3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C02', 'CARBON', 0.35) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C02', 'CREMAS', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C02', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C03', 'CARNE_BIFE', 0.35) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C03', 'PAPA', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C03', 'CARBON', 0.3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C03', 'CREMAS', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('C03', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B01', 'POLLO_ENTERO', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B01', 'PAPA', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B01', 'CARBON', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B01', 'CREMAS', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B01', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B02', 'POLLO_ENTERO', 0.5) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B02', 'PAPA', 0.45) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B02', 'CARBON', 0.5) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B02', 'CREMAS', 0.08) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B02', 'SERVILLETA', 4) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B03', 'POLLO_ENTERO', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B03', 'PAPA', 0.8) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B03', 'CARBON', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B03', 'CREMAS', 0.12) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('B03', 'SERVILLETA', 6) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA01', 'POLLO_ENTERO', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA01', 'PAPA', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA01', 'CARBON', 0.3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA01', 'CREMAS', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA01', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA02', 'POLLO_ENTERO', 0.5) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA02', 'PAPA', 0.45) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA02', 'CARBON', 0.55) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA02', 'CREMAS', 0.08) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA02', 'SERVILLETA', 4) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA03', 'POLLO_ENTERO', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA03', 'PAPA', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA03', 'CARBON', 0.3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA03', 'CREMAS', 0.06) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA03', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA04', 'POLLO_ENTERO', 0.5) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA04', 'PAPA', 0.45) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA04', 'CARBON', 0.55) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA04', 'CREMAS', 0.09) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('PA04', 'SERVILLETA', 4) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S01', 'FILETE_POLLO', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S01', 'PAPA', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S01', 'CARBON', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S01', 'CREMAS', 0.04) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S01', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S02', 'FILETE_POLLO', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S02', 'CHORIZO_CKTL', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S02', 'PAPA', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S02', 'CARBON', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S02', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S03', 'CORAZON_RES', 0.3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S03', 'PAPA', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S03', 'CHOCLO', 0.08) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S03', 'CARBON', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S03', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S04', 'MOLLEJA_POLLO', 0.3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S04', 'PAPA', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S04', 'CARBON', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S04', 'CREMAS', 0.04) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S04', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S05', 'FILETE_POLLO', 0.3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S05', 'PANKO', 0.07) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S05', 'ACEITE', 0.12) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S05', 'PAPA', 0.2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('S05', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E01', 'FILETE_POLLO', 0.35) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E01', 'PANKO', 0.08) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E01', 'ACEITE', 0.14) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E01', 'PAPA', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E01', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E02', 'MOLLEJA_POLLO', 0.35) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E02', 'PAPA', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E02', 'CARBON', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E02', 'CREMAS', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E02', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E03', 'CORAZON_RES', 0.35) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E03', 'PAPA', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E03', 'CARBON', 0.25) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E03', 'CREMAS', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('E03', 'SERVILLETA', 3) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN01', 'VAINITA', 0.1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN01', 'ZANAHORIA', 0.1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN01', 'BETERRAGA', 0.1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN01', 'PAPA', 0.1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN01', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN02', 'VAINITA', 0.15) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN02', 'ZANAHORIA', 0.15) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN02', 'BETERRAGA', 0.15) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN02', 'PAPA', 0.15) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN02', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN03', 'LECHUGA', 0.5) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN03', 'TOMATE', 0.12) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN03', 'PEPINO', 0.5) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN03', 'PALTA', 0.5) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN03', 'LIMON', 0.03) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN03', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN04', 'LECHUGA', 0.8) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN04', 'TOMATE', 0.18) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN04', 'PEPINO', 0.8) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN04', 'PALTA', 0.8) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN04', 'LIMON', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN04', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN05', 'LECHUGA', 0.6) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN05', 'TOMATE', 0.12) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN05', 'PALTA', 0.6) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN05', 'CHOCLO', 0.08) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN05', 'ZANAHORIA', 0.08) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('EN05', 'SERVILLETA', 2) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('D01', 'POSTRE_TORTA_CHOC', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('D01', 'SERVILLETA', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('D02', 'POSTRE_TRES_LECHES', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('D02', 'SERVILLETA', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('D03', 'POSTRE_PIE_LIMON', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('D03', 'SERVILLETA', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('D04', 'POSTRE_CHEESECAKE', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('D04', 'SERVILLETA', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE01', 'MAIZ_MORADO', 0.08) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE01', 'PINA', 0.05) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE01', 'ESPECIAS_CHICHA', 0.003) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE01', 'AZUCAR', 0.04) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE01', 'VASO_DESC', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE02', 'MAIZ_MORADO', 0.24) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE02', 'PINA', 0.15) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE02', 'ESPECIAS_CHICHA', 0.009) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE02', 'AZUCAR', 0.12) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE03', 'GASEOSA_500', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE04', 'GASEOSA_15L', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE05', 'INKA_25L', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;
INSERT INTO public.recipes (menu_code, supply_id, cantidad) VALUES ('BE06', 'AGUA', 1) ON CONFLICT (menu_code, supply_id) DO UPDATE SET cantidad=EXCLUDED.cantidad;

-- ── SEED: suppliers + supplier_prices ──
INSERT INTO public.suppliers (id, nombre, categoria, telefono, whatsapp, web, direccion, fuente, activo, precio_referencial) VALUES ('SF', 'San Fernando', 'proteina', NULL, NULL, 'https://www.san-fernando.com.pe', 'Lima (cobertura nacional)', 'https://veramendi.pe/carnes-aves-y-pescados/600-pollos-san-fernado-y-redondos-.html', true, true) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('SF', 'POLLO_ENTERO', 23.5, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('SF', 'FILETE_POLLO', 16.9, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('SF', 'MOLLEJA_POLLO', 9.5, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.suppliers (id, nombre, categoria, telefono, whatsapp, web, direccion, fuente, activo, precio_referencial) VALUES ('AVE', 'Avícola Estela (AVICELA)', 'proteina', '+51 908 750 004', NULL, 'https://avicolaestela.com', 'Lima Norte', 'https://avicolaestela.com/', true, true) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('AVE', 'POLLO_ENTERO', 21.9, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('AVE', 'FILETE_POLLO', 15.9, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.suppliers (id, nombre, categoria, telefono, whatsapp, web, direccion, fuente, activo, precio_referencial) VALUES ('AVK', 'Avinka', 'proteina', NULL, NULL, 'https://avinka.com', 'Tiendas propias en Lima', 'https://avinka.com/', true, true) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('AVK', 'POLLO_ENTERO', 22.8, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('AVK', 'FILETE_POLLO', 16.5, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.suppliers (id, nombre, categoria, telefono, whatsapp, web, direccion, fuente, activo, precio_referencial) VALUES ('MAKRO', 'Makro Supermayorista', 'multicategoria', NULL, NULL, 'https://www.makro.pe', 'Av. Jorge Chávez 1218, Santiago de Surco', 'https://www.makro.pe/', true, true) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'CARNE_LOMO', 42, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'CARNE_BIFE', 36, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'CORAZON_RES', 24, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'CHORIZO_CKTL', 0.9, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'QUESO', 26, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'PANKO', 14, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'ACEITE', 9.5, 'L') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'AZUCAR', 4.2, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'CREMAS', 12, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'MASA_TEQUENO', 0.35, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'GASEOSA_500', 2.8, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MAKRO', 'AGUA', 1.6, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.suppliers (id, nombre, categoria, telefono, whatsapp, web, direccion, fuente, activo, precio_referencial) VALUES ('GMML', 'Gran Mercado Mayorista de Lima (Santa Anita)', 'verdura', NULL, NULL, 'https://www.gob.pe/institucion/midagri/colecciones/335-reporte-de-ingreso-y-precios-en-el-gran-mercado-mayorista-de-lima', 'Av. de la Cultura 808, Santa Anita', 'https://amlq.org.pe/gran-mercado-mayorista-de-lima/', true, true) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'PAPA', 1.8, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'LECHUGA', 2.5, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'TOMATE', 3.5, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'ZANAHORIA', 2, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'BETERRAGA', 2.2, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'VAINITA', 4.5, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'CHOCLO', 4, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'PALTA', 2.8, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'PEPINO', 1.5, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'LIMON', 5.5, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'MAIZ_MORADO', 6, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'PINA', 2.8, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('GMML', 'ESPECIAS_CHICHA', 28, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.suppliers (id, nombre, categoria, telefono, whatsapp, web, direccion, fuente, activo, precio_referencial) VALUES ('ACL', 'Arca Continental Lindley (Coca-Cola / Inca Kola)', 'bebida', NULL, NULL, 'https://www.arcacontinentallindley.pe/servicio-cliente/', 'Av. Javier Prado Este 6210, La Molina', 'https://www.arcacontinentallindley.pe/', true, true) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('ACL', 'GASEOSA_500', 2.5, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('ACL', 'GASEOSA_15L', 6.8, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('ACL', 'INKA_25L', 9.5, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('ACL', 'AGUA', 1.4, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.suppliers (id, nombre, categoria, telefono, whatsapp, web, direccion, fuente, activo, precio_referencial) VALUES ('MCD', 'MC Descartables', 'descartable', '(01) 354-7109', '+51 907 898 618', 'https://descartables.com.pe', 'Lima', 'https://descartables.com.pe/collections/vendors?q=pamolsa', true, true) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MCD', 'VASO_DESC', 0.12, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MCD', 'CONT_DESC', 0.45, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MCD', 'SERVILLETA', 0.02, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('MCD', 'BOLSA', 0.08, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.suppliers (id, nombre, categoria, telefono, whatsapp, web, direccion, fuente, activo, precio_referencial) VALUES ('PAM', 'Pamolsa (fabricante de envases)', 'descartable', NULL, NULL, 'https://www.pamolsa.com.pe', 'Lima', 'https://www.pamolsa.com.pe/', true, true) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('PAM', 'VASO_DESC', 0.1, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('PAM', 'CONT_DESC', 0.4, 'unidad') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.suppliers (id, nombre, categoria, telefono, whatsapp, web, direccion, fuente, activo, precio_referencial) VALUES ('CC', 'Carbón Center', 'combustible', NULL, NULL, 'https://www.facebook.com/peru.carboncenter/', 'Jr. Pastaza 1488, Breña', 'https://www.facebook.com/peru.carboncenter/', true, true) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('CC', 'CARBON', 3.2, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.suppliers (id, nombre, categoria, telefono, whatsapp, web, direccion, fuente, activo, precio_referencial) VALUES ('CYP', 'Carbones y Parrillas', 'combustible', '+51 946 988 532', NULL, 'https://carbonesyparrillas.com', 'Lima', 'https://carbonesyparrillas.com/', true, true) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('CYP', 'CARBON', 3, 'kg') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.suppliers (id, nombre, categoria, telefono, whatsapp, web, direccion, fuente, activo, precio_referencial) VALUES ('REPO', 'Repostería local (postres por porción)', 'postre', NULL, NULL, NULL, 'Proveedor local por definir — completar con el dato del negocio', NULL, true, true) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, activo=EXCLUDED.activo;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('REPO', 'POSTRE_TORTA_CHOC', 7.5, 'porcion') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('REPO', 'POSTRE_TRES_LECHES', 7.5, 'porcion') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('REPO', 'POSTRE_PIE_LIMON', 7, 'porcion') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;
INSERT INTO public.supplier_prices (supplier_id, supply_id, precio, unidad) VALUES ('REPO', 'POSTRE_CHEESECAKE', 8, 'porcion') ON CONFLICT (supplier_id, supply_id) DO UPDATE SET precio=EXCLUDED.precio;

-- ── SEED: special_dates ──
INSERT INTO public.special_dates (id, nombre, tipo, mes, dia, dia_semana, ordinal, factor, nota) VALUES ('DIA_MADRE', 'Día de la Madre', 'movil', 5, NULL, 0, 2, 2.5, 'El día de mayor demanda del año en pollerías junto con el Día del Pollo a la Brasa.') ON CONFLICT (id) DO UPDATE SET factor=EXCLUDED.factor;
INSERT INTO public.special_dates (id, nombre, tipo, mes, dia, dia_semana, ordinal, factor, nota) VALUES ('DIA_PADRE', 'Día del Padre', 'movil', 6, NULL, 0, 3, 2, NULL) ON CONFLICT (id) DO UPDATE SET factor=EXCLUDED.factor;
INSERT INTO public.special_dates (id, nombre, tipo, mes, dia, dia_semana, ordinal, factor, nota) VALUES ('DIA_POLLO', 'Día del Pollo a la Brasa', 'movil', 7, NULL, 0, 3, 3, 'Tercer domingo de julio — feriado gastronómico oficial del Perú desde 2010.') ON CONFLICT (id) DO UPDATE SET factor=EXCLUDED.factor;
INSERT INTO public.special_dates (id, nombre, tipo, mes, dia, dia_semana, ordinal, factor, nota) VALUES ('FIESTAS_28', 'Fiestas Patrias (28 julio)', 'fija', 7, 28, NULL, NULL, 2, NULL) ON CONFLICT (id) DO UPDATE SET factor=EXCLUDED.factor;
INSERT INTO public.special_dates (id, nombre, tipo, mes, dia, dia_semana, ordinal, factor, nota) VALUES ('FIESTAS_29', 'Fiestas Patrias (29 julio)', 'fija', 7, 29, NULL, NULL, 1.8, NULL) ON CONFLICT (id) DO UPDATE SET factor=EXCLUDED.factor;
INSERT INTO public.special_dates (id, nombre, tipo, mes, dia, dia_semana, ordinal, factor, nota) VALUES ('SAN_VALENTIN', 'San Valentín', 'fija', 2, 14, NULL, NULL, 1.5, NULL) ON CONFLICT (id) DO UPDATE SET factor=EXCLUDED.factor;
INSERT INTO public.special_dates (id, nombre, tipo, mes, dia, dia_semana, ordinal, factor, nota) VALUES ('NAVIDAD_24', 'Nochebuena', 'fija', 12, 24, NULL, NULL, 1.6, NULL) ON CONFLICT (id) DO UPDATE SET factor=EXCLUDED.factor;
INSERT INTO public.special_dates (id, nombre, tipo, mes, dia, dia_semana, ordinal, factor, nota) VALUES ('ANO_NUEVO_31', 'Fin de año', 'fija', 12, 31, NULL, NULL, 1.6, NULL) ON CONFLICT (id) DO UPDATE SET factor=EXCLUDED.factor;

-- ===========================================================================
-- RLS opcional (recomendado): habilita lectura a usuarios autenticados.
-- Descomenta si tu proyecto usa Row Level Security.
-- ---------------------------------------------------------------------------
-- ALTER TABLE public.supplies        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.recipes         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.suppliers       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.supplier_prices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.special_dates   ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "lectura autenticada" ON public.supplies        FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "lectura autenticada" ON public.recipes         FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "lectura autenticada" ON public.suppliers       FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "lectura autenticada" ON public.supplier_prices FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "lectura autenticada" ON public.special_dates   FOR SELECT TO authenticated USING (true);
-- El líder de almacén podrá ACTUALIZAR stock:
-- CREATE POLICY "almacen actualiza stock" ON public.supplies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- ===========================================================================
-- FIN
-- ===========================================================================
