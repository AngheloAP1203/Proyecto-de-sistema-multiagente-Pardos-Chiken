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

console.log('\n1) VERIFICADO — DNI + codigo de reserva coinciden')
let r = evaluarEvidencia({ codigo:'R001', dni:'78765432' }, datos)
ok(r.veredicto===VEREDICTO.VERIFICADO && r.elegible, 'María reclama su propia reserva → elegible')
ok(r.cliente==='María García' && r.reservationId==='R001', 'identifica al cliente y la reserva')
ok(r.clientId==='CL01', 'devuelve el clientId para enlazar la queja')
ok(r.pago?.amount===110, 'adjunta el pago verificado')

console.log('\n2) VERIFICADO tolerante a formato')
ok(evaluarEvidencia({ codigo:'r001',    dni:'78 765 432' }, datos).elegible, 'acepta "r001" y DNI con espacios')
ok(evaluarEvidencia({ codigo:' R001 ',dni:'78-765-432' }, datos).elegible, 'acepta espacios extra y guiones')

console.log('\n3) RECHAZADO — el código existe pero el DNI NO coincide (fraude)')
r = evaluarEvidencia({ codigo:'R001', dni:'99900011' }, datos)
ok(r.veredicto===VEREDICTO.RECHAZADO && !r.elegible, 'un extraño reclama la reserva de María → rechazado')
r = evaluarEvidencia({ codigo:'R002', dni:'78765432' }, datos)
ok(r.veredicto===VEREDICTO.RECHAZADO && !r.elegible, 'María reclama la reserva de Roberto con su propio DNI → rechazado')

console.log('\n4) SIN_RESERVA — código que no existe en reservas')
r = evaluarEvidencia({ codigo:'R009', dni:'78765432' }, datos)
ok(r.veredicto===VEREDICTO.SIN_RESERVA && !r.elegible, 'código inexistente → sin recompensa')

console.log('\n5) SIN_CODIGO — el reclamo no indica código')
r = evaluarEvidencia({ dni:'78765432' }, datos)
ok(r.veredicto===VEREDICTO.SIN_CODIGO && !r.elegible, 'sin código no se puede verificar')

console.log('\n6) DUPLICADO — ya existe una queja para esa reserva')
const datosConQueja = { ...datos, complaints: [{ reservationId: 'R001' }] }
r = evaluarEvidencia({ codigo:'R001', dni:'78765432' }, datosConQueja)
ok(r.veredicto===VEREDICTO.DUPLICADO && !r.elegible, 'reserva ya reclamada → rechazado')

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
