/**
 * src/agents/CashAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agente especializado en cobros, caja y facturación.
 *
 * PRINCIPIO DE RESPONSABILIDAD ÚNICA (SRP):
 *   CashAgent es el Único agente autorizado a registrar pagos y gestionar turnos.
 *   Ninguna otra parte del sistema puede crear transacciones económicas.
 *
 * REGLA CRÍTICA DE NEGOCIO (punto de control obligatorio):
 *   "NUNCA se puede registrar un pago sin turno de caja activo."
 *   Esta validación se implementa en _validatePayment y _registerPayment.
 *   Si un cajero intenta cobrar sin abrir turno, el agente rechaza la operación
 *   con un mensaje de error claro y descriptivo.
 *
 * CÁLCULO DE IGV AUTOMÁTICO:
 *   Perú aplica IGV del 18% incluido en el precio. El agente desglosa:
 *     total    = monto total del pedido
 *     subtotal = total / 1.18   (precio sin impuesto)
 *     igv      = total - subtotal (impuesto extraído del total)
 *
 * INTERACCIÓN CON OTROS AGENTES (Swarm):
 *   - Swarm register_payment:
 *       CashAgent registra el pago EN PARALELO con ReservationAgent,
 *       quien completa la reserva automáticamente tras el cobro.
 *
 * COMUNICACIÓN (MCP via EventBus):
 *   Publica: cash:payment_registered, cash:shift_opened, cash:shift_closed
 *
 * Métodos de pago válidos: efectivo, tarjeta, yape, plin
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AgentBase } from './core/AgentBase.js'
import { EVENT_TYPES } from './core/EventBus.js'
import { MEMORY_KEYS } from './core/SharedMemory.js'

// Tasa de IGV peruana vigente: 18%
// Separada como constante para que sea fácil de actualizar si cambia la ley
const IGV_RATE = 0.18

export class CashAgent extends AgentBase {
  constructor() {
    super(
      'CashAgent',
      `Eres el agente de caja de Pardos Chicken Miraflores.
       Tu ÚNICA responsabilidad es gestionar los cobros y la facturación.
       
       REGLAS CRÍTICAS:
       1. NUNCA registres un pago si no hay turno de caja activo
       2. Aplica IGV del 18% a todos los cobros (mercado peruano)
       3. Los métodos de pago aceptados son: efectivo, tarjeta, yape, plin
       4. Una vez registrado el pago, la reserva se marca como pagada automáticamente
       5. Solo el cajero o admin pueden abrir/cerrar turnos
       
       Coordina con el ReservationAgent para completar reservas tras el pago.`,
      ['register_payment', 'open_shift', 'close_shift', 'get_shift_summary', 'validate_payment']
    )
    this._contextActions = null
    this._registerTools()
  }

  setContextActions(actions) {
    this._contextActions = actions
  }

  _registerTools() {
    this.registerTool(
      'register_payment',
      'Registra un cobro con cálculo de IGV — requiere turno activo',
      this._registerPayment
    )
    this.registerTool(
      'open_shift',
      'Abre un turno de caja con monto de apertura en efectivo',
      this._openShift
    )
    this.registerTool(
      'close_shift',
      'Cierra el turno activo y genera el resumen del día',
      this._closeShift
    )
    this.registerTool(
      'get_shift_summary',
      'Obtiene el resumen del turno actual (total, cobros, por método)',
      this._getShiftSummary
    )
    this.registerTool(
      'validate_payment',
      'Valida que un pago puede ser procesado (turno activo, monto válido)',
      this._validatePayment
    )
  }

  async _validatePayment({ amount, method, shift }) {
    const errors = {}

    // REGLA CRÍTICA: Verificar turno activo
    if (!shift) {
      errors.shift = 'No hay turno de caja activo. Abre un turno antes de cobrar.'
    }

    // Validar métodos de pago aceptados
    const VALID_METHODS = ['efectivo', 'tarjeta', 'yape', 'plin']
    if (method && !VALID_METHODS.includes(method)) {
      errors.method = `Método de pago inválido. Acepta: ${VALID_METHODS.join(', ')}`
    }

    // Validar monto
    if (amount !== undefined && amount <= 0) {
      errors.amount = 'El monto del cobro debe ser mayor a S/ 0.00'
    }

    return { valid: Object.keys(errors).length === 0, errors }
  }

  async _registerPayment({ paymentData, shift, cashier, reservationActions }, correlationId) {
    // 1. REGLA CRÍTICA: Verificar turno activo
    if (!shift) {
      return {
        success: false,
        error: '🚫 No hay turno de caja activo. Abre un turno antes de registrar pagos.',
      }
    }

    // 2. Validar que hay ítems (el monto viene del total de ítems)
    if (!paymentData.items || paymentData.items.length === 0) {
      return { success: false, error: 'Agrega al menos un ítem al pedido antes de cobrar.' }
    }

    const amount = paymentData.items.reduce((s, i) => s + (i.price * i.qty), 0)
    if (amount <= 0) {
      return { success: false, error: 'El monto del cobro debe ser mayor a S/ 0.00' }
    }

    // 3. Calcular IGV automáticamente
    const subtotal = amount / (1 + IGV_RATE)
    const igv      = amount - subtotal

    if (this._contextActions?.addPayment) {
      const payment = this._contextActions.addPayment({
        ...paymentData,
        amount,
        subtotal:    parseFloat(subtotal.toFixed(2)),
        igv:         parseFloat(igv.toFixed(2)),
        cashierId:   cashier?.id,
        cashierName: cashier?.name,
      })

      // 4. Actualizar memoria compartida con el nuevo total
      const currentRevenue = this.memory.getValue(MEMORY_KEYS.TODAY_REVENUE, 0)
      this.memory.set(MEMORY_KEYS.TODAY_REVENUE, currentRevenue + amount, this.name)

      // 5. Publicar evento de pago registrado
      this.bus.publish(EVENT_TYPES.CASH_PAYMENT_REGISTERED, {
        paymentId: payment?.id,
        amount,
        igv:       parseFloat(igv.toFixed(2)),
        method:    paymentData.method,
        clientName: paymentData.clientName,
        reservationId: paymentData.reservationId,
      }, this.name, correlationId)

      return {
        success:  true,
        payment,
        amount,
        subtotal: parseFloat(subtotal.toFixed(2)),
        igv:      parseFloat(igv.toFixed(2)),
        message:  `Pago de S/ ${amount.toFixed(2)} registrado correctamente`,
      }
    }
    return { success: false, error: 'No hay conexión con el contexto de caja' }
  }

  async _openShift({ cashier, initialCash = 0 }, correlationId) {
    if (!cashier) return { success: false, error: 'Se requiere información del cajero' }

    if (this._contextActions?.openShift) {
      this._contextActions.openShift(cashier, Number(initialCash))

      this.memory.set(MEMORY_KEYS.CURRENT_SHIFT, {
        cashierId:   cashier.id,
        cashierName: cashier.name,
        initialCash: Number(initialCash),
        openedAt:    new Date().toISOString(),
      }, this.name)

      this.bus.publish(EVENT_TYPES.CASH_SHIFT_OPENED, {
        cashierName: cashier.name,
        initialCash: Number(initialCash),
      }, this.name, correlationId)

      return { success: true, message: `Turno abierto por ${cashier.name} con S/ ${initialCash} de apertura` }
    }
    return { success: false }
  }

  async _closeShift({}, correlationId) {
    if (this._contextActions?.closeShift) {
      const summary = this._contextActions.closeShift()

      this.memory.set(MEMORY_KEYS.CURRENT_SHIFT, null, this.name)

      this.bus.publish(EVENT_TYPES.CASH_SHIFT_CLOSED, {
        totalAmount: summary?.totalAmount,
        totalTx:     summary?.totalTx,
        closedAt:    new Date().toISOString(),
      }, this.name, correlationId)

      return { success: true, summary, message: 'Turno cerrado correctamente' }
    }
    return { success: false }
  }

  async _getShiftSummary() {
    const shift   = this.memory.getValue(MEMORY_KEYS.CURRENT_SHIFT, null)
    const revenue = this.memory.getValue(MEMORY_KEYS.TODAY_REVENUE, 0)
    return {
      success: true,
      shift,
      totalRevenue: revenue,
      igvCollected: parseFloat((revenue * IGV_RATE / (1 + IGV_RATE)).toFixed(2)),
    }
  }
}

export const cashAgent = new CashAgent()
export default cashAgent
