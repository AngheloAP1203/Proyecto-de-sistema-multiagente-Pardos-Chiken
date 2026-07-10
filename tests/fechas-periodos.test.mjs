const base = '../src/agents/'
const { buildToolsForRole } = await import(base + 'tools/assistantTools.js')
const { calcularParticipacion } = await import(base + 'core/assistantGraph.js')

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

const hoy = new Date().toISOString().split('T')[0]
const manana = new Date(Date.now() + 864e5).toISOString().split('T')[0]
const ctx = { payments: [
  { date: hoy,          amount: 110,   method:'tarjeta',  time:'14:30', items:[{name:'Brasa', qty:2, subtotal:83.8}] },
  { date: hoy,          amount: 478.4, method:'efectivo', time:'15:00', items:[{name:'Chicha', qty:10, subtotal:69}] },
  { date: '2026-07-01', amount: 900,   method:'yape',     time:'13:00', items:[{name:'Chicha', qty:24, subtotal:165.6}] },
], reservations: [], clients: [], systemStatus: null }

const { handlers } = buildToolsForRole('admin', ctx)

console.log('\n1) FECHAS INVÁLIDAS → hoy')
ok((await handlers.read_sales_summary({ fecha:'hoy' })).fecha === hoy, '"hoy" (texto) → fecha de hoy')
ok((await handlers.read_sales_summary({ fecha: manana })).fecha === hoy, 'fecha futura → hoy (una venta futura no existe)')
ok((await handlers.read_sales_summary({ fecha:'2026-7-1' })).fecha === hoy, 'formato malformado → hoy')
ok((await handlers.read_sales_summary({ fecha:'2026-07-01' })).total === 900, 'fecha pasada válida sí se respeta')

console.log('\n2) ENSANCHE DE PERÍODO → explícito, nunca silencioso')
const delDia = await handlers.read_top_items({})
ok(delDia.es_del_dia === true && delDia.periodo === hoy, 'con datos del día, no ensancha')
ok(delDia.advertencia === undefined, 'sin advertencia cuando no hace falta')

const ctxPobre = { ...ctx, payments: [ctx.payments[0], ctx.payments[2]] }  // 1 pago hoy
const h2 = buildToolsForRole('admin', ctxPobre).handlers
const ensanchado = await h2.read_top_items({})
ok(ensanchado.es_del_dia === false, 'con 1 solo pago hoy, ensancha')
ok(/no de ese día/.test(ensanchado.advertencia || ''), 'y lo advierte al modelo de forma explícita')

console.log('\n3) CRUCE DE DOMINIOS — nunca mezcla períodos (el bug encontrado)')
const ventasHoy = await handlers.read_sales_summary({})
const c = calcularParticipacion(delDia, ventasHoy)
ok(c !== null && c.participacion_pct === 11.7, `mismo día → 69/588.40 = 11.7% (obtenido ${c?.participacion_pct})`)
ok(c.fecha === hoy, 'la métrica declara su fecha')

const ventasPobre = await h2.read_sales_summary({})
ok(calcularParticipacion(ensanchado, ventasPobre) === null,
   'top histórico + ventas de hoy → SIN cruce (antes daba 39.9%, un número sin sentido)')
ok(calcularParticipacion({ items:[{nombre:'Otros',unidades:1,ingresos:5}], es_del_dia:true, fecha_solicitada:hoy }, ventasHoy) === null,
   'solo "Otros" → sin cruce')
ok(calcularParticipacion(delDia, { fecha: hoy, total: 0 }) === null, 'total 0 → sin división por cero')

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
