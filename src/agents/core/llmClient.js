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
const GROQ_KEY = ENV.VITE_GROQ_API_KEY || ''
const PROVIDER = (ENV.VITE_LLM_PROVIDER || '').toLowerCase()

const MAX_RETRIES = 3
const MAX_TOOL_TURNS = 6

export const llmMode =
  useProxy                          ? 'proxy'
  : (PROVIDER === 'groq' && GROQ_KEY) ? 'groq'
  : API_KEY                           ? 'gemini'
  : 'mock'

// Cada proveedor tiene su modelo por defecto. Ningún agente fija el suyo.
// VITE_LLM_MODEL permite sobreescribirlo (útil: los límites de tokens de Groq
// son por modelo, así que se puede cambiar de modelo al agotar una bolsa).
// El proxy (/api/llm) habla con Groq, así que comparte su default.
const DEFAULT_MODEL =
  ENV.VITE_LLM_MODEL ||
  (llmMode === 'groq' || llmMode === 'proxy' ? 'llama-3.3-70b-versatile' : 'gemini-2.5-flash')

/** Modelo realmente en uso. La UI lo muestra: nunca debe mentir sobre quién respondió. */
export const llmModel = llmMode === 'mock' ? null : DEFAULT_MODEL

if (llmMode === 'mock') {
  console.warn(
    '[llmClient] Sin API key → modo MOCK (heurística local). ' +
    'Configura .env con VITE_GEMINI_API_KEY o VITE_GROQ_API_KEY para usar un LLM real.'
  )
}

// ── Carga perezosa de LangChain (cae a MOCK si falla) ───────────────────────
let _langchainPromise = null

async function getLangChainModel(opts = {}) {
  if (llmMode === 'mock') return null

  // En modo proxy el "modelo" es un adaptador que llama a /api/llm: misma
  // interfaz (bindTools/invoke/stream), pero la key vive solo en el servidor.
  if (llmMode === 'proxy') {
    return new ProxyChat({
      model: opts.model || DEFAULT_MODEL,
      temperature: opts.temperature ?? 0.3,
    })
  }

  if (!_langchainPromise) {
    // Los especificadores deben ser literales: Vite no resuelve import() con variable.
    _langchainPromise = (llmMode === 'groq'
      ? import('@langchain/groq')
      : import('@langchain/google-genai')
    ).catch((e) => {
      console.warn('[llmClient] No se pudo cargar el conector LLM, usando MOCK:', e.message)
      return null
    })
  }
  const mod = await _langchainPromise
  if (!mod) return null

  const config = {
    model: opts.model || DEFAULT_MODEL,
    temperature: opts.temperature ?? 0.3,
    ...(opts.extra || {}),
  }

  if (llmMode === 'groq') {
    // La key viaja al navegador (prefijo VITE_). Ver deuda del proxy en api/triage.js.
    return new mod.ChatGroq({ ...config, apiKey: GROQ_KEY })
  }
  return new mod.ChatGoogleGenerativeAI({ ...config, apiKey: API_KEY })
}

/**
 * normalizeTools — Traduce el formato de tools de Gemini al genérico de LangChain.
 *
 * Los agentes declaran sus tools como `[{ functionDeclarations: [...] }]` (formato
 * nativo de Gemini). Groq es compatible con OpenAI y rechaza ese formato con
 * "property 'type' is missing". La forma genérica `{ name, description, schema }`
 * la entienden ambos, pero la conversión solo se aplica fuera de Gemini para no
 * alterar el comportamiento ya verificado.
 */
function normalizeTools(tools) {
  if (llmMode === 'gemini' || !Array.isArray(tools)) return tools

  const declaraciones = tools.flatMap(t => t.functionDeclarations || [])
  if (declaraciones.length === 0) return tools

  return declaraciones.map(d => ({
    name: d.name,
    description: d.description,
    schema: d.parameters || { type: 'object', properties: {} },
  }))
}

/**
 * getChatModel — Modelo LangChain crudo, ya ligado a las tools del rol.
 *
 * Lo usa assistantGraph.js, que necesita controlar el bucle ReAct nodo a nodo
 * en vez de delegarlo en completeWithTools. Devuelve null en modo mock/proxy.
 */
export async function getChatModel({ tools, temperature, model } = {}) {
  const llm = await getLangChainModel({ model, temperature })
  if (!llm) return null
  return tools ? llm.bindTools(normalizeTools(tools)) : llm
}

// ── Adaptador de chat para el modo proxy ─────────────────────────────────────

/**
 * toOpenAIMessages — Convierte mensajes LangChain al formato OpenAI que espera
 * /api/llm. Cubre los cuatro tipos que produce el asistente: system, human,
 * ai (con o sin tool_calls) y tool (con su tool_call_id).
 */
