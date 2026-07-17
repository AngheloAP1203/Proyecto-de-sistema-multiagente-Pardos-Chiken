/**
 * src/domain/inventory/purchasePlanner.js
 * ─────────────────────────────────────────────────────────────────────────────
 * M7 — Planificador de demanda y compras (MRP de bolsillo).
 *
 * Funciones PURAS y deterministas — el LLM no decide nada aquí, solo narra el
 * resultado (misma filosofía que claimVerifier y numberGuard):
 *
 *   1. explotarVentasAInsumos : ventas por plato → consumo de insumos (BOM)
 *   2. proyectarDemanda       : histórico → demanda del día objetivo
 *                               (promedio por día de semana × factor de fecha especial)
 *   3. generarPlanCompra      : demanda + stock + proveedores → orden de compra
 *                               con el proveedor más barato por insumo y su contacto
 *
 * Reglas de honestidad:
 *   - Plato sin receta → va a `sin_receta`, nunca se ignora en silencio.
 *   - Insumo sin proveedor → va con proveedor null y advertencia.
 *   - Los redondeos SIEMPRE hacia arriba (no se compra 4.2 pollos: se compran 5).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { resolverFechaEspecial } from '../../data/seeds/specialDatesSeed.js'

const redondear2 = (n) => Math.round(n * 100) / 100

/**
 * explotarVentasAInsumos — Convierte unidades vendidas por plato en consumo
 * de insumos usando la lista de materiales (recetas).
 *
 * @param {Array}  ventas  [{ menuId, qty }]
 * @param {Object} recetas { menuId: [{ supplyId, cantidad }] }
 * @returns {{ insumos: Object<string, number>, sin_receta: string[] }}
 */
export function explotarVentasAInsumos(ventas = [], recetas = {}) {
  const insumos = {}
  const sinReceta = new Set()

  for (const v of ventas) {
    const qty = Number(v?.qty) || 0
    if (qty <= 0) continue

    const receta = recetas[v.menuId]
    if (!receta) {
      sinReceta.add(v.menuId)
      continue
    }
    for (const ing of receta) {
      insumos[ing.supplyId] = redondear2((insumos[ing.supplyId] || 0) + ing.cantidad * qty)
    }
  }
  return { insumos, sin_receta: [...sinReceta] }
}

/**
 * proyectarDemanda — Proyección de ventas por plato para una fecha objetivo.
 *
 * Método: promedio de las ventas de los MISMOS días de semana del histórico
 * (los domingos se parecen a los domingos, no a los martes), multiplicado por
 * el factor de fecha especial si aplica.
 *
 * @param {Array}  historico     [{ fecha: 'YYYY-MM-DD', menuId, qty }]
 * @param {string} fechaObjetivo 'YYYY-MM-DD'
 * @returns {{ proyeccion: Array<{menuId, qty}>, base: string, fecha_especial: Object|null, factor: number, advertencia?: string }}
 */
