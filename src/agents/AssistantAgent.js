/**
 * src/agents/AssistantAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * M5 — Asistente de gestión del líder. ReAct vía Function Calling.
 *
 * Reemplaza al PromptInterpreter como camino principal del Asistente IA, pero
 * lo conserva como red de seguridad.
 *
 * DEGRADACIÓN EN CASCADA — el asistente nunca se queda sin responder:
 *
 *   Nivel 0 · Grafo LangGraph  → supervisor + handoffs entre agentes de dominio
 *   Nivel 1 · Camino directo   → completeWithTools, sin grafo (VITE_ASSISTANT_GRAPH=false)
 *   Nivel 2 · PromptInterpreter → clasificación por regex, sin LLM
 *   Nivel 3 · Mensaje honesto   → nunca un spinner infinito
 *
 * `ask()` no lanza excepciones hacia la UI. Todo error baja un nivel.
 * El verificador de procedencia de cifras (core/numberGuard.js) corre en los
 * niveles 0 y 1: ninguna cifra llega al líder sin salir de una herramienta.
 *
 * SEGURIDAD (no degradable, corre en todos los niveles):
 *   · El guardrail destructivo se evalúa ANTES de cualquier llamada al LLM.
 *   · Las tools se filtran por rol ANTES de ligarlas al modelo.
 *   · No existe ninguna tool de escritura.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { completeWithTools, llmMode, llmModel } from './core/llmClient.js'
import { promptInterpreter, isDestructivePrompt, roleHasAssistantAccess } from './core/PromptInterpreter.js'
import { createAssistantGraph } from './core/assistantGraph.js'
import { verificarCifras } from './core/numberGuard.js'
import { claveDeConsulta, obtener, guardar } from './core/responseCache.js'
import { buildToolsForRole } from './tools/assistantTools.js'
import { PROMPT_ASISTENTE_LIDER } from './prompts.js'

const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {}

// El grafo es la ruta por defecto. `VITE_ASSISTANT_GRAPH=false` vuelve al camino
// directo sin perder ninguna garantía: el verificador de cifras corre en ambos.
const USAR_GRAFO = ENV.VITE_ASSISTANT_GRAPH !== 'false'

const TIMEOUT_MS      = 18000  // holgura para un reintento con la espera que pide el proveedor
const HISTORY_TURNS   = 6   // vueltas de conversación que recuerda el asistente
const MAX_USER_CHARS  = 500

// Temperatura baja: a 0.7 el modelo a veces omite la llamada a la herramienta e
// inventa la cifra. La naturalidad la da el prompt, no el sampling.
const TEMP_NORMAL = 0.3
const TEMP_ESTRICTA = 0.1

// Fallback de modelo (§3.8 robustez): si el modelo principal agota su cuota
// diaria de tokens, se reintenta con uno más ligero —bolsa de tokens separada—
// antes de degradar al modo sin LLM. Solo aplica en Groq.
const MODELO_FALLBACK = llmMode === 'groq' ? 'llama-3.1-8b-instant' : null

/** Etiqueta del modelo realmente usado, para que la UI no mienta sobre quién respondió. */
const etiquetaModelo = (modelo) => {
  const m = modelo || llmModel
  return m ? `Asistente IA · ${m}` : 'Asistente IA'
}

/** ¿El error es un límite de cuota/tokens del proveedor (no un fallo de red)? */
function esCuotaAgotada(err) {
  const s = String(err?.message || err || '')
  return /rate.?limit|rate_limit_exceeded|tokens per day|TPD|quota|429/i.test(s)
}

const BLOCKED_MSG =
  '🚫 Acción no permitida: el asistente de consulta no puede modificar, eliminar ni ' +
  'resetear datos del sistema. Esta restricción es permanente y no puede ser omitida ' +
  'por ningún rol, incluyendo administradores.'

/** Corta una promesa que tarda demasiado, para que la UI no se quede colgada. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

/**
 * Arma el prompt del usuario con su historial conversacional.
 * La consulta va delimitada: nada de lo que escriba el líder se confunde con
 * instrucciones del sistema.
 */
function buildPrompt(rawPrompt, history) {
  const turns = (history || []).slice(-HISTORY_TURNS)
  const contexto = turns.length > 0
    ? 'Conversación previa:\n' +
      turns.map(t => `${t.role === 'user' ? 'Líder' : 'Tú'}: ${t.content}`).join('\n') +
      '\n\n'
    : ''

  const consulta = String(rawPrompt).slice(0, MAX_USER_CHARS)
  return `${contexto}<consulta_del_lider>\n${consulta}\n</consulta_del_lider>`
}

class AssistantAgentClass {
  constructor() {
    this.name = 'AssistantAgent'
    this._history = []
  }

