-- ===========================================================================
-- 05 · DATOS HISTÓRICOS DE VENTAS + CLIENTES VIP
-- ===========================================================================
-- Instrucciones: pega TODO en el SQL Editor de Supabase y presiona "Run".
--
-- Qué hace:
--   1. Inserta ~70 pagos REALES repartidos en los últimos 14 días, con horas
--      variadas (12:00–21:30), métodos mezclados (efectivo/tarjeta/yape/plin)
--      y líneas de consumo con los códigos reales de la carta (B01, PA01…).
--      Con esto las gráficas por hora/método/plato y la proyección de demanda
--      del almacén tienen historia de verdad.
--   2. Marca como VIP a los 6 clientes con más reservas.
--
-- Es seguro re-ejecutarlo: los pagos usan IDs deterministas (upsert) y el
-- update de VIP es idempotente.
-- ===========================================================================

DO $$
DECLARE
  d integer;      -- días hacia atrás
  j integer;      -- n.º de pago del día
  n_pagos integer;
  combo integer;
  pay_id uuid;
  fecha date;
  hora text;
  metodo text;
  monto numeric;
  lineas jsonb;
  metodos text[] := array['efectivo','tarjeta','yape','plin'];
  horas text[] := array['12:15','12:45','13:10','13:30','13:50','14:20','15:05','18:40','19:15','19:50','20:30','21:10'];
BEGIN
  FOR d IN 1..14 LOOP
    fecha := current_date - d;
    -- Más ventas los fines de semana (sáb=6, dom=0)
    n_pagos := CASE WHEN extract(dow FROM fecha) IN (0, 6) THEN 8 ELSE 4 END;

    FOR j IN 1..n_pagos LOOP
      combo  := ((d * 7 + j * 3) % 6) + 1;  -- rota 6 combos de forma determinista
      hora   := horas[((d + j * 5) % 12) + 1];
      metodo := metodos[((d * 3 + j) % 4) + 1];

      IF combo = 1 THEN  -- Familia: pollo entero + gaseosa 1.5 + ensalada
        monto := 76.90 + 12.90 + 18.90;
        lineas := '[{"itemId":"B03","name":"1 Pardos Brasa (Entero)","qty":1,"unitPrice":76.90,"subtotal":76.90},
                    {"itemId":"BE04","name":"Coca Cola / Inca Kola 1.5L","qty":1,"unitPrice":12.90,"subtotal":12.90},
                    {"itemId":"EN03","name":"Ensalada Fresca (Regular)","qty":1,"unitPrice":18.90,"subtotal":18.90}]'::jsonb;
      ELSIF combo = 2 THEN  -- Pareja: 2× 1/4 brasa + 2 chichas
        monto := 25.90*2 + 6.90*2;
        lineas := '[{"itemId":"B01","name":"1/4 Pardos Brasa","qty":2,"unitPrice":25.90,"subtotal":51.80},
                    {"itemId":"BE01","name":"Chicha Pardos 500ml","qty":2,"unitPrice":6.90,"subtotal":13.80}]'::jsonb;
      ELSIF combo = 3 THEN  -- 1/2 brasa + agua + postre
        monto := 41.90 + 6.90 + 15.50;
        lineas := '[{"itemId":"B02","name":"1/2 Pardos Brasa","qty":1,"unitPrice":41.90,"subtotal":41.90},
                    {"itemId":"BE06","name":"Botella de agua (con/sin gas)","qty":1,"unitPrice":6.90,"subtotal":6.90},
                    {"itemId":"D02","name":"Tres leches","qty":1,"unitPrice":15.50,"subtotal":15.50}]'::jsonb;
      ELSIF combo = 4 THEN  -- Parrillero + chicharrón piqueo + gaseosas
        monto := 28.90 + 15.90 + 6.90*2;
        lineas := '[{"itemId":"PA01","name":"1/4 Parrillero Original","qty":1,"unitPrice":28.90,"subtotal":28.90},
                    {"itemId":"P07","name":"Piqueo Chicharrón de Pollo (6 unidades)","qty":1,"unitPrice":15.90,"subtotal":15.90},
                    {"itemId":"BE03","name":"Coca Cola / Inca Kola 500ml","qty":2,"unitPrice":6.90,"subtotal":13.80}]'::jsonb;
      ELSIF combo = 5 THEN  -- Carnívoro: lomo + chicha 1.5
        monto := 44.90 + 16.90;
        lineas := '[{"itemId":"C01","name":"Lomo a la Parrilla (Mediano)","qty":1,"unitPrice":44.90,"subtotal":44.90},
                    {"itemId":"BE02","name":"Chicha Pardos 1.5L","qty":1,"unitPrice":16.90,"subtotal":16.90}]'::jsonb;
      ELSE  -- Grupo: 2× 1/2 brasa + anticuchos + bebidas
        monto := 41.90*2 + 23.90 + 6.90*3;
        lineas := '[{"itemId":"B02","name":"1/2 Pardos Brasa","qty":2,"unitPrice":41.90,"subtotal":83.80},
                    {"itemId":"S03","name":"Anticuchos de Corazón","qty":1,"unitPrice":23.90,"subtotal":23.90},
                    {"itemId":"BE01","name":"Chicha Pardos 500ml","qty":3,"unitPrice":6.90,"subtotal":20.70}]'::jsonb;
      END IF;

      -- ID determinista por día+número: re-ejecutar NO duplica (upsert).
      pay_id := ('00000000-0000-4000-f000-' || lpad((d * 100 + j)::text, 12, '0'))::uuid;

      INSERT INTO public.payments (id, reservation_id, amount, method, status, date, time, items)
      VALUES (
        pay_id, NULL, monto, metodo, 'paid', fecha, hora,
        jsonb_build_object(
          'lineas', lineas,
          'clientName', 'Cliente histórico ' || (d * 100 + j),
          'guests', (j % 4) + 1,
          'notes', '',
          'cashierName', 'Lucia Torres'
        )
      )
      ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, items = EXCLUDED.items;
    END LOOP;
  END LOOP;
END $$;

-- ── Clientes VIP: los 6 con más reservas pasan a VIP ──
UPDATE public.clients SET is_vip = true
WHERE id IN (
  SELECT c.id FROM public.clients c
  LEFT JOIN public.reservations r ON r.client_id = c.id
  GROUP BY c.id
  ORDER BY count(r.id) DESC
  LIMIT 6
);

-- Verificación rápida (opcional): cuántos pagos y VIPs quedaron
-- SELECT count(*) AS pagos_historicos FROM payments WHERE id::text LIKE '00000000-0000-4000-f000-%';
-- SELECT count(*) AS vips FROM clients WHERE is_vip = true;
-- ===========================================================================
