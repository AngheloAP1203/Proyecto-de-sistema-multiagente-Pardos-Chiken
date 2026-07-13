/**
 * src/domain/complaints/questionnaire.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cuestionario guiado de quejas del cliente (M6 / M1).
 *
 * Preguntas CERRADAS (opción única) + una pregunta ABIERTA final. Las respuestas
 * cerradas anclan la severidad de forma DETERMINISTA (regla de negocio), de modo
 * que el LLM solo redacta el mensaje empático — no decide la gravedad.
 *
 * CATEGORÍAS que alimentan al LeaderAnalystAgent:
 *   - Calidad del Producto (sabor, temperatura, presentación)
 *   - Tiempos de Atención
 *   - Actitud y Amabilidad del Personal
 *   - Higiene y Ambiente del Local
 *   - Precisión del Pedido y Cobro
 *   - Satisfacción General
 *   - Fidelización (¿volvería?)
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
  // ── 1. Categoría principal del problema ─────────────────────────────────
  {
    id: 'categoria',
    tipo: 'opcion',
    titulo: '¿En qué área tuviste el inconveniente?',
    subtitulo: 'Selecciona la que mejor describa tu experiencia.',
    opciones: [
      { valor: 'comida',    label: '🍗 Calidad de la comida',     punto: 'Calidad del producto',    severidad: 'Alta' },
      { valor: 'servicio',  label: '🤝 Atención del personal',    punto: 'Atención al cliente',     severidad: 'Alta' },
      { valor: 'tiempos',   label: '⏱️ Demora en la atención',    punto: 'Tiempo de espera',        severidad: 'Media' },
      { valor: 'cobro',     label: '💰 Error en pedido o cobro',  punto: 'Precisión pedido/cobro',  severidad: 'Crítica' },
      { valor: 'ambiente',  label: '🏠 Limpieza o ambiente',      punto: 'Higiene y ambiente',      severidad: 'Media' },
      { valor: 'otro',      label: '📌 Otro problema',            punto: 'Otro',                    severidad: 'Media' },
    ],
  },

  // ── 2. Detalle del problema (comida) ────────────────────────────────────
  {
    id: 'detalle_comida',
    tipo: 'opcion',
    titulo: '¿Qué pasó exactamente con tu comida?',
    subtitulo: 'Esto nos ayuda a identificar si el problema viene de cocina o del despacho.',
    condicion: (r) => r.categoria === 'comida',
    opciones: [
      { valor: 'fria',         label: 'Llegó fría o tibia',               punto: 'Comida fría',               severidad: 'Alta' },
      { valor: 'mal_sabor',    label: 'Sabor desagradable o diferente',   punto: 'Sabor incorrecto',          severidad: 'Alta' },
      { valor: 'cruda',        label: 'Cruda o mal cocida',               punto: 'Cocción inadecuada',        severidad: 'Crítica' },
      { valor: 'presentacion', label: 'Mala presentación del plato',      punto: 'Presentación deficiente',   severidad: 'Media' },
      { valor: 'porcion',      label: 'Porción muy pequeña',              punto: 'Porción insuficiente',      severidad: 'Media' },
      { valor: 'contaminado',  label: 'Encontré algo extraño en el plato', punto: 'Contaminación / cuerpo extraño', severidad: 'Crítica' },
    ],
  },

  // ── 3. Detalle del problema (servicio) ──────────────────────────────────
  {
    id: 'detalle_servicio',
    tipo: 'opcion',
    titulo: '¿Cómo describirías la atención recibida?',
    subtitulo: 'Tu respuesta nos ayuda a capacitar mejor a nuestro equipo.',
    condicion: (r) => r.categoria === 'servicio',
    opciones: [
      { valor: 'descortes',     label: 'Trato descortés o indiferente',     punto: 'Personal descortés',        severidad: 'Alta' },
      { valor: 'ignorado',      label: 'Me ignoraron o tardaron en atenderme', punto: 'Falta de atención',      severidad: 'Alta' },
      { valor: 'pedido_mal',    label: 'Trajeron un plato que no pedí',     punto: 'Pedido equivocado',         severidad: 'Crítica' },
      { valor: 'sin_info',      label: 'No me supieron informar del menú',  punto: 'Falta de información',      severidad: 'Media' },
      { valor: 'actitud',       label: 'Actitud negativa o mala disposición', punto: 'Actitud del personal',    severidad: 'Alta' },
    ],
  },

  // ── 4. Detalle del problema (tiempos) ───────────────────────────────────
  {
    id: 'detalle_tiempos',
    tipo: 'opcion',
    titulo: '¿En qué momento sentiste la demora?',
    subtitulo: 'Saber el momento exacto nos permite enfocar la mejora.',
    condicion: (r) => r.categoria === 'tiempos',
    opciones: [
      { valor: 'espera_mesa',     label: 'Esperé mucho para que me asignen mesa', punto: 'Demora asignación mesa',    severidad: 'Media' },
      { valor: 'espera_pedido',   label: 'Tardaron en tomar mi pedido',           punto: 'Demora toma de pedido',     severidad: 'Media' },
      { valor: 'espera_comida',   label: 'La comida demoró demasiado',            punto: 'Demora preparación comida', severidad: 'Alta' },
      { valor: 'espera_cuenta',   label: 'Tardaron en traer la cuenta',           punto: 'Demora en la cuenta',       severidad: 'Media' },
    ],
  },

  // ── 5. Detalle del problema (cobro) ─────────────────────────────────────
  {
    id: 'detalle_cobro',
    tipo: 'opcion',
    titulo: '¿Qué pasó con tu pedido o el cobro?',
    subtitulo: 'Los errores de cobro son nuestro problema más prioritario.',
    condicion: (r) => r.categoria === 'cobro',
    opciones: [
      { valor: 'cobro_mas',      label: 'Me cobraron de más',                     punto: 'Sobrecobro',               severidad: 'Crítica' },
      { valor: 'plato_no_pedido', label: 'Me cobraron un plato que no pedí',       punto: 'Cobro de plato no pedido', severidad: 'Crítica' },
      { valor: 'falta_plato',    label: 'Pagué algo que nunca llegó',              punto: 'Plato no entregado',       severidad: 'Crítica' },
      { valor: 'precio_diff',    label: 'El precio era distinto a la carta',       punto: 'Discrepancia de precios',  severidad: 'Alta' },
    ],
  },

  // ── 6. Detalle del problema (ambiente) ──────────────────────────────────
  {
    id: 'detalle_ambiente',
    tipo: 'opcion',
    titulo: '¿Qué aspecto del local te incomodó?',
    subtitulo: 'Queremos que tu experiencia sea cómoda de principio a fin.',
    condicion: (r) => r.categoria === 'ambiente',
    opciones: [
      { valor: 'mesa_sucia',     label: 'Mesa o cubiertos sucios',         punto: 'Higiene de mesa',      severidad: 'Alta' },
      { valor: 'bano',           label: 'Baños en mal estado',             punto: 'Higiene de baños',     severidad: 'Alta' },
      { valor: 'ruido',          label: 'Demasiado ruido',                 punto: 'Ruido ambiental',      severidad: 'Baja' },
      { valor: 'temperatura',    label: 'Temperatura incómoda (frío/calor)', punto: 'Climatización',      severidad: 'Baja' },
      { valor: 'olor',           label: 'Malos olores',                    punto: 'Olores desagradables', severidad: 'Media' },
    ],
  },

  // ── 7. Impacto en la experiencia ────────────────────────────────────────
  {
    id: 'impacto',
    tipo: 'opcion',
    titulo: '¿Cómo afectó esto tu experiencia?',
    subtitulo: 'Nos ayuda a medir la gravedad real del incidente.',
    opciones: [
      { valor: 'arruino',       label: 'Arruinó mi visita por completo',  punto: 'Experiencia arruinada',   severidad: 'Crítica' },
      { valor: 'molesto',       label: 'Me molestó bastante',             punto: 'Molestia considerable',   severidad: 'Alta' },
      { valor: 'incomodo',      label: 'Fue incómodo pero tolerable',     punto: 'Incomodidad menor',       severidad: 'Media' },
      { valor: 'menor',         label: 'Algo menor, pero lo quiero reportar', punto: 'Reporte preventivo',  severidad: 'Baja' },
    ],
  },

  // ── 8. Satisfacción general ─────────────────────────────────────────────
  {
    id: 'satisfaccion',
    tipo: 'rating',
    titulo: 'Del 1 al 5, ¿cómo calificarías tu visita en general?',
    subtitulo: '1 = Pésima · 5 = Excelente',
    // severidad por nivel: 1–2 Alta, 3 Media, 4–5 Baja
    ratingSeveridad: { 1: 'Crítica', 2: 'Alta', 3: 'Media', 4: 'Baja', 5: 'Baja' },
  },

  // ── 9. Fidelización ─────────────────────────────────────────────────────
  {
    id: 'recomendaria',
    tipo: 'opcion',
    titulo: '¿Nos recomendarías a un amigo o familiar?',
    subtitulo: 'Sé sincero/a, esto es confidencial.',
    opciones: [
      { valor: 'si',         label: '👍 Sí, sin duda' },
      { valor: 'con_reservas', label: '🤔 Con algunas reservas' },
      { valor: 'no',         label: '👎 No lo haría',    severidad: 'Alta', punto: 'No recomendaría el local' },
    ],
  },

  // ── 10. Intención de retorno ────────────────────────────────────────────
  {
    id: 'volveria',
    tipo: 'opcion',
    titulo: '¿Volverías a visitarnos?',
    subtitulo: 'Tu respuesta es muy valiosa para nosotros.',
    opciones: [
      { valor: 'si',      label: '✅ Sí, volvería' },
      { valor: 'talvez',  label: '🤷 Tal vez, depende' },
      { valor: 'no',      label: '❌ No volvería',     severidad: 'Alta', punto: 'Riesgo de pérdida del cliente' },
    ],
  },
]

/** Pregunta abierta final (opcional). */
export const PREGUNTA_ABIERTA = {
  id: 'comentario',
  titulo: '¿Hay algo más que quieras contarnos?',
  placeholder: 'Cuéntanos con tus palabras qué pasó. Cada detalle nos ayuda a mejorar (opcional)…',
}

