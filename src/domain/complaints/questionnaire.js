/**
 * src/domain/complaints/questionnaire.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cuestionario guiado de quejas del cliente (M6 / M1).
 *
 * Preguntas CERRADAS (opción única) + una pregunta ABIERTA final. Las respuestas
 * cerradas anclan la severidad de forma DETERMINISTA (regla de negocio), de modo
 * que el LLM solo redacta el mensaje empático — no decide la gravedad.
 *
 * Para AJUSTAR el cuestionario: edita `PREGUNTAS`. Cada opción puede declarar una
 * `severidad` y un `punto` (punto crítico) que alimentan el análisis.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const SEVERIDADES = ['Baja', 'Media', 'Alta', 'Crítica']
const RANK = { Baja: 0, Media: 1, Alta: 2, Crítica: 3 }

/**
 * Preguntas cerradas. `id` es la clave en el objeto de respuestas.
 * `tipo`: 'opcion' (tarjetas) | 'rating' (estrellas 1–5).
 */
export const PREGUNTAS = [
  {
    id: 'problema',
    tipo: 'opcion',
    titulo: '¿Cuál fue el problema principal?',
    opciones: [
      { valor: 'demora',    label: 'Demora en la atención',        punto: 'Tiempo de espera', severidad: 'Alta' },
      { valor: 'comida',    label: 'Comida fría o en mal estado',  punto: 'Calidad de comida', severidad: 'Crítica' },
      { valor: 'cobro',     label: 'Error en el pedido o el cobro', punto: 'Error de cobro',   severidad: 'Crítica' },
      { valor: 'trato',     label: 'Trato del personal',           punto: 'Atención al cliente', severidad: 'Alta' },
      { valor: 'limpieza',  label: 'Limpieza del local',           punto: 'Limpieza',         severidad: 'Media' },
      { valor: 'otro',      label: 'Otro',                         punto: 'Otro',             severidad: 'Media' },
    ],
  },
  {
    id: 'area',
    tipo: 'opcion',
    titulo: '¿Qué área se vio afectada?',
    opciones: [
      { valor: 'comida',    label: 'Comida',            punto: 'Área: Comida' },
      { valor: 'servicio',  label: 'Servicio',          punto: 'Área: Servicio' },
      { valor: 'limpieza',  label: 'Limpieza',          punto: 'Área: Limpieza' },
      { valor: 'espera',    label: 'Tiempo de espera',  punto: 'Área: Espera' },
      { valor: 'cobro',     label: 'Cobro',             punto: 'Área: Cobro' },
    ],
  },
  {
    id: 'satisfaccion',
    tipo: 'rating',
    titulo: '¿Qué tan satisfecho quedaste?',
    // severidad por nivel: 1–2 Alta, 3 Media, 4–5 Baja
    ratingSeveridad: { 1: 'Alta', 2: 'Alta', 3: 'Media', 4: 'Baja', 5: 'Baja' },
  },
  {
    id: 'volveria',
    tipo: 'opcion',
    titulo: '¿Volverías a Pardos?',
    opciones: [
      { valor: 'si',      label: 'Sí' },
      { valor: 'talvez',  label: 'Tal vez' },
      { valor: 'no',      label: 'No', severidad: 'Alta', punto: 'Riesgo de pérdida del cliente' },
    ],
  },
]

/** Pregunta abierta final (opcional). */
export const PREGUNTA_ABIERTA = {
  id: 'comentario',
  titulo: '¿Deseas agregar algo más?',
  placeholder: 'Cuéntanos con tus palabras qué pasó (opcional)…',
}

const findOpcion = (pregunta, valor) => pregunta.opciones?.find(o => o.valor === valor)

/**
 * analizarRespuestas — Deriva severidad + puntos críticos de forma DETERMINISTA
 * a partir de las respuestas cerradas.
 *
 * @param {Object} respuestas - { problema, area, satisfaccion, volveria, comentario }
 * @returns {{ severidad: string, puntos_criticos: string[] }}
 */
export function analizarRespuestas(respuestas = {}) {
  let severidad = 'Baja'
  const puntos = []
  const subir = (s) => { if (s && RANK[s] > RANK[severidad]) severidad = s }

  for (const p of PREGUNTAS) {
    if (p.tipo === 'rating') {
      const n = Number(respuestas[p.id])
      if (n) subir(p.ratingSeveridad?.[n])
      continue
    }
    const op = findOpcion(p, respuestas[p.id])
    if (op) {
      subir(op.severidad)
      if (op.punto) puntos.push(op.punto)
    }
  }

  return { severidad, puntos_criticos: puntos }
}

/**
 * respuestasATexto — Convierte las respuestas en un mensaje en lenguaje natural,
 * para que el LLM lo use como contexto al redactar la respuesta al cliente.
 */
export function respuestasATexto(respuestas = {}) {
  const partes = []
  for (const p of PREGUNTAS) {
    if (p.tipo === 'rating') {
      if (respuestas[p.id]) partes.push(`${p.titulo} ${respuestas[p.id]}/5`)
      continue
    }
    const op = findOpcion(p, respuestas[p.id])
    if (op) partes.push(`${p.titulo} ${op.label}`)
  }
  if (respuestas.comentario?.trim()) partes.push(`Comentario del cliente: "${respuestas.comentario.trim()}"`)
  return partes.join('. ')
}
