/**
 * src/agents/LeaderAnalystAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * MÓDULO 2 — Analista del Líder (ReAct vía Function Calling de Gemini).
 *
 * Traduce preguntas en lenguaje natural del líder en consultas sobre la base de
 * quejas. Gemini decide qué herramienta usar (puntos_frecuentes, quejas_cliente,
 * resumen_sede); cada herramienta es una función JS que lee las quejas reales.
 *
 * Sigue el patrón de ClientAgent (singleton + setContextActions).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AgentBase } from './core/AgentBase.js'
import { MEMORY_KEYS } from './core/SharedMemory.js'
import { completeWithTools } from './core/llmClient.js'
import { PROMPT_LIDER, TOOLS_LIDER } from './prompts.js'
import { retrieveSimilar } from './core/ragStore.js'

export class LeaderAnalystAgent extends AgentBase {
  constructor() {
    super(
      'LeaderAnalystAgent',
      `Eres el asistente analítico del líder de Pardos Chicken. Traduces sus preguntas
       en consultas sobre la base de quejas usando herramientas (function calling) y
       devuelves resúmenes accionables. Nunca inventas datos.`,
      ['answer_leader_query']
    )
    this._contextActions = null
    this._registerTools()
  }

  setContextActions(actions) {
    this._contextActions = actions
  }

  _registerTools() {
    this.registerTool(
      'answer_leader_query',
      'Responde una pregunta del líder consultando la base de quejas (ReAct/tool-use)',
      this._answerLeaderQuery
    )
  }

  /** Lee las quejas desde el contexto React o, en su defecto, desde SharedMemory. */
  _readComplaints() {
    const fromCtx = this._contextActions?.getComplaints?.()
    if (Array.isArray(fromCtx)) return fromCtx
    return this.memory.getValue(MEMORY_KEYS.COMPLAINTS, [])
  }

  /**
   * _answerLeaderQuery — Punto de entrada (M2).
   * @param {{ pregunta: string }} params
   */
  async _answerLeaderQuery({ pregunta }) {
    if (!pregunta || !pregunta.trim()) {
      return { success: false, error: 'La pregunta del líder está vacía' }
    }

    // Handlers JS que Gemini puede invocar (function calling)
    const handlers = {
      puntos_frecuentes: async () => this._puntosFrecuentes(),
      quejas_cliente: async ({ nombre }) => this._quejasCliente(nombre),
      resumen_sede: async ({ sede }) => this._resumenSede(sede),
      buscar_quejas_similares: async ({ consulta }) => this._buscarQuejasSimilares(consulta),
    }

    try {
      const respuesta = await completeWithTools({
        system: PROMPT_LIDER,
        prompt: pregunta,
        tools: TOOLS_LIDER,
        handlers,
        temperature: 0.2,
      })
      return { success: true, result: respuesta }
    } catch (err) {
      this.log('error', 'Fallo la consulta del líder', err.message)
      return { success: false, error: `Error del LLM: ${err.message}` }
    }
  }

  // ── Herramientas de datos (leídas por el function calling) ──────────────────

  _puntosFrecuentes() {
    const quejas = this._readComplaints()
    const conteo = {}
    for (const q of quejas) {
      for (const p of (q.puntos_criticos || [])) {
        conteo[p] = (conteo[p] || 0) + 1
      }
    }
    const ranking = Object.entries(conteo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([punto, veces]) => ({ punto, veces }))
    return { total_quejas: quejas.length, puntos_frecuentes: ranking }
  }

  _quejasCliente(nombre) {
    const q = (nombre || '').toLowerCase().trim()
    const quejas = this._readComplaints().filter(
      (c) => (c.cliente || '').toLowerCase().includes(q)
    )
    return {
      cliente: nombre,
      encontradas: quejas.length,
      quejas: quejas.map((c) => ({
        id: c.id, fecha: c.fecha, sede: c.sede, prioridad: c.prioridad,
        puntos_criticos: c.puntos_criticos, estado: c.estado,
      })),
    }
  }

  async _buscarQuejasSimilares(consulta) {
    try {
      const similares = await retrieveSimilar(consulta, 5)
      return {
        consulta,
        encontradas: similares.length,
        quejas: similares.map((s) => ({
          id: s.id, sede: s.sede, prioridad: s.prioridad,
          puntos_criticos: s.puntos_criticos, sentimiento: s.sentimiento,
          similitud: s.score || null,
        })),
      }
    } catch {
      return { consulta, encontradas: 0, quejas: [], error: 'RAG no disponible' }
    }
  }

  _resumenSede(sede) {
    const s = (sede || '').toLowerCase().trim()
    const quejas = this._readComplaints().filter(
      (c) => (c.sede || '').toLowerCase().includes(s)
    )
    const porPrioridad = {}
    const porSentimiento = {}
    const puntos = {}
    for (const c of quejas) {
      porPrioridad[c.prioridad] = (porPrioridad[c.prioridad] || 0) + 1
      porSentimiento[c.sentimiento] = (porSentimiento[c.sentimiento] || 0) + 1
      for (const p of (c.puntos_criticos || [])) puntos[p] = (puntos[p] || 0) + 1
    }
    const topPuntos = Object.entries(puntos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([punto, veces]) => ({ punto, veces }))
    return {
      sede,
      total: quejas.length,
      por_prioridad: porPrioridad,
      por_sentimiento: porSentimiento,
      puntos_top: topPuntos,
    }
  }
}

export const leaderAnalystAgent = new LeaderAnalystAgent()
export default leaderAnalystAgent
