/**
 * src/agents/core/PromptInterpreter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de Interpretación de Prompts con Control de Permisos.
 *
 * CÓMO FUNCIONA (pipeline de 4 pasos):
 *
 *   Prompt del usuario
 *       │
 *       ▼
 *   1. NORMALIZAR    → quitar acentos, minúsculas, limpiar texto
 *       │
 *       ▼
 *   2. CLASIFICAR    → detectar intención con patrones (regex)
 *       │
 *       ▼
 *   3. VALIDAR       → ¿es destructiva? ¿tiene permiso el rol?  → BLOQUEADO
 *       │                                                              ↑
 *       ▼                                                         (regresa aquí si falla)
 *   4. RESOLVER      → delegar al agente correcto + formatear resultado
 *       │
 *       ▼
 *   Respuesta estructurada { type, data, summary, agentsUsed, intent }
 *
 * TIPOS DE INTENCIÓN:
 *   read.sales.summary      → Resumen de ventas del día (CashAgent)
 *   read.sales.chart        → Gráfica de ventas por hora (CashAgent)
 *   read.sales.by_method    → Ventas por método de pago (CashAgent)
 *   read.sales.by_item      → Top 5 alimentos más consumidos + "otros" (CashAgent+KitchenAgent)
 *   read.reservations.today → Estado de reservas hoy (ReservationAgent)
 *   read.reservations.chart → Gráfica de reservas por estado (ReservationAgent)
 *   read.clients.vip        → Lista de clientes VIP (ClientAgent)
 *   read.clients.summary    → Resumen del CRM (ClientAgent)
 *   read.system.status      → Estado del sistema multiagente (Orchestrator)
 *   read.general.summary    → Resumen ejecutivo combinado (todos los agentes)
 *   BLOCKED.destructive     → Intento de borrar/modificar/eliminar datos → SIEMPRE bloqueado
 *   BLOCKED.unauthorized    → Intento de acción fuera del rol
 *   unknown                 → Intención no reconocida
 *
 * SISTEMA DE PERMISOS (por rol):
 *   admin      → Puede ejecutar todos los intents read.* + read.system.*
 *   cajero     → Solo read.sales.* y read.clients.summary
 *   hostess    → Solo read.reservations.*
 *   mozo       → Sin acceso al asistente
 *   jefe_cocina→ Sin acceso al asistente
 *   (todos)    → BLOCKED.* jamás se ejecuta sin importar el rol
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Patrones de clasificación de intención ────────────────────────────────────

/**
 * BLOCKED_PATTERNS — Patrones que indican acciones DESTRUCTIVAS o peligrosas.
 *
 * GUARDRAIL DE SEGURIDAD: Si el prompt normalizado coincide con CUALQUIERA de
 * estos patrones, se bloquea INMEDIATAMENTE sin importar el rol del usuario.
 * Esta lista es exhaustiva e incluye variantes en español, inglés y combinaciones.
 *
 * Regla de diseño: es preferible bloquear de más que bloquear de menos.
 * Un falso positivo se puede aclarar; una acción destructiva no se puede deshacer.
 */
