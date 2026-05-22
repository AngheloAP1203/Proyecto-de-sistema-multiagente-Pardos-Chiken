/**
 * src/agents/ReservationAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agente especializado en la gestión del ciclo de vida de reservas.
 *
 * PRINCIPIO DE RESPONSABILIDAD ÚNICA (SRP):
 *   Este agente SOLO gestiona reservas. No toca pagos, cocina ni perfiles
 *   de clientes. Esa separación clara es lo que define la arquitectura multiagente.
 *
 * PATRÓN DE DISEÑO: Template Method (heredado de AgentBase)
 *   AgentBase define el ciclo: input → validate → execute tool → log → publish event
 *   ReservationAgent define las tools específicas, AgentBase maneja la infraestructura.
 *
 * REGLAS DE NEGOCIO IMPLEMENTADAS:
 *   ✔ Horario de atención: 11:00 AM – 10:00 PM (validación en cada creación)
 *   ✔ Última reserva: 21:30 (para cerrar a las 22:00)
 *   ✔ Fechas: solo presentes o futuras para internas; solo futuras para online
 *   ✔ Capacidad de mesa: la mesa debe tener capacidad ≥ número de personas
 *   ✔ Rango de personas: 1 a 20 por reserva
 *
 * MÁQUINA DE ESTADOS:
 *   REQUESTED → PENDING → SEATED → COMPLETED
 *   REQUESTED → REJECTED
 *   PENDING/SEATED → CANCELLED
 *
 * INTERACCIONES CON OTROS AGENTES (via Swarms del Orquestador):
 *   - Swarm approve: activa en paralelo con ClientAgent
 *   - Swarm seat:    activa en paralelo con KitchenAgent
 *   - Swarm payment: activa en paralelo con CashAgent
 *
 * COMUNICACIÓN (MCP via EventBus):
 *   Publica: reservation:created, reservation:updated, reservation:approved,
 *            reservation:rejected, reservation:seated, reservation:completed,
 *            reservation:cancelled
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AgentBase } from './core/AgentBase.js'
import { EVENT_TYPES } from './core/EventBus.js'
import { MEMORY_KEYS } from './core/SharedMemory.js'
import { format } from 'date-fns'

// ── Reglas de negocio del restaurante ─────────────────────────────────────────
// Centralizar las reglas como constantes evita magic numbers y facilita el
// mantenimiento. Si el restaurante cambia su horario, solo se cambia aquí.
const BUSINESS_RULES = {
  // Horario de atención: 11:00 AM – 10:00 PM
  OPENING_HOUR:   11,
  OPENING_MINUTE: 0,
  // Última reserva posible: 21:30 (para que el servicio termine a las 22:00)
  LAST_RESERVATION_HOUR:   21,
  LAST_RESERVATION_MINUTE: 30,
  // Tiempo mínimo de anticipación para reservas online (en horas)
  MIN_ADVANCE_HOURS: 1,
  // Máximo de personas por reserva
  MAX_GUESTS: 20,
  MIN_GUESTS:  1,
}

/**
 * Valida si una hora está dentro del horario de atención.
 * @param {string} timeStr - Hora en formato "HH:MM"
 * @returns {{ valid: boolean, error?: string }}
 */
function validateBusinessHours(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const totalMinutes = h * 60 + m

  const openMinutes  = BUSINESS_RULES.OPENING_HOUR   * 60 + BUSINESS_RULES.OPENING_MINUTE
  const closeMinutes = BUSINESS_RULES.LAST_RESERVATION_HOUR * 60 + BUSINESS_RULES.LAST_RESERVATION_MINUTE

  if (totalMinutes < openMinutes) {
    return {
      valid: false,
      error: `El restaurante abre a las ${BUSINESS_RULES.OPENING_HOUR}:00 AM. No se pueden hacer reservas antes de esa hora.`,
    }
  }
  if (totalMinutes > closeMinutes) {
    return {
      valid: false,
      error: `La última reserva disponible es a las 21:30. El restaurante cierra a las 10:00 PM.`,
    }
  }
  return { valid: true }
}

/**
 * Valida que la fecha de reserva sea válida (hoy o futura).
 */
function validateReservationDate(dateStr, isPublic = false) {
  const today = format(new Date(), 'yyyy-MM-dd')
  if (dateStr < today) {
    return { valid: false, error: 'No se pueden crear reservas en fechas pasadas.' }
  }
  // Para reservas públicas (clientes externos), mínimo mañana
  if (isPublic && dateStr === today) {
    return { valid: false, error: 'Las reservas en línea deben ser con al menos 1 día de anticipación.' }
  }
  return { valid: true }
}

