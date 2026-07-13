/**
 * src/agents/core/claimVerifier.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de verificación anti-fraude de reclamos (M6).
 *
 * REGLA DE IDENTIDAD (decisión de negocio): DNI Y número de mesa.
 *
 * CADENA DE EVIDENCIA (Backend / Supabase):
 *   Reserva(tableId, clientDni) → Comanda(tableId) → Pago(reservationId)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../../domain/supabase'

export const VEREDICTO = {
  VERIFICADO:  'VERIFICADO',
  RECHAZADO:   'RECHAZADO',
  SIN_COMANDA: 'SIN_COMANDA',
  SIN_MESA:    'SIN_MESA',
}

const normDoc = (d) => String(d || '').replace(/\D/g, '')
const normMesa = (m) => String(m || '')
  .toLowerCase()
  .replace(/[^0-9a-z]/g, '')
  .replace(/^(mesa|table|t)/, '')
  .replace(/^0+(?=\d)/, '')

const mismaMesa = (a, b) => normMesa(a) !== '' && normMesa(a) === normMesa(b)

const CONSUMIO = ['seated', 'completed', 'approved', 'confirmed']
const HOY = () => new Date().toISOString().split('T')[0]

/**
 * verificarReclamo — Consulta segura a Supabase.
 * @param {Object} reclamo - { tableId, dni, fecha }
 */
export async function verificarReclamo(reclamo = {}) {
  const { tableId, dni, fecha } = reclamo

  if (!tableId || normMesa(tableId) === '') {
    return {
      veredicto: VEREDICTO.SIN_MESA, elegible: false,
      motivo: 'El reclamo no indica el número de mesa, así que no se puede verificar quién consumió.',
    }
  }

  const queryDate = fecha || HOY()

  // 1. Obtener Reservas de esa mesa y fecha
  const { data: reservasMesa, error: resErr } = await supabase
    .from('reservations')
    .select('*')
    .eq('date', queryDate)

  // 2. Obtener Pagos
  const { data: pagosMesa, error: payErr } = await supabase
    .from('payments')
    .select('*')
    .eq('date', queryDate)

  // 3. Obtener Comandas (Kitchen Tickets)
  const { data: comandasMesa, error: kitErr } = await supabase
    .from('kitchen_tickets')
    .select('*')

  if (resErr || payErr || kitErr) {
    console.error('Error verificando reclamo:', resErr || payErr || kitErr)
    return { veredicto: VEREDICTO.RECHAZADO, elegible: false, motivo: 'Error interno del servidor al verificar datos.' }
  }

  // Filtrar localmente por mesa (ya que normalizamos el formato en JS)
  const reservasFiltradas = (reservasMesa || []).filter(r => mismaMesa(r.table_id, tableId))
  const pagosFiltrados = (pagosMesa || []).filter(p => 
    (reservasFiltradas.some(r => r.id === p.reservation_id) || (p.table_id && mismaMesa(p.table_id, tableId)))
  )
  const comandaCuenta = (comandasMesa || []).some(t => mismaMesa(t.table_id, tableId))

  const huboConsumo =
    comandaCuenta ||
    pagosFiltrados.length > 0 ||
    reservasFiltradas.some(r => CONSUMIO.includes(r.status))

  if (!huboConsumo) {
    return {
      veredicto: VEREDICTO.SIN_COMANDA, elegible: false,
      motivo: `No hay registro de un pedido confirmado en la mesa ${tableId}${fecha ? ` el ${fecha}` : ''}. Sin consumo, no hay reclamo que recompensar.`,
    }
  }

  const docId = normDoc(dni)
  const reservaCoincide = docId
    ? reservasFiltradas.find(r => normDoc(r.client_dni) === docId)
    : null

  if (!reservaCoincide) {
    return {
      veredicto: VEREDICTO.RECHAZADO, elegible: false,
      motivo: 'El DNI indicado no coincide con el de quien reservó y consumió en esa mesa.',
    }
  }

  const pago = pagosFiltrados.find(p => p.reservation_id === reservaCoincide.id) || pagosFiltrados[0] || null
  return {
    veredicto: VEREDICTO.VERIFICADO,
    elegible: true,
    motivo: 'Identidad confirmada: DNI y mesa coinciden con un consumo registrado.',
    cliente: reservaCoincide.client_name,
    reservationId: reservaCoincide.id,
    pago: pago ? { id: pago.id, amount: pago.amount, fecha: pago.date } : null,
  }
}