const BLOCKED_PATTERNS = [
  // ── Verbos destructivos directos ────────────────────────────────────────────
  // "borra", "borrar", "borre", "borraste" + cualquier complemento
  /\b(borra(r|s|n|d[ao]s?|ndo|me|te|le|les|mos|ron)?)\b/i,
  // "elimina", "eliminar", "elimine", "eliminaste" + cualquier complemento
  /\b(elimina(r|s|n|d[ao]s?|ndo|me|te|le|les|mos|ron)?|elimine)\b/i,
  // "borrar la información", "borrar datos", "borrar registros"
  /\bborra(r)?\s+(la\s+)?(informaci[oó]n|datos?|registros?|historial|todo|pagos?|reservas?|clientes?)\b/i,
  // "eliminar la información de hoy"
  /\belimina(r)?\s+(la\s+)?(informaci[oó]n|datos?|registros?|historial|todo|pagos?|reservas?|clientes?)\b/i,

  // ── Limpiar / vaciar / resetear ──────────────────────────────────────────────
  // "limpiar datos", "limpiar registros", "limpiar información", "limpiar todo"
  /\blimpiar?\s+(datos?|registros?|informaci[oó]n|historial|todo|pagos?|reservas?|clientes?|la\s+base)\b/i,
  // "vaciar la base", "vaciar registros", "vaciar todo"
  /\bvaciar?\s+(datos?|registros?|informaci[oó]n|historial|todo|la\s+base|tabla)\b/i,
  // "resetear", "resetea", "reset"
  /\b(resetea(r)?|reset\s+(the\s+)?(data|system|db|database))\b/i,

  // ── Acciones de escritura masiva ────────────────────────────────────────────
  // "borra todo", "elimina todo", "vacía todo"
  /\b(borra|elimina|vacia|limpia|borra|suprime)\s+todo(s|s\s+los?)?\b/i,
  // "actualiza/modifica/cambia todos"
  /\b(actualiza|modifica|cambia)\s+todo(s|s?\s+los?)?\b/i,
  // "borrar la informacion de hoy/general"
  /\bborra(r)?\s+.*(de\s+hoy|general|del?\s+d[ií]a|completo|del?\s+sistema)\b/i,
  /\belimina(r)?\s+.*(de\s+hoy|general|del?\s+d[ií]a|completo|del?\s+sistema)\b/i,

  // ── Inyección SQL y código ────────────────────────────────────────────────────
  /\b(drop\s+table|delete\s+from|truncate(\s+table)?|insert\s+into|update\s+\w+\s+set)\b/i,
  /\b(exec|execute|eval|fetch|import|require)\s*\(/i,
  /;\s*(drop|delete|truncate|insert|update|alter|create)/i,
  /--\s*(drop|delete|truncate)/i,

  // ── Acciones de sistema peligrosas ───────────────────────────────────────────
  /\b(desactiva(r)?|deshabilita(r)?|apaga(r)?\s+(el\s+)?(sistema|servidor|app|aplicaci[oó]n))\b/i,
  /\b(cierra?\s+(la\s+)?(base\s+de\s+datos?|db|servidor)|shut\s*down|format(ear)?)\b/i,
  // "eliminar/borrar usuario"
  /\b(borra|elimina)(r)?\s+(el\s+|un\s+|al?\s+)?(usuario|admin|cuenta|perfil|rol)\b/i,
  // Cambios de credenciales
  /\bcambia(r)?\s+(la\s+)?contraseña\b/i,
  /\bcambia(r)?\s+(el\s+)?rol\b/i,
  /\basigna(r)?\s+(el\s+)?rol\b/i,

  // ── Variantes en inglés ──────────────────────────────────────────────────────
  /\b(delete|remove|erase|wipe|clear\s+all|purge)\s+(all\s+)?(data|records?|users?|payments?)\b/i,
  /\b(drop|destroy|nuke)\s+(the\s+)?(database|db|data|table)\b/i,
]

/**
 * INTENT_PATTERNS — Mapa de intenciones con sus patrones de detección.
 * Cada entrada tiene: patrones de keywords que deben aparecer en el prompt.
 */
const INTENT_PATTERNS = [
  // ── Top N alimentos consumidos (MÁXIMA PRIORIDAD — muy específico) ─────────
  // Este intent debe ganar siempre que el usuario pida alimentos/platos + ranking
  {
    intent: 'read.sales.by_item',
    priority: 12,
    patterns: [
      // "gráfica/chart/diagrama ... alimentos/productos/platos"
      /gr[aá]fica?\s+.*(alimentos?|productos?|platos?|items?|pedidos?|consumidos?)/i,
      // "separándolas/separar por alimentos/productos/platos"
      /separ[ae](n|ndo|ndolas?|r)?\s+(por\s+)?(alimentos?|productos?|platos?|items?)/i,
      // "top N alimentos/productos/platos"
      /\btop\s*\d*\s*(alimentos?|productos?|platos?|items?|platillos?)\b/i,
      // "los N alimentos/platos más consumidos/pedidos/vendidos"
      /\blos?\s+\d\s+(alimentos?|productos?|platos?|items?)\s+(m[aá]s\s+)?(consumidos?|pedidos?|vendidos?|populares?)/i,
      // "alimentos más consumidos", "platos más pedidos", "productos más vendidos"
      /(alimentos?|productos?|platos?|items?|platillos?)\s+(m[aá]s\s+)?(consumidos?|pedidos?|vendidos?|populares?|frecuentes?|ordenados?)/i,
      // "qué/cuál plato/alimento se vendió/pidió más"
      /(qu[eé]|cu[aá]l(es)?)\s+(platos?|alimentos?|productos?|items?)\s+(se\s+)?(m[aá]s\s+)?(vendio?|pidio?|consumio?|ordeno?|vende|pide)/i,
      // "menú más popular", "carta más consumida"
      /\b(menu|carta|oferta)\s+(m[aá]s\s+)?(popular|consumid[ao]|pedid[ao]|vendid[ao])/i,
      // "mostrar los 5 alimentos", "muéstrame los 5 platos"
      /muestra(me|r)?\s+.*(alimentos?|productos?|platos?|items?)\s*(m[aá]s)?\s*(consumidos?|pedidos?)/i,
      // "gráfica de ventas del día separándolas por alimentos" (el prompt exacto del usuario)
      /ventas?\s+.*(separad[ao]s?|desglosad[ao]s?|divid[ie]d[ao]s?|distribu[ií]d[ao]s?)\s+(por\s+)?(alimentos?|productos?|platos?)/i,
    ],
    description: 'Top 5 alimentos más consumidos',
  },

  // ── Ventas / Caja ──────────────────────────────────────────────────────────
  {
    intent: 'read.sales.chart',
    priority: 10,
    patterns: [
      /gr[aá]fica?\s+(de\s+)?(ventas?|ingresos?|pagos?|cobros?)/i,
      /\b(chart|grafico|gr[aá]fico|diagrama)\b.*\b(ventas?|ingresos?|pagos?)/i,
      /ventas?.*\b(gr[aá]fica?|chart|grafico|diagrama|visualiza)\b/i,
      /\bmuestra\b.*\b(ventas?|ingresos?)\b.*\b(gr[aá]fica?|chart|grafico)\b/i,
    ],
    description: 'Gráfica de ventas del día',
  },
  {
    intent: 'read.sales.by_method',
    priority: 9,
    patterns: [
      /ventas?\s+(por|seg[uú]n)\s+(m[eé]todo|forma|tipo)\s+(de\s+)?(pago|cobro)/i,
      /distribuci[oó]n\s+(de\s+)?(pagos?|ventas?)/i,
      /cu[aá]nto\s+(se\s+cobr[oó]|se\s+vendi[oó])\s+(con|en)\s+(efectivo|tarjeta|yape|plin)/i,
      /(efectivo|tarjeta|yape|plin)\s+vs?\s+(efectivo|tarjeta|yape|plin)/i,
    ],
    description: 'Ventas desglosadas por método de pago',
  },
  {
    intent: 'read.sales.summary',
    priority: 8,
    patterns: [
      /resumen\s+(de\s+)?(ventas?|ingresos?|caja|cobros?|pagos?)/i,
      /total\s+(de\s+)?(ventas?|ingresos?|cobros?|pagos?)\s*(de\s+hoy|del?\s+d[ií]a|de\s+hoy)?/i,
      /cu[aá]nto\s+(se\s+ha?\s+)?(vendido|cobrado|recaudado|ingresado)\s*(hoy|este\s+d[ií]a)?/i,
      /cu[aá]l\s+es\s+(el\s+)?(total|monto|importe)\s+(de\s+)?(ventas?|ingresos?|caja)/i,
      /dame\s+(las?\s+)?(ventas?|ingresos?|caja|cifras?)\s*(de\s+hoy)?/i,
      /(ventas?|ingresos?|caja)\s+(de\s+hoy|del?\s+d[ií]a|del?\s+turno)/i,
    ],
    description: 'Resumen de ventas del día',
  },
  // ── Reservas ──────────────────────────────────────────────────────────────
  {
    intent: 'read.reservations.chart',
    priority: 10,
    patterns: [
      /gr[aá]fica?\s+(de\s+)?reservas?/i,
      /reservas?.*\b(gr[aá]fica?|chart|grafico|diagrama)\b/i,
      /distribuci[oó]n\s+(de\s+)?reservas?\s+(por\s+estado)?/i,
    ],
    description: 'Gráfica de reservas por estado',
  },
  {
    intent: 'read.reservations.today',
    priority: 8,
    patterns: [
      /resumen\s+(de\s+)?reservas?/i,
      /cu[aá]ntas?\s+reservas?\s*(hay|tenemos|existen)?\s*(hoy|este\s+d[ií]a)?/i,
      /estado\s+(de\s+las?\s+)?reservas?\s*(de\s+hoy|del?\s+d[ií]a)?/i,
      /reservas?\s+(de\s+hoy|del?\s+d[ií]a|pendientes?|aprobadas?|activas?)/i,
      /mesas?\s+(ocupadas?|disponibles?|libres?)/i,
    ],
    description: 'Estado de reservas de hoy',
  },
  // ── Clientes / CRM ────────────────────────────────────────────────────────
  {
    intent: 'read.clients.vip',
    priority: 9,
    patterns: [
      /clientes?\s+vip/i,
      /lista\s+(de\s+)?clientes?\s+vip/i,
      /qui[eé]nes?\s+(son|est[aá]n)\s+(los?\s+)?clientes?\s+vip/i,
      /vip\s+customers?/i,
    ],
    description: 'Lista de clientes VIP',
  },
  {
    intent: 'read.clients.summary',
    priority: 8,
    patterns: [
      /resumen\s+(de\s+)?clientes?/i,
      /cu[aá]ntos?\s+clientes?\s*(tenemos|hay|registrados?)?/i,
      /estado\s+(del?\s+)?crm/i,
      /estad[ií]sticas?\s+(de\s+)?clientes?/i,
    ],
    description: 'Resumen del CRM de clientes',
  },
  // ── Sistema multiagente ───────────────────────────────────────────────────
  {
    intent: 'read.system.status',
    priority: 9,
    patterns: [
      /estado\s+(del?\s+)?sistema\s*(multiagente)?/i,
      /c[oó]mo\s+(est[aá]n?|est[aá]\s+funcionando)\s+(los?\s+)?agentes?/i,
      /m[eé]tricas?\s+(de\s+los?\s+)?agentes?/i,
      /rendimiento\s+(del?\s+sistema|de\s+los?\s+agentes?)/i,
      /swarms?\s+(ejecutados?|corridos?)/i,
    ],
    description: 'Estado del sistema multiagente',
  },
  // ── Resumen ejecutivo ─────────────────────────────────────────────────────
  {
    intent: 'read.general.summary',
    priority: 7,
    patterns: [
      /resumen\s+(general|ejecutivo|completo|global|del?\s+d[ií]a)/i,
      /dame\s+un\s+panorama\s+general/i,
      /c[oó]mo\s+(va|est[aá])\s+(el\s+)?(negocio|restaurante|todo)\s*(hoy)?/i,
      /informe\s+(general|del?\s+d[ií]a|ejecutivo)/i,
      /reporte\s+(general|completo|del?\s+d[ií]a)/i,
    ],
    description: 'Resumen ejecutivo del día',
  },
]

/**
 * ROLE_PERMISSIONS — Qué intenciones puede ejecutar cada rol.
 * 'BLOCKED.*' jamás aparece aquí — siempre está bloqueado para todos.
 */
const ROLE_PERMISSIONS = {
  admin: [
    'read.sales.summary',
    'read.sales.chart',
    'read.sales.by_method',
    'read.sales.by_item',
    'read.reservations.today',
    'read.reservations.chart',
    'read.clients.vip',
    'read.clients.summary',
    'read.system.status',
    'read.general.summary',
  ],
  cajero: [
    'read.sales.summary',
    'read.sales.chart',
    'read.sales.by_method',
    'read.sales.by_item',
    'read.clients.summary',
  ],
  hostess: [
    'read.reservations.today',
    'read.reservations.chart',
    'read.clients.summary',
  ],
  mozo:        [], // Sin acceso al asistente
  jefe_cocina: [], // Sin acceso al asistente
}

// ── Clase PromptInterpreter ───────────────────────────────────────────────────

class PromptInterpreterClass {
  constructor() {
    this.name = 'PromptInterpreter'
    this._history = [] // Historial de prompts procesados
  }

  /**
   * interpret — Punto de entrada principal.
   * Ejecuta el pipeline completo: normalizar → clasificar → validar → resolver.
   *
   * @param {string} rawPrompt - Texto libre del usuario
   * @param {string} role - Rol del usuario (admin, cajero, etc.)
   * @param {Object} contextData - Datos actuales del sistema (payments, reservations, etc.)
   * @returns {Promise<InterpretResult>}
   */
  async interpret(rawPrompt, role, contextData = {}) {
    const startTime = Date.now()
    const normalized = this._normalize(rawPrompt)

    // PASO 1: Detección de intención destructiva (guardrail de seguridad)
    const isDestructive = this._isDestructive(normalized)
    if (isDestructive) {
      return this._buildBlockedResult(rawPrompt, 'BLOCKED.destructive', role, startTime,
        '🚫 Acción no permitida: el asistente de consulta no puede modificar, eliminar ni resetear datos del sistema. ' +
        'Esta restricción es permanente y no puede ser omitida por ningún rol, incluyendo administradores. ' +
        'Para operaciones de mantenimiento, usa los módulos correspondientes del sistema.'
      )
    }

    // PASO 2: Clasificar intención
    const { intent, confidence, description } = this._classifyIntent(normalized)

    if (intent === 'unknown') {
      return this._buildUnknownResult(rawPrompt, role, startTime)
    }

    // PASO 3: Validar permisos del rol
    const allowedIntents = ROLE_PERMISSIONS[role] || []
    if (!allowedIntents.includes(intent)) {
      return this._buildBlockedResult(rawPrompt, 'BLOCKED.unauthorized', role, startTime,
        `🔒 Tu rol (${role}) no tiene acceso a esta consulta. ` +
        `Las consultas disponibles para tu rol son: ${allowedIntents.map(i => `"${i.split('.').slice(1).join(' ')}"`) .join(', ')}.`
      )
    }

    // PASO 4: Resolver — ejecutar y formatear respuesta (pasa rawPrompt para extraer parámetros)
    const result = await this._resolve(intent, contextData, role, rawPrompt)
    const latency = Date.now() - startTime

    const finalResult = {
      success:     true,
      blocked:     false,
      rawPrompt,
      normalizedPrompt: normalized,
      intent,
      confidence,
      description,
      role,
      latency,
      timestamp:   new Date().toISOString(),
      ...result,
    }

    this._history.push(finalResult)
    return finalResult
  }

  // ── PASO 1: Detección de contenido destructivo ─────────────────────────────

  _isDestructive(normalizedPrompt) {
    return BLOCKED_PATTERNS.some(pattern => pattern.test(normalizedPrompt))
  }

  // ── PASO 2: Clasificación de intención ────────────────────────────────────

  _classifyIntent(normalizedPrompt) {
    let bestMatch  = { intent: 'unknown', confidence: 0, description: 'Intención no reconocida' }
    let maxMatches = 0

    for (const entry of INTENT_PATTERNS) {
      const matchCount = entry.patterns.filter(p => p.test(normalizedPrompt)).length
      if (matchCount === 0) continue

      // Score = matchCount * priority (prioridad desempata cuando hay mismo número de matches)
      const score = matchCount * entry.priority
      if (score > maxMatches) {
        maxMatches = score
        bestMatch  = {
          intent:      entry.intent,
          confidence:  Math.min(100, Math.round((matchCount / entry.patterns.length) * 100 + entry.priority * 2)),
          description: entry.description,
        }
      }
    }

    return bestMatch
  }

  // ── PASO 3 (implícito en interpret): Validación de permisos ───────────────
  // Ver lógica en interpret() arriba.

  // ── PASO 4: Resolución — obtener datos y formatearlos ─────────────────────

  async _resolve(intent, contextData, role, rawPrompt = '') {
    const { payments = [], reservations = [], clients = [], systemStatus = null } = contextData
    const today = new Date().toISOString().split('T')[0]

    switch (intent) {
      // ── Ventas ────────────────────────────────────────────────────────────
      case 'read.sales.summary': {
        const todayPayments = payments.filter(p => p.date === today)
        const total         = todayPayments.reduce((s, p) => s + (p.amount || 0), 0)
        const igv           = total * 0.18
        const subtotal      = total - igv

        return {
          type:       'summary',
          agentsUsed: ['CashAgent'],
          data: {
            total,
            subtotal,
            igv,
            count:   todayPayments.length,
            methods: this._groupByMethod(todayPayments),
          },
          summary: this._formatSalesSummary(total, subtotal, igv, todayPayments),
        }
      }

      case 'read.sales.chart': {
        const todayPayments = payments.filter(p => p.date === today)
        const byHour        = this._groupByHour(todayPayments)

        return {
          type:       'bar_chart',
          agentsUsed: ['CashAgent'],
          chartConfig: {
            title:    'Ventas por hora — Hoy',
            xLabel:   'Hora del día',
            yLabel:   'Ingresos (S/.)',
            labels:   byHour.map(h => h.label),
            values:   byHour.map(h => h.total),
            color:    '#e8622a',
          },
          data:    byHour,
          summary: `Gráfica de ventas generada con ${todayPayments.length} transacciones del día.`,
        }
      }

      // ── Top 5 alimentos más consumidos ────────────────────────────────────
      case 'read.sales.by_item': {
        // Extraer topN del prompt original si el usuario especificó un número (ej: "los 5 alimentos")
        const topNMatch = rawPrompt.match(/\b(\d+)\s*(alimentos?|productos?|platos?|items?|mas\s+consumidos?)?/i)
        const topN = topNMatch ? Math.min(Math.max(parseInt(topNMatch[1]), 2), 10) : 5

        // Obtener pagos del período (hoy o todos si hay pocos datos hoy)
        const todayPayments = payments.filter(p => p.date === today)
        const sourcePayments = todayPayments.length >= 2 ? todayPayments : payments

        // Acumular items de todos los pagos que tienen el campo `items`
        const itemMap = {}
        for (const payment of sourcePayments) {
          if (!payment.items?.length) continue
          for (const item of payment.items) {
            const key = item.name || item.itemId || 'Otro'
            if (!itemMap[key]) {
              itemMap[key] = { name: key, qty: 0, totalRevenue: 0, itemId: item.itemId }
            }
            itemMap[key].qty          += item.qty       || 1
            itemMap[key].totalRevenue += item.subtotal  || item.unitPrice || 0
          }
        }

        const sorted = Object.values(itemMap).sort((a, b) => b.qty - a.qty)

        // Top N + "Otros"
        const top     = sorted.slice(0, topN)
        const rest    = sorted.slice(topN)
        const otrosQty = rest.reduce((s, i) => s + i.qty, 0)
        const otrosRev = rest.reduce((s, i) => s + i.totalRevenue, 0)

        const chartItems = [...top]
        if (otrosQty > 0) {
          chartItems.push({ name: 'Otros', qty: otrosQty, totalRevenue: otrosRev })
        }

        const totalQty = chartItems.reduce((s, i) => s + i.qty, 0)
        const dateLabel = todayPayments.length >= 2 ? 'hoy' : 'período disponible'

        // Determinar si mostrar gráfica de barras o pastel según el contexto
        // Si hay pocas categorías → pastel; si hay muchas → barras
        const chartType = chartItems.length <= 6 ? 'pie_chart' : 'bar_chart'

        const CHART_COLORS = ['#e8622a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b']

        return {
          type: chartType,
          agentsUsed: ['CashAgent', 'KitchenAgent'],
          chartConfig: chartType === 'pie_chart' ? {
            title:  `Top ${topN} alimentos más consumidos — ${dateLabel}`,
            labels: chartItems.map(i => i.name),
            values: chartItems.map(i => i.qty),
            colors: CHART_COLORS,
          } : {
            title:  `Top ${topN} alimentos más consumidos — ${dateLabel}`,
            xLabel: 'Alimento',
            yLabel: 'Unidades pedidas',
            labels: chartItems.map(i => i.name),
            values: chartItems.map(i => i.qty),
            color:  '#e8622a',
          },
          data: chartItems,
          summary:
            `**Top ${topN} alimentos más consumidos — ${dateLabel}:**\n` +
            top.map((item, i) =>
              `${i + 1}. **${item.name}** — ${item.qty} unidades (S/. ${item.totalRevenue.toFixed(2)})`
            ).join('\n') +
            (otrosQty > 0
              ? `\n• Otros ${rest.length} platos — ${otrosQty} unidades (S/. ${otrosRev.toFixed(2)})`
              : '') +
            `\n\n📦 Total de pedidos analizados: **${totalQty}** unidades`,
        }
      }

      case 'read.sales.by_method': {
        const todayPayments = payments.filter(p => p.date === today)
        const byMethod      = this._groupByMethod(todayPayments)

        return {
          type:       'pie_chart',
          agentsUsed: ['CashAgent'],
          chartConfig: {
            title:  'Ventas por método de pago — Hoy',
            labels: byMethod.map(m => m.method),
            values: byMethod.map(m => m.total),
            colors: ['#e8622a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
          },
          data:    byMethod,
          summary: this._formatByMethodSummary(byMethod),
        }
      }

      // ── Reservas ──────────────────────────────────────────────────────────
      case 'read.reservations.today': {
        const todayRes = reservations.filter(r => r.date === today)
        const byStatus = this._groupByStatus(todayRes)

        return {
          type:       'summary',
          agentsUsed: ['ReservationAgent'],
          data:       { total: todayRes.length, byStatus },
          summary:    this._formatReservationsSummary(todayRes, byStatus),
        }
      }

      case 'read.reservations.chart': {
        const todayRes = reservations.filter(r => r.date === today)
        const byStatus = this._groupByStatus(todayRes)

        return {
          type:       'bar_chart',
          agentsUsed: ['ReservationAgent'],
          chartConfig: {
            title:  'Reservas por estado — Hoy',
            xLabel: 'Estado',
            yLabel: 'Cantidad',
            labels: byStatus.map(s => s.label),
            values: byStatus.map(s => s.count),
            color:  '#3b82f6',
          },
          data:    byStatus,
          summary: `${todayRes.length} reservas totales hoy distribuidas en ${byStatus.length} estados.`,
        }
      }

      // ── Clientes ──────────────────────────────────────────────────────────
      case 'read.clients.vip': {
        const vip = clients.filter(c => c.isVip || c.completedReservations >= 5)

        return {
          type:       'list',
          agentsUsed: ['ClientAgent'],
          data:       vip,
          summary:    vip.length > 0
            ? `Se encontraron **${vip.length} clientes VIP** (5+ reservas completadas).`
            : 'No hay clientes VIP registrados aún. Un cliente se convierte en VIP al completar 5 reservas.',
        }
      }

      case 'read.clients.summary': {
        const vipCount  = clients.filter(c => c.isVip || c.completedReservations >= 5).length
        const newToday  = clients.filter(c => c.createdAt?.startsWith(today)).length

        return {
          type:       'summary',
          agentsUsed: ['ClientAgent'],
          data:       { total: clients.length, vip: vipCount, newToday },
          summary:
            `**CRM Pardos Chicken:**\n` +
            `• Total de clientes registrados: **${clients.length}**\n` +
            `• Clientes VIP: **${vipCount}** (${clients.length > 0 ? ((vipCount / clients.length) * 100).toFixed(1) : 0}% del total)\n` +
            `• Nuevos clientes hoy: **${newToday}**`,
        }
      }

      // ── Sistema ───────────────────────────────────────────────────────────
      case 'read.system.status': {
        if (!systemStatus) {
          return {
            type:       'summary',
            agentsUsed: ['OrchestratorAgent'],
            data:       null,
            summary:    'El estado del sistema no está disponible en este momento. Asegúrate de que el AgentContext esté montado.',
          }
        }
        const { orchestrator: orch, agents, eventBus } = systemStatus

        return {
          type:       'summary',
          agentsUsed: ['OrchestratorAgent'],
          data:       systemStatus,
          summary:
            `**Sistema Multiagente — ${orch.topology.toUpperCase()}:**\n` +
            `• Agentes registrados: **${agents.length}** | Activos ahora: **${systemStatus.activeAgents}**\n` +
            `• Orquestaciones totales: **${orch.totalOrchestrations}** | Swarms: **${orch.swarmExecutions}**\n` +
            `• Mensajes MCP en EventBus: **${eventBus.totalMessages}** | Tasa de éxito: **${eventBus.successRate}%**\n` +
            `• Tokens estimados (total): **${orch.totalTokens?.toLocaleString() || 0}**\n` +
            `• Uptime del sistema: **${orch.uptime}s**`,
        }
      }

      // ── Resumen ejecutivo ─────────────────────────────────────────────────
      case 'read.general.summary': {
        const todayPayments = payments.filter(p => p.date === today)
        const todayRes      = reservations.filter(r => r.date === today)
        const total         = todayPayments.reduce((s, p) => s + (p.amount || 0), 0)
        const vipCount      = clients.filter(c => c.isVip || c.completedReservations >= 5).length
        const activeRes     = todayRes.filter(r => ['PENDING', 'SEATED'].includes(r.status)).length

        return {
          type:       'executive_summary',
          agentsUsed: ['CashAgent', 'ReservationAgent', 'ClientAgent'],
          data: {
            sales: { total, count: todayPayments.length },
            reservations: { total: todayRes.length, active: activeRes },
            clients: { total: clients.length, vip: vipCount },
          },
          summary:
            `**📊 Resumen Ejecutivo — ${new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}**\n\n` +
            `💰 **Ventas:** S/. ${total.toFixed(2)} en ${todayPayments.length} transacciones\n` +
            `📅 **Reservas:** ${todayRes.length} totales hoy, ${activeRes} activas ahora\n` +
            `👥 **Clientes:** ${clients.length} registrados, ${vipCount} VIP\n` +
            (systemStatus ? `🤖 **Sistema:** ${systemStatus.agents?.length || 5} agentes operativos, ${systemStatus.orchestrator?.swarmExecutions || 0} swarms ejecutados` : ''),
        }
      }

      default:
        return {
          type:    'error',
          agentsUsed: [],
          summary: 'Intención no implementada.',
        }
    }
  }

  // ── Helpers de formateo ───────────────────────────────────────────────────

  _normalize(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quitar acentos
      .replace(/[^\w\s]/g, ' ')         // quitar puntuación
      .replace(/\s+/g, ' ')
      .trim()
  }

  _groupByMethod(payments) {
    const map = {}
    for (const p of payments) {
      const m = p.method || p.paymentMethod || 'otro'
      if (!map[m]) map[m] = { method: m, total: 0, count: 0 }
      map[m].total += p.amount || 0
      map[m].count++
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }

  _groupByHour(payments) {
    const map = {}
    // Inicializar todas las horas del restaurante (11:00 - 22:00)
    for (let h = 11; h <= 22; h++) {
      const label = `${String(h).padStart(2, '0')}:00`
      map[label] = { label, total: 0, count: 0 }
    }
    for (const p of payments) {
      const createdAt = p.createdAt || p.date || ''
      const hour      = createdAt.includes('T') ? createdAt.split('T')[1]?.slice(0, 2) : null
      const label     = hour ? `${hour}:00` : '??:00'
      if (map[label]) {
        map[label].total += p.amount || 0
        map[label].count++
      }
    }
    return Object.values(map)
  }

  _groupByStatus(reservations) {
    const STATUS_LABELS = {
      REQUESTED: 'Solicitada',
      PENDING:   'Pendiente',
      SEATED:    'En mesa',
      COMPLETED: 'Completada',
      CANCELLED: 'Cancelada',
      REJECTED:  'Rechazada',
    }
    const map = {}
    for (const r of reservations) {
      const s = r.status || 'UNKNOWN'
      if (!map[s]) map[s] = { status: s, label: STATUS_LABELS[s] || s, count: 0 }
      map[s].count++
    }
    return Object.values(map).sort((a, b) => b.count - a.count)
  }

  _formatSalesSummary(total, subtotal, igv, payments) {
    const count = payments.length
    const avg   = count > 0 ? subtotal / count : 0
    return (
      `**Resumen de ventas — hoy:**\n` +
      `• Subtotal (sin IGV): **S/. ${subtotal.toFixed(2)}**\n` +
      `• IGV (18%): **S/. ${igv.toFixed(2)}**\n` +
      `• **Total cobrado: S/. ${total.toFixed(2)}**\n` +
      `• Transacciones: **${count}**\n` +
      `• Ticket promedio: **S/. ${avg.toFixed(2)}**`
    )
  }

  _formatByMethodSummary(byMethod) {
    if (byMethod.length === 0) return 'No hay pagos registrados hoy.'
    const lines = byMethod.map(m =>
      `• ${m.method}: **S/. ${m.total.toFixed(2)}** (${m.count} transacciones)`
    )
    return `**Distribución por método de pago — hoy:**\n${lines.join('\n')}`
  }

  _formatReservationsSummary(todayRes, byStatus) {
    const lines = byStatus.map(s => `• ${s.label}: **${s.count}**`)
    return (
      `**Reservas del día (${new Date().toLocaleDateString('es-PE')}):**\n` +
      `• Total: **${todayRes.length} reservas**\n` +
      lines.join('\n')
    )
  }

  // ── Constructores de resultados bloqueados ────────────────────────────────

  _buildBlockedResult(rawPrompt, intent, role, startTime, reason) {
    const result = {
      success:   false,
      blocked:   true,
      rawPrompt,
      intent,
      role,
      latency:   Date.now() - startTime,
      timestamp: new Date().toISOString(),
      reason,
      type:      'blocked',
      agentsUsed: [],
      summary:   reason,
    }
    this._history.push(result)
    return result
  }

  _buildUnknownResult(rawPrompt, role, startTime) {
    const allowedIntents = ROLE_PERMISSIONS[role] || []
    const suggestions    = allowedIntents.slice(0, 3).map(i =>
      `"${i.replace('read.', '').replace('.', ' de ').replace('_', ' ')}"`
    )

    const result = {
      success:   false,
      blocked:   false,
      rawPrompt,
      intent:    'unknown',
      confidence: 0,
      role,
      latency:   Date.now() - startTime,
      timestamp: new Date().toISOString(),
      type:      'unknown',
      agentsUsed: [],
      summary:
        `No reconocí exactamente lo que necesitas. Puedes intentar con:\n` +
        suggestions.map(s => `• ${s}`).join('\n') + '\n\n' +
        `O escribe "resumen del día" para un reporte ejecutivo completo.`,
    }
    this._history.push(result)
    return result
  }

  // ── Acceso al historial ───────────────────────────────────────────────────

  getHistory(limit = 20) {
    return this._history.slice(-limit)
  }

  getAvailableIntents(role) {
    return (ROLE_PERMISSIONS[role] || []).map(intent => {
      const entry = INTENT_PATTERNS.find(e => e.intent === intent)
      return { intent, description: entry?.description || intent }
    })
  }
}

// Singleton
export const promptInterpreter = new PromptInterpreterClass()
export default promptInterpreter
