import { evaluarEvidencia, VEREDICTO } from '../src/agents/core/claimVerifier.js'

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

const hoy = '2026-07-11'
// Datos reales del tipo del seed: María (T03, tel 987654321) reservó, hay comanda y pago.
const datos = {
  reservations: [
    { id:'R001', tableId:'T03', clientId:'CL01', clientName:'María García',  clientDni:'78765432', date:hoy, status:'seated' },
    { id:'R002', tableId:'T01', clientId:'CL02', clientName:'Roberto Silva', clientDni:'91234567', date:hoy, status:'completed' },
    { id:'R003', tableId:'T06', clientId:'CL03', clientName:'Ana López',     clientDni:'998877665', date:hoy, status:'approved' },
  ],
  // Las comandas se enlazan por reservationId (kitchen_tickets no tiene mesa ni fecha).
  kitchenTickets: [ { reservationId:'R001', status:'served' } ],
  payments: [ { id:'P001', reservationId:'R001', amount:110, date:hoy } ],
}

console.log('\n1) VERIFICADO — DNI + mesa + consumo coinciden')
let r = evaluarEvidencia({ tableId:'T03', dni:'78765432', fecha:hoy }, datos)
ok(r.veredicto===VEREDICTO.VERIFICADO && r.elegible, 'María reclama su propia mesa → elegible')
ok(r.cliente==='María García' && r.reservationId==='R001', 'identifica al cliente y la reserva')
ok(r.clientId==='CL01', 'devuelve el clientId para enlazar la queja')
ok(r.pago?.amount===110, 'adjunta el pago verificado')

console.log('\n2) VERIFICADO tolerante a formato de teléfono y mesa')
ok(evaluarEvidencia({ tableId:'t3',    dni:'78 765 432' }, datos).elegible, 'acepta "t3" y DNI con espacios')
ok(evaluarEvidencia({ tableId:'mesa 3',dni:'78-765-432' }, datos).elegible, 'acepta "mesa 3" y guiones')

console.log('\n3) RECHAZADO — la mesa tuvo consumo pero el DNI NO coincide (fraude)')
r = evaluarEvidencia({ tableId:'T03', dni:'99900011', fecha:hoy }, datos)
ok(r.veredicto===VEREDICTO.RECHAZADO && !r.elegible, 'un extraño reclama la mesa de María → rechazado')
r = evaluarEvidencia({ tableId:'T01', dni:'78765432', fecha:hoy }, datos)
ok(r.veredicto===VEREDICTO.RECHAZADO && !r.elegible, 'María reclama la mesa de Roberto con su propio DNI → rechazado')

console.log('\n4) SIN_COMANDA — mesa sin ningún consumo ese día')
r = evaluarEvidencia({ tableId:'T09', dni:'78765432', fecha:hoy }, datos)
ok(r.veredicto===VEREDICTO.SIN_COMANDA && !r.elegible, 'mesa que nadie ocupó → sin recompensa')
r = evaluarEvidencia({ tableId:'T03', dni:'78765432', fecha:'2020-01-01' }, datos)
ok(r.veredicto===VEREDICTO.SIN_COMANDA && !r.elegible, 'mesa correcta pero otro día → sin consumo ese día')

console.log('\n5) SIN_MESA — el reclamo no indica mesa')
r = evaluarEvidencia({ dni:'78765432', fecha:hoy }, datos)
ok(r.veredicto===VEREDICTO.SIN_MESA && !r.elegible, 'sin número de mesa no se puede verificar')

console.log('\n6) La identidad NUNCA depende solo del nombre')
r = evaluarEvidencia({ tableId:'T03', dni:'000', fecha:hoy }, datos)   // tel falso
ok(!r.elegible, 'nombre correcto no basta: sin DNI válido → no elegible')

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
