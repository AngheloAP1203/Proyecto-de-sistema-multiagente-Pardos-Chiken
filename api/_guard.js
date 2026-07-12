/**
 * api/_guard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Controles de acceso compartidos para los proxies serverless (/api/llm, /api/triage).
 *
 * El prefijo "_" hace que Vercel NO lo trate como un endpoint: es un módulo
 * auxiliar, no una ruta. Ambos proxies lo importan.
 *
 * Qué protege (hallazgo F-01 de la auditoría):
 *   1. Allowlist de origen — solo el propio front (mismo host) o los dominios
 *      declarados en ALLOWED_ORIGINS pueden usar el proxy. Corta el abuso desde
 *      otras webs / scraping casual que agotaría la cuota de Groq/Gemini.
 *   2. Rate-limit por IP — ventana deslizante en memoria. Frena el "quota DoS":
 *      un cliente que dispara miles de peticiones para vaciar la bolsa de tokens.
 *
 * Nota honesta de alcance: el rate-limit vive en memoria del proceso, así que es
 * POR INSTANCIA serverless (Vercel puede tener varias calientes). Sube el listón
 * de forma real contra abuso simple; para límites duros globales se necesitaría
 * un store compartido (Upstash/Redis). Se documenta como mejora futura.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Allowlist de origen ───────────────────────────────────────────────────────
/** Hosts extra permitidos, separados por coma en la env ALLOWED_ORIGINS. */
function origenesPermitidos(req) {
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  // El propio dominio del despliegue siempre está permitido (mismo origen).
  const host = String(req.headers.host || '').toLowerCase()
  const propios = host ? [host] : []
  // Desarrollo local: vite sirve el front y monta estos handlers.
  const locales = ['localhost:5173', '127.0.0.1:5173', 'localhost:3000']
  return new Set([...propios, ...locales, ...extra])
}

/** Extrae el host de una URL de Origin/Referer ("https://x.com/y" → "x.com"). */
function hostDe(url) {
  if (!url) return ''
  try { return new URL(url).host.toLowerCase() } catch { return '' }
}

/**
 * verificarOrigen — true si la petición viene de un origen permitido.
 *
 * Los navegadores mandan Origin en peticiones POST (incluido mismo-origen); si
 * falta, se cae a Referer. Una petición sin ninguno de los dos (curl "pelado")
 * se rechaza: el front legítimo siempre los envía.
 */
export function verificarOrigen(req) {
  const permitidos = origenesPermitidos(req)
  const origen = hostDe(req.headers.origin) || hostDe(req.headers.referer)
  if (!origen) return false
  return permitidos.has(origen)
}

// ── Rate-limit por IP (ventana deslizante, en memoria) ────────────────────────
const _hits = new Map() // ip → number[] (timestamps ms)

/** IP del cliente detrás del proxy de Vercel. */
function ipDe(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return fwd || req.socket?.remoteAddress || 'desconocida'
}

/**
 * rateLimit — true si la petición está DENTRO del límite; false si lo excede.
 *
 * @param {object} req
 * @param {object} [opts]  { max = 30 peticiones, windowMs = 60_000 }
 */
export function rateLimit(req, { max = 30, windowMs = 60_000 } = {}) {
  const ip = ipDe(req)
  const ahora = Date.now()
  const desde = ahora - windowMs
  const previos = (_hits.get(ip) || []).filter(t => t > desde)
  previos.push(ahora)
  _hits.set(ip, previos)

  // Limpieza oportunista para que el Map no crezca sin fin en instancias calientes.
  if (_hits.size > 5000) {
    for (const [k, v] of _hits) {
      if (v.every(t => t <= desde)) _hits.delete(k)
    }
  }
  return previos.length <= max
}

/**
 * aplicarGuard — Aplica origen + rate-limit y responde el error si corresponde.
 * Devuelve true si la petición puede continuar, false si ya fue respondida.
 */
export function aplicarGuard(req, res, rateOpts) {
  if (!verificarOrigen(req)) {
    res.status(403).json({ error: 'Origen no autorizado.' })
    return false
  }
  if (!rateLimit(req, rateOpts)) {
    res.setHeader('Retry-After', '60')
    res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' })
    return false
  }
  return true
}