export function toOpenAIMessages(messages) {
  return (messages || []).map((msg) => {
    const tipo = msg.getType?.() ?? msg._getType?.() ?? msg.role
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '')

    if (tipo === 'system') return { role: 'system', content }
    if (tipo === 'human' || tipo === 'user') return { role: 'user', content }

    if (tipo === 'tool') {
      return { role: 'tool', tool_call_id: msg.tool_call_id || msg.name || '', content }
    }

    // 'ai' / 'assistant'
    const out = { role: 'assistant', content }
    if (msg.tool_calls?.length) {
      out.tool_calls = msg.tool_calls.map((tc) => ({
        id: tc.id || tc.name,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
      }))
    }
    return out
  })
}

/**
 * ProxyChat — Chat-model mínimo que habla con /api/llm en vez de con Groq
 * directo. Implementa la interfaz que usan el grafo y completeWithTools
 * (bindTools / invoke / stream), así que ninguno se entera del cambio.
 *
 * `stream()` emite la respuesta completa en un solo fragmento: el proxy no
 * retransmite tokens. Es un intercambio deliberado — granularidad de streaming
 * a cambio de que la key no viaje al navegador — y está documentado, no oculto.
 */
export class ProxyChat {
  constructor({ model, temperature, tools = null, url = '/api/llm' }) {
    this.model = model
    this.temperature = temperature
    this.tools = tools
    this.url = url
  }

  /** Recibe el formato genérico de normalizeTools y lo traduce a OpenAI. */
  bindTools(tools) {
    const openaiTools = (tools || []).map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.schema || { type: 'object', properties: {} },
      },
    }))
    return new ProxyChat({ model: this.model, temperature: this.temperature, tools: openaiTools, url: this.url })
  }

  async invoke(messages) {
    const { AIMessage } = await import('@langchain/core/messages')

    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        messages: toOpenAIMessages(messages),
        ...(this.tools?.length ? { tools: this.tools } : {}),
      }),
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      // El status y el mensaje original de Groq deben sobrevivir: withRetry
      // decide la espera leyendo "Please try again in Xs" del cuerpo.
      throw Object.assign(new Error(JSON.stringify(body)), { status: res.status })
    }

    const mensaje = body.choices?.[0]?.message || {}
    const toolCalls = (mensaje.tool_calls || []).map((tc) => {
      let args = {}
      try {
        const parseado = JSON.parse(tc.function?.arguments || '{}')
        if (parseado && typeof parseado === 'object') args = parseado
      } catch { /* argumentos malformados: la tool corre con sus defaults */ }
      return { id: tc.id || tc.function?.name, name: tc.function?.name, args, type: 'tool_call' }
    })

    return new AIMessage({ content: mensaje.content ?? '', tool_calls: toolCalls })
  }

  /** Una sola emisión con la respuesta completa (ver nota de la clase). */
  async *_streamImpl(messages) {
    yield await this.invoke(messages)
  }

  stream(messages) {
    return Promise.resolve(this._streamImpl(messages))
  }
}

// Limpia posibles cercos ```json que el modelo agrega
function safeParseJSON(text) {
  const clean = String(text).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  return JSON.parse(clean)
}

const MAX_BACKOFF_MS = 8000

/**
 * Gemini y Groq indican en el propio error cuánto falta para que se libere la
 * cuota ("Please try again in 6.6s"). Respetarlo evita reintentar demasiado
 * pronto y agotar los intentos por unas décimas de segundo.
 */
function esperaSugerida(err) {
  const texto = String(err?.message || '')
  // "try again in 6.6s" · "try again in 26m41.856s" · Gemini: retryDelay:"48s"
  const m = texto.match(/try again in (?:(\d+)m)?([\d.]+)\s*s/i) || texto.match(/retryDelay"\s*:\s*"(\d+)s/i)
  if (!m) return null

  const segundos = m.length === 3
    ? (parseInt(m[1] || 0, 10) * 60) + parseFloat(m[2])
    : parseFloat(m[1])

  return Number.isFinite(segundos) ? Math.ceil(segundos * 1000) + 300 : null
}

// Reintento ante 429/503, respetando la espera que pide el proveedor
async function withRetry(fn, { retries = MAX_RETRIES, label = 'llm' } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const status = err?.status ?? err?.response?.status
      const retryable = status === 429 || status === 503
      if (!retryable || attempt === retries) break

      const sugerida = esperaSugerida(err)
      const waitMs = Math.min(sugerida ?? 2 ** attempt * 1000, MAX_BACKOFF_MS)

      // Si la cuota tarda más de lo que estamos dispuestos a esperar, degradamos ya.
      if (sugerida && sugerida > MAX_BACKOFF_MS) {
        console.warn(`[llmClient] ${label}: cuota agotada por ${Math.round(sugerida / 1000)}s. No reintento.`)
        break
      }

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
  // En modo proxy getLangChainModel devuelve ProxyChat: el bucle ReAct corre
  // igual, solo que cada llamada al modelo pasa por /api/llm.
  const llm = await getLangChainModel({ model, temperature })
  if (!llm) return mockTools(prompt, handlers)

  return withRetry(async () => {
    const { HumanMessage, SystemMessage, AIMessage } = await import('@langchain/core/messages')

    // En LangChain v1 el método es bindTools(); `bind({ tools })` ya no existe.
    const modelWithTools = llm.bindTools(normalizeTools(tools))
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
