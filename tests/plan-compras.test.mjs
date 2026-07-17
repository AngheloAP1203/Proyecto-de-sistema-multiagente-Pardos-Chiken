/**
 * tests/plan-compras.test.mjs
 * M7 — Planificador de demanda y compras. Todo determinista: asserts exactos.
 */
const base = '../src/agents/'
const { explotarVentasAInsumos, proyectarDemanda, generarPlanCompra, planificarCompras } =
  await import('../src/domain/inventory/purchasePlanner.js')
const { RECIPES } = await import('../src/data/seeds/recipesSeed.js')
const { SUPPLIES } = await import('../src/data/seeds/suppliesSeed.js')
const { SUPPLIERS } = await import('../src/data/seeds/suppliersSeed.js')
const { resolverFechaEspecial } = await import('../src/data/seeds/specialDatesSeed.js')

let fail = 0
const ok = (c, l) => { console.log(`${c ? '  PASS' : '  FALL'}  ${l}`); if (!c) fail++ }

console.log('\n1) Explosión BOM: 20 × 1/4 pollo = 5 pollos enteros (el ejemplo del líder de almacén)')
{
  const { insumos, sin_receta } = explotarVentasAInsumos([{ menuId: 'B01', qty: 20 }], RECIPES)
  ok(insumos.POLLO_ENTERO === 5, `20 cuartos → ${insumos.POLLO_ENTERO} pollos (esperado 5)`)
  ok(insumos.PAPA === 5, `20 × 0.25 kg papa → ${insumos.PAPA} kg (esperado 5)`)
  ok(sin_receta.length === 0, 'ningún plato sin receta')
}

console.log('\n2) Plato sin receta → se reporta, no se ignora')
{
  const { sin_receta } = explotarVentasAInsumos([{ menuId: 'ZZZ99', qty: 3 }], RECIPES)
  ok(sin_receta.includes('ZZZ99'), 'ZZZ99 aparece en sin_receta')
}

console.log('\n3) Fechas especiales peruanas')
{
  // 2026: Día de la Madre = 2.º domingo de mayo = 10/05/2026
  const madre = resolverFechaEspecial('2026-05-10')
  ok(madre?.id === 'DIA_MADRE', `10/05/2026 es Día de la Madre (${madre?.id})`)
  // Día del Pollo a la Brasa = 3.er domingo de julio = 19/07/2026
  const pollo = resolverFechaEspecial('2026-07-19')
  ok(pollo?.id === 'DIA_POLLO' && pollo.factor === 3, `19/07/2026 es Día del Pollo, factor ${pollo?.factor}`)
  ok(resolverFechaEspecial('2026-07-28')?.id === 'FIESTAS_28', '28/07 es fecha fija')
  ok(resolverFechaEspecial('2026-03-11') === null, 'un día común no es especial')
}

console.log('\n4) Proyección: promedio por día de semana × factor especial')
{
  // Histórico: dos domingos previos con 20 y 30 unidades de B01 → promedio 25.
  const historico = [
    { fecha: '2026-07-05', menuId: 'B01', qty: 20 }, // domingo
    { fecha: '2026-07-12', menuId: 'B01', qty: 30 }, // domingo
    { fecha: '2026-07-14', menuId: 'B01', qty: 99 }, // martes: NO debe contar
  ]
  const normal = proyectarDemanda(historico, '2026-07-26') // domingo común
  ok(normal.proyeccion[0].qty === 25, `domingo normal proyecta ${normal.proyeccion[0].qty} (esperado 25)`)

  const diaPollo = proyectarDemanda(historico, '2026-07-19') // Día del Pollo ×3
  ok(diaPollo.proyeccion[0].qty === 75, `Día del Pollo proyecta ${diaPollo.proyeccion[0].qty} (esperado 75)`)
  ok(diaPollo.factor === 3, 'factor aplicado = 3')
}

console.log('\n5a) Sin día de semana comparable → fallback a todo el histórico (mejor que un cero)')
{
  // Solo hay un martes en el histórico, pero se pide un domingo (Día del Pollo ×3).
  // Antes devolvía vacío; ahora promedia lo disponible y aplica el factor.
  const r = proyectarDemanda([{ fecha: '2026-07-14', menuId: 'B01', qty: 10 }], '2026-07-19')
  ok(r.proyeccion.length > 0, 'proyecta usando el histórico disponible, no lo ignora')
  ok(r.proyeccion[0].qty === 30, `10 × factor 3 = ${r.proyeccion[0].qty} (esperado 30)`)
}

