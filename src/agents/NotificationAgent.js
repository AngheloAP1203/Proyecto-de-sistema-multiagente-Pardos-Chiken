/**
 * src/agents/NotificationAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agente REACTIVO especializado en notificaciones y alertas del sistema.
 *
 * PATRÓN DE DISEÑO: OBSERVER (Event-Driven)
 *   NotificationAgent es un consumidor puro del EventBus. No ejecuta acciones
 *   ni modifica el estado del sistema. Solo ESCUCHA eventos y GENERA alertas.
 *   Esta separación es un principio fundamental de arquitecturas event-driven.
 *
 * FLUJO:
 *   EventBus publica → NotificationAgent suscrito escucha → decide prioridad →
 *   → crea notificación → dispara callback (toast en la UI) + guarda en cola
 *
 * PRIORIDADES (sistema semafórico):
 *   urgent    → Rojo   → Conflictos, errores críticos — duración toast: 6s
 *   important → Ámbar  → Nuevas solicitudes, pedidos listos — duración: 4.5s
 *   success   → Verde  → Acciones completadas correctamente — duración: 3.5s
 *   info      → Azul   → Actualizaciones de estado — duración: 3s
 *
 * EVENTOS QUE ESCUCHA (suscrito al EventBus):
 *   reservation:requested → alerta de nueva solicitud web
 *   kitchen:order_ready   → alerta de pedido listo para servir
 *   reservation:approved  → confirmación de aprobación
 *   system:conflict_detected → alerta urgente de conflicto en SharedMemory
 *   cash:shift_opened     → información de apertura de turno
 *   cash:payment_registered → confirmación de pago
 *   reservation:completed → confirmación de reserva completada
 *
 * DIFERENCIA CON OTROS AGENTES:
 *   - No usa setContextActions (no necesita mutar el estado React)
 *   - Usa setNotificationCallback para inyectar el toast de la UI
 *   - Es el único agente completamente REACTIVO (sin acciones propias)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AgentBase } from './core/AgentBase.js'
import { EVENT_TYPES } from './core/EventBus.js'

// Tipos de notificaciones con su prioridad
export const NOTIFICATION_PRIORITY = {
  URGENT:      'urgent',    // Requiere acción inmediata (rojo)
  IMPORTANT:   'important', // Importante pero no crítico (amarillo)
  INFO:        'info',      // Informativo (azul)
  SUCCESS:     'success',   // Confirmación de acción exitosa (verde)
}

export class NotificationAgent extends AgentBase {
  constructor() {
    super(
      'NotificationAgent',
      `Eres el agente de notificaciones de Pardos Chicken Miraflores.
       Escuchas todos los eventos del sistema y generas las notificaciones
       apropiadas para el personal del restaurante.
       
       PRIORIDADES:
       - urgent: Conflictos, errores críticos, alertas de seguridad
       - important: Nuevas solicitudes de reserva, pedidos listos
       - info: Actualizaciones de estado, confirmaciones
       - success: Acciones completadas correctamente`,
      ['notify', 'get_notifications', 'clear_notifications', 'subscribe_to_events']
    )

    // Cola de notificaciones pendientes
    this._notificationQueue = []
    this._notificationId = 0

    // Función de callback para actualizar la UI (inyectada externamente)
    this._onNotification = null

    this._registerTools()
    this._setupEventListeners()
  }

  /**
   * setNotificationCallback — Inyecta la función que actualiza la UI con notificaciones.
   * Típicamente conectada al toast de react-hot-toast.
   */
  setNotificationCallback(callback) {
    this._onNotification = callback
  }

  _registerTools() {
    this.registerTool('notify', 'Genera una notificación para el usuario', this._notify)
    this.registerTool('get_notifications', 'Obtiene las notificaciones pendientes', this._getNotifications)
    this.registerTool('clear_notifications', 'Limpia las notificaciones antiguas', this._clearNotifications)
  }

  /**
   * _setupEventListeners — Suscribe el agente a todos los eventos del sistema.
   * Este es el mecanismo central de coordinación del NotificationAgent.
   */
  _setupEventListeners() {
    // Nuevas solicitudes de reserva web → alerta para el personal
    this.bus.subscribe(EVENT_TYPES.RESERVATION_REQUESTED, (msg) => {
      this._createNotification({
        priority: NOTIFICATION_PRIORITY.IMPORTANT,
        title:    '🔔 Nueva solicitud de reserva',
        message:  `${msg.payload.clientName} solicita reserva para ${msg.payload.guests} personas el ${msg.payload.date} a las ${msg.payload.time}`,
        eventType: msg.type,
        correlationId: msg.correlationId,
      })
    })

    // Pedido listo en cocina → alerta para el mozo
    this.bus.subscribe(EVENT_TYPES.KITCHEN_ORDER_READY, (msg) => {
      this._createNotification({
        priority: NOTIFICATION_PRIORITY.IMPORTANT,
        title:    '🍗 Pedido listo',
        message:  `El pedido ${msg.payload.ticketId} está listo para servir`,
        eventType: msg.type,
        correlationId: msg.correlationId,
      })
    })

    // Reserva aprobada → confirmación para el personal
    this.bus.subscribe(EVENT_TYPES.RESERVATION_APPROVED, (msg) => {
      this._createNotification({
        priority: NOTIFICATION_PRIORITY.SUCCESS,
        title:    '✅ Reserva aprobada',
        message:  `Reserva #${msg.payload.id} aprobada — Mesa ${msg.payload.tableId} asignada`,
        eventType: msg.type,
        correlationId: msg.correlationId,
      })
    })

    // Conflicto detectado → alerta urgente
    this.bus.subscribe(EVENT_TYPES.CONFLICT_DETECTED, (msg) => {
      this._createNotification({
        priority: NOTIFICATION_PRIORITY.URGENT,
        title:    '⚠️ Conflicto detectado y resuelto',
        message:  `Conflicto en ${msg.payload.key} entre ${msg.payload.attemptedBy} y ${msg.payload.lastUpdatedBy}. Resolución: last-write-wins`,
        eventType: msg.type,
        correlationId: msg.correlationId,
      })
    })

    // Turno abierto → info
    this.bus.subscribe(EVENT_TYPES.CASH_SHIFT_OPENED, (msg) => {
      this._createNotification({
        priority: NOTIFICATION_PRIORITY.INFO,
        title:    '🏪 Turno de caja abierto',
        message:  `${msg.payload.cashierName} abrió turno con S/ ${msg.payload.initialCash} de apertura`,
        eventType: msg.type,
        correlationId: msg.correlationId,
      })
    })

    // Pago registrado → success
    this.bus.subscribe(EVENT_TYPES.CASH_PAYMENT_REGISTERED, (msg) => {
      this._createNotification({
        priority: NOTIFICATION_PRIORITY.SUCCESS,
        title:    '💳 Pago registrado',
        message:  `S/ ${msg.payload.amount?.toFixed(2)} cobrado a ${msg.payload.clientName}`,
        eventType: msg.type,
        correlationId: msg.correlationId,
      })
    })

    // Reserva completada → success
    this.bus.subscribe(EVENT_TYPES.RESERVATION_COMPLETED, (msg) => {
      this._createNotification({
        priority: NOTIFICATION_PRIORITY.SUCCESS,
        title:    '✔️ Reserva completada',
        message:  `Reserva #${msg.payload.id} marcada como completada`,
        eventType: msg.type,
        correlationId: msg.correlationId,
      })
    })
  }

  _createNotification({ priority, title, message, eventType, correlationId }) {
    const notification = {
      id:            ++this._notificationId,
      priority,
      title,
      message,
      eventType,
      correlationId,
      timestamp:     new Date().toISOString(),
      read:          false,
    }

    this._notificationQueue.push(notification)

    // Mantener máximo 50 notificaciones
    if (this._notificationQueue.length > 50) {
      this._notificationQueue.shift()
    }

    // Disparar callback para actualizar la UI
    if (this._onNotification) {
      this._onNotification(notification)
    }

    return notification
  }

  async _notify({ priority, title, message, correlationId }) {
    const notification = this._createNotification({ priority, title, message, correlationId })
    return { success: true, notification }
  }

  async _getNotifications({ unreadOnly = false, limit = 20 }) {
    let notifications = this._notificationQueue
    if (unreadOnly) notifications = notifications.filter(n => !n.read)
    return {
      success: true,
      notifications: notifications.slice(-limit),
      unreadCount: this._notificationQueue.filter(n => !n.read).length,
    }
  }

  async _clearNotifications() {
    const count = this._notificationQueue.length
    this._notificationQueue = []
    return { success: true, cleared: count }
  }

  /**
   * getUnreadCount — Método público para la UI.
   */
  getUnreadCount() {
    return this._notificationQueue.filter(n => !n.read).length
  }

  /**
   * getAll — Método público para obtener todas las notificaciones.
   */
  getAll(limit = 20) {
    return this._notificationQueue.slice(-limit).reverse()
  }

  /**
   * markRead — Marca una notificación como leída.
   */
  markRead(id) {
    const n = this._notificationQueue.find(n => n.id === id)
    if (n) n.read = true
  }
}

export const notificationAgent = new NotificationAgent()
export default notificationAgent
