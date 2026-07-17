import { format, subDays } from 'date-fns'

const d = (daysAgo) => format(subDays(new Date(), daysAgo), 'yyyy-MM-dd')
const today = format(new Date(), 'yyyy-MM-dd')

export const SAMPLE_PAYMENTS = [
  {
    id: 'P01', reservationId: 'R01', clientName: 'Carlos Garcia',
    amount: 96.00, method: 'yape',
    date: d(7), time: '14:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 5,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P02', reservationId: 'R02', clientName: 'Carmen Mendoza',
    amount: 175.00, method: 'tarjeta',
    date: d(7), time: '17:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P03', reservationId: 'R03', clientName: 'Patricia Reyes',
    amount: 89.00, method: 'efectivo',
    date: d(7), time: '16:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 91.6 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P04', reservationId: 'R04', clientName: 'Miguel Garcia',
    amount: 55.00, method: 'yape',
    date: d(7), time: '14:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 91.6 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P05', reservationId: 'R05', clientName: 'Jorge Torres',
    amount: 237.00, method: 'efectivo',
    date: d(7), time: '21:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P06', reservationId: 'R06', clientName: 'Lucia Flores',
    amount: 177.00, method: 'yape',
    date: d(6), time: '18:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 5,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P07', reservationId: 'R07', clientName: 'Patricia Castillo',
    amount: 226.00, method: 'yape',
    date: d(6), time: '19:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 91.6 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P08', reservationId: 'R08', clientName: 'Roberto Flores',
    amount: 137.00, method: 'tarjeta',
    date: d(6), time: '21:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 13.8 }
    ]
  },
  {
    id: 'P09', reservationId: 'R09', clientName: 'Patricia Reyes',
    amount: 230.00, method: 'efectivo',
    date: d(6), time: '22:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P10', reservationId: 'R10', clientName: 'Carmen Reyes',
    amount: 204.00, method: 'efectivo',
    date: d(6), time: '18:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P11', reservationId: 'R11', clientName: 'Rosa Castillo',
    amount: 241.00, method: 'efectivo',
    date: d(6), time: '20:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 5,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P12', reservationId: 'R12', clientName: 'Carmen Mendoza',
    amount: 86.00, method: 'tarjeta',
    date: d(6), time: '17:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 13.8 }
    ]
  },
  {
    id: 'P13', reservationId: 'R13', clientName: 'Patricia Lopez',
    amount: 96.00, method: 'tarjeta',
    date: d(6), time: '14:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P14', reservationId: 'R14', clientName: 'Carmen Mendoza',
    amount: 128.00, method: 'efectivo',
    date: d(6), time: '22:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P15', reservationId: 'R15', clientName: 'Carmen Mendoza',
    amount: 234.00, method: 'tarjeta',
    date: d(6), time: '22:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P16', reservationId: 'R16', clientName: 'Lucia Torres',
    amount: 109.00, method: 'yape',
    date: d(5), time: '13:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 13.8 }
    ]
  },
  {
    id: 'P17', reservationId: 'R17', clientName: 'Lucia Torres',
    amount: 157.00, method: 'yape',
    date: d(5), time: '13:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 5,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P18', reservationId: 'R18', clientName: 'Rosa Castillo',
    amount: 210.00, method: 'efectivo',
    date: d(5), time: '14:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P19', reservationId: 'R19', clientName: 'Miguel Garcia',
    amount: 152.00, method: 'yape',
    date: d(5), time: '18:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P20', reservationId: 'R20', clientName: 'Patricia Lopez',
    amount: 180.00, method: 'tarjeta',
    date: d(5), time: '20:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P21', reservationId: 'R21', clientName: 'Carlos Garcia',
    amount: 57.00, method: 'yape',
    date: d(5), time: '13:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 91.6 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P22', reservationId: 'R22', clientName: 'Carmen Flores',
    amount: 50.00, method: 'efectivo',
    date: d(4), time: '16:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 91.6 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 13.8 }
    ]
  },
  {
    id: 'P23', reservationId: 'R23', clientName: 'Roberto Flores',
    amount: 176.00, method: 'tarjeta',
    date: d(4), time: '17:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P24', reservationId: 'R24', clientName: 'Carlos Garcia',
    amount: 144.00, method: 'tarjeta',
    date: d(4), time: '22:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P25', reservationId: 'R25', clientName: 'Patricia Castillo',
    amount: 73.00, method: 'yape',
    date: d(4), time: '16:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 5,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P26', reservationId: 'R26', clientName: 'Patricia Reyes',
    amount: 137.00, method: 'efectivo',
    date: d(4), time: '17:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P27', reservationId: 'R27', clientName: 'Patricia Reyes',
    amount: 119.00, method: 'tarjeta',
    date: d(4), time: '22:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P28', reservationId: 'R28', clientName: 'Lucia Flores',
    amount: 143.00, method: 'yape',
    date: d(4), time: '13:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P29', reservationId: 'R29', clientName: 'Luis Vasquez',
    amount: 75.00, method: 'tarjeta',
    date: d(3), time: '18:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 5,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 91.6 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 13.8 }
    ]
  },
  {
    id: 'P30', reservationId: 'R30', clientName: 'Roberto Flores',
    amount: 138.00, method: 'efectivo',
    date: d(3), time: '16:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 91.6 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P31', reservationId: 'R31', clientName: 'Ana Flores',
    amount: 194.00, method: 'tarjeta',
    date: d(3), time: '20:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P32', reservationId: 'R32', clientName: 'Carmen Reyes',
    amount: 63.00, method: 'efectivo',
    date: d(3), time: '22:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P33', reservationId: 'R33', clientName: 'Roberto Quispe',
    amount: 106.00, method: 'yape',
    date: d(3), time: '15:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 91.6 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 13.8 }
    ]
  },
  {
    id: 'P34', reservationId: 'R34', clientName: 'Carmen Mendoza',
    amount: 235.00, method: 'tarjeta',
    date: d(3), time: '13:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P35', reservationId: 'R35', clientName: 'Jorge Reyes',
    amount: 157.00, method: 'efectivo',
    date: d(3), time: '22:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 13.8 }
    ]
  },
  {
    id: 'P36', reservationId: 'R36', clientName: 'Miguel Garcia',
    amount: 51.00, method: 'efectivo',
    date: d(3), time: '19:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P37', reservationId: 'R37', clientName: 'Miguel Garcia',
    amount: 175.00, method: 'yape',
    date: d(3), time: '19:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P38', reservationId: 'R38', clientName: 'Carmen Vasquez',
    amount: 222.00, method: 'efectivo',
    date: d(3), time: '14:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 5,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P39', reservationId: 'R39', clientName: 'Lucia Flores',
    amount: 122.00, method: 'efectivo',
    date: d(2), time: '21:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P40', reservationId: 'R40', clientName: 'Carlos Garcia',
    amount: 202.00, method: 'tarjeta',
    date: d(2), time: '19:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 91.6 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P41', reservationId: 'R41', clientName: 'Carmen Flores',
    amount: 137.00, method: 'efectivo',
    date: d(2), time: '19:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P42', reservationId: 'R42', clientName: 'Carlos Flores',
    amount: 115.00, method: 'tarjeta',
    date: d(2), time: '18:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 91.6 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P43', reservationId: 'R43', clientName: 'Lucia Torres',
    amount: 100.00, method: 'efectivo',
    date: d(2), time: '17:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 13.8 }
    ]
  },
  {
    id: 'P44', reservationId: 'R44', clientName: 'Carlos Garcia',
    amount: 117.00, method: 'yape',
    date: d(1), time: '17:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P45', reservationId: 'R45', clientName: 'Jorge Silva',
    amount: 108.00, method: 'efectivo',
    date: d(1), time: '20:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P46', reservationId: 'R46', clientName: 'Roberto Vasquez',
    amount: 53.00, method: 'efectivo',
    date: d(1), time: '19:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P47', reservationId: 'R47', clientName: 'Lucia Reyes',
    amount: 139.00, method: 'efectivo',
    date: d(1), time: '20:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 5,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P48', reservationId: 'R48', clientName: 'Miguel Garcia',
    amount: 182.00, method: 'efectivo',
    date: d(1), time: '15:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P49', reservationId: 'R49', clientName: 'Roberto Quispe',
    amount: 126.00, method: 'tarjeta',
    date: d(1), time: '21:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 2, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P50', reservationId: 'R50', clientName: 'Lucia Flores',
    amount: 177.00, method: 'efectivo',
    date: today, time: '16:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 91.6 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P51', reservationId: 'R51', clientName: 'Miguel Garcia',
    amount: 233.00, method: 'efectivo',
    date: today, time: '22:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 5,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
  {
    id: 'P52', reservationId: 'R52', clientName: 'Rosa Castillo',
    amount: 165.00, method: 'yape',
    date: today, time: '20:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P53', reservationId: 'R53', clientName: 'Maria Reyes',
    amount: 209.00, method: 'yape',
    date: today, time: '15:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 13.8 }
    ]
  },
  {
    id: 'P54', reservationId: 'R54', clientName: 'Miguel Garcia',
    amount: 241.00, method: 'tarjeta',
    date: today, time: '14:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 5,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 13.8 }
    ]
  },
  {
    id: 'P55', reservationId: 'R55', clientName: 'Roberto Quispe',
    amount: 157.00, method: 'yape',
    date: today, time: '13:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 1, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P56', reservationId: 'R56', clientName: 'Miguel Vasquez',
    amount: 215.00, method: 'yape',
    date: today, time: '13:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 4, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 13.8 }
    ]
  },
  {
    id: 'P57', reservationId: 'R57', clientName: 'Maria Reyes',
    amount: 181.00, method: 'efectivo',
    date: today, time: '17:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 1, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 20.700000000000003 }
    ]
  },
  {
    id: 'P58', reservationId: 'R58', clientName: 'Lucia Torres',
    amount: 81.00, method: 'efectivo',
    date: today, time: '15:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 6,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 22.9 },
      { itemId: 'BE01', name: 'Chicha', qty: 3, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P59', reservationId: 'R59', clientName: 'Roberto Quispe',
    amount: 150.00, method: 'yape',
    date: today, time: '21:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 5,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 2, unitPrice: 22.90, subtotal: 45.8 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 6.9 }
    ]
  },
  {
    id: 'P60', reservationId: 'R60', clientName: 'Patricia Reyes',
    amount: 207.00, method: 'efectivo',
    date: today, time: '21:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa', qty: 3, unitPrice: 22.90, subtotal: 68.69999999999999 },
      { itemId: 'BE01', name: 'Chicha', qty: 4, unitPrice: 6.90, subtotal: 27.6 }
    ]
  },
]
export default SAMPLE_PAYMENTS