console.log('\n5b) Histórico totalmente vacío → advertencia honesta, no un cero inventado')
{
  const r = proyectarDemanda([], '2026-07-19')
  ok(r.proyeccion.length === 0 && !!r.advertencia, 'sin datos: advertencia y proyección vacía')
  ok(r.base === 'sin_historico', 'base marcada como sin_historico')
}

console.log('\n6) Plan de compra: cubre demanda + colchón y elige el proveedor más barato')
{
  const supplies = [
    { id: 'POLLO_ENTERO', nombre: 'Pollo', unidad: 'unidad', stock_actual: 10, stock_minimo: 5 },
    { id: 'PAPA', nombre: 'Papa', unidad: 'kg', stock_actual: 100, stock_minimo: 10 },
  ]
  const demanda = { POLLO_ENTERO: 60, PAPA: 20 } // papa alcanza de sobra
  const plan = generarPlanCompra(demanda, supplies, SUPPLIERS)

  const pollo = plan.items.find(i => i.supplyId === 'POLLO_ENTERO')
  ok(pollo.comprar === 55, `comprar = 60 + 5 − 10 = ${pollo.comprar} (esperado 55)`)
  // Avícola Estela (21.9) < Avinka (22.8) < San Fernando (23.5)
  ok(pollo.proveedor?.proveedorId === 'AVE', `elige el más barato: ${pollo.proveedor?.proveedor}`)
  ok(pollo.proveedor?.contacto?.telefono === '+51 908 750 004', 'trae el contacto real del proveedor')
  ok(!plan.items.find(i => i.supplyId === 'PAPA'), 'papa con stock suficiente NO entra a la orden')
}

console.log('\n7) Insumo sin proveedor → advertencia, no silencio')
{
  const supplies = [{ id: 'MISTERIO', nombre: 'Insumo huérfano', unidad: 'kg', stock_actual: 0, stock_minimo: 1 }]
  const plan = generarPlanCompra({ MISTERIO: 5 }, supplies, SUPPLIERS)
  ok(plan.advertencias.some(a => a.includes('MISTERIO')), 'advierte que MISTERIO no tiene proveedor')
  ok(plan.items[0].proveedor === null && plan.items[0].costo_estimado === null, 'item sin proveedor ni costo')
}

console.log('\n8) Flujo completo (planificarCompras) — determinista e idempotente')
{
  const historico = [
    { fecha: '2026-07-05', menuId: 'B01', qty: 20 },
    { fecha: '2026-07-12', menuId: 'B01', qty: 30 },
    { fecha: '2026-07-05', menuId: 'BE01', qty: 15 },
    { fecha: '2026-07-12', menuId: 'BE01', qty: 25 },
  ]
  const args = { historico, fechaObjetivo: '2026-07-19', recetas: RECIPES, supplies: SUPPLIES, suppliers: SUPPLIERS }
  const r1 = planificarCompras(args)
  const r2 = planificarCompras(args)

  ok(r1.fecha_especial?.id === 'DIA_POLLO', 'detecta el Día del Pollo a la Brasa')
  // 75 × 1/4 pollo = 18.75 pollos de consumo proyectado
  ok(r1.consumo_insumos.POLLO_ENTERO === 18.75, `consumo pollo = ${r1.consumo_insumos.POLLO_ENTERO} (esperado 18.75)`)
  const pollo = r1.orden_compra.find(i => i.supplyId === 'POLLO_ENTERO')
  // 18.75 + 10 (mínimo) − 22 (stock) = 6.75 → 7 unidades enteras
  ok(pollo?.comprar === 7, `orden de pollo = ${pollo?.comprar} unidades (esperado 7)`)
  ok(r1.total_estimado > 0, `total estimado S/ ${r1.total_estimado}`)
  ok(JSON.stringify(r1) === JSON.stringify(r2), 'dos corridas idénticas dan el mismo plan (idempotente)')
}

console.log(`\n${fail === 0 ? 'TODO OK' : fail + ' FALLOS'}\n`); process.exit(fail ? 1 : 0)
