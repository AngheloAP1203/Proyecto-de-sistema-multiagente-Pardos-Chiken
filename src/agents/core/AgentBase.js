/**
 * src/agents/core/AgentBase.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Clase base para todos los agentes del sistema multiagente.
 *
 * Cada agente tiene:
 *   - systemPrompt: Define el rol, responsabilidades y restricciones del agente
 *   - tools: Herramientas (funciones) que el agente puede ejecutar
 *   - memory: Memoria propia del agente (conversationHistory)
 *   - metrics: Métricas de rendimiento (latencia, tasa de éxito, etc.)
 *
 * El agente sigue el ciclo:
 *   input → validate → execute tool → log → publish event → return result
 *
 * Patrón: Template Method — la subclase define las tools específicas,
 * la clase base maneja la infraestructura común.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { eventBus } from './EventBus.js'
import { sharedMemory } from './SharedMemory.js'
import { EVENT_TYPES } from './EventBus.js'

export class AgentBase {
  /**
   * @param {string} name - Nombre único del agente
   * @param {string} systemPrompt - Prompt del sistema que define el rol del agente
   * @param {string[]} capabilities - Lista de capabilities que expone este agente
   */
  constructor(name, systemPrompt, capabilities = []) {
    this.name         = name
    this.systemPrompt = systemPrompt
    this.capabilities = capabilities
    this.isActive     = false

    // Registro de herramientas: toolName → { description, handler }
    this._tools = new Map()

    // Historial de conversación del agente (preservado entre turnos)
    this._conversationHistory = []

    // Métricas de rendimiento del agente
    this._metrics = {
      totalCalls:    0,
      successCalls:  0,
      failedCalls:   0,
      totalLatency:  0,  // ms acumulados
      lastCallAt:    null,
      lastError:     null,
      totalTokens:   0,
    }
  }

  // ── Registro de herramientas ──────────────────────────────────────────────

  /**
   * registerTool — Registra una herramienta que el agente puede usar.
   * @param {string} toolName - Nombre de la herramienta
   * @param {string} description - Descripción de qué hace
   * @param {Function} handler - Función que ejecuta la herramienta
   */
  registerTool(toolName, description, handler) {
    this._tools.set(toolName, { description, handler: handler.bind(this) })
  }

  /**
   * getTools — Retorna la lista de herramientas disponibles (para el orquestador).
   */
  getTools() {
    return [...this._tools.entries()].map(([name, tool]) => ({
      name,
      description: tool.description,
    }))
  }

  // ── Ejecución de tareas ───────────────────────────────────────────────────

  /**
   * execute — Punto de entrada principal del agente.
   * Ejecuta una herramienta con los parámetros dados.
   *
   * @param {string} toolName - Nombre de la herramienta a ejecutar
   * @param {Object} params - Parámetros para la herramienta
   * @param {string} [correlationId] - ID de correlación del flujo
   * @returns {Promise<{ success: boolean, result: *, latency: number, error?: string }>}
   */
  async execute(toolName, params = {}, correlationId = null) {
    const startTime = Date.now()
    this._metrics.totalCalls++
    this._metrics.lastCallAt = new Date().toISOString()
    this.isActive = true

    // Publicar evento de inicio del agente
    eventBus.publish(EVENT_TYPES.AGENT_STARTED, {
      agentName: this.name,
      tool:      toolName,
      params,
    }, this.name, correlationId)

    try {
      // Buscar la herramienta registrada
      const tool = this._tools.get(toolName)
      if (!tool) {
        throw new Error(`Herramienta "${toolName}" no encontrada en agente "${this.name}"`)
      }

      // Agregar al historial de conversación (memoria del agente)
      this._addToHistory('user', `Ejecutar: ${toolName}`, params)

      // Ejecutar la herramienta
      const result = await tool.handler(params, correlationId)

      // Medir latencia
      const latency = Date.now() - startTime
      this._metrics.successCalls++
      this._metrics.totalLatency += latency

      // Estimación de tokens (heurística: 1 token ≈ 4 caracteres)
      const promptChars = (this.systemPrompt || '').length + JSON.stringify(params || {}).length
      const completionChars = result ? JSON.stringify(result).length : 0
      const promptTokens = Math.ceil(promptChars / 4)
      const completionTokens = Math.ceil(completionChars / 4)
      const totalTokens = promptTokens + completionTokens
      this._metrics.totalTokens = (this._metrics.totalTokens || 0) + totalTokens

      // Agregar resultado al historial
      this._addToHistory('assistant', `Resultado de ${toolName}`, result)

      // Publicar evento de completado
      eventBus.publish(EVENT_TYPES.AGENT_COMPLETED, {
        agentName: this.name,
        tool:      toolName,
        latency,
        success:   true,
      }, this.name, correlationId)

      this.isActive = false
      return { success: true, result, latency, agentName: this.name }

    } catch (error) {
      const latency = Date.now() - startTime
      this._metrics.failedCalls++
      this._metrics.lastError = error.message

      // Estimación de tokens en caso de fallo
      const promptChars = (this.systemPrompt || '').length + JSON.stringify(params || {}).length
      const completionChars = error.message.length
      const promptTokens = Math.ceil(promptChars / 4)
      const completionTokens = Math.ceil(completionChars / 4)
      const totalTokens = promptTokens + completionTokens
      this._metrics.totalTokens = (this._metrics.totalTokens || 0) + totalTokens

      // Publicar evento de error
      eventBus.publish(EVENT_TYPES.AGENT_ERROR, {
        agentName: this.name,
        tool:      toolName,
        error:     error.message,
        latency,
      }, this.name, correlationId)

      this.isActive = false
      return { success: false, result: null, latency, error: error.message, agentName: this.name }
    }
  }

  // ── Memoria del agente ────────────────────────────────────────────────────

  /**
   * _addToHistory — Agrega un mensaje al historial de conversación.
   * El historial se preserva entre turnos y es visible para el orquestador.
   */
  _addToHistory(role, content, data = null) {
    this._conversationHistory.push({
      role,
      content,
      data,
      timestamp: new Date().toISOString(),
      agentName: this.name,
    })
    // Mantener historial de máximo 100 entradas
    if (this._conversationHistory.length > 100) {
      this._conversationHistory.shift()
    }
  }

  /**
   * getConversationHistory — Retorna el historial de conversación del agente.
   */
  getConversationHistory(limit = 20) {
    return this._conversationHistory.slice(-limit)
  }

  // ── Métricas del agente ───────────────────────────────────────────────────

  /**
   * getMetrics — Retorna las métricas de rendimiento del agente.
   */
  getMetrics() {
    const { totalCalls, successCalls, failedCalls, totalLatency, lastCallAt, lastError, totalTokens } = this._metrics
    return {
      agentName:       this.name,
      capabilities:    this.capabilities,
      totalCalls,
      successCalls,
      failedCalls,
      successRate:     totalCalls > 0 ? ((successCalls / totalCalls) * 100).toFixed(1) : '100.0',
      avgLatency:      totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0,
      totalLatency,
      lastCallAt,
      lastError,
      isActive:        this.isActive,
      toolCount:       this._tools.size,
      historyEntries:  this._conversationHistory.length,
      totalTokens:     totalTokens || 0,
    }
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  /**
   * sharedMemory — Acceso directo a la memoria compartida del sistema.
   */
  get memory() { return sharedMemory }

  /**
   * bus — Acceso directo al bus de eventos.
   */
  get bus() { return eventBus }

  /**
   * log — Método de logging con contexto del agente.
   */
  log(level, message, data = null) {
    const entry = { level, message, agentName: this.name, timestamp: new Date().toISOString(), data }
    if (level === 'error') console.error(`[${this.name}]`, message, data)
    else if (level === 'warn')  console.warn(`[${this.name}]`, message, data)
    else                        console.log(`[${this.name}]`, message, data)
    return entry
  }
}

export default AgentBase
