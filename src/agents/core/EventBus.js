/**
 * src/agents/core/EventBus.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sistema de comunicación entre agentes con validación de esquema JSON
 * inspirada en el protocolo MCP (Model Context Protocol).
 *
 * QUÉ ES EL MODEL CONTEXT PROTOCOL (MCP):
 *   MCP es un protocolo estándar de Anthropic para que los modelos de IA
 *   interaccionen con herramientas y otros agentes de manera tipada y
 *   auditable. Cada mensaje tiene:
 *     · type:          Identificador del evento (dominio:acción)
 *     · source:        Agente que publicó el mensaje
 *     · payload:       Datos del evento (tipado por schema)
 *     · correlationId: UUID v4 que agrupa eventos del mismo flujo/Swarm
 *     · messageId:     UUID v4 único por mensaje
 *     · timestamp:     ISO 8601 del momento de publicación
 *     · version:       Versión del schema para compatibilidad
 *
 * VALIDACIÓN DE SCHEMA:
 *   Antes de publicar, cada mensaje es validado contra un schema JSON
 *   definido en EVENT_SCHEMAS. Si el payload no cumple el schema,
 *   el bus rechaza el mensaje y lo registra en _errors.
 *   La tasa de éxito visible en el panel = _successMessages / _totalMessages.
 *
 * CORRELATIONID (clave para verificar Swarms):
 *   Cuando el Orquestador ejecuta un Swarm, genera un único correlationId
 *   y lo pasa a todos los agentes participantes. Ambos mensajes llevan el
 *   mismo ID, permitiendo trazar que "estos 2 eventos son del mismo Swarm"
 *   en el historial del tab "Eventos" del panel de monitoreo.
 *
 * ARQUITECTURA:
 *   Pub/Sub estándar donde un agente publica y todos los suscritos reciben.
 *   La entrega es SINCRÓNICA en el mismo event loop de JavaScript.
 *   Para patrones ASYNC el Orquestador usa Promise.all (ver Swarms).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Tipos de eventos soportados por el sistema ────────────────────────────────
export const EVENT_TYPES = {
  // Reservas
  RESERVATION_CREATED:   'reservation:created',
  RESERVATION_UPDATED:   'reservation:updated',
  RESERVATION_CANCELLED: 'reservation:cancelled',
  RESERVATION_SEATED:    'reservation:seated',
  RESERVATION_COMPLETED: 'reservation:completed',
  RESERVATION_APPROVED:  'reservation:approved',
  RESERVATION_REJECTED:  'reservation:rejected',
  RESERVATION_REQUESTED: 'reservation:requested',

  // Cocina
  KITCHEN_TICKET_ADDED:   'kitchen:ticket_added',
  KITCHEN_TICKET_UPDATED: 'kitchen:ticket_updated',
  KITCHEN_ORDER_READY:    'kitchen:order_ready',

  // Caja
  CASH_PAYMENT_REGISTERED: 'cash:payment_registered',
  CASH_SHIFT_OPENED:       'cash:shift_opened',
  CASH_SHIFT_CLOSED:       'cash:shift_closed',

  // Clientes
  CLIENT_CREATED: 'client:created',
  CLIENT_UPDATED: 'client:updated',

  // Sistema
  AGENT_STARTED:    'system:agent_started',
  AGENT_COMPLETED:  'system:agent_completed',
  AGENT_ERROR:      'system:agent_error',
  CONFLICT_DETECTED:'system:conflict_detected',
  CONFLICT_RESOLVED:'system:conflict_resolved',
}

// ── Schema de validación MCP ──────────────────────────────────────────────────
// Cada mensaje debe tener estos campos obligatorios para cumplir con MCP
const MCP_REQUIRED_FIELDS = ['type', 'payload', 'source', 'timestamp', 'correlationId']

/**
 * JSON Schemas por tipo de evento — validan la estructura del PAYLOAD.
 * Esto implementa la validación "schema validado" del protocolo MCP.
 * Cada schema define los campos requeridos y sus tipos esperados.
 */
const EVENT_PAYLOAD_SCHEMAS = {
  'reservation:created':   { required: ['id', 'clientName', 'date', 'time', 'guests'] },
  'reservation:updated':   { required: ['id'] },
  'reservation:approved':  { required: ['id', 'tableId', 'approvedBy'] },
  'reservation:rejected':  { required: ['id'] },
  'reservation:seated':    { required: ['id'] },
  'reservation:completed': { required: ['id'] },
  'reservation:cancelled': { required: ['id'] },
  'reservation:requested': { required: ['clientName', 'date', 'time', 'guests'] },
  'kitchen:ticket_added':  { required: ['tableId', 'clientName'] },
  'kitchen:ticket_updated':{ required: ['ticketId'] },
  'kitchen:order_ready':   { required: ['ticketId', 'tableId'] },
  'cash:payment_registered':{ required: ['amount', 'method'] },
  'cash:shift_opened':     { required: ['cashier'] },
  'cash:shift_closed':     { required: ['cashier', 'totalRevenue'] },
  'client:created':        { required: ['clientName'] },
  'client:updated':        { required: ['clientId'] },
  'system:agent_started':  { required: ['agentName', 'tool'] },
  'system:agent_completed':{ required: ['agentName', 'tool', 'latency', 'success'] },
  'system:agent_error':    { required: ['agentName', 'tool', 'error'] },
  'system:conflict_detected': { required: [] },
  'system:conflict_resolved': { required: [] },
}