// ── Clase ReservationAgent ────────────────────────────────────────────────────
export class ReservationAgent extends AgentBase {
  constructor() {
    super(
      'ReservationAgent',
      // System Prompt especializado del agente
      `Eres el agente de reservas de Pardos Chicken Miraflores.
       Tu ÚNICA responsabilidad es gestionar el ciclo de vida de las reservas.
       
       REGLAS DE NEGOCIO que SIEMPRE debes respetar:
       1. Horario de atención: 11:00 AM – 10:00 PM (lunes a domingo)
       2. Última reserva: 21:30 (servicio de 2 horas como mínimo)
       3. Solo fechas presentes o futuras para reservas internas; solo futuras para online
       4. La capacidad de la mesa asignada DEBE ser >= número de personas
       5. Rango de personas: 1 a 20 por reserva
       
       FLUJO DE ESTADOS:
       REQUESTED → PENDING → SEATED → COMPLETED
       REQUESTED → REJECTED (si se rechaza)
       PENDING/SEATED → CANCELLED (si se cancela)
       
       Comunica resultados al OrchestratorAgent para coordinar con otros agentes.`,
      ['create_reservation', 'update_reservation', 'cancel_reservation',
       'seat_reservation', 'complete_reservation', 'approve_request', 'reject_request']
    )

    // Referencia a las funciones del context (inyectadas por el Orquestador)
    this._contextActions = null

    // Registrar todas las herramientas del agente
    this._registerTools()
  }

  /**
   * setContextActions — Inyecta las funciones del ReservationContext.
   * Esto permite al agente actuar sobre el estado real de la aplicación.
   */
  setContextActions(actions) {
    this._contextActions = actions
  }

  // ── Registro de herramientas ──────────────────────────────────────────────

  _registerTools() {
    this.registerTool(
      'create_reservation',
      'Crea una nueva reserva validando horario, fecha y capacidad de mesa',
      this._createReservation
    )
    this.registerTool(
      'update_reservation',
      'Actualiza los datos de una reserva existente (fecha, hora, mesa, personas)',
      this._updateReservation
    )
    this.registerTool(
      'cancel_reservation',
      'Cancela una reserva con motivo opcional',
      this._cancelReservation
    )
    this.registerTool(
      'seat_reservation',
      'Registra que el cliente llegó y fue sentado en su mesa',
      this._seatReservation
    )
    this.registerTool(
      'complete_reservation',
      'Marca una reserva como completada (cliente terminó su comida)',
      this._completeReservation
    )
    this.registerTool(
      'approve_request',
      'Aprueba una solicitud de reserva online y asigna una mesa',
      this._approveRequest
    )
    this.registerTool(
      'reject_request',
      'Rechaza una solicitud de reserva online con motivo',
      this._rejectRequest
    )
    this.registerTool(
      'validate_reservation',
      'Valida los datos de una reserva antes de crearla (sin crearla)',
      this._validateReservation
    )
  }

  // ── Herramientas del agente ───────────────────────────────────────────────

  async _validateReservation({ date, time, guests, tableId, tables = [], isPublic = false }) {
    const errors = {}

    // Validar fecha
    const dateVal = validateReservationDate(date, isPublic)
    if (!dateVal.valid) errors.date = dateVal.error

    // Validar hora (horario de atención)
    if (time) {
      const timeVal = validateBusinessHours(time)
      if (!timeVal.valid) errors.time = timeVal.error
    }

    // Validar número de personas
    if (guests < BUSINESS_RULES.MIN_GUESTS || guests > BUSINESS_RULES.MAX_GUESTS) {
      errors.guests = `El número de personas debe ser entre ${BUSINESS_RULES.MIN_GUESTS} y ${BUSINESS_RULES.MAX_GUESTS}.`
    }

    // Validar capacidad de mesa si se especificó
    if (tableId && tables.length > 0) {
      const table = tables.find(t => t.id === tableId)
      if (table && table.capacity < guests) {
        errors.tableId = `La Mesa ${table.number} tiene capacidad para ${table.capacity} personas. Para ${guests} personas, selecciona una mesa más grande.`
      }
    }

    const isValid = Object.keys(errors).length === 0
    return { valid: isValid, errors, rulesChecked: ['date', 'time', 'guests', 'tableCapacity'] }
  }

