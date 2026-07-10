const base = '../src/agents/'
const { claveDeConsulta, huellaDeDatos, obtener, guardar, vaciar } = await import(base + 'core/responseCache.js')

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

const hoy = new Date().toISOString().split('T')[0]
const ctx = { payments: [{ id:'P1', date:hoy, amount:100 }], reservations: [{status:'pending'}], clients: [{name:'Ana'}] }
const RES_OK   = { success:true,  degraded:false, blocked:false, summary:'Vendimos S/. 100.00', agentsUsed:['CashAgent'] }
const RES_DEG  = { success:false, degraded:true,  summary:'fallback' }
const RES_BLQ  = { success:false, blocked:true,   summary:'bloqueado' }

console.log('\n1) ACIERTO — misma pregunta, mismo rol, mismos datos')
vaciar()
const k1 = claveDeConsulta({ prompt:'¿cuánto vendimos hoy?', role:'admin', contextData:ctx })
guardar(k1, RES_OK)
ok(obtener(k1)?.summary === 'Vendimos S/. 100.00', 'se sirve del caché')
const k1b = claveDeConsulta({ prompt:'¿CUÁNTO vendimos hoy?', role:'admin', contextData:ctx })
ok(obtener(k1b)?.summary === 'Vendimos S/. 100.00', 'mayúsculas y tildes no generan otra entrada')

console.log('\n2) INVALIDACIÓN — cualquier cambio relevante es otra clave')
const otroRol = claveDeConsulta({ prompt:'¿cuánto vendimos hoy?', role:'cajero', contextData:ctx })
ok(obtener(otroRol) === null, 'otro ROL jamás recibe la respuesta cacheada')

const ctxConVenta = { ...ctx, payments: [...ctx.payments, { id:'P2', date:hoy, amount:50 }] }
const kVenta = claveDeConsulta({ prompt:'¿cuánto vendimos hoy?', role:'admin', contextData:ctxConVenta })
ok(obtener(kVenta) === null, 'una VENTA nueva invalida (huella distinta)')

const ctxReserva = { ...ctx, reservations: [{status:'pending'},{status:'seated'}] }
ok(obtener(claveDeConsulta({ prompt:'¿cuánto vendimos hoy?', role:'admin', contextData:ctxReserva })) === null,
   'una RESERVA nueva también invalida')

const conHistorial = claveDeConsulta({ prompt:'¿y el ticket promedio?', role:'admin', contextData:ctx,
  history:[{role:'user',content:'¿cuánto vendimos hoy?'},{role:'agent',content:'S/. 100'}] })
const otroHistorial = claveDeConsulta({ prompt:'¿y el ticket promedio?', role:'admin', contextData:ctx,
  history:[{role:'user',content:'¿cuántas reservas hay?'},{role:'agent',content:'5 reservas'}] })
ok(conHistorial !== otroHistorial, 'la MISMA pregunta con otro contexto conversacional es otra entrada')

console.log('\n3) SOLO se cachean éxitos completos')
vaciar()
const kd = claveDeConsulta({ prompt:'x', role:'admin', contextData:ctx })
guardar(kd, RES_DEG); ok(obtener(kd) === null, 'un resultado degradado NO se guarda')
guardar(kd, RES_BLQ); ok(obtener(kd) === null, 'un bloqueo NO se guarda')
guardar(kd, RES_OK);  ok(obtener(kd) !== null, 'un éxito sí')

console.log('\n4) La huella es estable y sensible')
ok(huellaDeDatos(ctx) === huellaDeDatos({ ...ctx }), 'mismos datos → misma huella')
ok(huellaDeDatos(ctx) !== huellaDeDatos(ctxConVenta), 'datos distintos → huella distinta')
ok(typeof huellaDeDatos({}) === 'string', 'contexto vacío no revienta')

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
