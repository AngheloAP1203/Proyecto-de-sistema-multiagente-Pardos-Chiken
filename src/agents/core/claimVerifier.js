/**
 * src/agents/core/claimVerifier.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de verificación anti-fraude de reclamos (M6).
 *
 * PRINCIPIO: la elegibilidad la decide JAVASCRIPT, nunca el LLM.
 *
 * REGLA DE IDENTIDAD: El cliente debe proporcionar su DNI y el CÓDIGO ÚNICO
 * de su reserva o boleta. El código es el UUID de la reserva, que aparece
 * impreso en la boleta y en la tarjeta de reserva.
 *
 * CADENA DE EVIDENCIA (Backend / Supabase):
 *   Reserva(id, client_dni) → Comanda(reservation_id) → Pago(reservation_id)
 *
 * DISEÑO — dos capas separadas para poder testear la lógica sin backend:
 *   · evaluarEvidencia(reclamo, datos)  → función PURA y determinista (golden set).
 *   · verificarReclamo(reclamo)         → async: trae datos de Supabase y delega
 *                                         en evaluarEvidencia. Es la que usa la app.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const VEREDICTO = {
  VERIFICADO:  'VERIFICADO',   // DNI + código + consumo confirmados → elegible
  RECHAZADO:   'RECHAZADO',    // hubo reserva, pero el DNI no coincide → fraude
  SIN_RESERVA: 'SIN_RESERVA',  // no se encontró la reserva con ese código
  SIN_CODIGO:  'SIN_CODIGO',   // el reclamo no indica código → no se puede verificar
  DUPLICADO:   'DUPLICADO',    // ya existe una queja para esta reserva
}

/** Deja solo dígitos: "78 765 432" y "78-765-432" se comparan igual que "78765432". */
const normDoc = (d) => String(d || '').replace(/\D/g, '')

const CONSUMIO = ['seated', 'completed', 'approved', 'confirmed']

/**
 * evaluarEvidencia — Núcleo determinista PURO (sin efectos, testeable).
 *
 * @param {Object} reclamo - { codigo, dni }
 * @param {Object} datos   - { reservations, payments, kitchenTickets, complaints }
 *                           reservations[{ id, clientDni, clientName, clientId, status, date, tableId }]
 *                           payments[{ id, reservationId, amount, date }]
 *                           kitchenTickets[{ reservationId, status }]
 *                           complaints[{ reservationId }] — quejas previas
 * @returns {Object} { veredicto, elegible, motivo, cliente?, clientId?, reservationId?, pago? }
 */
