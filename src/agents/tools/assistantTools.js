/**
 * src/agents/tools/assistantTools.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Registro de herramientas del Asistente IA (function calling de Gemini).
 *
 * PRINCIPIO ANTI-ALUCINACIÓN:
 *   Las herramientas calculan. El LLM narra.
 *   El modelo nunca recibe arrays crudos de pagos/reservas/clientes: recibe el
 *   objeto ya agregado que devuelve el handler. No puede equivocarse en un
 *   total porque no es él quien lo suma.
 *
 * PRINCIPIO DE PERMISOS:
 *   Cada tool declara qué roles pueden usarla. `buildToolsForRole()` filtra el
 *   registro ANTES de ligar las tools al modelo, de modo que un rol sin permiso
 *   no puede invocar la herramienta: sencillamente no existe en su contexto.
 *
 * SOLO LECTURA:
 *   No hay ninguna tool de escritura. Aunque el modelo fuera persuadido de
 *   borrar datos, no tiene con qué hacerlo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { STATUS_LABELS } from '../../domain/reservations/reservationStatus.js'
import { planificarCompras } from '../../domain/inventory/purchasePlanner.js'
import { RECIPES } from '../../data/seeds/recipesSeed.js'
import { SUPPLIES } from '../../data/seeds/suppliesSeed.js'
import { SUPPLIERS } from '../../data/seeds/suppliersSeed.js'
import { MENU_ITEMS } from '../../domain/kitchen/menu.js'

const CHART_COLORS = ['#e8622a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b']

const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const todayISO = () => new Date().toISOString().split('T')[0]

/**
 * Los modelos pasan fechas inventadas: `"hoy"`, `"2026-7-1"`, o incluso mañana.
 * Filtrar por una fecha sin pagos devuelve cero (o dispara el ensanche de período),
 * y el modelo narra el resultado sin sospechar. Observado en pruebas reales.
 *
 * Cualquier fecha malformada o futura se trata como hoy.
 */