const findOpcion = (pregunta, valor) => pregunta.opciones?.find(o => o.valor === valor)

/**
 * preguntasVisibles — Filtra las preguntas según las respuestas ya dadas
 * (por ejemplo, solo muestra "detalle_comida" si eligió "comida" como categoría).
 */
export function preguntasVisibles(respuestas = {}) {
  return PREGUNTAS.filter(p => !p.condicion || p.condicion(respuestas))
}

/**
 * analizarRespuestas — Deriva severidad + puntos críticos de forma DETERMINISTA
 * a partir de las respuestas cerradas.
 *
 * @param {Object} respuestas - { categoria, detalle_comida, ..., satisfaccion, volveria, comentario }
 * @returns {{ severidad: string, puntos_criticos: string[] }}
 */
export function analizarRespuestas(respuestas = {}) {
  let severidad = 'Baja'
  const puntos = []
  const subir = (s) => { if (s && RANK[s] > RANK[severidad]) severidad = s }

  for (const p of preguntasVisibles(respuestas)) {
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
  for (const p of preguntasVisibles(respuestas)) {
    if (p.tipo === 'rating') {
      if (respuestas[p.id]) partes.push(`${p.titulo} ${respuestas[p.id]}/5`)
      continue
    }
    const op = findOpcion(p, respuestas[p.id])
    if (op) partes.push(`${p.titulo} ${op.label.replace(/^[^\w]+/, '')}`)
  }
  if (respuestas.comentario?.trim()) partes.push(`Comentario del cliente: "${respuestas.comentario.trim()}"`)
  return partes.join('. ')
}
