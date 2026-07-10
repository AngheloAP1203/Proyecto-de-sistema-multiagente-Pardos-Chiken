/**
 * src/agents/core/numberGuard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Verificación de procedencia de cifras.
 *
 * Un modelo con voz humana también miente con voz humana. Observado en pruebas
 * reales contra Gemini y Llama 3.3:
 *
 *   · Dar cifras sin llamar a ninguna herramienta.
 *       "Hoy hemos vendido S/. 1,234.56" (real: 588.40)
 *
 *   · Llamar a una herramienta y, de paso, citar cifras de otra que no consultó.
 *       Pidió el top de platos y añadió "el total cobrado es S/. 3,510.20
 *       con 158 transacciones", que nunca preguntó.
 *
 *   · Rehacer la aritmética que la herramienta ya hizo.
 *       Contó las barras de la gráfica y dijo 6 transacciones en vez de 7.
 *
 * La única defensa fiable es rastrear cada número de la respuesta hasta la
 * salida de una herramienta. Lo que no aparece ahí, se lo inventó.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Cifras de negocio: montos en soles, decimales, o conteos de entidades. */
export const CIFRAS_DE_NEGOCIO =
  /(S\s*\/|\b\d+[.,]\d{2}\b|\b\d+\s*(transacci|reserva|cliente|vip|unidad|plato|pedido))/i

// Se ignoran horas y fechas. Los porcentajes SÍ se revisan: el modelo los
// calculaba por su cuenta ("aproximadamente el 15% de las unidades").
const MONTO      = /S\/\.?\s*([\d.,]+)|\b(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})\b/g
const CONTEO     = /\b(\d[\d,]*)\s+(transacci\w*|reservas?|clientes?|unidades?|platos?|pedidos?)\b/gi
const PORCENTAJE = /\b(\d+(?:[.,]\d+)?)\s*%/g

const aNumero = (s) => parseFloat(String(s).replace(/,/g, ''))
const money   = (n) => Math.round((n + Number.EPSILON) * 100) / 100

/** Todos los valores numéricos de un objeto, redondeados. Son las cifras citables. */
export function numerosDe(valor, acc = new Set()) {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    acc.add(money(valor))
    acc.add(Math.round(valor))
  } else if (Array.isArray(valor)) {
    valor.forEach(v => numerosDe(v, acc))
  } else if (valor && typeof valor === 'object') {
    Object.values(valor).forEach(v => numerosDe(v, acc))
  }
  return acc
}

/** Números citados en el texto que no salen de ninguna herramienta. */
export function cifrasSinRespaldo(texto, resultadosDeTools) {
  const permitidos = numerosDe(resultadosDeTools)
  const citados = []

  for (const m of String(texto).matchAll(MONTO))      citados.push(aNumero(m[1] ?? m[2]))
  for (const m of String(texto).matchAll(CONTEO))     citados.push(aNumero(m[1]))
  for (const m of String(texto).matchAll(PORCENTAJE)) citados.push(aNumero(m[1].replace(',', '.')))

  return citados.filter(n => Number.isFinite(n) && !permitidos.has(n))
}

/**
 * ¿La respuesta contiene cifras que el modelo no puede justificar?
 *
 * @param {string} texto           - Respuesta final del modelo
 * @param {Array}  results         - Salidas de las tools ejecutadas
 * @param {number} toolsEjecutadas - Cuántas tools corrieron
 * @returns {{ invento: boolean, sinRespaldo: number[] }}
 */
/**
 * Corte que retiene las `n` últimas palabras del buffer.
 *
 * Se verifica UNA palabra más adelante de lo que se emite, y esa asimetría es
 * deliberada:
 *
 *   · Retener 1 palabra al verificar → la última palabra del texto revisado está
 *     completa. Sin esto, "S/. 84.0" (a medio llegar) parecería una cifra falsa.
 *   · Retener 2 al emitir → un número nunca sale a pantalla antes de conocer la
 *     palabra que lo sigue. Sin esto, el "158" de "158 transacciones" ya estaría
 *     visible cuando descubriéramos que es inventado.
 */
function corteRetentendo(buffer, palabras) {
  let idx = buffer.length
  for (let i = 0; i < palabras; i++) {
    idx = buffer.lastIndexOf(' ', idx - 1)
    if (idx < 0) return 0
  }
  return idx + 1
}

/**
 * crearFiltroDeCifras — Emisor de streaming que nunca deja pasar una cifra sin
 * respaldo. El texto fluye token a token; los números se retienen hasta estar
 * completos y verificados contra la salida de las herramientas.
 *
 * @param {Array}    results - Salidas de las tools ya ejecutadas
 * @param {Function} emitir  - Recibe los fragmentos seguros
 * @returns {{ push, flush, hayInvento }}
 */
export function crearFiltroDeCifras(results, emitir) {
  let buffer = ''
  let invento = false

  /** ¿La región (que termina en palabra completa) cita alguna cifra sin respaldo? */
  const limpio = (region) => {
    if (invento) return false
    if (region && cifrasSinRespaldo(region, results).length > 0) {
      invento = true      // se corta la emisión: la mentira no llega a pantalla
      return false
    }
    return true
  }

  return {
    push(delta) {
      buffer += delta
      if (invento) return

      // Verifica hasta la última palabra completa; emite una palabra por detrás.
      if (!limpio(buffer.slice(0, corteRetentendo(buffer, 1)))) return

      const corte = corteRetentendo(buffer, 2)
      if (corte === 0) return

      emitir(buffer.slice(0, corte))
      buffer = buffer.slice(corte)
    },

    flush() {
      // Un turno que solo pide herramientas no produce texto: no emitas nada.
      if (buffer && limpio(buffer)) emitir(buffer)
      buffer = ''
    },

    get hayInvento() { return invento },
  }
}

export function verificarCifras(texto, results, toolsEjecutadas) {
  if (toolsEjecutadas === 0) {
    const invento = CIFRAS_DE_NEGOCIO.test(texto)
    return { invento, sinRespaldo: [], motivo: invento ? 'dio cifras sin llamar a ninguna herramienta' : null }
  }

  const sinRespaldo = cifrasSinRespaldo(texto, results)
  return {
    invento: sinRespaldo.length > 0,
    sinRespaldo,
    motivo: sinRespaldo.length > 0 ? `cifras que ninguna herramienta devolvió: ${sinRespaldo.join(', ')}` : null,
  }
}
