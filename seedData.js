import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { resolve } from 'path'
import { SAMPLE_COMPLAINTS as COMPLAINTS_SEED } from './src/data/seeds/complaintsSeed.js'
import { SAMPLE_RESERVATIONS as RESERVATIONS_SEED } from './src/data/seeds/reservationsSeed.js'
import { SAMPLE_PAYMENTS as PAYMENTS_SEED } from './src/data/seeds/paymentsSeed.js'

// Mock de tickets de cocina porque no tienen seed separado, lo generamos de las reservas
const KITCHEN_TICKETS = [
  { id: 'k1', table_id: '4', status: 'completed' },
  { id: 'k2', table_id: '12', status: 'completed' },
  { id: 'k3', table_id: '8', status: 'completed' },
  { id: 'k4', table_id: '15', status: 'completed' }
]

// Cargar .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function seedAll() {
  console.log('🌱 Poblando datos de prueba en Supabase...')

  // 1. Reservas
  for (const r of RESERVATIONS_SEED) {
    await supabase.from('reservations').insert({
      id: r.id,
      client_name: r.clientName,
      client_dni: r.clientDni,
      table_id: r.tableId,
      date: r.date,
      time: r.time,
      pax: r.pax,
      status: r.status,
      notes: r.notes || ''
    }).select()
  }
  console.log('✅ Reservas insertadas')

  // 2. Tickets de cocina
  for (const k of KITCHEN_TICKETS) {
    await supabase.from('kitchen_tickets').insert({
      id: k.id,
      table_id: k.table_id,
      status: k.status
    }).select()
  }
  console.log('✅ Tickets de cocina insertados')

  // 3. Pagos
  for (const p of PAYMENTS_SEED) {
    await supabase.from('payments').insert({
      id: p.id,
      reservation_id: p.reservationId,
      amount: p.amount,
      method: p.method,
      status: p.status,
      date: p.date
    }).select()
  }
  console.log('✅ Pagos insertados')

  // 4. Quejas
  for (const c of COMPLAINTS_SEED) {
    await supabase.from('complaints').insert({
      id: c.id,
      client_name: c.clientName,
      client_email: c.clientEmail,
      client_dni: c.clientDni,
      table_id: c.tableId,
      message: c.message,
      status: c.status,
      severity: c.severity,
      date: c.date,
      tags: c.tags || [],
      resolution: typeof c.resolution === 'object' ? JSON.stringify(c.resolution) : c.resolution
    }).select()
  }
  console.log('✅ Quejas insertadas')
}

seedAll().catch(console.error)
