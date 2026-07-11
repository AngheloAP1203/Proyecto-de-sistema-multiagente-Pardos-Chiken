import { verificarReclamo, VEREDICTO } from '../src/agents/core/claimVerifier.js'

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

const hoy = '2026-07-11'
// Datos reales del tipo del seed: María (T03, tel 987654321) reservó, hay comanda y pago.
const datos = {
  reservations: [
    { id:'R001', tableId:'T03', clientName:'María García',  clientPhone:'987654321', date:hoy, status:'seated' },
    { id:'R002', tableId:'T01', clientName:'Roberto Silva', clientPhone:'912345678', date:hoy, status:'completed' },
    { id:'R003', tableId:'T06', clientName:'Ana López',     clientPhone:'998877665', date:hoy, status:'approved' },
  ],
  kitchenTickets: [ { id:'TK1', tableId:'T03', items:[{name:'Pollo'}] } ],
  payments: [ { id:'P001', reservationId:'R001', amount:110, date:hoy } ],
}

console.log('\n1) VERIFICADO — teléfono + mesa + consumo coinciden')
let r = verificarReclamo({ tableId:'T03', telefono:'987654321', fecha:hoy }, datos)
ok(r.veredicto===VEREDICTO.VERIFICADO && r.elegible, 'María reclama su propia mesa → elegible')
ok(r.cliente==='María García' && r.reservationId==='R001', 'identifica al cliente y la reserva')
ok(r.pago?.amount===110, 'adjunta el pago verificado')

console.log('\n2) VERIFICADO tolerante a formato de teléfono y mesa')
ok(verificarReclamo({ tableId:'t3',    telefono:'987 654 321' }, datos).elegible, 'acepta "t3" y teléfono con espacios')
ok(verificarReclamo({ tableId:'mesa 3',telefono:'987-654-321' }, datos).elegible, 'acepta "mesa 3" y guiones')

console.log('\n3) RECHAZADO — la mesa tuvo consumo pero el teléfono NO coincide (fraude)')
r = verificarReclamo({ tableId:'T03', telefono:'999000111', fecha:hoy }, datos)
ok(r.veredicto===VEREDICTO.RECHAZADO && !r.elegible, 'un extraño reclama la mesa de María → rechazado')
r = verificarReclamo({ tableId:'T01', telefono:'987654321', fecha:hoy }, datos)
ok(r.veredicto===VEREDICTO.RECHAZADO && !r.elegible, 'María reclama la mesa de Roberto con su propio tel → rechazado')

console.log('\n4) SIN_COMANDA — mesa sin ningún consumo ese día')
r = verificarReclamo({ tableId:'T09', telefono:'987654321', fecha:hoy }, datos)
ok(r.veredicto===VEREDICTO.SIN_COMANDA && !r.elegible, 'mesa que nadie ocupó → sin recompensa')
r = verificarReclamo({ tableId:'T03', telefono:'987654321', fecha:'2020-01-01' }, datos)
ok(r.veredicto===VEREDICTO.SIN_COMANDA && !r.elegible, 'mesa correcta pero otro día → sin consumo ese día')

console.log('\n5) SIN_MESA — el reclamo no indica mesa')
r = verificarReclamo({ telefono:'987654321', fecha:hoy }, datos)
ok(r.veredicto===VEREDICTO.SIN_MESA && !r.elegible, 'sin número de mesa no se puede verificar')

console.log('\n6) La identidad NUNCA depende solo del nombre')
r = verificarReclamo({ tableId:'T03', telefono:'000', fecha:hoy }, datos)   // tel falso
ok(!r.elegible, 'nombre correcto no basta: sin teléfono válido → no elegible')

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
