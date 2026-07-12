/**
 * src/agents/ComplaintAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * MÓDULO 1 — Agente de Recepción y Triaje de Quejas (Chain-of-Thought + Few-Shot).
 *
 * Recibe el mensaje de un cliente (WhatsApp/web), lo envía a Gemini con el system
 * prompt PROMPT_RECEPCION y responseMimeType JSON, valida la salida y la estructura.
 *
 * REGLA DE NEGOCIO: cobro doble o comida en mal estado ⇒ prioridad "Crítica".
 *
 * COMUNICACIÓN (MCP via EventBus):
 *   Publica: complaint:created, complaint:escalated (cuando es Crítica)
 *
 * Sigue el patrón de ClientAgent (singleton + setContextActions).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AgentBase } from './core/AgentBase.js'
import { EVENT_TYPES } from './core/EventBus.js'
import { MEMORY_KEYS } from './core/SharedMemory.js'
import { completeJSON } from './core/llmClient.js'
import { PROMPT_RECEPCION, RECEPCION_KEYS } from './prompts.js'
import { retrieveSimilar, addComplaint as ragAddComplaint } from './core/ragStore.js'

const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Crítica']
const SENTIMIENTOS = ['Bajo', 'Medio', 'Alto']

export class ComplaintAgent extends AgentBase {
  constructor() {
    super(
      'ComplaintAgent',
      `Eres el agente de recepción y triaje de quejas de Pardos Chicken (Perú).
       Analizas el mensaje del cliente con razonamiento Chain-of-Thought y devuelves
       un JSON estructurado: razonamiento, sentimiento, prioridad, sede, puntos_criticos
       y una respuesta_cliente empática. Cobros dobles o comida en mal estado son SIEMPRE
       prioridad Crítica. Tras estructurar la queja la registras y, si es Crítica, la escalas.`,
      ['triage_complaint']
    )
    this._contextActions = null
    this._registerTools()
  }

  setContextActions(actions) {
    this._contextActions = actions
  }

  _registerTools() {
    this.registerTool(
      'triage_complaint',
      'Analiza el mensaje de un cliente, lo estructura (CoT + JSON) y lo registra como queja',
      this._triageComplaint
    )
  }

  /**
   * _triageComplaint — Punto de entrada del triaje (M1).
   * @param {{ mensaje: string, canal?: string, cliente?: string, dni?: string }} params
   */
  async _triageComplaint({ mensaje, canal = 'WhatsApp', cliente = '', dni = '' }, correlationId) {
    if (!mensaje || !mensaje.trim()) {
      return { success: false, error: 'El mensaje de la queja está vacío' }
    }

    // 0. RAG: buscar quejas similares para enriquecer el contexto del triaje
    let ragContext = ''
    try {
      const similares = await retrieveSimilar(mensaje, 3)
      if (similares.length > 0) {
        const lines = similares.map((s) => `- ${s.sede}: ${s.puntos_criticos?.join(', ') || s.texto} (${s.prioridad})`)
        ragContext = `\n\nQuejas similares recientes (contexto, NO copies estos datos):\n${lines.join('\n')}`
      }
    } catch { /* RAG es opcional, no bloquea el triaje */ }

    // 1. Llamar al LLM (Gemini) para el triaje estructurado
    let triage
    try {
      const prompt = ragContext ? `${mensaje}${ragContext}` : mensaje
      triage = await completeJSON({ system: PROMPT_RECEPCION, prompt, temperature: 0.3 })
    } catch (err) {
      this.log('error', 'Fallo el triaje con el LLM', err.message)
      return { success: false, error: `Error del LLM al analizar la queja: ${err.message}` }
    }

    // 2. Validar y normalizar la salida
    const norm = this._validateAndNormalize(triage)
    if (!norm.ok) {
      return { success: false, error: norm.error, raw: triage }
    }
    const data = norm.data

    // 3. Construir el registro de queja
    const isCritica = data.prioridad === 'Crítica'
    const complaint = {
      id: `Q${Date.now().toString().slice(-6)}`,
      fecha: new Date().toISOString(),
      canal,
      cliente: cliente || 'Anónimo',
      dni,
      mensaje,
      ...data,
      estado: isCritica ? 'escalada' : 'nueva',
    }

    // 4. Persistir en el contexto React (si está conectado) y en SharedMemory
    this._contextActions?.addComplaint?.(complaint)

    const current = this.memory.getValue(MEMORY_KEYS.COMPLAINTS, [])
    this.memory.set(MEMORY_KEYS.COMPLAINTS, [...current, complaint], this.name)
    this._updateSedeIndex(complaint)

    // Indexar en RAG para futuras búsquedas semánticas
    try { await ragAddComplaint(complaint) } catch { /* no bloquea */ }

    // 5. Publicar evento de queja creada (MCP)
    this.bus.publish(EVENT_TYPES.COMPLAINT_CREATED, {
      id: complaint.id,
      prioridad: complaint.prioridad,
      sede: complaint.sede,
      sentimiento: complaint.sentimiento,
      cliente: complaint.cliente,
    }, this.name, correlationId)

    // 6. Escalar si es crítica
    if (isCritica) {
      this.bus.publish(EVENT_TYPES.COMPLAINT_ESCALATED, {
        id: complaint.id,
        prioridad: complaint.prioridad,
        sede: complaint.sede,
        cliente: complaint.cliente,
        motivo: complaint.puntos_criticos.join(', '),
      }, this.name, correlationId)
    }

    return { success: true, result: complaint, escalated: isCritica }
  }

  /**
   * _validateAndNormalize — Asegura que la salida del LLM cumple el contrato.
   */
  _validateAndNormalize(triage) {
    if (!triage || typeof triage !== 'object') {
      return { ok: false, error: 'El LLM no devolvió un objeto JSON válido' }
    }
    // Verificar llaves requeridas
    for (const key of RECEPCION_KEYS) {
      if (!(key in triage)) {
        return { ok: false, error: `Falta la llave requerida "${key}" en la salida del triaje` }
      }
    }
    // Normalizar puntos_criticos → array
    let puntos = triage.puntos_criticos
    if (typeof puntos === 'string') puntos = [puntos]
    if (!Array.isArray(puntos)) puntos = []

    // Normalizar enums (capitaliza y valida; si no calza, deja un valor seguro)
    const prioridad = PRIORIDADES.includes(triage.prioridad) ? triage.prioridad : 'Media'
    const sentimiento = SENTIMIENTOS.includes(triage.sentimiento) ? triage.sentimiento : 'Medio'

    return {
      ok: true,
      data: {
        razonamiento: String(triage.razonamiento || ''),
        sentimiento,
        prioridad,
        sede: String(triage.sede || 'No especificada').trim() || 'No especificada',
        puntos_criticos: puntos.map(String),
        respuesta_cliente: String(triage.respuesta_cliente || ''),
      },
    }
  }

  /**
   * _updateSedeIndex — Mantiene un índice de conteo de quejas por sede en SharedMemory.
   */
  _updateSedeIndex(complaint) {
    const idx = this.memory.getValue(MEMORY_KEYS.COMPLAINTS_BY_SEDE, {})
    const sede = complaint.sede || 'No especificada'
    const prev = idx[sede] || { total: 0, criticas: 0 }
    idx[sede] = {
      total: prev.total + 1,
      criticas: prev.criticas + (complaint.prioridad === 'Crítica' ? 1 : 0),
    }
    this.memory.set(MEMORY_KEYS.COMPLAINTS_BY_SEDE, idx, this.name)
  }
}

export const complaintAgent = new ComplaintAgent()
export default complaintAgent
