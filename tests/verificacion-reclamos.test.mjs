import { evaluarEvidencia, VEREDICTO } from '../src/agents/core/claimVerifier.js'

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

const hoy = '2026-07-11'
// Datos reales del tipo del seed: María (R001, DNI 78765432)
const datos = {
  reservations: [
    { id:'R001', clientId:'CL01', clientName:'María García',  clientDni:'78765432', date:hoy, status:'seated' },
    { id:'R002', clientId:'CL02', clientName:'Roberto Silva', clientDni:'91234567', date:hoy, status:'completed' },
    { id:'R003', clientId:'CL03', clientName:'Ana López',     clientDni:'998877665', date:hoy, status:'approved' },
  ],
  kitchenTickets: [ { reservationId:'R001', status:'served' } ],
  payments: [ { id:'P001', reservationId:'R001', amount:110, date:hoy } ],
  complaints: []
}

console.log('\n1) VERIFICADO — codigo de reserva coincide')
let r = evaluarEvidencia({ codigo:'R001' }, datos)
ok(r.veredicto===VEREDICTO.VERIFICADO && r.elegible, 'María reclama su reserva → elegible')
ok(r.cliente==='María García' && r.reservationId==='R001', 'identifica al cliente y la reserva')
ok(r.clientId==='CL01', 'devuelve el clientId para enlazar la queja')
ok(r.pago?.amount===110, 'adjunta el pago verificado')

console.log('\n2) VERIFICADO tolerante a formato')
ok(evaluarEvidencia({ codigo:'r001' }, datos).elegible, 'acepta "r001"')
ok(evaluarEvidencia({ codigo:' R001 ' }, datos).elegible, 'acepta espacios extra')



console.log('\n4) SIN_RESERVA — código que no existe en reservas')
r = evaluarEvidencia({ codigo:'R009' }, datos)
ok(r.veredicto===VEREDICTO.SIN_RESERVA && !r.elegible, 'código inexistente → sin recompensa')

console.log('\n5) SIN_CODIGO — el reclamo no indica código')
r = evaluarEvidencia({}, datos)
ok(r.veredicto===VEREDICTO.SIN_CODIGO && !r.elegible, 'sin código no se puede verificar')

console.log('\n6) DUPLICADO — ya existe una queja para esa reserva')
const datosConQueja = { ...datos, complaints: [{ reservationId: 'R001' }] }
r = evaluarEvidencia({ codigo:'R001' }, datosConQueja)
ok(r.veredicto===VEREDICTO.DUPLICADO && !r.elegible, 'reserva ya reclamada → rechazado')

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
