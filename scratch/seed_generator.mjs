import fs from 'fs'

const names = ['Carlos', 'Luis', 'Ana', 'Maria', 'Jorge', 'Lucia', 'Jose', 'Rosa', 'Miguel', 'Carmen', 'Roberto', 'Patricia']
const lasts = ['Garcia', 'Silva', 'Lopez', 'Flores', 'Quispe', 'Mendoza', 'Castillo', 'Torres', 'Vasquez', 'Reyes']

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[rand(0, arr.length - 1)]
const pad = (n) => String(n).padStart(2, '0')

let clients = []
for (let i = 1; i <= 40; i++) {
  clients.push({
    id: `C${pad(i)}`,
    name: `${pick(names)} ${pick(lasts)}`,
    phone: `9${rand(1000000, 9999999)}`,
    email: `client${i}@email.com`,
    dni: `${rand(10000000, 99999999)}`,
    birthday: `19${rand(70, 99)}-${pad(rand(1, 12))}-${pad(rand(1, 28))}`,
    preferences: pick(['Mesa cerca a ventana', 'Sin preferencias', 'Área tranquila']),
    allergies: pick(['Ninguna', 'Ninguna', 'Lácteos', 'Mariscos']),
    totalVisits: rand(1, 20),
    totalReservations: rand(1, 15),
    lastVisit: '2026-07-16',
    registeredAt: '2025-01-01T10:00:00Z',
    notes: '',
    vip: Math.random() > 0.8
  })
}

let reservationsStr = `import { format, subDays } from 'date-fns'
import { RESERVATION_STATUS } from '../../domain/reservations/reservationStatus.js'

export const INITIAL_TABLES = Array.from({ length: 20 }, (_, i) => ({
  id: \`T\${String(i + 1).padStart(2, '0')}\`,
  number: i + 1,
  capacity: [2, 2, 4, 4, 4, 6, 6, 2, 4, 4, 6, 2, 4, 8, 4, 6, 2, 4, 4, 6][i],
  zone: i < 8 ? 'Salón Principal' : i < 14 ? 'Terraza' : 'VIP',
  isAvailable: true,
}))

const d = (daysAgo) => format(subDays(new Date(), daysAgo), 'yyyy-MM-dd')
const today = format(new Date(), 'yyyy-MM-dd')

export const SAMPLE_RESERVATIONS = [\n`

let paymentsStr = `import { format, subDays } from 'date-fns'

const d = (daysAgo) => format(subDays(new Date(), daysAgo), 'yyyy-MM-dd')
const today = format(new Date(), 'yyyy-MM-dd')

export const SAMPLE_PAYMENTS = [\n`

let resCount = 1
let payCount = 1

// Generate history for last 7 days + today
for (let daysAgo = 7; daysAgo >= 0; daysAgo--) {
  let numPerDay = daysAgo === 0 ? 15 : rand(5, 10) // More today
  for (let i = 0; i < numPerDay; i++) {
    const c = pick(clients)
    const tableId = `T${pad(rand(1, 20))}`
    const rId = `R${pad(resCount++)}`
    
    // reservation
    reservationsStr += `  {
    id: '${rId}', clientId: '${c.id}',
    clientName: '${c.name}', clientPhone: '${c.phone}',
    clientDni: '${c.dni}', clientEmail: '${c.email}',
    date: ${daysAgo === 0 ? 'today' : `d(${daysAgo})`}, time: '${pad(rand(12, 21))}:30', guests: ${rand(2, 6)}, tableId: '${tableId}',
    status: RESERVATION_STATUS.${daysAgo === 0 && i > 10 ? 'PENDING' : 'COMPLETED'},
    notes: '', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: '',
  },\n`
    
    // payment
    if (daysAgo > 0 || i <= 10) {
      const pId = `P${pad(payCount++)}`
      const amount = rand(50, 250)
      paymentsStr += `  {
    id: '${pId}', reservationId: '${rId}', clientName: '${c.name}',
    amount: ${amount}.00, method: '${pick(['tarjeta', 'yape', 'efectivo'])}',
    date: ${daysAgo === 0 ? 'today' : `d(${daysAgo})`}, time: '${pad(rand(13, 22))}:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: ${rand(2, 6)},
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: ${rand(1, 4)}, unitPrice: 22.90, subtotal: ${rand(1, 4) * 22.9} },
      { itemId: 'BE01', name: 'Chicha', qty: ${rand(1, 4)}, unitPrice: 6.90, subtotal: ${rand(1, 4) * 6.9} }
    ]
  },\n`
    }
  }
}

reservationsStr += `]
export default SAMPLE_RESERVATIONS\n`

paymentsStr += `]
export default SAMPLE_PAYMENTS\n`

fs.writeFileSync('src/data/seeds/clientsSeed.js', 'export const SAMPLE_CLIENTS = ' + JSON.stringify(clients, null, 2) + '\\nexport default SAMPLE_CLIENTS\\n')
fs.writeFileSync('src/data/seeds/reservationsSeed.js', reservationsStr)
fs.writeFileSync('src/data/seeds/paymentsSeed.js', paymentsStr)

console.log('Done generating data!')