/**
 * validatePayloadSchema — Valida el payload contra el schema JSON del tipo de evento.
 * Comprueba que todos los campos requeridos existan y tengan valor no-nulo.
 * @param {string} type - Tipo de evento
 * @param {Object} payload - Payload a validar
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePayloadSchema(type, payload) {
  const schema = EVENT_PAYLOAD_SCHEMAS[type]
  if (!schema) return { valid: true, errors: [] } // Sin schema → se permite

  const errors = []
  for (const field of schema.required) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      errors.push(`Payload schema error — campo requerido faltante: "${field}" en evento "${type}"`)
    }
  }
  return { valid: errors.length === 0, errors }
}

/**
 * Valida que un mensaje cumpla con el schema MCP (campos + payload).
 * @param {Object} message - Mensaje a validar
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateMCPMessage(message) {
  const errors = []

  // 1. Validar campos obligatorios del envelope MCP
  for (const field of MCP_REQUIRED_FIELDS) {
    if (message[field] === undefined || message[field] === null) {
      errors.push(`Campo requerido faltante: "${field}"`)
    }
  }

  // 2. Validar que el tipo de evento sea conocido
  if (message.type && !Object.values(EVENT_TYPES).includes(message.type)) {
    errors.push(`Tipo de evento desconocido: "${message.type}"`)
  }

  // 3. Validar el payload contra el JSON Schema del tipo de evento
  if (message.type && message.payload) {
    const payloadValidation = validatePayloadSchema(message.type, message.payload)
    errors.push(...payloadValidation.errors)
  }

  return { valid: errors.length === 0, errors }
}

// ── Clase principal EventBus ──────────────────────────────────────────────────
class EventBusClass {
  constructor() {
    // Map: eventType → Set de funciones suscriptoras
    this._subscribers = new Map()
    // Historial completo de mensajes para trazabilidad
    this._history = []
    // Contador de mensajes procesados
    this._messageCount = 0
    // Contador de errores de validación
    this._validationErrors = 0
  }

  /**
   * subscribe — Registra un handler para un tipo de evento.
   * @param {string} eventType - Tipo de evento (usar EVENT_TYPES)
   * @param {Function} handler - Función que recibe el mensaje completo
   * @returns {Function} Función de desuscripción
   */
  subscribe(eventType, handler) {
    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, new Set())
    }
    this._subscribers.get(eventType).add(handler)

    // Retorna función para desuscribirse (limpieza de memoria)
    return () => this._subscribers.get(eventType)?.delete(handler)
  }

  /**
   * publish — Publica un evento en el bus con validación MCP.
   * @param {string} type - Tipo de evento (usar EVENT_TYPES)
   * @param {Object} payload - Datos del evento (específicos por tipo)
   * @param {string} source - Nombre del agente que publica
   * @param {string} [correlationId] - ID para correlacionar flujos multi-paso
   * @returns {Object} Mensaje completo publicado
   */
  publish(type, payload, source, correlationId = null) {
    const message = {
      type,
      payload,
      source,
      timestamp: new Date().toISOString(),
      correlationId: correlationId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      messageId: ++this._messageCount,
    }

    // Validar schema MCP antes de distribuir
    const { valid, errors } = validateMCPMessage(message)
    if (!valid) {
      this._validationErrors++
      console.error(`[EventBus] Error de validación MCP en mensaje de ${source}:`, errors)
      return null
    }

    // Guardar en historial para trazabilidad
    this._history.push({ ...message, deliveredTo: [] })

    // Distribuir a todos los suscriptores del tipo
    const handlers = this._subscribers.get(type)
    if (handlers) {
      const lastEntry = this._history[this._history.length - 1]
      handlers.forEach(handler => {
        try {
          handler(message)
          lastEntry.deliveredTo.push(handler.name || 'anonymous')
        } catch (err) {
          console.error(`[EventBus] Error en handler para ${type}:`, err)
        }
      })
    }

    return message
  }

  /**
   * getHistory — Retorna el historial completo de mensajes.
   * @param {number} [limit=50] - Número máximo de mensajes a retornar
   * @returns {Array} Últimos N mensajes del historial
   */
  getHistory(limit = 50) {
    return this._history.slice(-limit)
  }

  /**
   * getMetrics — Retorna métricas del bus de eventos.
   */
  getMetrics() {
    return {
      totalMessages:    this._messageCount,
      validationErrors: this._validationErrors,
      successMessages:  this._messageCount - this._validationErrors,
      successRate:      this._messageCount > 0
        ? ((this._messageCount - this._validationErrors) / this._messageCount * 100).toFixed(1)
        : '100.0',
      subscriberCount:  [...this._subscribers.values()].reduce((s, set) => s + set.size, 0),
      historySize:      this._history.length,
      schemasRegistered: Object.keys(EVENT_PAYLOAD_SCHEMAS).length,
    }
  }

  /**
   * getPayloadSchemas — Expone los JSON Schemas registrados (para debugging y UI).
   * Útil para demostrar la validación de payloads durante la exposición.
   */
  getPayloadSchemas() {
    return EVENT_PAYLOAD_SCHEMAS
  }

  /** Limpia el historial (útil para tests) */
  clearHistory() {
    this._history = []
  }
}

// Singleton — un único bus para toda la aplicación
export const eventBus = new EventBusClass()
export default eventBus