export function proyectarDemanda(historico = [], fechaObjetivo) {
  const [y, m, d] = String(fechaObjetivo).split('-').map(Number)
  const diaObjetivo = new Date(y, m - 1, d).getDay()

  // Agrupar el histórico por fecha, quedándonos con los mismos días de semana.
  const porFecha = {}
  for (const h of historico) {
    const [hy, hm, hd] = String(h.fecha).split('-').map(Number)
    if (new Date(hy, hm - 1, hd).getDay() !== diaObjetivo) continue
    if (!porFecha[h.fecha]) porFecha[h.fecha] = {}
    porFecha[h.fecha][h.menuId] = (porFecha[h.fecha][h.menuId] || 0) + (Number(h.qty) || 0)
  }

  let fechas = Object.keys(porFecha)
  const especial = resolverFechaEspecial(fechaObjetivo)
  const factor = especial ? especial.factor : 1

  if (fechas.length === 0) {
    // Fallback: Si no hay ventas en ese día de la semana, promediar TODOS los días disponibles
    for (const h of historico) {
      if (!porFecha[h.fecha]) porFecha[h.fecha] = {}
      porFecha[h.fecha][h.menuId] = (porFecha[h.fecha][h.menuId] || 0) + (Number(h.qty) || 0)
    }
    fechas = Object.keys(porFecha)

    if (fechas.length === 0) {
      return {
        proyeccion: [],
        base: 'sin_historico',
        fecha_especial: especial,
        factor,
        advertencia: `No hay ventas históricas registradas; no se puede proyectar ${fechaObjetivo}.`,
      }
    }
  }

  // Promedio por plato entre los días comparables, siempre redondeado ARRIBA:
  // quedarse corto de pollo cuesta más que sobrar una unidad.
  const suma = {}
  for (const f of fechas) {
    for (const [menuId, qty] of Object.entries(porFecha[f])) {
      suma[menuId] = (suma[menuId] || 0) + qty
    }
  }
  const proyeccion = Object.entries(suma)
    .map(([menuId, total]) => ({ menuId, qty: Math.ceil((total / fechas.length) * factor) }))
    .filter(p => p.qty > 0)
    .sort((a, b) => b.qty - a.qty)

  return {
    proyeccion,
    base: `promedio de ${fechas.length} día(s) comparables`,
    fecha_especial: especial,
    factor,
  }
}

/** Proveedor activo más barato para un insumo, o null si nadie lo vende. */
function mejorProveedor(supplyId, suppliers) {
  let mejor = null
  for (const prov of suppliers) {
    if (prov.activo === false) continue
    const oferta = (prov.precios || []).find(p => p.supplyId === supplyId)
    if (!oferta) continue
    if (!mejor || oferta.precio < mejor.precio) {
      mejor = {
        proveedorId: prov.id,
        proveedor:   prov.nombre,
        precio:      oferta.precio,
        contacto:    prov.contacto || null,
        precio_referencial: prov.precio_referencial === true,
      }
    }
  }
  return mejor
}

/**
 * generarPlanCompra — Cruza demanda proyectada de insumos contra stock y
 * proveedores; arma la orden de compra sugerida.
 *
 * comprar = max(0, necesidad + stock_minimo − stock_actual)
 * (el mínimo es colchón: después de cubrir la demanda debe quedar el colchón intacto)
 *
 * @param {Object} demandaInsumos { supplyId: cantidadNecesaria }
 * @param {Array}  supplies       catálogo con stock_actual y stock_minimo
 * @param {Array}  suppliers      proveedores con precios
 * @returns {{ items: Array, total_estimado: number, advertencias: string[] }}
 */
export function generarPlanCompra(demandaInsumos = {}, supplies = [], suppliers = []) {
  const porId = Object.fromEntries(supplies.map(s => [s.id, s]))
  const items = []
  const advertencias = []
  let total = 0

  for (const [supplyId, necesidad] of Object.entries(demandaInsumos)) {
    const insumo = porId[supplyId]
    if (!insumo) {
      advertencias.push(`Insumo desconocido en demanda: ${supplyId}`)
      continue
    }

    const stockActual = Number(insumo.stock_actual) || 0
    const stockMinimo = Number(insumo.stock_minimo) || 0
    const faltante = necesidad + stockMinimo - stockActual
    if (faltante <= 0) continue // alcanza con lo que hay

    // Unidades enteras se compran enteras; los kg/L se redondean a 2 decimales.
    const esUnitario = insumo.unidad === 'unidad' || insumo.unidad === 'porcion'
    const comprar = esUnitario ? Math.ceil(faltante) : redondear2(faltante)

    const prov = mejorProveedor(supplyId, suppliers)
    const costo = prov ? redondear2(comprar * prov.precio) : null
    if (!prov) {
      advertencias.push(`Sin proveedor registrado para ${insumo.nombre} (${supplyId}).`)
    } else {
      total += costo
    }

    items.push({
      supplyId,
      insumo:        insumo.nombre,
      unidad:        insumo.unidad,
      necesidad:     redondear2(necesidad),
      stock_actual:  stockActual,
      stock_minimo:  stockMinimo,
      comprar,
      proveedor:     prov, // { proveedor, precio, contacto } o null
      costo_estimado: costo,
    })
  }

  items.sort((a, b) => (b.costo_estimado || 0) - (a.costo_estimado || 0))
  return { items, total_estimado: redondear2(total), advertencias }
}

