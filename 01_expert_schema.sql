-- ===========================================================================
-- ARQUITECTURA EXPERTA PARDOS CHICKEN (MIGRACIÓN)
-- ===========================================================================
-- Instrucciones: Copia y pega todo este código en el "SQL Editor" de Supabase y presiona "Run".
-- Esto creará todas las tablas maestras, llaves foráneas y relaciones perfectas.

-- 1. TABLAS MAESTRAS (Catálogos)
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    dni text UNIQUE NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    is_vip boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tables (
    id text PRIMARY KEY, -- Ej: 'T01'
    number integer NOT NULL,
    capacity integer NOT NULL,
    zone text NOT NULL,
    is_available boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.menu_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.menu_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id uuid REFERENCES public.menu_categories(id),
    name text NOT NULL,
    price numeric NOT NULL,
    is_available boolean DEFAULT true
);

-- Asegurarnos que profiles existe (Supabase la suele tener, pero agregamos si falta)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY, -- vinculado a auth.users
    name text,
    email text,
    role text,
    avatar text,
    sucursal text,
    created_at timestamptz DEFAULT now()
);

-- 2. TABLAS OPERACIONALES (Transaccionales)
-- Nota: Usamos DROP CASCADE para limpiar las tablas viejas que no tenían relaciones
DROP TABLE IF EXISTS public.reservations CASCADE;
CREATE TABLE public.reservations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    table_id text REFERENCES public.tables(id),
    approved_by uuid REFERENCES public.profiles(id),
    date date NOT NULL,
    time text NOT NULL,
    guests integer NOT NULL,
    status text DEFAULT 'pending',
    notes text,
    created_at timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS public.kitchen_tickets CASCADE;
CREATE TABLE public.kitchen_tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS public.ticket_items CASCADE;
CREATE TABLE public.ticket_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid REFERENCES public.kitchen_tickets(id) ON DELETE CASCADE,
    menu_item_id uuid REFERENCES public.menu_items(id),
    quantity integer NOT NULL,
    status text DEFAULT 'pending',
    notes text
);

DROP TABLE IF EXISTS public.payments CASCADE;
CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
    processed_by uuid REFERENCES public.profiles(id),
    amount numeric NOT NULL,
    method text NOT NULL,
    status text DEFAULT 'pending',
    date date NOT NULL,
    time text,
    items jsonb,
    created_at timestamptz DEFAULT now()
);

DROP TABLE IF EXISTS public.complaints CASCADE;
CREATE TABLE public.complaints (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
    fecha date NOT NULL,
    canal text,
    estado text,
    severidad text,
    mensaje text,
    resolution jsonb,
    created_at timestamptz DEFAULT now()
);

-- ===========================================================================
DROP TABLE IF EXISTS public.cash_shifts CASCADE;
CREATE TABLE public.cash_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by text NOT NULL,
  start_balance numeric NOT NULL,
  opened_at timestamp with time zone DEFAULT now(),
  closed_at timestamp with time zone,
  end_balance numeric,
  status text DEFAULT 'open'
);

-- ===========================================================================
-- FIN DE LA MIGRACIÓN
-- ===========================================================================
