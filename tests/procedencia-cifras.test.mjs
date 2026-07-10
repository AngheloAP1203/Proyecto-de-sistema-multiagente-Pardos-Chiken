import { buildToolsForRole } from '../src/agents/tools/assistantTools.js'
import { numerosDe } from '../src/agents/core/numberGuard.js'

const MONTO  = /S\/\.?\s*([\d.,]+)|\b(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})\b/g
const CONTEO = /\b(\d[\d,]*)\s+(transacci\w*|reservas?|clientes?|unidades?|platos?|pedidos?)\b/gi
const aNum = s => parseFloat(String(s).replace(/,/g,''))
const sinRespaldo = (t, ok) => { const c=[]
  for (const m of t.matchAll(MONTO))  c.push(aNum(m[1] ?? m[2]))
  for (const m of t.matchAll(CONTEO)) c.push(aNum(m[1]))
  return c.filter(n => Number.isFinite(n) && !ok.has(n)) }

// Datos reales del seed de hoy
const hoy = new Date().toISOString().split('T')[0]
const pagos = [
  {date:hoy,amount:110,method:'tarjeta',time:'14:30',items:[{name:'1/2 Pardos Brasa',qty:2,subtotal:83.8}]},
  {date:hoy,amount:52.5,method:'yape',time:'15:45',items:[]},
  {date:hoy,amount:89,method:'efectivo',time:'13:10',items:[]},
  {date:hoy,amount:76.8,method:'tarjeta',time:'14:00',items:[]},
  {date:hoy,amount:63.7,method:'yape',time:'14:50',items:[]},
  {date:hoy,amount:137.6,method:'tarjeta',time:'15:20',items:[]},
  {date:hoy,amount:58.8,method:'efectivo',time:'16:00',items:[]},
]
const { handlers, results } = buildToolsForRole('admin', { payments: pagos, reservations: [], clients: [], systemStatus: null })
await handlers.read_top_items({ top_n: 5 })   // el modelo SOLO llamó a esta
const ok = numerosDe(results)

let fail = 0
const t = (txt, debeFallar, label) => { const s = sinRespaldo(txt, ok); const bien = (s.length>0) === debeFallar
  console.log(`${bien?'  PASS':'  FALL'}  ${label}${s.length?'  → sin respaldo: '+JSON.stringify(s):''}`); if(!bien) fail++ }

console.log('\nDEBE marcar como inventado (cifras de una tool que no llamó):')
t('el total cobrado es de S/. 3,510.20, con 158 transacciones y un ticket promedio de S/. 22.17', true, 'resumen de ventas fabricado')
t('Hoy vendimos S/. 1,234.56', true, 'monto inventado')
t('Tuvimos 6 transacciones', true, 'conteo inventado (real: 7)')
t('El ticket promedio es S/. 84.05', true, 'promedio recalculado a mano (real: 84.06)')

console.log('\nNO debe marcar (todo sale de read_top_items):')
const r = results[0]
t(`La Chicha Pardos 500ml es el plato más consumido con ${r.items[0].unidades} unidades`, false, 'unidades del top')
t(`El total de unidades analizadas es ${r.unidades_totales}`, false, 'agregado precalculado')
t('¡Hola! ¿En qué te ayudo?', false, 'saludo sin cifras')
t('El pico fue a las 14:00 y representó el 43% del día', false, 'hora y porcentaje se ignoran')

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
