import { format, subDays } from 'date-fns'

export const SAMPLE_PAYMENTS = [
  // HOY
  { id: 'P001', reservationId: 'R001', clientName: 'María García',      amount: 110.00, method: 'tarjeta',       date: format(new Date(), 'yyyy-MM-dd'), time: '14:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Pollada familiar + extras', status: 'paid', guests: 4 },
  { id: 'P002', reservationId: 'R002', clientName: 'Roberto Silva',     amount:  52.50, method: 'yape',          date: format(new Date(), 'yyyy-MM-dd'), time: '15:45', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 2 },
  // AYER
  { id: 'P003', reservationId: 'R006', clientName: 'Ana López',         amount:  78.00, method: 'efectivo',      date: format(subDays(new Date(),1), 'yyyy-MM-dd'), time: '14:15', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 3 },
  { id: 'P004', reservationId: 'R007', clientName: 'Jorge Castillo',    amount:  46.50, method: 'tarjeta',       date: format(subDays(new Date(),1), 'yyyy-MM-dd'), time: '15:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 2 },
  { id: 'P005', reservationId: 'R008', clientName: 'Isabel Torres',     amount: 125.00, method: 'tarjeta',       date: format(subDays(new Date(),1), 'yyyy-MM-dd'), time: '21:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Cena larga', status: 'paid', guests: 5 },
  // HACE 2 DÍAS
  { id: 'P006', reservationId: 'R010', clientName: 'María García',      amount:  96.00, method: 'efectivo',      date: format(subDays(new Date(),2), 'yyyy-MM-dd'), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P007', reservationId: 'R012', clientName: 'Patricia Flores',   amount:  65.00, method: 'yape',          date: format(subDays(new Date(),2), 'yyyy-MM-dd'), time: '15:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 3 },
  // HACE 3 DÍAS
  { id: 'P008', reservationId: 'R013', clientName: 'Ana López',         amount: 135.00, method: 'tarjeta',       date: format(subDays(new Date(),3), 'yyyy-MM-dd'), time: '13:45', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Grupo grande', status: 'paid', guests: 5 },
  { id: 'P009', reservationId: 'R014', clientName: 'Enrique Huamán',    amount: 190.00, method: 'transferencia', date: format(subDays(new Date(),3), 'yyyy-MM-dd'), time: '20:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Corporativo', status: 'paid', guests: 6 },
  // HACE 5 DÍAS
  { id: 'P010', reservationId: 'R016', clientName: 'Carlos Quispe',     amount: 245.00, method: 'transferencia', date: format(subDays(new Date(),5), 'yyyy-MM-dd'), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Aniversario empresa', status: 'paid', guests: 8 },
  { id: 'P011', reservationId: 'R017', clientName: 'Jorge Castillo',    amount:  88.00, method: 'tarjeta',       date: format(subDays(new Date(),5), 'yyyy-MM-dd'), time: '21:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P012', reservationId: 'R018', clientName: 'Valeria Cruz',      amount:  72.00, method: 'yape',          date: format(subDays(new Date(),5), 'yyyy-MM-dd'), time: '15:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Cumpleaños', status: 'paid', guests: 3 },
  // HACE 7 DÍAS
  { id: 'P013', reservationId: 'R019', clientName: 'María García',      amount:  98.00, method: 'efectivo',      date: format(subDays(new Date(),7), 'yyyy-MM-dd'), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P014', reservationId: 'R020', clientName: 'Isabel Torres',     amount: 155.00, method: 'tarjeta',       date: format(subDays(new Date(),7), 'yyyy-MM-dd'), time: '21:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Cena especial', status: 'paid', guests: 6 },
  // HACE 10 DÍAS
  { id: 'P015', reservationId: 'R021', clientName: 'Ana López',         amount:  48.00, method: 'yape',          date: format(subDays(new Date(),10), 'yyyy-MM-dd'), time: '15:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 2 },
  { id: 'P016', reservationId: 'R022', clientName: 'Lucia Mendoza',     amount: 210.00, method: 'tarjeta',       date: format(subDays(new Date(),10), 'yyyy-MM-dd'), time: '20:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Mesa VIP aniversario', status: 'paid', guests: 4 },
  { id: 'P017', reservationId: 'R023', clientName: 'Enrique Huamán',    amount: 145.00, method: 'transferencia', date: format(subDays(new Date(),10), 'yyyy-MM-dd'), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Reunión', status: 'paid', guests: 5 },
  // HACE 14 DÍAS
  { id: 'P018', reservationId: 'R024', clientName: 'Patricia Flores',   amount:  89.00, method: 'efectivo',      date: format(subDays(new Date(),14), 'yyyy-MM-dd'), time: '21:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P019', reservationId: 'R025', clientName: 'Valeria Cruz',      amount: 165.00, method: 'tarjeta',       date: format(subDays(new Date(),14), 'yyyy-MM-dd'), time: '15:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Almuerzo familiar grande', status: 'paid', guests: 6 },
]
