/**
 * src/agents/core/responseCache.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Caché de respuestas del Asistente IA (en memoria, por sesión).
 *
 * POR QUÉ EXISTE:
 *   Los free tiers se agotan por tokens, no por peticiones (Groq 70B: 100K/día;
 *   cada consulta con herramienta cuesta ~4-5K). En una demo las preguntas se
 *   repiten mucho: servirlas del caché multiplica el presupuesto real.
 *
 * POR QUÉ ES SEGURO:
 *   La clave incluye el ROL (una respuesta de admin jamás se sirve a un cajero),
 *   una HUELLA de los datos (una venta nueva invalida todo lo que dependa de
 *   pagos) y el CONTEXTO reciente de la conversación ("¿y el ticket promedio?"
 *   con historial distinto es otra consulta). Además caduca por tiempo.
 *
 * QUÉ NO SE CACHEA:
 *   Respuestas degradadas, bloqueadas o con error. Solo éxitos verificados.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TTL_MS = 10 * 60 * 1000   // 10 min: una demo entera, sin arrastrar sesiones
const MAX_ENTRIES = 50          // suficiente para una sesión; evita crecer sin tope

const _store = new Map()

/** Normalización idéntica a la del prompt: la clave no distingue tildes ni mayúsculas. */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Hash djb2 — barato y suficiente para claves de caché (no es criptográfico). */
function hash(texto) {
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/**
 * Huella de los datos del sistema. Si cambia cualquier cosa de la que dependen
 * las herramientas (un pago nuevo, una reserva, un cliente), la huella cambia y
 * las entradas viejas dejan de servirse.
 */
export function huellaDeDatos(contextData = {}) {
  const pagos    = contextData.payments     || []
  const reservas = contextData.reservations || []
  const clientes = contextData.clients      || []

  const totalPagos = pagos.reduce((s, p) => s + (p.amount || 0), 0)
  const ultimoPago = pagos[pagos.length - 1]?.id || ''
  const estados    = reservas.map(r => r.status).join(',')

  return hash(`${pagos.length}|${Math.round(totalPagos * 100)}|${ultimoPago}|${reservas.length}|${estados}|${clientes.length}`)
}

/**
 * Clave de una consulta. Incluye las 2 últimas vueltas del historial: la misma
 * pregunta con otro contexto conversacional ("¿y el ticket promedio?") es otra
 * entrada, no un falso acierto.
 */
export function claveDeConsulta({ prompt, role, contextData, history = [] }) {
  const recientes = history.slice(-2).map(t => normalizar(t.content)).join('→')
  return `${role}::${normalizar(prompt)}::${huellaDeDatos(contextData)}::${hash(recientes)}`
}

export function obtener(clave) {
  const entrada = _store.get(clave)
  if (!entrada) return null

  if (Date.now() - entrada.guardadoEn > TTL_MS) {
    _store.delete(clave)
    return null
  }
  return entrada.result
}

export function guardar(clave, result) {
  // Solo éxitos completos. Un fallback o un bloqueo debe recalcularse siempre.
  if (!result?.success || result.degraded || result.blocked) return

  if (_store.size >= MAX_ENTRIES) {
    // FIFO: la primera clave insertada es la más vieja
    _store.delete(_store.keys().next().value)
  }
  _store.set(clave, { result, guardadoEn: Date.now() })
}

export function vaciar() {
  _store.clear()
}

export function estadisticas() {
  return { entradas: _store.size, ttlMs: TTL_MS }
}
