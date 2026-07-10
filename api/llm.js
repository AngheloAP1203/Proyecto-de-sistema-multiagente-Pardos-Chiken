/**
 * api/llm.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Proxy serverless hacia Groq (API compatible con OpenAI).
 *
 * El Asistente IA (M5) ejecuta su bucle ReAct en el navegador porque los
 * handlers de las herramientas leen el estado React/localStorage. Este endpoint
 * es un passthrough fino de chat: recibe mensajes+tools, llama a Groq con la
 * key que vive SOLO en el servidor (process.env.GROQ_API_KEY) y devuelve la
 * respuesta cruda — incluidas las tool_calls, que el cliente ejecuta.
 *
 * En desarrollo, vite.config.js monta este mismo handler en /api/llm, así que
 * el código que se prueba localmente es el mismo que corre en Vercel.
 *
 * Los errores de Groq (429 con "try again in Xs", etc.) se devuelven con su
 * status y cuerpo originales: el cliente los necesita para decidir la espera.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Solo modelos que este proyecto usa. Un proxy abierto a cualquier modelo es
// una invitación a que terceros consuman la cuota con modelos caros.
const MODELOS_PERMITIDOS = new Set(['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'])

const MAX_MESSAGES = 40      // el asistente usa ~6 vueltas; 40 es holgado
const MAX_BODY_CHARS = 60000 // corta payloads absurdos antes de gastar tokens

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'GROQ_API_KEY no configurada en el servidor' })
    return
  }

  const { model = 'llama-3.3-70b-versatile', messages = [], tools, temperature = 0.3 } = req.body || {}

  if (!MODELOS_PERMITIDOS.has(model)) {
    res.status(400).json({ error: `Modelo no permitido: ${model}` })
    return
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    res.status(400).json({ error: 'messages debe ser un array de 1 a 40 mensajes' })
    return
  }
  if (JSON.stringify(messages).length > MAX_BODY_CHARS) {
    res.status(413).json({ error: 'Payload demasiado grande' })
    return
  }

  try {
    const upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        ...(Array.isArray(tools) && tools.length > 0 ? { tools } : {}),
      }),
    })

    const body = await upstream.json()
    // Passthrough del status: un 429 de Groq debe llegar como 429 al cliente,
    // con su mensaje intacto ("Please try again in Xs") para el backoff.
    res.status(upstream.status).json(body)
  } catch (err) {
    console.error('[api/llm] Error:', err)
    res.status(502).json({ error: `No se pudo contactar a Groq: ${err.message}` })
  }
}