  async _createReservation({ data, tables = [], createdBy }, correlationId) {
    // 1. Validar reglas de negocio
    const validation = await this._validateReservation({
      date:    data.date,
      time:    data.time,
      guests:  data.guests,
      tableId: data.tableId,
      tables,
      isPublic: false,
    })

    if (!validation.valid) {
      return { success: false, errors: validation.errors, message: 'Validación fallida' }
    }

    // 2. Ejecutar acción en el contexto
    if (this._contextActions?.addReservation) {
      const reservation = this._contextActions.addReservation({ ...data, createdBy })

      // 3. Actualizar memoria compartida
      this.memory.set(MEMORY_KEYS.TODAY_STATS, {
        lastCreated: reservation?.id,
        timestamp:   new Date().toISOString(),
      }, this.name)

      // 4. Publicar evento de reserva creada
      this.bus.publish(EVENT_TYPES.RESERVATION_CREATED, {
        reservationId: reservation?.id,
        clientName:    data.clientName,
        date:          data.date,
        time:          data.time,
        guests:        data.guests,
        tableId:       data.tableId,
      }, this.name, correlationId)

      return { success: true, reservation, message: 'Reserva creada correctamente' }
    }
    return { success: false, message: 'No hay conexión con el contexto de reservas' }
  }

  async _updateReservation({ id, updates, tables = [] }, correlationId) {
    // Validar los cambios si incluyen fecha, hora o mesa
    if (updates.time) {
      const timeVal = validateBusinessHours(updates.time)
      if (!timeVal.valid) return { success: false, error: timeVal.error }
    }
    if (updates.date) {
      const dateVal = validateReservationDate(updates.date, false)
      if (!dateVal.valid) return { success: false, error: dateVal.error }
    }

    if (this._contextActions?.updateReservation) {
      this._contextActions.updateReservation(id, updates)
      this.bus.publish(EVENT_TYPES.RESERVATION_UPDATED, { id, updates }, this.name, correlationId)
      return { success: true, message: 'Reserva actualizada' }
    }
    return { success: false, message: 'No hay conexión con el contexto' }
  }

  async _cancelReservation({ id, reason = '' }, correlationId) {
    if (this._contextActions?.cancelReservation) {
      this._contextActions.cancelReservation(id, reason)
      this.bus.publish(EVENT_TYPES.RESERVATION_CANCELLED, { id, reason }, this.name, correlationId)
      return { success: true, message: 'Reserva cancelada' }
    }
    return { success: false }
  }

  async _seatReservation({ id }, correlationId) {
    if (this._contextActions?.seatReservation) {
      this._contextActions.seatReservation(id)
      this.bus.publish(EVENT_TYPES.RESERVATION_SEATED, { id, seatedAt: new Date().toISOString() }, this.name, correlationId)
      return { success: true, message: 'Cliente sentado en mesa' }
    }
    return { success: false }
  }

  async _completeReservation({ id }, correlationId) {
    if (this._contextActions?.completeReservation) {
      this._contextActions.completeReservation(id)
      this.bus.publish(EVENT_TYPES.RESERVATION_COMPLETED, { id, completedAt: new Date().toISOString() }, this.name, correlationId)
      return { success: true, message: 'Reserva completada' }
    }
    return { success: false }
  }

  async _approveRequest({ id, tableId, approvedBy }, correlationId) {
    // Validar que se asignó una mesa
    if (!tableId) return { success: false, error: 'Debes asignar una mesa para aprobar la solicitud' }

    if (this._contextActions?.approveReservation) {
      this._contextActions.approveReservation(id, tableId, approvedBy)
      this.bus.publish(EVENT_TYPES.RESERVATION_APPROVED, { id, tableId, approvedBy }, this.name, correlationId)
      return { success: true, message: 'Solicitud aprobada y mesa asignada' }
    }
    return { success: false }
  }

  async _rejectRequest({ id, reason = '' }, correlationId) {
    if (this._contextActions?.rejectReservation) {
      this._contextActions.rejectReservation(id, reason)
      this.bus.publish(EVENT_TYPES.RESERVATION_REJECTED, { id, reason }, this.name, correlationId)
      return { success: true, message: 'Solicitud rechazada' }
    }
    return { success: false }
  }
}

// Singleton del agente de reservas
export const reservationAgent = new ReservationAgent()
export default reservationAgent

// Exportar reglas de negocio para uso en la UI
export { BUSINESS_RULES, validateBusinessHours, validateReservationDate }