/**
 * calcularConsumoDia — Cuánto insumo se consumió realmente por las ventas de un
 * día, aplicando la regla de indivisibilidad del pollo.
 *
 * El pollo (y todo insumo en 'unidad'/'porcion') solo se gasta en piezas enteras:
 * vender 3 cuartos abre 1 pollo, no 0.75. Por eso el consumo de esos insumos se
 * redondea HACIA ARRIBA. Los insumos por peso/volumen (kg, L) se gastan exactos.
 *
 * @param {Array}  ventasDia  [{ menuId, qty }]  ventas (cobradas) del día
 * @param {Object} recetas    BOM
 * @param {Array}  supplies   catálogo (para saber la unidad de cada insumo)
 * @returns {Object<string, number>} { supplyId: cantidadConsumida }
 */
export function calcularConsumoDia(ventasDia = [], recetas = {}, supplies = []) {
  const { insumos } = explotarVentasAInsumos(ventasDia, recetas)
  const porId = Object.fromEntries(supplies.map(s => [s.id, s]))
  const consumo = {}
  for (const [supplyId, cant] of Object.entries(insumos)) {
    const insumo = porId[supplyId]
    const enPiezasEnteras = insumo && (insumo.unidad === 'unidad' || insumo.unidad === 'porcion')
    consumo[supplyId] = enPiezasEnteras ? Math.ceil(cant) : redondear2(cant)
  }
  return consumo
}

/**
 * aplicarStockVivo — Descuenta el consumo del día del stock inicial de cada
 * insumo. El stock que ve el líder de almacén = inicial − consumido, sin bajar
 * de cero. No muta nada: devuelve una copia con el rastro (stock_inicial y
 * consumido_hoy) para poder narrarlo.
 *
 * @param {Array}  supplies  catálogo con stock_actual = stock INICIAL del día
 * @param {Object} consumo   salida de calcularConsumoDia
 */
export function aplicarStockVivo(supplies = [], consumo = {}) {
  return supplies.map(s => {
    const usado = consumo[s.id] || 0
    const inicial = Number(s.stock_actual) || 0
    const restante = Math.max(0, inicial - usado)
    return {
      ...s,
      stock_inicial: inicial,
      consumido_hoy: usado,
      stock_actual:  redondear2(restante),
      bajo_minimo:   restante < (Number(s.stock_minimo) || 0),
    }
  })
}

/**
 * planificarCompras — Orquestación completa en un paso:
 * histórico → proyección de mañana → explosión a insumos → orden de compra.
 * Devuelve todo el rastro intermedio para que el LLM narre con cifras trazables
 * (numberGuard: cada número de la respuesta debe existir en esta salida).
 */
export function planificarCompras({ historico, fechaObjetivo, recetas, supplies, suppliers }) {
  const demanda = proyectarDemanda(historico, fechaObjetivo)
  const { insumos, sin_receta } = explotarVentasAInsumos(demanda.proyeccion, recetas)
  const plan = generarPlanCompra(insumos, supplies, suppliers)

  return {
    fecha_objetivo:  fechaObjetivo,
    fecha_especial:  demanda.fecha_especial,
    factor_demanda:  demanda.factor,
    base_proyeccion: demanda.base,
    proyeccion_platos: demanda.proyeccion,
    consumo_insumos: insumos,
    sin_receta,
    orden_compra:    plan.items,
    total_estimado:  plan.total_estimado,
    advertencias:    [...(demanda.advertencia ? [demanda.advertencia] : []), ...plan.advertencias],
  }
}
