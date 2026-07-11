import { rewardAgent } from '../src/agents/RewardAgent.js'

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

const hoy = new Date().toISOString().split('T')[0]
const datos = {
  reservations: [
    { id:'R001', tableId:'T03', clientName:'María García', clientPhone:'987654321', date:hoy, status:'seated' },
    { id:'R002', tableId:'T01', clientName:'Roberto Silva', clientPhone:'912345678', date:hoy, status:'completed' },
  ],
  kitchenTickets: [ { id:'TK1', tableId:'T03' } ],
  payments: [ { id:'P001', reservationId:'R001', amount:110, date:hoy } ],
  policies: [
    { id:'POL001', problema:'pollo_frio', palabras_clave:['frío','frio','helado'], requiere_promo:true, promo_sugerida:'P001' },
  ],
  promotions: [
    { id:'P001', nombre:'Vale 20% próxima visita', tipo:'descuento_porcentaje', valor:20, condiciones:'Consumo mínimo S/50', vigencia_dias:30, activa:true },
    { id:'P002', nombre:'Vale S/30 de descuento', tipo:'descuento_monto', valor:30, condiciones:'Consumo mayor a S/80', vigencia_dias:15, activa:true },
  ],
}

console.log('\n1) VERIFICADO → recompensa acorde al problema')
let r = await rewardAgent.evaluar(
  { tableId:'T03', telefono:'987654321', cliente:'María García', puntos_criticos:['Pollo frío'], prioridad:'Alta', mensaje:'el pollo llegó frío' },
  datos)
ok(r.elegible===true, 'María (verificada) es elegible')
ok(r.recompensa?.id==='P001', `recompensa = política del pollo frío (P001), obtenido ${r.recompensa?.id}`)
ok(r.mensaje.includes('20%') || r.mensaje.includes('Vale'), 'el mensaje nombra la recompensa real')
ok(!r.mensaje.includes('S/30'), 'no menciona un cupón distinto al asignado')

console.log('\n2) RECHAZADO (fraude) → sin recompensa, nunca llama al LLM para premiar')
r = await rewardAgent.evaluar(
  { tableId:'T03', telefono:'999000111', cliente:'Vivo', puntos_criticos:['Pollo frío'], prioridad:'Alta' },
  datos)
ok(r.elegible===false && r.veredicto==='RECHAZADO', 'teléfono no coincide → rechazado')
ok(r.recompensa===null, 'sin recompensa')
ok(/no pudimos verificar|seguridad|boleta/i.test(r.mensaje), 'mensaje de rechazo, no de premio')

console.log('\n3) SIN_MESA → pide la mesa, sin premio')
r = await rewardAgent.evaluar({ telefono:'987654321', puntos_criticos:['Pollo frío'], prioridad:'Alta' }, datos)
ok(r.elegible===false && r.veredicto==='SIN_MESA' && r.recompensa===null, 'sin mesa → no elegible')

console.log('\n4) SIN_COMANDA → mesa sin consumo, sin premio')
r = await rewardAgent.evaluar({ tableId:'T09', telefono:'987654321', prioridad:'Alta' }, datos)
ok(r.elegible===false && r.veredicto==='SIN_COMANDA', 'mesa vacía → no elegible')

console.log('\n5) Severidad sin política específica → default por prioridad')
r = await rewardAgent.evaluar(
  { tableId:'T03', telefono:'987654321', puntos_criticos:['algo raro'], prioridad:'Crítica' }, datos)
ok(r.elegible && r.recompensa?.id==='P002', `Crítica sin política → P002 (S/30), obtenido ${r.recompensa?.id}`)

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
