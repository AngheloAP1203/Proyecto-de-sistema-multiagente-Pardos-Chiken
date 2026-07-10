const base = '../src/agents/'
const { verificarCifras, numerosDe, cifrasSinRespaldo } = await import(base + 'core/numberGuard.js')
const { buildToolsForRole } = await import(base + 'tools/assistantTools.js')

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

const hoy = new Date().toISOString().split('T')[0]
const ctx = { payments: [
  { date: hoy, amount: 110, method:'tarjeta', time:'14:30', items:[{name:'1/2 Pardos Brasa', qty:2, subtotal:83.8}] },
  { date: hoy, amount: 478.4, method:'efectivo', time:'15:00', items:[{name:'Chicha', qty:10, subtotal:69}] },
], reservations: [], clients: [], systemStatus: null }

const { handlers, results } = buildToolsForRole('admin', ctx)
await handlers.read_sales_summary({})   // total 588.4, 2 transacciones

console.log('\n1) Sin herramientas ejecutadas → cualquier cifra es invención')
let v = verificarCifras('Hoy vendimos S/. 4,500.00', [], 0)
ok(v.invento === true && /sin llamar a ninguna herramienta/.test(v.motivo), 'detecta y explica el motivo')
v = verificarCifras('¡Hola! ¿En qué te ayudo?', [], 0)
ok(v.invento === false && v.motivo === null, 'saludo sin cifras → limpio')

console.log('\n2) Con herramientas → rastrea cada cifra hasta su salida')
v = verificarCifras('Vendimos S/. 588.40 en 2 transacciones', results, 1)
ok(v.invento === false, 'cifras respaldadas por read_sales_summary')
v = verificarCifras('Vendimos S/. 588.40 y además hubo 158 transacciones', results, 1)
ok(v.invento === true && v.sinRespaldo.includes(158), `cita un conteo inexistente → ${JSON.stringify(v.sinRespaldo)}`)
ok(/ninguna herramienta devolvió/.test(v.motivo), 'el motivo nombra las cifras huérfanas')

console.log('\n3) El resultado del handoff cuenta como cifra respaldada')
const cruce = { plato_estrella:'Chicha', participacion_pct: 11.7, total_del_dia: 588.4 }
results.push(cruce)
v = verificarCifras('La Chicha representa el 11.7% de S/. 588.40', results, 2)
ok(v.invento === false, 'la métrica cruzada (calculada en JS) es citable')

console.log('\n4) numerosDe recorre estructuras anidadas')
const nums = numerosDe({ a: 1.005, b: [ { c: 250.5 } ], d: 'texto' })
ok(nums.has(250.5) && nums.has(1.01) && nums.has(1), 'redondea a 2 decimales y al entero')
ok(cifrasSinRespaldo('nada aquí', results).length === 0, 'texto sin cifras → sin huérfanas')

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
