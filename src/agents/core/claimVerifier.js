/**
 * src/agents/core/claimVerifier.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de verificación anti-fraude de reclamos (M6).
 *
 * PRINCIPIO: la elegibilidad la decide JAVASCRIPT, nunca el LLM.
 *
 * REGLA DE IDENTIDAD (decisión de negocio): DNI Y número de mesa deben coincidir
 * con quien reservó/consumió en esa mesa ese día.
 *
 * CADENA DE EVIDENCIA (Backend / Supabase):
 *   Reserva(table_id, client_dni) → Comanda(table_id) → Pago(reservation_id)
 *
 * DISEÑO — dos capas separadas para poder testear la lógica sin backend:
 *   · evaluarEvidencia(reclamo, datos)  → función PURA y determinista (golden set).
 *   · verificarReclamo(reclamo)         → async: trae datos de Supabase y delega
 *                                         en evaluarEvidencia. Es la que usa la app.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const VEREDICTO = {
  VERIFICADO:  'VERIFICADO',   // DNI + mesa + consumo confirmados → elegible
  RECHAZADO:   'RECHAZADO',    // hubo consumo, pero el DNI no coincide → fraude
  SIN_COMANDA: 'SIN_COMANDA',  // esa mesa no tuvo pedido/consumo ese día
  SIN_MESA:    'SIN_MESA',     // el reclamo no indica mesa → no se puede verificar
}

/** Deja solo dígitos: "78 765 432" y "78-765-432" se comparan igual que "78765432". */
const normDoc = (d) => String(d || '').replace(/\D/g, '')

/** Normaliza el id de mesa: "T03", "t3", "mesa 3" → "3". */
const normMesa = (m) => String(m || '')
  .toLowerCase()
  .replace(/[^0-9a-z]/g, '')
  .replace(/^(mesa|table|t)/, '')
  .replace(/^0+(?=\d)/, '')

const mismaMesa = (a, b) => normMesa(a) !== '' && normMesa(a) === normMesa(b)

const CONSUMIO = ['seated', 'completed', 'approved', 'confirmed']
const HOY = () => new Date().toISOString().split('T')[0]

/**
 * evaluarEvidencia — Núcleo determinista PURO (sin efectos, testeable).
 *
 * @param {Object} reclamo - { tableId, dni, fecha }
 * @param {Object} datos   - { reservations, payments, kitchenTickets } normalizados a
 *                           camelCase: reservations[{ id, tableId, clientDni, clientName,
 *                           clientId, status, date }], payments[{ id, reservationId,
 *                           amount, date }], kitchenTickets[{ reservationId, status }]
 *                           (las comandas se enlazan por reservationId, no por mesa).
 * @returns {Object} { veredicto, elegible, motivo, cliente?, clientId?, reservationId?, pago? }
 */
export function evaluarEvidencia(reclamo = {}, datos = {}) {
  const { tableId, dni, fecha } = reclamo
  const reservations   = datos.reservations   || []
  const payments       = datos.payments       || []
  const kitchenTickets = datos.kitchenTickets || []

  // 1. Sin mesa no hay forma de verificar identidad.
  if (!tableId || normMesa(tableId) === '') {
    return {
      veredicto: VEREDICTO.SIN_MESA, elegible: false,
      motivo: 'El reclamo no indica el número de mesa, así que no se puede verificar quién consumió.',
    }
  }

  // 2. Reservas de esa mesa (ese día si se conoce la fecha).
  const reservasMesa = reservations.filter(r =>
    mismaMesa(r.tableId, tableId) && (!fecha || r.date === fecha))
  const idsMesa = new Set(reservasMesa.map(r => r.id))

  const pagosMesa = payments.filter(p =>
    idsMesa.has(p.reservationId) && (!fecha || !p.date || p.date === fecha))

  // Comanda: se enlaza por reservationId (kitchen_tickets no tiene mesa ni fecha).
  const comandaCuenta = kitchenTickets.some(t => idsMesa.has(t.reservationId))

  // 3. ¿Hubo consumo real en esa mesa ese día?
  const huboConsumo =
    comandaCuenta ||
    pagosMesa.length > 0 ||
    reservasMesa.some(r => CONSUMIO.includes(r.status))

  if (!huboConsumo) {
    return {
      veredicto: VEREDICTO.SIN_COMANDA, elegible: false,
      motivo: `No hay registro de un pedido confirmado en la mesa ${tableId}${fecha ? ` el ${fecha}` : ''}. Sin consumo, no hay reclamo que recompensar.`,
    }
  }

  // 4. Identidad: el DNI del reclamo debe coincidir con quien ocupó la mesa.
  //    Se comparan solo los dígitos, así "78 765 432" y "78-765-432" valen igual.
  const docId = normDoc(dni)
  const reservaCoincide = docId
    ? reservasMesa.find(r => normDoc(r.clientDni) === docId)
    : null

  if (!reservaCoincide) {
    return {
      veredicto: VEREDICTO.RECHAZADO, elegible: false,
      motivo: 'El DNI indicado no coincide con el de quien reservó y consumió en esa mesa. El reclamo no puede validarse.',
    }
  }

  // 5. Verificado: mesa + DNI + consumo.
  const pago = pagosMesa.find(p => p.reservationId === reservaCoincide.id) || pagosMesa[0] || null
  return {
    veredicto:     VEREDICTO.VERIFICADO,
    elegible:      true,
    motivo:        'Identidad confirmada: DNI y mesa coinciden con un consumo registrado.',
    cliente:       reservaCoincide.clientName,
    clientId:      reservaCoincide.clientId,
    reservationId: reservaCoincide.id,
    pago:          pago ? { id: pago.id, amount: pago.amount, fecha: pago.date } : null,
  }
}

/**
 * verificarReclamo — Capa de datos: trae la evidencia de Supabase y delega la
 * decisión en evaluarEvidencia. Es la que usa la app (ClaimPage → RewardAgent).
 *
 * @param {Object} reclamo - { tableId, dni, fecha }
 */
export async function verificarReclamo(reclamo = {}) {
  const { fecha } = reclamo
  const queryDate = fecha || HOY()

  // Import dinámico: el cliente Supabase depende de import.meta.env (Vite) y solo
  // debe cargarse en el navegador. Así la lógica pura (evaluarEvidencia) queda
  // importable en Node para el golden set sin arrastrar el backend.
  const { supabase } = await import('../../domain/supabase.js')

  // Reservas del día con el cliente (el DNI/nombre viven en `clients`, no en
  // `reservations`). Pagos del día. Comandas: sin fecha/mesa → se traen todas y
  // se enlazan por reservation_id en la lógica pura.
  const [{ data: reservas, error: resErr },
         { data: pagos,   error: payErr },
         { data: comandas, error: kitErr }] = await Promise.all([
    supabase.from('reservations').select('*, clients(dni, name)').eq('date', queryDate),
    supabase.from('payments').select('id, reservation_id, amount, date').eq('date', queryDate),
    supabase.from('kitchen_tickets').select('reservation_id, status'),
  ])

  if (resErr || payErr || kitErr) {
    console.error('Error verificando reclamo:', resErr || payErr || kitErr)
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
  }

  return evaluarEvidencia(reclamo, datos)
}
