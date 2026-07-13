/**
 * tests/platos-servidos.test.mjs
 * Fija la regla de "solo se cobra lo servido" (Caja ← Cocina).
 */
import { platosServidosDeTickets } from '../src/domain/kitchen/servedItems.js'

let fail = 0
const ok = (c, l) => { console.log(`${c ? '  PASS' : '  FALL'}  ${l}`); if (!c) fail++ }

console.log('\n1) Solo cuenta lo servido (itemStatus ready/served o ticket servido)')
const tickets = [
  { status: 'preparing', items: [
    { menuId: 'A01', name: 'Anticucho',  price: 10, qty: 2, itemStatus: 'ready' },     // servido
    { menuId: 'C01', name: 'Lomo',       price: 45, qty: 1, itemStatus: 'preparing' }, // NO servido
  ]},
  { status: 'served', items: [
    { menuId: 'B01', name: 'Chicha',     price: 8,  qty: 3, itemStatus: 'pending' },   // ticket servido → cuenta
  ]},
]
const r = platosServidosDeTickets(tickets)
ok(r.length === 2, 'devuelve 2 platos servidos (excluye el que sigue en preparación)')
ok(!r.some(i => i.name === 'Lomo'), 'el plato en preparación NO se cobra')
ok(r.find(i => i.name === 'Anticucho')?.qty === 2, 'respeta la cantidad del ítem listo')
ok(r.find(i => i.name === 'Chicha')?.qty === 3, 'un ticket servido cuenta todos sus ítems')

console.log('\n2) Agrupa el mismo plato de varios tickets')
const dobles = [
  { status: 'ready', items: [{ menuId: 'A01', name: 'Anticucho', price: 10, qty: 2, itemStatus: 'ready' }] },
  { status: 'ready', items: [{ menuId: 'A01', name: 'Anticucho', price: 10, qty: 1, itemStatus: 'ready' }] },
]
const agr = platosServidosDeTickets(dobles)
ok(agr.length === 1 && agr[0].qty === 3, 'suma cantidades del mismo plato (2 + 1 = 3)')

console.log('\n3) Mesa sin nada servido → lista vacía')
ok(platosServidosDeTickets([{ status: 'pending', items: [{ name: 'X', qty: 1, itemStatus: 'pending' }] }]).length === 0,
  'nada servido → no se cobra de más')
ok(platosServidosDeTickets([]).length === 0, 'sin tickets → vacío')

console.log(`\n${fail === 0 ? 'TODO OK' : fail + ' FALLOS'}\n`); process.exit(fail ? 1 : 0)
