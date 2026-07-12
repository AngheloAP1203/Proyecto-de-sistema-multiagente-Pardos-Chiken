/**
 * api/triage.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Función serverless (Vercel) que actúa como PROXY hacia Google Gemini.
 *
 * Se usa cuando el front arranca con VITE_USE_PROXY=true: así la API key vive solo
 * en el servidor (process.env.GEMINI_API_KEY) y NUNCA se expone en el bundle.
 *
 * Modos soportados (campo `mode` del body):
 *   · 'json' → triaje (M1): devuelve el objeto JSON parseado.
 *   · 'text' → auditoría (M3): devuelve { text }.
 *
 * Nota: el function calling del líder (M2) corre client-side (sus handlers leen el
 * estado React), por eso aquí solo se cubren json/text.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { aplicarGuard } from './_guard.js'

const DEFAULT_MODEL = 'gemini-2.5-flash'

function parseJSON(text) {
  const clean = String(text).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  return JSON.parse(clean)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }

  // Control de acceso (F-01): origen permitido + rate-limit por IP.
  if (!aplicarGuard(req, res, { max: 40, windowMs: 60_000 })) return

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor' })
    return
  }

  try {
    const { mode = 'text', system, prompt, schema, temperature = 0.3, model = DEFAULT_MODEL } = req.body || {}
    const genAI = new GoogleGenerativeAI(apiKey)

    const generationConfig = { temperature }
    if (mode === 'json') {
      generationConfig.responseMimeType = 'application/json'
      if (schema) generationConfig.responseSchema = schema
    }

    const gen = genAI.getGenerativeModel({ model, systemInstruction: system, generationConfig })
    const result = await gen.generateContent(prompt)
    const text = result.response.text()

    if (mode === 'json') {
      res.status(200).json(parseJSON(text))
    } else {
      res.status(200).json({ text })
    }
  } catch (err) {
    console.error('[api/triage] Error:', err)
    res.status(500).json({ error: err.message })
  }
}
