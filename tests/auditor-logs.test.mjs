import { auditLogger } from '../src/agents/core/auditLogger.js'

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

auditLogger.limpiar()

console.log('\n1) Registra entradas estructuradas')
auditLogger.record({ agente:'AssistantAgent', accion:'assistant.query', resultado:'ok', latencia:1200, detalle:{ rol:'admin', modelo:'llama-3.3-70b-versatile' } })
auditLogger.record({ agente:'AssistantAgent', accion:'guardrail.block', nivel:'warn', resultado:'BLOCKED.destructive', detalle:{ rol:'admin', prompt:'borra todo' } })
let e = auditLogger.getEntries()
ok(e.length===2, `2 entradas (obtenido ${e.length})`)
ok(e[0].accion==='guardrail.block', 'la más reciente primero')
ok(typeof e[0].ts==='string' && e[0].nivel==='warn', 'timestamp y nivel presentes')

console.log('\n2) REDACCIÓN — el teléfono nunca queda en claro')
auditLogger.record({ agente:'RewardAgent', accion:'claim.verify', nivel:'warn', resultado:'RECHAZADO', detalle:{ mesa:'T03', telefono:'987654321', elegible:false } })
e = auditLogger.getEntries({ agente:'RewardAgent' })
const tel = e[0].detalle.telefono
ok(!/987654321/.test(tel) && /\*\*\*\*/.test(tel), `teléfono redactado: "${tel}"`)
ok(e[0].detalle.mesa==='T03', 'la mesa (no sensible) sí se guarda')

console.log('\n3) Filtros y estadísticas')
ok(auditLogger.getEntries({ nivel:'warn' }).length===2, 'filtra por nivel warn')
ok(auditLogger.getEntries({ agente:'AssistantAgent' }).length===2, 'filtra por agente')
const st = auditLogger.stats()
ok(st.total===3 && st.porNivel.warn===2 && st.porAgente.RewardAgent===1, 'stats correctas')

console.log('\n4) Export y suscripción en vivo')
const json = JSON.parse(auditLogger.exportarJSON())
ok(Array.isArray(json) && json.length===3, 'export JSON válido')
let recibido = null
const unsub = auditLogger.subscribe(x => { recibido = x })
auditLogger.record({ agente:'X', accion:'test' })
ok(recibido?.accion==='test', 'los suscriptores reciben cada entrada nueva (para UI en vivo)')
unsub()

console.log('\n5) Ring buffer — no crece sin límite')
for (let i=0;i<250;i++) auditLogger.record({ agente:'spam', accion:'x'+i })
ok(auditLogger.stats().total<=200, `tope de 200 entradas respetado (${auditLogger.stats().total})`)

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