  /**
   * ask — Punto de entrada del Asistente IA.
   *
   * @param {Object} params
   * @param {string} params.prompt       - Texto libre del líder
   * @param {string} params.role         - admin | cajero | hostess | mozo | jefe_cocina
   * @param {Object} params.contextData  - { payments, reservations, clients, systemStatus }
   * @param {Array}  params.history      - [{ role: 'user'|'agent', content: string }]
   * @returns {Promise<Object>} Resultado listo para renderizar. Nunca rechaza.
   */
  async ask({ prompt, role, contextData = {}, history = [], onToken, onReset }) {
    const startTime = Date.now()

    // ── Guardrail: corre antes que nada, en todos los niveles ────────────────
    if (isDestructivePrompt(prompt)) {
      return this._blocked(prompt, role, startTime, 'BLOCKED.destructive', BLOCKED_MSG)
    }

    if (!roleHasAssistantAccess(role)) {
      return this._blocked(prompt, role, startTime, 'BLOCKED.unauthorized',
        `🔒 Tu rol (${role}) no tiene acceso al asistente.`)
    }

    // ── Nivel 2 directo: sin LLM configurado, no hay nada que intentar ───────
    if (llmMode === 'mock') {
      return this._fallback(prompt, role, contextData, startTime, 'sin LLM configurado')
    }

    // ── Caché de sesión (DESPUÉS del guardrail: el caché nunca salta seguridad).
    // La clave incluye rol, huella de datos e historial reciente, así que un
    // acierto es la misma pregunta, del mismo rol, sobre los mismos datos.
    const claveCache = claveDeConsulta({ prompt, role, contextData, history })
    const enCache = obtener(claveCache)
    if (enCache) {
      return { ...enCache, cached: true, latency: Date.now() - startTime, timestamp: new Date().toISOString() }
    }

    // ── Nivel 0: Gemini + tools filtradas por rol ────────────────────────────
    if (buildToolsForRole(role, contextData).isEmpty) {
      return this._blocked(prompt, role, startTime, 'BLOCKED.unauthorized',
        `🔒 Tu rol (${role}) no tiene consultas habilitadas.`)
    }

    try {
      // No enumeramos las capacidades en el prompt: los esquemas de las tools ya
      // se las dicen, y el permiso se aplica filtrando el registry, no pidiéndolo.
      //
      // La fecha va SIEMPRE: sin ella el modelo adivina "hoy" desde su
      // entrenamiento (observado: pasó fecha="2024-07-10" y narró "no hay
      // ventas" sobre un día con S/. 588.40 en caja).
      const fechaHoy = new Date().toISOString().split('T')[0]
      const system = `${PROMPT_ASISTENTE_LIDER}\n\nHOY es ${fechaHoy}. ` +
        `Si el líder pregunta por "hoy" o no menciona fecha, NO pases el parámetro fecha a las herramientas.`
      const userPrompt = buildPrompt(prompt, history)

      // Fallback de modelo: primero el default (70B); si agota su cuota diaria,
      // el 8B —bolsa separada— antes de degradar al modo sin LLM.
      const modelos = MODELO_FALLBACK ? [undefined, MODELO_FALLBACK] : [undefined]
      let intento, modeloUsado, ultimoErr
      for (const model of modelos) {
        try {
          onReset?.()   // descarta streaming del intento anterior si lo hubo
          intento = USAR_GRAFO
            ? await this._porGrafo(system, userPrompt, prompt, role, contextData, { onToken, onReset, model })
            : await this._porCaminoDirecto(system, userPrompt, role, contextData, { model })
          modeloUsado = model || llmModel
          ultimoErr = null
          break
        } catch (err) {
          ultimoErr = err
          const quedanModelos = model !== modelos[modelos.length - 1]
          if (esCuotaAgotada(err) && quedanModelos) {
            console.warn(`[AssistantAgent] Cuota agotada en ${llmModel}; reintentando con ${MODELO_FALLBACK}.`)
            continue
          }
          throw err
        }
      }
      if (ultimoErr) throw ultimoErr

      // El modelo insistió en inventar cifras: mejor una respuesta limitada pero cierta.
      if (intento.degraded) {
        onReset?.()
        return this._fallback(prompt, role, contextData, startTime, 'el modelo no consultó los datos')
      }

      const { texto, emitted, agentsUsed, handoffs = [] } = intento

      // La primera visualización emitida por las tools es la que ve el líder.
      const visual = emitted.find(e => e.chartConfig) || emitted[0] || null

      const result = {
        success:     true,
        blocked:     false,
        rawPrompt:   prompt,
        intent:      'assistant.llm',
        description: etiquetaModelo(modeloUsado),
        role,
        type:        visual?.type || 'summary',
        chartConfig: visual?.chartConfig || null,
        data:        visual?.data || null,
        agentsUsed:  [...agentsUsed],
        handoffs,
        summary:     String(texto).trim(),
        latency:     Date.now() - startTime,
        timestamp:   new Date().toISOString(),
      }

      this._history.push(result)
      guardar(claveCache, result)   // solo guarda éxitos; ignora degradados/bloqueados
      return result

    } catch (err) {
      // ── Nivel 2: el LLM falló (cuota, key, red, timeout) ───────────────────
      const motivo = err.message === 'timeout'
        ? 'el modelo tardó demasiado'
        : `error del modelo (${err.message})`
      console.warn(`[AssistantAgent] Degradando a PromptInterpreter: ${motivo}`)
      onReset?.()
      return this._fallback(prompt, role, contextData, startTime, motivo)
    }
  }