function normalizarFecha(fecha) {
  const texto = String(fecha || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return todayISO()
  return texto > todayISO() ? todayISO() : texto
}

// ── Agregaciones (JS puro — la fuente de verdad de todas las cifras) ──────────

function paymentsOfDay(payments, fecha) {
  return payments.filter(p => p.date === fecha)
}

function groupByMethod(payments) {
  const map = {}
  for (const p of payments) {
    const m = p.method || p.paymentMethod || 'otro'
    if (!map[m]) map[m] = { metodo: m, total: 0, transacciones: 0 }
    map[m].total += p.amount || 0
    map[m].transacciones++
  }
  return Object.values(map)
    .map(m => ({ ...m, total: money(m.total) }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Extrae la hora de un pago. El seed usa `time: "14:30"`; algunos registros
 * traen `createdAt` ISO. Sin este fallback la gráfica por hora sale toda en cero.
 */
function hourOf(payment) {
  if (payment.time?.includes(':')) return payment.time.split(':')[0].padStart(2, '0')
  const iso = payment.createdAt || ''
  return iso.includes('T') ? iso.split('T')[1]?.slice(0, 2) : null
}

function groupByHour(payments) {
  const map = {}
  for (let h = 11; h <= 22; h++) {
    map[`${String(h).padStart(2, '0')}:00`] = { hora: `${String(h).padStart(2, '0')}:00`, total: 0, transacciones: 0 }
  }
  for (const p of payments) {
    const hh = hourOf(p)
    const label = hh ? `${hh}:00` : null
    if (label && map[label]) {
      map[label].total += p.amount || 0
      map[label].transacciones++
    }
  }
  return Object.values(map).map(h => ({ ...h, total: money(h.total) }))
}

function groupByStatus(reservations) {
  const map = {}
  for (const r of reservations) {
    const s = r.status || 'desconocido'
    if (!map[s]) map[s] = { estado: STATUS_LABELS[s] || s, cantidad: 0 }
    map[s].cantidad++
  }
  return Object.values(map).sort((a, b) => b.cantidad - a.cantidad)
}

function rankItems(payments, topN) {
  const map = {}
  for (const p of payments) {
    if (!p.items?.length) continue
    for (const item of p.items) {
      const key = item.name || item.itemId || 'Otro'
      if (!map[key]) map[key] = { nombre: key, unidades: 0, ingresos: 0 }
      map[key].unidades += item.qty || 1
      map[key].ingresos += item.subtotal || item.unitPrice || 0
    }
  }
  const sorted = Object.values(map).sort((a, b) => b.unidades - a.unidades)
  const top = sorted.slice(0, topN).map(i => ({ ...i, ingresos: money(i.ingresos) }))
  const rest = sorted.slice(topN)

  if (rest.length > 0) {
    top.push({
      nombre:   'Otros',
      unidades: rest.reduce((s, i) => s + i.unidades, 0),
      ingresos: money(rest.reduce((s, i) => s + i.ingresos, 0)),
      _otros:   rest.length,
    })
  }
  return top
}

/**
 * Un cliente es VIP si lleva la marca `vip`. Es la misma regla que usa
 * ClientContext (`vipClients`), de modo que el asistente nunca contradice a la
 * pantalla de Clientes.
 *
 * Nota: ClientAgent promueve a VIP al alcanzar VIP_THRESHOLD reservas, pero el
 * seed tiene clientes por encima del umbral sin la marca puesta (p. ej. Roberto
 * Silva, 6 reservas). Aplicar el umbral aquí daría 9 VIP frente a los 5 que
 * muestra la app.
 */
const isVip = (c) => c.vip === true

/** Reservas acumuladas del cliente, con el nombre de campo que usa el seed. */
const reservasDe = (c) => c.totalReservations || 0

// ── Registro de herramientas ─────────────────────────────────────────────────
//
// Cada entrada:
//   schema  → declaración que ve Gemini (formato functionDeclarations)
//   roles   → quiénes pueden invocarla
//   handler → (args, ctx) => objeto JSON que verá el modelo
//
// ctx = { contextData, emit }
//   emit(payload) adjunta una visualización a la respuesta final (gráfica o lista).
//   Lo que emit() recibe NO va al modelo: lo consume la UI directamente.

export const TOOL_REGISTRY = {
  read_sales_summary: {
    roles: ['admin', 'cajero'],
    agents: ['CashAgent'],
    schema: {
      name: 'read_sales_summary',
      description:
        'Ventas del día: total cobrado, subtotal sin IGV, IGV, número de transacciones, ' +
        'ticket promedio y desglose por método de pago. Úsala para preguntas como ' +
        '"¿cuánto vendimos?", "¿cómo vamos hoy?", "¿cuál es el ticket promedio?".',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'OMITE este parámetro salvo que el líder nombre una fecha concreta. Formato YYYY-MM-DD. Si se omite, es hoy.' },
        },
      },
    },
    handler: ({ fecha }, { contextData }) => {
      const dia   = normalizarFecha(fecha)
      const pagos = paymentsOfDay(contextData.payments || [], dia)
      const total = pagos.reduce((s, p) => s + (p.amount || 0), 0)
      const igv   = total * 0.18

      // Ambos promedios vienen precalculados: si solo diéramos uno, el modelo
      // tiende a rehacer la división por su cuenta con el otro criterio.
      return {
        fecha:           dia,
        total:           money(total),
        subtotal_sin_igv: money(total - igv),
        igv:             money(igv),
        transacciones:   pagos.length,
        ticket_promedio:          pagos.length > 0 ? money(total / pagos.length) : 0,
        ticket_promedio_sin_igv:  pagos.length > 0 ? money((total - igv) / pagos.length) : 0,
        por_metodo:      groupByMethod(pagos),
      }
    },
  },

  read_sales_by_hour: {
    roles: ['admin', 'cajero'],
    agents: ['CashAgent'],
    schema: {
      name: 'read_sales_by_hour',
      description:
        'Ventas del día distribuidas por hora (11:00 a 22:00). Úsala cuando pregunten por ' +
        'la evolución del día, las horas punta, el turno de almuerzo vs. el de noche, ' +
        'o cuando pidan una gráfica de ventas.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'OMITE este parámetro salvo que el líder nombre una fecha concreta. Formato YYYY-MM-DD. Si se omite, es hoy.' },
        },
      },
    },
    handler: ({ fecha }, { contextData, emit }) => {
      const dia    = normalizarFecha(fecha)
      const pagos  = paymentsOfDay(contextData.payments || [], dia)
      const byHour = groupByHour(pagos)

      emit({
        type: 'bar_chart',
        chartConfig: {
          title:  `Ventas por hora — ${dia}`,
          xLabel: 'Hora del día',
          yLabel: 'Ingresos (S/.)',
          labels: byHour.map(h => h.hora),
          values: byHour.map(h => h.total),
          color:  '#e8622a',
        },
      })

      // Agregados precalculados: si el modelo tiene que sumar la lista, se equivoca.
      const conVentas = byHour.filter(h => h.transacciones > 0)
      const pico      = conVentas.reduce((a, h) => (h.total > (a?.total ?? -1) ? h : a), null)

      return {
        fecha: dia,
        total_del_dia:         money(pagos.reduce((s, p) => s + (p.amount || 0), 0)),
        transacciones_totales: pagos.length,
        horas_con_ventas:      conVentas.length,
        primera_venta:         conVentas[0]?.hora ?? null,
        ultima_venta:          conVentas[conVentas.length - 1]?.hora ?? null,
        hora_pico:             pico ? { hora: pico.hora, total: pico.total, transacciones: pico.transacciones } : null,
        por_hora:              byHour,
      }
    },
  },

  read_sales_by_method: {
    roles: ['admin', 'cajero'],
    agents: ['CashAgent'],
    schema: {
      name: 'read_sales_by_method',
      description:
        'Ventas del día desglosadas por método de pago (efectivo, tarjeta, Yape, Plin). ' +
        'Úsala para "¿cuánto entró por Yape?", "efectivo vs tarjeta", "distribución de pagos".',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'OMITE este parámetro salvo que el líder nombre una fecha concreta. Formato YYYY-MM-DD. Si se omite, es hoy.' },
        },
      },
    },
    handler: ({ fecha }, { contextData, emit }) => {
      const dia      = normalizarFecha(fecha)
      const pagos    = paymentsOfDay(contextData.payments || [], dia)
      const byMethod = groupByMethod(pagos)

      emit({
        type: 'pie_chart',
        chartConfig: {
          title:  `Ventas por método de pago — ${dia}`,
          labels: byMethod.map(m => m.metodo),
          values: byMethod.map(m => m.total),
          unit:   'S/.',
          colors: CHART_COLORS,
        },
      })

      return { fecha: dia, por_metodo: byMethod }
    },
  },

  read_top_items: {
    roles: ['admin', 'cajero'],
    agents: ['CashAgent', 'KitchenAgent'],
    schema: {
      name: 'read_top_items',
      description:
        'Ranking de los platos más consumidos, con unidades vendidas e ingresos por plato. ' +
        'Agrupa el resto bajo "Otros". Úsala para "¿qué se vende más?", "top de platos", ' +
        '"cuál es el plato estrella".',
      parameters: {
        type: 'object',
        properties: {
          top_n: { type: 'number', description: 'Cuántos platos listar antes de agrupar en "Otros". Entre 2 y 10. Por defecto 5.' },
          fecha: { type: 'string', description: 'OMITE este parámetro salvo que el líder nombre una fecha concreta. Formato YYYY-MM-DD. Si se omite, es hoy.' },
        },
      },
    },
    handler: ({ top_n, fecha }, { contextData, emit }) => {
      const dia   = normalizarFecha(fecha)
      const topN  = Math.min(Math.max(parseInt(top_n) || 5, 2), 10)
      const pagos = contextData.payments || []

      // Si el día pedido tiene muy pocos pagos, el ranking no dice nada y se amplía
      // el período. Debe ser EXPLÍCITO: si no, el modelo narra cifras históricas
      // como si fueran de hoy, y el cruce con las ventas del día queda sin sentido.
      const delDia    = paymentsOfDay(pagos, dia)
      const esDelDia  = delDia.length >= 2
      const fuente    = esDelDia ? delDia : pagos
      const periodo   = esDelDia ? dia : 'todo el período disponible'

      const items = rankItems(fuente, topN)
      if (items.length === 0) {
        return { fecha_solicitada: dia, periodo, es_del_dia: esDelDia, items: [], nota: 'No hay pagos con detalle de platos.' }
      }

      emit({
        type: items.length <= 6 ? 'pie_chart' : 'bar_chart',
        chartConfig: {
          title:  `Top ${topN} platos más consumidos — ${periodo}`,
          xLabel: 'Plato',
          yLabel: 'Unidades pedidas',
          labels: items.map(i => i.nombre),
          values: items.map(i => i.unidades),
          unit:   'unidades',   // no son soles: la leyenda del pastel lo necesita
          color:  '#e8622a',
          colors: CHART_COLORS,
        },
      })

      return {
        fecha_solicitada: dia,
        periodo,
        es_del_dia: esDelDia,
        ...(esDelDia ? {} : { advertencia: `No hay suficientes pagos el ${dia}. Estas cifras son del histórico completo, no de ese día. Dilo al responder.` }),
        unidades_totales: items.reduce((s, i) => s + i.unidades, 0),
        items,
      }
    },
  },

  read_reservations_today: {
    roles: ['admin', 'hostess'],
    agents: ['ReservationAgent'],
    schema: {
      name: 'read_reservations_today',
      description:
        'Reservas del día: total y desglose por estado (solicitada, pendiente, en mesa, ' +
        'completada, cancelada, rechazada). Úsala para "¿cuántas reservas hay?", ' +
        '"¿cómo van las mesas?", "estado de las reservas".',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'OMITE este parámetro salvo que el líder nombre una fecha concreta. Formato YYYY-MM-DD. Si se omite, es hoy.' },
        },
      },
    },
    handler: ({ fecha }, { contextData, emit }) => {
      const dia      = normalizarFecha(fecha)
      const reservas = (contextData.reservations || []).filter(r => r.date === dia)
      const byStatus = groupByStatus(reservas)

      emit({
        type: 'bar_chart',
        chartConfig: {
          title:  `Reservas por estado — ${dia}`,
          xLabel: 'Estado',
          yLabel: 'Cantidad',
          labels: byStatus.map(s => s.estado),
          values: byStatus.map(s => s.cantidad),
          color:  '#3b82f6',
        },
      })

      const activas = reservas.filter(r => ['pending', 'seated'].includes(r.status)).length
      return { fecha: dia, total: reservas.length, activas_ahora: activas, por_estado: byStatus }
    },
  },

  read_clients_vip: {
    roles: ['admin'],
    agents: ['ClientAgent'],
    schema: {
      name: 'read_clients_vip',
      description:
        'Lista de clientes VIP (5 o más reservas completadas), con su número de reservas. ' +
        'Úsala para "¿quiénes son nuestros VIP?", "clientes frecuentes".',
      parameters: { type: 'object', properties: {} },
    },
    handler: (_args, { contextData, emit }) => {
      const vip = (contextData.clients || []).filter(isVip)

      // La UI espera `completedReservations`; el seed lo llama `totalReservations`.
      if (vip.length > 0) {
        emit({ type: 'list', data: vip.map(c => ({ ...c, completedReservations: reservasDe(c) })) })
      }

      return {
        total_vip: vip.length,
        // Solo lo necesario para narrar. El teléfono no va al modelo.
        clientes: vip.slice(0, 20).map(c => ({
          nombre: c.name,
          reservas_completadas: reservasDe(c),
        })),
      }
    },
  },

  read_clients_summary: {
    roles: ['admin', 'cajero', 'hostess'],
    agents: ['ClientAgent'],
    schema: {
      name: 'read_clients_summary',
      description:
        'Resumen del CRM: total de clientes registrados, cuántos son VIP y cuántos se ' +
        'registraron hoy. Úsala para "¿cuántos clientes tenemos?", "estado del CRM".',
      parameters: { type: 'object', properties: {} },
    },
    handler: (_args, { contextData }) => {
      const clients = contextData.clients || []
      const vip     = clients.filter(isVip).length
      const hoy     = todayISO()

      return {
        total_clientes:  clients.length,
        clientes_vip:    vip,
        porcentaje_vip:  clients.length > 0 ? money((vip / clients.length) * 100) : 0,
        // El seed usa `registeredAt`, no `createdAt`.
        nuevos_hoy:      clients.filter(c => (c.registeredAt || c.createdAt || '').startsWith(hoy)).length,
      }
    },
  },

  read_purchase_plan: {
    roles: ['admin', 'lider_almacen'],
    agents: ['InventoryAgent'],
    schema: {
      name: 'read_purchase_plan',
      description:
        'Plan de compras del almacén para una fecha futura (por defecto, mañana): proyecta ' +
        'la demanda por plato desde el histórico de ventas, la convierte a insumos con las ' +
        'recetas, ajusta por fechas especiales (Día de la Madre, Día del Pollo a la Brasa, ' +
        'Fiestas Patrias), cruza contra el stock y sugiere qué comprar, a qué proveedor ' +
        '(el más barato registrado) y su contacto. Úsala para "¿qué debo comprar?", ' +
        '"plan de compras", "¿alcanza el stock para mañana?", "pedido al proveedor".',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'OMITE este parámetro salvo que el líder nombre una fecha concreta. Formato YYYY-MM-DD. Si se omite, se planifica para MAÑANA.' },
        },
      },
    },
    handler: ({ fecha }, { contextData, emit }) => {
      // A diferencia de las tools de lectura, aquí la fecha válida es FUTURA:
      // se planifica lo que viene, no se reporta lo que pasó.
      const manana = new Date()
      manana.setDate(manana.getDate() + 1)
      const mananaISO = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, '0')}-${String(manana.getDate()).padStart(2, '0')}`
      const objetivo = /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || '')) && fecha > todayISO()
        ? fecha
        : mananaISO

      // Histórico desde los pagos reales: cada línea consumida con su menuId.
      // El seed usa `itemId`; los cobros nuevos usan `menuId`; si solo hay
      // nombre, se resuelve contra la carta.
      const porNombre = Object.fromEntries(MENU_ITEMS.map(m => [m.name, m.id]))
      const historico = []
      for (const p of contextData.payments || []) {
        for (const it of p.items || []) {
          const menuId = it.menuId || it.itemId || porNombre[it.name]
          if (!menuId) continue
          historico.push({ fecha: p.date, menuId, qty: Number(it.qty) || 0 })
        }
      }

      const plan = planificarCompras({
        historico,
        fechaObjetivo: objetivo,
        recetas:   RECIPES,
        supplies:  SUPPLIES,
        suppliers: SUPPLIERS,
      })

      if (plan.orden_compra.length > 0) {
        emit({
          type: 'bar_chart',
          chartConfig: {
            title:  `Orden de compra sugerida — ${objetivo}${plan.fecha_especial ? ` (${plan.fecha_especial.nombre} ×${plan.factor_demanda})` : ''}`,
            xLabel: 'Insumo',
            yLabel: 'Costo estimado (S/)',
            labels: plan.orden_compra.slice(0, 8).map(i => i.insumo),
            values: plan.orden_compra.slice(0, 8).map(i => i.costo_estimado || 0),
            color:  '#e8622a',
          },
        })
      }

      return {
        fecha_objetivo:  plan.fecha_objetivo,
        fecha_especial:  plan.fecha_especial ? { nombre: plan.fecha_especial.nombre, factor: plan.factor_demanda } : null,
        base_proyeccion: plan.base_proyeccion,
        platos_proyectados: plan.proyeccion_platos.slice(0, 10),
        comprar: plan.orden_compra.map(i => ({
          insumo:    i.insumo,
          cantidad:  i.comprar,
          unidad:    i.unidad,
          proveedor: i.proveedor?.proveedor || 'SIN PROVEEDOR REGISTRADO',
          contacto:  i.proveedor?.contacto?.telefono || i.proveedor?.contacto?.whatsapp || i.proveedor?.contacto?.web || null,
          costo_estimado: i.costo_estimado,
        })),
        total_estimado: plan.total_estimado,
        nota_precios: 'Precios referenciales del seed de proveedores; confirmar con la lista negociada.',
        ...(plan.advertencias.length > 0 ? { advertencias: plan.advertencias } : {}),
      }
    },
  },

  read_system_status: {
    roles: ['admin'],
    agents: ['OrchestratorAgent'],
    schema: {
      name: 'read_system_status',
      description:
        'Estado del sistema multiagente: agentes registrados y activos, orquestaciones, ' +
        'swarms, mensajes en el EventBus, tasa de éxito y uptime. Úsala para ' +
        '"¿cómo están los agentes?", "estado del sistema", "métricas".',
      parameters: { type: 'object', properties: {} },
    },
    handler: (_args, { contextData }) => {
      const st = contextData.systemStatus
      if (!st) return { disponible: false, nota: 'El AgentContext no está montado.' }

      return {
        disponible:        true,
        topologia:         st.orchestrator?.topology,
        agentes_registrados: st.agents?.length || 0,
        agentes_activos:   st.activeAgents,
        orquestaciones:    st.orchestrator?.totalOrchestrations,
        swarms:            st.orchestrator?.swarmExecutions,
        mensajes_eventbus: st.eventBus?.totalMessages,
        tasa_exito_pct:    st.eventBus?.successRate,
        uptime_segundos:   st.orchestrator?.uptime,
      }
    },
  },
}

// ── Construcción de tools filtradas por rol ──────────────────────────────────

/**
 * buildToolsForRole — Devuelve las tools que el rol puede usar, en el formato
 * que espera `completeWithTools`, junto a sus handlers ya ligados al contexto.
 *
 * Las visualizaciones que emitan los handlers se acumulan en `emitted`.
 *
 * @param {string} role - admin | cajero | hostess | mozo | jefe_cocina
 * @param {Object} contextData - { payments, reservations, clients, systemStatus }
 * @returns {{ tools, handlers, emitted, agentsUsed, isEmpty }}
 */
export function buildToolsForRole(role, contextData) {
  const allowed = Object.values(TOOL_REGISTRY).filter(t => t.roles.includes(role))

  const emitted    = []
  const results    = []   // lo que devolvió cada tool: la única fuente de cifras válidas
  const agentsUsed = new Set()
  const handlers   = {}

  for (const tool of allowed) {
    handlers[tool.schema.name] = async (args) => {
      tool.agents.forEach(a => agentsUsed.add(a))
      const emit = (payload) => emitted.push(payload)
      const salida = tool.handler(args || {}, { contextData, emit })
      results.push(salida)
      return salida
    }
  }

  return {
    tools:      [{ functionDeclarations: allowed.map(t => t.schema) }],
    handlers,
    emitted,
    results,
    agentsUsed,
    isEmpty:    allowed.length === 0,
  }
}

// La extracción de cifras citables vive en core/numberGuard.js (numerosDe).

/** Nombres legibles de las capacidades del rol (para la UI y el prompt). */
export function describeToolsForRole(role) {
  return Object.values(TOOL_REGISTRY)
    .filter(t => t.roles.includes(role))
    .map(t => t.schema.description.split('.')[0])
}
