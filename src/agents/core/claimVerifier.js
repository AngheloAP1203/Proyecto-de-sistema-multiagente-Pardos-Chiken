/**
 * src/agents/core/claimVerifier.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de verificación anti-fraude de reclamos (M6).
 *
 * PRINCIPIO: la elegibilidad para recompensa la decide JAVASCRIPT, nunca el LLM.
 * Un cliente que reclama "porque sí" para sacar un cupón choca contra un cruce
 * de datos, no contra un modelo al que se pueda convencer con palabras.
 *
 * REGLA DE IDENTIDAD (decisión de negocio): DNI Y número de mesa.
 *   El reclamante debe indicar la mesa, y su DNI debe coincidir con el de
 *   quien reservó/consumió en esa mesa ese día. Ambas condiciones, no una.
 *
 * CADENA DE EVIDENCIA:
 *   Reserva(tableId, clientDni) → Comanda(tableId) → Pago(reservationId)
 *   El reclamo se valida contra los tres eslabones.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const VEREDICTO = {
  VERIFICADO:  'VERIFICADO',   // DNI + mesa + consumo confirmados → elegible
  RECHAZADO:   'RECHAZADO',    // hubo consumo en la mesa, pero el DNI no coincide → fraude
  SIN_COMANDA: 'SIN_COMANDA',  // esa mesa no tuvo pedido/consumo ese día → nadie comió ahí
  SIN_MESA:    'SIN_MESA',     // el reclamo no indica mesa → no se puede verificar
}

/** Deja solo dígitos: "987 654 321" y "987654321" se comparan igual. */
const normTel = (t) => String(t || '').replace(/\D/g, '')

/** Normaliza el id de mesa: "T03", "t3", "mesa 3" → "3" para comparar (sin cero inicial). */
const normMesa = (m) => String(m || '')
  .toLowerCase()
  .replace(/[^0-9a-z]/g, '')
  .replace(/^(mesa|table|t)/, '')
  .replace(/^0+(?=\d)/, '')

const mismaMesa = (a, b) => normMesa(a) !== '' && normMesa(a) === normMesa(b)

const CONSUMIO = ['seated', 'completed', 'approved', 'confirmed']
const HOY = () => new Date().toISOString().split('T')[0]

/**
 * verificarReclamo — Núcleo determinista.
 *
 * @param {Object} reclamo   - { tableId, dni, fecha } del reclamo del cliente
 * @param {Object} datos     - { reservations, payments, kitchenTickets }
 * @returns {Object} { veredicto, elegible, motivo, cliente?, reservationId?, pago? }
 */
export function verificarReclamo(reclamo = {}, datos = {}) {
  const { tableId, dni, fecha } = reclamo
  const reservations   = datos.reservations   || []
  const payments       = datos.payments       || []
  const kitchenTickets = datos.kitchenTickets || []

  // 1. Sin mesa no hay forma de verificar identidad → no elegible.
  if (!tableId || normMesa(tableId) === '') {
    return {
      veredicto: VEREDICTO.SIN_MESA, elegible: false,
      motivo: 'El reclamo no indica el número de mesa, así que no se puede verificar quién consumió.',
    }
  }

  // 2. Reservas de esa mesa (ese día si se conoce la fecha).
  const reservasMesa = reservations.filter(r =>
    mismaMesa(r.tableId, tableId) && (!fecha || r.date === fecha))

  // Pagos ligados a esa mesa, del mismo día si se conoce la fecha.
  const pagosMesa = payments.filter(p =>
    (reservasMesa.some(r => r.id === p.reservationId) || (p.tableId && mismaMesa(p.tableId, tableId))) &&
    (!fecha || !p.date || p.date === fecha))

  // Comanda (ticket de cocina): es del día en curso; solo cuenta si el reclamo
  // es de hoy (o no trae fecha). Una comanda de hoy no prueba un consumo de 2020.
  const comandaCuenta = (!fecha || fecha === HOY()) &&
    kitchenTickets.some(t => mismaMesa(t.tableId, tableId))

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
  const docId = dni?.trim()
  const reservaCoincide = docId
    ? reservasMesa.find(r => r.clientDni?.trim() === docId)
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
    reservationId: reservaCoincide.id,
    pago:          pago ? { id: pago.id, amount: pago.amount, fecha: pago.date } : null,
  }
}
