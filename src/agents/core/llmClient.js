/**
 * src/agents/core/llmClient.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Wrapper LLM sobre LangChain.js + Google Gemini para todo el sistema.
 *
 * Tres modos de operación (detectados automáticamente):
 *   · 'gemini' → hay VITE_GEMINI_API_KEY: usa ChatGoogleGenerativeAI (LangChain).
 *   · 'proxy'  → VITE_USE_PROXY === 'true': delega en /api/triage (key server-side).
 *   · 'mock'   → no hay key ni proxy: heurística local determinística (demo offline).
 *
 * Internamente usa @langchain/google-genai (ChatGoogleGenerativeAI) en vez del SDK
 * directo. La interfaz pública se mantiene idéntica para no romper los agentes.
 *
 * Expone:
 *   completeJSON({ system, prompt, schema?, temperature?, model? })  → objeto JSON
 *   completeWithTools({ system, prompt, tools, handlers, ... })      → texto final
 *   complete({ system, prompt, temperature?, model? })              → texto plano
 *   llmMode → 'gemini' | 'proxy' | 'mock'
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {}
const useProxy = ENV.VITE_USE_PROXY === 'true'
const API_KEY = ENV.VITE_GEMINI_API_KEY || ''

const DEFAULT_MODEL = 'gemini-2.5-flash'
const MAX_RETRIES = 3
const MAX_TOOL_TURNS = 6

export const llmMode = useProxy ? 'proxy' : (API_KEY ? 'gemini' : 'mock')

if (llmMode === 'mock') {
  console.warn(
    '[llmClient] Sin VITE_GEMINI_API_KEY → modo MOCK (heurística local). ' +
    'Configura .env con tu key gratuita de https://aistudio.google.com/apikey para usar Gemini real.'
  )
}

// ── Carga perezosa de LangChain (cae a MOCK si falla) ───────────────────────
let _langchainPromise = null

async function getLangChainModel(opts = {}) {
  if (!API_KEY) return null
  if (!_langchainPromise) {
    _langchainPromise = import('@langchain/google-genai')
      .catch((e) => {
        console.warn('[llmClient] No se pudo cargar @langchain/google-genai, usando MOCK:', e.message)
        return null
      })
  }
  const mod = await _langchainPromise
  if (!mod) return null

  const { ChatGoogleGenerativeAI } = mod
  return new ChatGoogleGenerativeAI({
    model: opts.model || DEFAULT_MODEL,
    apiKey: API_KEY,
    temperature: opts.temperature ?? 0.3,
    ...(opts.extra || {}),
  })
}

// Limpia posibles cercos ```json que el modelo agrega
function safeParseJSON(text) {
  const clean = String(text).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  return JSON.parse(clean)
}

// Reintento con backoff exponencial ante 429/503
async function withRetry(fn, { retries = MAX_RETRIES, label = 'gemini' } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const status = err?.status ?? err?.response?.status
      const retryable = status === 429 || status === 503
      if (!retryable || attempt === retries) break
      const waitMs = Math.min(2 ** attempt * 1000, 8000)
      console.warn(`[llmClient] ${label}: ${status}, reintento ${attempt + 1}/${retries} en ${waitMs}ms`)
      await new Promise((r) => setTimeout(r, waitMs))
    }
  }
  throw lastErr
}

// Proxy serverless (modo producción)
async function callProxy(payload) {
  const res = await fetch('/api/triage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw Object.assign(new Error(`Proxy LLM error ${res.status}`), { status: res.status })
  return res.json()
}

// ── M1: salida JSON estructurada (LangChain) ────────────────────────────────
export async function completeJSON({ system, prompt, schema, temperature = 0.3, model = DEFAULT_MODEL }) {
  if (useProxy) return callProxy({ mode: 'json', system, prompt, schema, temperature, model })

  const llm = await getLangChainModel({ model, temperature })
  if (!llm) return mockTriage(prompt)

  return withRetry(async () => {
    const { HumanMessage, SystemMessage } = await import('@langchain/core/messages')
    const messages = [new SystemMessage(system), new HumanMessage(prompt)]

    // Intentar structured output con schema si está disponible
    if (schema) {
      try {
        const structured = llm.bind({ response_format: { type: 'json_object' } })
        const result = await structured.invoke(messages)
        return safeParseJSON(result.content)
      } catch {
        // Fallback: sin structured output binding, solo parsear la respuesta
      }
    }

    const result = await llm.invoke(messages)
    return safeParseJSON(result.content)
  }, { label: 'completeJSON' })
}

// ── M3: texto plano (LangChain) ─────────────────────────────────────────────
export async function complete({ system, prompt, temperature = 0.8, model = DEFAULT_MODEL }) {
  if (useProxy) return (await callProxy({ mode: 'text', system, prompt, temperature, model })).text

  const llm = await getLangChainModel({ model, temperature })
  if (!llm) return mockAudit(prompt)

  return withRetry(async () => {
    const { HumanMessage, SystemMessage } = await import('@langchain/core/messages')
    const result = await llm.invoke([new SystemMessage(system), new HumanMessage(prompt)])
    return result.content
  }, { label: 'complete' })
}

// ── M2: function calling / bucle ReAct (LangChain) ──────────────────────────
export async function completeWithTools({ system, prompt, tools, handlers,
                                          temperature = 0.2, model = DEFAULT_MODEL }) {
  const llm = useProxy ? null : await getLangChainModel({ model, temperature })
  if (!llm) return mockTools(prompt, handlers)

  return withRetry(async () => {
    const { HumanMessage, SystemMessage, AIMessage } = await import('@langchain/core/messages')

    // Bind las tools de Gemini al modelo LangChain
    const modelWithTools = llm.bind({ tools })
    const messages = [new SystemMessage(system), new HumanMessage(prompt)]

    let resp = await modelWithTools.invoke(messages)
    messages.push(resp)
    let turns = 0

    while (resp.tool_calls?.length && turns < MAX_TOOL_TURNS) {
      turns++
      const { ToolMessage } = await import('@langchain/core/messages')

      for (const call of resp.tool_calls) {
        let result
        try {
          const handler = handlers?.[call.name]
          result = handler ? await handler(call.args || {}) : { error: `Handler "${call.name}" no encontrado` }
        } catch (e) {
          result = { error: e.message }
        }
        messages.push(new ToolMessage({
          content: JSON.stringify(result),
          tool_call_id: call.id || call.name,
          name: call.name,
        }))
      }

      resp = await modelWithTools.invoke(messages)
      messages.push(resp)
    }

    return typeof resp.content === 'string' ? resp.content : JSON.stringify(resp.content)
  }, { label: 'completeWithTools' })
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK MOCK (heurística local determinística, sin LLM)
// ─────────────────────────────────────────────────────────────────────────────

const SEDES_CONOCIDAS = [
  'San Borja', 'Miraflores', 'San Isidro', 'Surco', 'La Molina', 'San Miguel',
  'Jockey Plaza', 'Salaverry', 'Benavides', 'Chacarilla', 'Los Olivos', 'Callao',
]

function detectSede(textOriginal) {
  const t = (textOriginal || '').toLowerCase()
  for (const sede of SEDES_CONOCIDAS) {
    if (t.includes(sede.toLowerCase())) return sede
  }
  return 'No especificada'
}

export function mockTriage(message) {
  const t = (message || '').toLowerCase()
  const puntos = []
  let prioridad = 'Media'
  let sentimiento = 'Medio'

  if (/(cobr|cobro|doble|duplicad|me cobraron|tarjeta|pasarela|pago)/.test(t)) {
    puntos.push('Problema de cobro/pago'); prioridad = 'Crítica'
  }
  if (/(mal estado|podrid|malogr|intoxic|crud[oa]|vencid)/.test(t)) {
    puntos.push('Comida en mal estado'); prioridad = 'Crítica'
  }
  if (/(cabello|pelo|mosca|insecto|sucio|higiene|cucaracha)/.test(t)) {
    puntos.push('Problema de higiene'); prioridad = 'Crítica'
  }
  if (/(fr[ií]o|fria|helad|tibio)/.test(t)) {
    puntos.push('Comida fría'); if (prioridad !== 'Crítica') prioridad = 'Alta'
  }
  if (/(demor|tard|hora|esper|lent|nunca lleg|no lleg)/.test(t)) {
    puntos.push('Demora o delivery fallido'); if (prioridad === 'Media') prioridad = 'Alta'
  }
  if (/(falt|incomplet|no me mandaron|sin cremas|sin papas)/.test(t)) {
    puntos.push('Pedido incompleto')
  }
  if (/(cup[oó]n|descuento|promoci[oó]n)/.test(t)) {
    puntos.push('Problema con cupón/descuento')
  }
  if (/(p[eé]simo|terrible|horrible|asco|indignad|furioso|c[oó]lera|nunca|jam[aá]s)/.test(t)) {
    sentimiento = 'Alto'
  } else if (/(gracias|amable|bien|solo que|buena|excelente)/.test(t)) {
    sentimiento = 'Bajo'; if (prioridad === 'Media') prioridad = 'Baja'
  }
  if (puntos.length === 0) puntos.push('Reclamo general')

  const sede = detectSede(message)
  const sedeTxt = sede !== 'No especificada' ? ` en nuestra sede de ${sede}` : ''

  return {
    razonamiento: `[Heurística local sin LLM] Se detectaron ${puntos.length} punto(s) crítico(s): ${puntos.join(', ')}. Sentimiento ${sentimiento}, prioridad ${prioridad}.`,
    sentimiento,
    prioridad,
    sede,
    puntos_criticos: puntos,
    respuesta_cliente: `¡Hola! Lamentamos mucho el inconveniente${sedeTxt}. Ya estamos escalando tu caso (${puntos.join(', ')}) al área correspondiente para darte una solución lo antes posible. ¡Mil disculpas y gracias por avisarnos!`,
  }
}

async function mockTools(question, handlers = {}) {
  const q = (question || '').toLowerCase()

  const sede = detectSede(question)
  if (sede !== 'No especificada' && handlers.resumen_sede) {
    const r = await handlers.resumen_sede({ sede })
    return `📍 Resumen de quejas — Sede ${sede} (heurística local):\n${formatResult(r)}`
  }

  if (/(cliente|señor|sr\.?|sra\.?|de )/.test(q) && handlers.quejas_cliente) {
    const nombre = extractName(question)
    if (nombre) {
      const r = await handlers.quejas_cliente({ nombre })
      return `👤 Quejas del cliente "${nombre}" (heurística local):\n${formatResult(r)}`
    }
  }

  if (handlers.puntos_frecuentes) {
    const r = await handlers.puntos_frecuentes({})
    return `📊 Puntos críticos más frecuentes (heurística local):\n${formatResult(r)}`
  }

  return 'No pude determinar la consulta. Pregunta por una sede (ej. "San Borja"), un cliente o los puntos frecuentes.'
}

export function mockAudit(definicion) {
  const txt = String(definicion || '')
  const m = txt.match(/Proceso(?:\s+a\s+auditar)?:\s*(.+)/i)
  const proceso = m ? m[1].split('\n')[0].trim().slice(0, 80) : 'Proceso auditado'
  return `# INFORME DE AUDITORÍA — ${proceso}
## Vulnerabilidades detectadas
- **Riesgo:** Inyección de prompt · **Descripción:** el mensaje del cliente se concatena al prompt de triaje sin delimitar; un cliente podría intentar alterar la prioridad o la sede asignada. · **Probabilidad:** Alta
- **Riesgo:** Fuga de API key · **Descripción:** en modo directo, VITE_GEMINI_API_KEY queda incrustada en el bundle del navegador y es legible desde DevTools. · **Probabilidad:** Alta
- **Riesgo:** Manipulación lógica · **Descripción:** sin validación de esquema, una respuesta malformada del modelo podría guardar una queja con prioridad inválida. · **Probabilidad:** Media
## Recomendaciones de mitigación
1. Delimitar la entrada del cliente (p. ej. envolverla en marcadores) y validar el JSON contra RECEPCION_KEYS antes de guardar.
2. Migrar las llamadas al proxy serverless (api/triage.js) y mover la key a process.env.GEMINI_API_KEY.
3. Normalizar prioridad/sentimiento a sus enums permitidos al recibir el triaje.

> Nota: informe generado por heurística local (modo MOCK, sin LLM). Con Gemini configurado se generan 5 auditorías y se consolidan los hallazgos repetidos (≥3/5).`
}

function formatResult(r) {
  if (r == null) return '  (sin datos)'
  if (typeof r === 'string') return '  ' + r
  try {
    return JSON.stringify(r, null, 2).split('\n').map((l) => '  ' + l).join('\n')
  } catch {
    return '  ' + String(r)
  }
}

function extractName(text) {
  const m = String(text || '').match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)\b/)
  return m ? m[1] : ''
}
