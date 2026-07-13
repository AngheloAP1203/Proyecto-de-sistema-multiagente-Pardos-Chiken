import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { resolve } from 'path'
import { SAMPLE_CLIENTS } from './src/data/seeds/clientsSeed.js'
import { SAMPLE_RESERVATIONS as RESERVATIONS_SEED, INITIAL_TABLES } from './src/data/seeds/reservationsSeed.js'
import { SAMPLE_PAYMENTS as PAYMENTS_SEED } from './src/data/seeds/paymentsSeed.js'
import { SAMPLE_COMPLAINTS as COMPLAINTS_SEED } from './src/data/seeds/complaintsSeed.js'
import { MENU_ITEMS } from './src/domain/kitchen/menu.js'

// Cargar .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function seedAll() {
  console.log('🧹 Limpiando datos existentes en Supabase (CASCADE)...')
  // Solo con borrar clientes, mesas y menús en cascada se limpia casi todo, pero por si acaso borraremos todo explícitamente si queremos, aunque el SQL ya limpió.
  await supabase.from('complaints').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('cash_shifts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('ticket_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('kitchen_tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('reservations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('menu_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('menu_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('tables').delete().neq('id', 'T00')
  await supabase.from('clients').delete().neq('dni', '0000')

  console.log('🌱 Poblando datos de prueba en Supabase...')

  // 1. Clientes
  const addedDnis = new Set()
  for (const c of SAMPLE_CLIENTS) {
    addedDnis.add(c.dni)
    const res = await supabase.from('clients').insert({
      id: '00000000-0000-4000-a000-' + String(c.dni).replace(/\D/g, '').padStart(12, '0'),
      dni: c.dni,
      name: c.name,
      email: c.email,
      phone: c.phone || c.dni,
      is_vip: c.vip
    })
    if (res.error) console.error('Error insertando cliente:', res.error)
  }
  console.log('✅ Clientes insertados')

  // 2. Mesas
  for (const t of INITIAL_TABLES) {
    const res = await supabase.from('tables').insert({
      id: t.id,
      number: t.number,
      capacity: t.capacity,
      zone: t.zone,
      is_available: t.isAvailable
    })
    if (res.error) console.error('Error mesas:', res.error)
  }
  console.log('✅ Mesas insertadas')

  // 3. Menú (Categorías e Items)
  const categories = [...new Set(MENU_ITEMS.map(m => m.category))]
  const catMap = {}
  for (const catName of categories) {
    const res = await supabase.from('menu_categories').insert({ name: catName }).select('id').single()
    if (!res.error) catMap[catName] = res.data.id
  }
  
  for (const m of MENU_ITEMS) {
    const res = await supabase.from('menu_items').insert({
      id: '00000000-0000-4000-b000-' + String(m.id).replace(/\D/g, '').padStart(12, '0'),
      category_id: catMap[m.category],
      name: m.name,
      price: m.price,
      is_available: true
    })
    if (res.error) console.error('Error menu:', res.error)
  }
  console.log('✅ Menú insertado')

  // 4. Reservas
  for (const r of RESERVATIONS_SEED) {
    if (!addedDnis.has(r.clientDni)) {
      // Insertar cliente ficticio
      await supabase.from('clients').insert({
        id: '00000000-0000-4000-a000-' + String(r.clientDni).replace(/\D/g, '').padStart(12, '0'),
        dni: r.clientDni,
        name: r.clientName || 'Cliente ' + r.clientDni,
        phone: r.clientDni
      })
      addedDnis.add(r.clientDni)
    }

    const clientUuid = '00000000-0000-4000-a000-' + String(r.clientDni).replace(/\D/g, '').padStart(12, '0')
    const resIdNum = String(r.id).replace(/\D/g, '')
    const res = await supabase.from('reservations').insert({
      id: '00000000-0000-4000-c000-' + resIdNum.padStart(12, '0'),
      client_id: clientUuid,
      table_id: r.tableId,
      date: r.date,
      time: r.time,
      guests: r.guests || r.pax || 2,
      status: r.status,
      notes: r.notes || ''
    })
    if (res.error) console.error('Error insertando reserva:', res.error)
  }
  console.log('✅ Reservas insertadas')

  // 5. Pagos (que internamente generan tickets de cocina)
  // Usaremos PAYMENTS_SEED porque tiene los items consumidos
  for (const p of PAYMENTS_SEED) {
    const resIdNum = String(p.reservationId).replace(/\D/g, '')
    const resId = '00000000-0000-4000-c000-' + resIdNum.padStart(12, '0')
    const pIdNum = String(p.id).replace(/\D/g, '')
    
    // a. Insertar Pago
    const itemsJsonb = p.items ? {
      lineas: p.items,
      clientName: p.clientName || '',
      guests: p.guests || 2,
      notes: p.notes || '',
      cashierName: p.cashierName || 'Lucia Torres'
    } : null

    const payRes = await supabase.from('payments').insert({
      id: '00000000-0000-4000-d000-' + pIdNum.padStart(12, '0'),
      reservation_id: resId,
      amount: p.amount,
      method: p.method,
      status: p.status,
      date: p.date,
      time: p.time,
      items: itemsJsonb
    })
    if (payRes.error) console.error('Error insertando pago:', payRes.error)

    // b. Crear un Ticket de Cocina para esta reserva
    const kitRes = await supabase.from('kitchen_tickets').insert({
      id: '00000000-0000-4000-e000-' + pIdNum.padStart(12, '0'),
      reservation_id: resId,
      status: 'completed'
    })

    // c. Insertar Ticket Items
    if (p.items) {
      for (const item of p.items) {
        const itemIdNum = String(item.itemId).replace(/\D/g, '')
        await supabase.from('ticket_items').insert({
            ticket_id: '00000000-0000-4000-e000-' + pIdNum.padStart(12, '0'),
            menu_item_id: '00000000-0000-4000-b000-' + itemIdNum.padStart(12, '0'),
            quantity: item.qty
        })
      }
    }
  }
  console.log('✅ Pagos y Tickets de Cocina insertados')

  // 5.5 Turnos de Caja
  console.log('🌱 Insertando Turnos de Caja...')
  const shiftRes = await supabase.from('cash_shifts').insert([
    {
      opened_by: 'Lucia Torres',
      start_balance: 150.00,
      opened_at: new Date().toISOString(),
      status: 'open'
    }
  ])
  if (shiftRes.error) console.error('Error insertando turno de caja:', shiftRes.error)
  else console.log('✅ Turno de caja abierto insertado')

  // 6. Quejas
  for (const c of COMPLAINTS_SEED) {
    // Intentamos encontrar el cliente por nombre en SAMPLE_CLIENTS para sacar el DNI
    const clientDef = SAMPLE_CLIENTS.find(x => x.name === c.cliente) || SAMPLE_CLIENTS[0]
    const clientUuid = '00000000-0000-4000-a000-' + String(clientDef.dni).replace(/\D/g, '').padStart(12, '0')
    const cIdNum = String(c.id).replace(/\D/g, '')

    const res = await supabase.from('complaints').insert({
      id: '00000000-0000-4000-f000-' + cIdNum.padStart(12, '0'),
      client_id: clientUuid,
      fecha: c.fecha,
      canal: c.canal,
      estado: c.estado,
      severidad: c.prioridad,
      mensaje: c.mensaje,
      resolution: typeof c.resolution === 'object' ? JSON.stringify(c.resolution) : c.resolution
    })
    if (res.error) console.error('Error insertando queja:', res.error)
  }
  console.log('✅ Quejas insertadas')
}

seedAll().catch(console.error)
