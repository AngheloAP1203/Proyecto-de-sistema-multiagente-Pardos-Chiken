/**
 * src/agents/KitchenAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agente especializado en la gestión de la cocina y el flujo de pedidos.
 *
 * PRINCIPIO DE RESPONSABILIDAD ÚNICA (SRP):
 *   KitchenAgent es el único responsable del estado de los pedidos en cocina.
 *   No conoce precios, clientes ni reservas — solo tickets de cocina.
 *
 * MÁQUINA DE ESTADOS (Kanban de cocina):
 *   pending → preparing → ready → delivered
 *
 *   - pending:    Ítem recibido, esperando ser preparado
 *   - preparing:  En preparación activa por el cocinero
 *   - ready:      Listo para ser servido al cliente
 *   - delivered:  Entregado (ticket completado)
 *
 *   Cuando TODOS los ítems de un ticket están en "ready",
 *   el sistema notifica al NotificationAgent para alertar al mozo.
 *
 * SISTEMA DE PRIORIDADES:
 *   urgent → Clientes VIP o pedidos urgentes (sirve primero)
 *   high   → Pedidos con más de 15 minutos de espera
 *   normal → Flujo estándar de atención
 *
 * INTERACCIÓN CON OTROS AGENTES (Swarm):
 *   - Swarm seat_with_kitchen: activa EN PARALELO con ReservationAgent
 *     cuando se sienta a un cliente. El ticket se crea simultáneamente
 *     con el cambio de estado de la reserva.
 *
 * COMUNICACIÓN (MCP via EventBus):
 *   Publica: kitchen:ticket_added, kitchen:ticket_updated, kitchen:order_ready
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AgentBase } from './core/AgentBase.js'
import { EVENT_TYPES } from './core/EventBus.js'
import { MEMORY_KEYS } from './core/SharedMemory.js'

export class KitchenAgent extends AgentBase {
  constructor() {
    super(
      'KitchenAgent',
      `Eres el agente de cocina de Pardos Chicken Miraflores.
       Tu ÚNICA responsabilidad es gestionar el flujo de pedidos en la cocina.
       
       PRIORIDADES DE PEDIDOS:
       1. urgent: Pedidos especiales o clientes VIP
       2. high: Pedidos con más de 15 minutos de espera
       3. normal: Flujo estándar
       
       ESTADOS DE ITEMS:
       pending → preparing → ready → delivered
       
       Notifica al NotificationAgent cuando un pedido esté listo.
       Coordina con el ReservationAgent cuando un cliente es sentado.`,
      ['add_ticket', 'update_ticket_status', 'complete_ticket', 'get_queue']
    )
    this._contextActions = null
    this._registerTools()
  }

  setContextActions(actions) {
    this._contextActions = actions
  }

  _registerTools() {
    this.registerTool(
      'add_ticket',
      'Crea un nuevo ticket de cocina cuando un cliente es sentado en su mesa',
      this._addTicket
    )
    this.registerTool(
      'update_ticket_status',
      'Actualiza el estado de un ítem del pedido (pending, preparing, ready, delivered)',
      this._updateTicketStatus
    )
    this.registerTool(
      'complete_ticket',
      'Marca un ticket completo como entregado',
      this._completeTicket
    )
    this.registerTool(
      'get_queue',
      'Obtiene la cola actual de pedidos pendientes en cocina',
      this._getQueue
    )
    this.registerTool(
      'prioritize_ticket',
      'Cambia la prioridad de un ticket (urgent, high, normal)',
      this._prioritizeTicket
    )
  }

  async _addTicket({ tableId, clientName, guests, items, notes, priority = 'normal' }, correlationId) {
    if (!tableId) return { success: false, error: 'Se requiere ID de mesa para crear el ticket' }
    if (!items || items.length === 0) {
      // Si no hay ítems, no hay ticket de cocina que crear
      return { success: true, message: 'Sin ítems de pedido — no se crea ticket de cocina', ticketId: null }
    }

    if (this._contextActions?.addTicket) {
      const ticket = this._contextActions.addTicket({ tableId, clientName, guests, items, notes, priority })

      // Actualizar cola en memoria compartida
      const currentQueue = this.memory.getValue(MEMORY_KEYS.KITCHEN_QUEUE, [])
      this.memory.set(MEMORY_KEYS.KITCHEN_QUEUE, [...currentQueue, ticket?.id].filter(Boolean), this.name)

      this.bus.publish(EVENT_TYPES.KITCHEN_TICKET_ADDED, {
        ticketId:   ticket?.id,
        tableId,
        clientName,
        itemCount:  items.length,
        priority,
      }, this.name, correlationId)

      return { success: true, ticket, message: `Ticket de cocina creado para Mesa ${tableId}` }
    }
    return { success: false, message: 'No hay conexión con el contexto de cocina' }
  }

  async _updateTicketStatus({ ticketId, itemId, status }, correlationId) {
    const validStatuses = ['pending', 'preparing', 'ready', 'delivered']
    if (!validStatuses.includes(status)) {
      return { success: false, error: `Estado inválido. Use: ${validStatuses.join(', ')}` }
    }

    if (this._contextActions?.updateTicket) {
      this._contextActions.updateTicket(ticketId, itemId, status)
      this.bus.publish(EVENT_TYPES.KITCHEN_TICKET_UPDATED, { ticketId, itemId, status }, this.name, correlationId)

      if (status === 'ready') {
        this.bus.publish(EVENT_TYPES.KITCHEN_ORDER_READY, { ticketId, itemId }, this.name, correlationId)
      }
      return { success: true, message: `Ítem actualizado a: ${status}` }
    }
    return { success: false }
  }

  async _completeTicket({ ticketId }, correlationId) {
    if (this._contextActions?.completeTicket) {
      this._contextActions.completeTicket(ticketId)
      // Actualizar cola en memoria compartida
      const currentQueue = this.memory.getValue(MEMORY_KEYS.KITCHEN_QUEUE, [])
      this.memory.set(MEMORY_KEYS.KITCHEN_QUEUE, currentQueue.filter(id => id !== ticketId), this.name)
      return { success: true, message: 'Ticket de cocina completado' }
    }
    return { success: false }
  }

  async _getQueue() {
    const queue = this.memory.getValue(MEMORY_KEYS.KITCHEN_QUEUE, [])
    return { success: true, queue, count: queue.length }
  }

  async _prioritizeTicket({ ticketId, priority }) {
    const validPriorities = ['urgent', 'high', 'normal']
    if (!validPriorities.includes(priority)) {
      return { success: false, error: `Prioridad inválida. Use: ${validPriorities.join(', ')}` }
    }
    if (this._contextActions?.updateTicketPriority) {
      this._contextActions.updateTicketPriority(ticketId, priority)
      return { success: true, message: `Prioridad cambiada a: ${priority}` }
    }
    return { success: false }
  }
}

export const kitchenAgent = new KitchenAgent()
export default kitchenAgent