  /**
   * NIVEL 0 — Grafo de LangGraph: supervisor + handoffs entre agentes de dominio.
   * El verificador de cifras y el reintento estricto viven dentro del grafo.
   */
  async _porGrafo(system, userPrompt, promptCrudo, role, contextData, { onToken, onReset, model } = {}) {
    const { SystemMessage, HumanMessage } = await import('@langchain/core/messages')
    const grafo = await createAssistantGraph({ role, contextData, systemPrompt: system, onToken, onReset, model })

    // LangGraph no cargó: caemos al camino directo, que está igual de verificado.
    if (!grafo) {
      console.warn('[AssistantAgent] Grafo no disponible, usando camino directo.')
      return this._porCaminoDirecto(system, userPrompt, role, contextData, { model })
    }

    const salida = await withTimeout(
      grafo.invoke(promptCrudo, [new SystemMessage(system), new HumanMessage(userPrompt)]),
      TIMEOUT_MS,
    )

    if (salida.handoffs?.length) {
      console.info('[AssistantAgent] Handoffs ejecutados:', salida.handoffs.join(', '))
    }

    return { ...salida, texto: String(salida.texto).trim() }
  }

  /**
   * NIVEL 1 — Camino directo, sin grafo. Conserva el bucle ReAct de
   * completeWithTools. Se usa si el grafo se desactiva o no carga.
   */
  async _porCaminoDirecto(system, userPrompt, role, contextData, { model } = {}) {
    let intento = await this._unaPasada(system, userPrompt, TEMP_NORMAL, role, contextData, model)

    if (this._inventoCifras(intento)) {
      console.warn('[AssistantAgent] Cifras sin respaldo. Reintento estricto.')
      intento = await this._unaPasada(
        `${system}\n\nOBLIGATORIO: no escribas ninguna cifra que no te haya devuelto una herramienta.`,
        userPrompt, TEMP_ESTRICTA, role, contextData, model,
      )
      if (this._inventoCifras(intento)) return { ...intento, degraded: true }
    }
    return intento
  }

  async _unaPasada(system, userPrompt, temperature, role, contextData, model) {
    const { tools, handlers, emitted, results, agentsUsed } = buildToolsForRole(role, contextData)

    const texto = await withTimeout(
      completeWithTools({ system, prompt: userPrompt, tools, handlers, temperature, ...(model ? { model } : {}) }),
      TIMEOUT_MS,
    )

    return { texto: String(texto).trim(), emitted, results, agentsUsed, degraded: false }
  }

  /** Verificación de procedencia de cifras (compartida con el grafo). */
  _inventoCifras({ texto, results, agentsUsed }) {
    const { invento, motivo } = verificarCifras(texto, results, agentsUsed.size)
    if (invento) console.warn('[AssistantAgent] El modelo inventó —', motivo)
    return invento
  }

  // ── Nivel 2: clasificación por regex, sin LLM ─────────────────────────────
  async _fallback(prompt, role, contextData, startTime, motivo) {
    try {
      const result = await promptInterpreter.interpret(prompt, role, contextData)
      return { ...result, degraded: true, degradedReason: motivo, latency: Date.now() - startTime }
    } catch (err) {
      // ── Nivel 3: hasta el fallback falló. Mensaje honesto. ────────────────
      console.error('[AssistantAgent] Fallback también falló:', err)
      return {
        success:    false,
        blocked:    false,
        rawPrompt:  prompt,
        intent:     'assistant.unavailable',
        description: 'Asistente no disponible',
        role,
        type:       'summary',
        agentsUsed: [],
        degraded:   true,
        summary:    'Ahora mismo no puedo responder. Vuelve a intentarlo en un momento.',
        latency:    Date.now() - startTime,
        timestamp:  new Date().toISOString(),
      }
    }
  }

  _blocked(rawPrompt, role, startTime, intent, reason) {
    const result = {
      success:   false,
      blocked:   true,
      rawPrompt,
      intent,
      role,
      type:      'blocked',
      agentsUsed: [],
      reason,
      summary:   reason,
      latency:   Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }
    this._history.push(result)
    return result
  }

  getHistory(limit = 20) {
    return this._history.slice(-limit)
  }
}

export const assistantAgent = new AssistantAgentClass()
export default assistantAgent