export function evaluarEvidencia(reclamo = {}, datos = {}) {
  const { codigo, dni } = reclamo
  const reservations   = datos.reservations   || []
  const payments       = datos.payments       || []
  const kitchenTickets = datos.kitchenTickets || []
  const complaints     = datos.complaints    || []

  // 1. Sin código no hay forma de verificar.
  if (!codigo || codigo.trim() === '') {
    return {
      veredicto: VEREDICTO.SIN_CODIGO, elegible: false,
      motivo: 'No se proporcionó el código de reserva o boleta. Lo encuentras en tu boleta impresa o en la confirmación de tu reserva.',
    }
  }

  // 2. Buscar la reserva por su ID (código único) (case-insensitive)
  const normalizedCodigo = codigo.trim().toLowerCase()
  const reserva = reservations.find(r => r.id.toLowerCase() === normalizedCodigo)

  if (!reserva) {
    return {
      veredicto: VEREDICTO.SIN_RESERVA, elegible: false,
      motivo: 'No encontramos una reserva con ese código. Verifica que el código sea el correcto (lo encuentras en tu boleta o confirmación de reserva).',
    }
  }

  // 3. Verificar identidad: el DNI del reclamo debe coincidir con el de la reserva.
  const docId = normDoc(dni)
  const docReserva = normDoc(reserva.clientDni)

  if (!docId || docId !== docReserva) {
    return {
      veredicto: VEREDICTO.RECHAZADO, elegible: false,
      motivo: 'El DNI indicado no coincide con el del cliente que realizó esta reserva. Por seguridad, solo el titular puede presentar un reclamo.',
    }
  }

  // 4. Verificar que hubo consumo real (no una reserva cancelada antes de sentarse).
  const huboConsumo =
    CONSUMIO.includes(reserva.status) ||
    kitchenTickets.some(t => t.reservationId === reserva.id) ||
    payments.some(p => p.reservationId === reserva.id)

  if (!huboConsumo) {
    return {
      veredicto: VEREDICTO.SIN_RESERVA, elegible: false,
      motivo: 'Esta reserva no tiene un consumo registrado (puede haber sido cancelada). Solo se pueden presentar reclamos de visitas donde hubo consumo.',
    }
  }

  // 5. Verificar que no haya una queja previa para esta misma reserva.
  const quejaDuplicada = complaints.some(c => c.reservationId === reserva.id)
  if (quejaDuplicada) {
    return {
      veredicto: VEREDICTO.DUPLICADO, elegible: false,
      motivo: 'Ya existe un reclamo registrado para esta visita. Si necesitas agregar información adicional, acércate a nuestro personal o escríbenos por WhatsApp.',
    }
  }

  // 6. Verificado: código + DNI + consumo confirmados.
  const pago = payments.find(p => p.reservationId === reserva.id) || null
  return {
    veredicto:     VEREDICTO.VERIFICADO,
    elegible:      true,
    motivo:        'Identidad confirmada: DNI y código de reserva coinciden con un consumo registrado.',
    cliente:       reserva.clientName,
    clientId:      reserva.clientId,
    reservationId: reserva.id,
    tableId:       reserva.tableId,
    fecha:         reserva.date,
    pago:          pago ? { id: pago.id, amount: pago.amount, fecha: pago.date } : null,
  }
}

/**
 * verificarReclamo — Capa de datos: trae la evidencia de Supabase y delega la
 * decisión en evaluarEvidencia. Es la que usa la app (ClaimPage → RewardAgent).
 *
 * @param {Object} reclamo - { codigo, dni }
 */
export async function verificarReclamo(reclamo = {}) {
  const { supabase } = await import('../../domain/supabase.js')

  // Traemos la reserva específica por su ID (código), los pagos asociados,
  // las comandas, y las quejas previas para esta reserva.
  const [{ data: reservas, error: resErr },
         { data: pagos,    error: payErr },
         { data: comandas, error: kitErr },
         { data: quejas,   error: compErr }] = await Promise.all([
    supabase.from('reservations').select('*, clients(dni, name)').eq('id', reclamo.codigo),
    supabase.from('payments').select('id, reservation_id, amount, date').eq('reservation_id', reclamo.codigo),
    supabase.from('kitchen_tickets').select('reservation_id, status').eq('reservation_id', reclamo.codigo),
    supabase.from('complaints').select('reservation_id').eq('reservation_id', reclamo.codigo),
  ])

  if (resErr || payErr || kitErr || compErr) {
    console.error('Error verificando reclamo:', resErr || payErr || kitErr || compErr)
    return { veredicto: VEREDICTO.RECHAZADO, elegible: false, motivo: 'Error interno del servidor al verificar datos.' }
  }

  // Mapear snake_case (Supabase) → camelCase (contrato de la lógica pura).
  const datos = {
    reservations: (reservas || []).map(r => ({
      id: r.id, tableId: r.table_id, clientDni: r.clients?.dni,
      clientName: r.clients?.name, clientId: r.client_id, status: r.status, date: r.date,
    })),
    payments: (pagos || []).map(p => ({
      id: p.id, reservationId: p.reservation_id, amount: p.amount, date: p.date,
    })),
    kitchenTickets: (comandas || []).map(t => ({ reservationId: t.reservation_id, status: t.status })),
    complaints: (quejas || []).map(c => ({ reservationId: c.reservation_id })),
  }

  return evaluarEvidencia(reclamo, datos)
}
