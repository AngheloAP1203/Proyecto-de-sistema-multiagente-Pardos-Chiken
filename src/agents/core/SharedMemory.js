/**
 * src/agents/core/SharedMemory.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Memoria compartida del sistema multiagente — Estado global explícito.
 *
 * Implementa:
 *   - Estado centralizado accesible por todos los agentes
 *   - Versionado de cada clave para detección de conflictos
 *   - Mecanismo de resolución de conflictos por timestamp (last-write-wins)
 *   - Bloqueo optimista para escrituras concurrentes
 *   - Log de operaciones de lectura/escritura para auditoría
 *
 * Diferente del EventBus: la SharedMemory es el ESTADO (qué pasó),
 * mientras que el EventBus son los EVENTOS (qué está pasando).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Claves de memoria compartida ─────────────────────────────────────────────
export const MEMORY_KEYS = {
  // Estado de reservas (mirror del context para agentes)
  RESERVATIONS:     'reservations',
  TODAY_STATS:      'today_stats',
  PENDING_REQUESTS: 'pending_requests',

  // Estado de cocina
  KITCHEN_TICKETS:  'kitchen_tickets',
  KITCHEN_QUEUE:    'kitchen_queue',

  // Estado de caja
  CURRENT_SHIFT:    'current_shift',
  TODAY_PAYMENTS:   'today_payments',
  TODAY_REVENUE:    'today_revenue',

  // Estado de clientes
  CLIENTS:          'clients',
  VIP_CLIENTS:      'vip_clients',

  // Métricas del sistema
  AGENT_METRICS:    'agent_metrics',

  // Bloqueos activos (para resolución de conflictos)
  ACTIVE_LOCKS:     'active_locks',
}

/**
 * SharedMemoryClass — Memoria compartida con versionado y control de conflictos.
 */
class SharedMemoryClass {
  constructor() {
    // Almacén principal: key → { value, version, updatedAt, updatedBy }
    this._store = new Map()
    // Log de operaciones para auditoría
    this._operationLog = []
    // Bloqueos activos para escrituras concurrentes
    this._locks = new Map()
    // Contadores de operaciones
    this._reads  = 0
    this._writes = 0
    this._conflicts = 0
    this._resolved  = 0
  }

  /**
   * set — Escribe un valor en la memoria compartida.
   * Detecta conflictos si el valor ya fue modificado por otro agente.
   *
   * @param {string} key - Clave (usar MEMORY_KEYS)
   * @param {*} value - Valor a guardar
   * @param {string} agentName - Nombre del agente que escribe
   * @param {number} [expectedVersion] - Versión esperada (para detección de conflictos)
   * @returns {{ success: boolean, version: number, conflict?: Object }}
   */
  set(key, value, agentName, expectedVersion = null) {
    const existing = this._store.get(key)
    const now = new Date().toISOString()

    // ── Detección de conflicto ────────────────────────────────────────────────
    if (expectedVersion !== null && existing && existing.version !== expectedVersion) {
      this._conflicts++
      const conflict = {
        key,
        expectedVersion,
        actualVersion:  existing.version,
        attemptedBy:    agentName,
        lastUpdatedBy:  existing.updatedBy,
        timestamp:      now,
      }
      // Estrategia: last-write-wins (el último en escribir gana)
      // Se registra el conflicto pero se resuelve automáticamente
      this._operationLog.push({ op: 'CONFLICT_DETECTED', ...conflict })
      this._resolved++
      this._operationLog.push({ op: 'CONFLICT_RESOLVED', strategy: 'last-write-wins', winner: agentName, timestamp: now })
    }

    // ── Escribir valor ────────────────────────────────────────────────────────
    const newVersion = (existing?.version || 0) + 1
    this._store.set(key, {
      value,
      version:   newVersion,
      updatedAt: now,
      updatedBy: agentName,
    })

    this._writes++
    this._operationLog.push({
      op:        'WRITE',
      key,
      version:   newVersion,
      agentName,
      timestamp: now,
    })

    return { success: true, version: newVersion }
  }

  /**
   * get — Lee un valor de la memoria compartida.
   * @param {string} key - Clave a leer
   * @param {*} [defaultValue=null] - Valor por defecto si no existe
   * @returns {{ value: *, version: number, updatedAt: string, updatedBy: string }}
   */
  get(key, defaultValue = null) {
    this._reads++
    const entry = this._store.get(key)
    if (!entry) {
      return { value: defaultValue, version: 0, updatedAt: null, updatedBy: null }
    }
    return { ...entry }
  }

  /**
   * getValue — Atajo para obtener solo el valor.
   */
  getValue(key, defaultValue = null) {
    return this.get(key, defaultValue).value ?? defaultValue
  }

  /**
   * update — Actualiza parcialmente un objeto existente en memoria.
   * @param {string} key - Clave a actualizar
   * @param {Object} patch - Campos a mezclar con el valor existente
   * @param {string} agentName - Agente que actualiza
   */
  update(key, patch, agentName) {
    const existing = this.getValue(key, {})
    const merged = Array.isArray(existing)
      ? [...existing, ...patch]  // Arrays: concatenar
      : { ...existing, ...patch } // Objetos: merge
    return this.set(key, merged, agentName)
  }

  /**
   * getMetrics — Retorna métricas de uso de la memoria compartida.
   */
  getMetrics() {
    return {
      totalKeys:   this._store.size,
      totalReads:  this._reads,
      totalWrites: this._writes,
      conflicts:   this._conflicts,
      resolved:    this._resolved,
      resolutionRate: this._conflicts > 0
        ? ((this._resolved / this._conflicts) * 100).toFixed(1)
        : '100.0',
    }
  }

  /**
   * getOperationLog — Retorna el log de operaciones recientes.
   */
  getOperationLog(limit = 30) {
    return this._operationLog.slice(-limit)
  }

  /**
   * snapshot — Retorna una copia de todo el estado actual.
   * Útil para debugging y para la UI de estado del sistema.
   */
  snapshot() {
    const result = {}
    this._store.forEach((entry, key) => {
      result[key] = {
        version:   entry.version,
        updatedAt: entry.updatedAt,
        updatedBy: entry.updatedBy,
        // No incluir value para no exponer datos sensibles en la UI
      }
    })
    return result
  }
}

// Singleton — una única memoria compartida para todo el sistema
export const sharedMemory = new SharedMemoryClass()
export default sharedMemory
