import { format, subDays } from 'date-fns'

/**
 * Cada pago incluye un array `items` con los platos/bebidas consumidos.
 * Esto permite al PromptInterpreter generar gráficas de "alimentos más consumidos".
 * Estructura: { itemId, name, qty, unitPrice, subtotal }
 */
export const SAMPLE_PAYMENTS = [
  // ── HOY ──────────────────────────────────────────────────────────────────
  {
    id: 'P001', reservationId: 'R001', clientName: 'María García',
    amount: 110.00, method: 'tarjeta',
    date: format(new Date(), 'yyyy-MM-dd'), time: '14:30',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: 'Pollada familiar + extras', status: 'paid', guests: 4,
    items: [
      { itemId: 'B02', name: '1/2 Pardos Brasa',        qty: 2, unitPrice: 41.90, subtotal: 83.80 },
      { itemId: 'BE01', name: 'Chicha Pardos 500ml',    qty: 4, unitPrice:  6.90, subtotal: 27.60 },
    ],
  },
  {
    id: 'P002', reservationId: 'R002', clientName: 'Roberto Silva',
    amount: 52.50, method: 'yape',
    date: format(new Date(), 'yyyy-MM-dd'), time: '15:45',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'PA01', name: '1/4 Parrillero Original',  qty: 2, unitPrice: 28.90, subtotal: 57.80 },
      { itemId: 'BE03', name: 'Coca Cola / Inca Kola 500ml', qty: 2, unitPrice: 6.90, subtotal: 13.80 },
    ],
  },
  {
    id: 'P020', reservationId: 'R030', clientName: 'Carmen Ríos',
    amount: 89.00, method: 'efectivo',
    date: format(new Date(), 'yyyy-MM-dd'), time: '13:10',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B02', name: '1/2 Pardos Brasa',          qty: 1, unitPrice: 41.90, subtotal: 41.90 },
      { itemId: 'P07', name: 'Piqueo Chicharrón de Pollo (6 unidades)', qty: 1, unitPrice: 15.90, subtotal: 15.90 },
      { itemId: 'S01', name: 'Brochetas de Pollo',         qty: 1, unitPrice: 24.90, subtotal: 24.90 },
      { itemId: 'BE06', name: 'Botella de agua (con/sin gas)', qty: 2, unitPrice: 6.90, subtotal: 13.80 },
    ],
  },
  {
    id: 'P021', reservationId: 'R031', clientName: 'Diego Paredes',
    amount: 76.80, method: 'tarjeta',
    date: format(new Date(), 'yyyy-MM-dd'), time: '14:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B03', name: '1 Pardos Brasa (Entero)',    qty: 1, unitPrice: 76.90, subtotal: 76.90 },
      { itemId: 'BE02', name: 'Chicha Pardos 1.5L',        qty: 1, unitPrice: 16.90, subtotal: 16.90 },
    ],
  },
  {
    id: 'P022', reservationId: 'R032', clientName: 'Fiorella Soto',
    amount: 63.70, method: 'yape',
    date: format(new Date(), 'yyyy-MM-dd'), time: '14:50',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'PA01', name: '1/4 Parrillero Original',  qty: 1, unitPrice: 28.90, subtotal: 28.90 },
      { itemId: 'S05', name: 'Chicharrón de Pollo',        qty: 1, unitPrice: 24.90, subtotal: 24.90 },
      { itemId: 'EN01', name: 'Ensalada Cocida (Regular)', qty: 1, unitPrice: 18.90, subtotal: 18.90 },
      { itemId: 'BE01', name: 'Chicha Pardos 500ml',       qty: 2, unitPrice:  6.90, subtotal: 13.80 },
    ],
  },
  {
    id: 'P023', reservationId: 'R033', clientName: 'Andrés Campos',
    amount: 137.60, method: 'tarjeta',
    date: format(new Date(), 'yyyy-MM-dd'), time: '15:20',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B02', name: '1/2 Pardos Brasa',          qty: 3, unitPrice: 41.90, subtotal: 125.70 },
      { itemId: 'A02', name: 'Anticucho (1)',              qty: 2, unitPrice:  9.90, subtotal: 19.80 },
      { itemId: 'BE01', name: 'Chicha Pardos 500ml',       qty: 4, unitPrice:  6.90, subtotal: 27.60 },
    ],
  },
  {
    id: 'P024', reservationId: 'R034', clientName: 'Susana Vega',
    amount: 58.80, method: 'efectivo',
    date: format(new Date(), 'yyyy-MM-dd'), time: '16:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'PA03', name: '1/4 Parrillero BBQ/Hot',   qty: 2, unitPrice: 30.90, subtotal: 61.80 },
      { itemId: 'BE03', name: 'Coca Cola / Inca Kola 500ml', qty: 2, unitPrice: 6.90, subtotal: 13.80 },
    ],
  },

  // ── AYER ──────────────────────────────────────────────────────────────────
  {
    id: 'P003', reservationId: 'R006', clientName: 'Ana López',
    amount: 78.00, method: 'efectivo',
    date: format(subDays(new Date(),1), 'yyyy-MM-dd'), time: '14:15',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'B02', name: '1/2 Pardos Brasa',          qty: 1, unitPrice: 41.90, subtotal: 41.90 },
      { itemId: 'S05', name: 'Chicharrón de Pollo',        qty: 1, unitPrice: 24.90, subtotal: 24.90 },
      { itemId: 'BE01', name: 'Chicha Pardos 500ml',       qty: 3, unitPrice:  6.90, subtotal: 20.70 },
    ],
  },
  {
    id: 'P004', reservationId: 'R007', clientName: 'Jorge Castillo',
    amount: 46.50, method: 'tarjeta',
    date: format(subDays(new Date(),1), 'yyyy-MM-dd'), time: '15:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'PA01', name: '1/4 Parrillero Original',  qty: 2, unitPrice: 28.90, subtotal: 57.80 },
      { itemId: 'BE06', name: 'Botella de agua (con/sin gas)', qty: 2, unitPrice: 6.90, subtotal: 13.80 },
    ],
  },
  {
    id: 'P005', reservationId: 'R008', clientName: 'Isabel Torres',
    amount: 125.00, method: 'tarjeta',
    date: format(subDays(new Date(),1), 'yyyy-MM-dd'), time: '21:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: 'Cena larga', status: 'paid', guests: 5,
    items: [
      { itemId: 'B02', name: '1/2 Pardos Brasa',          qty: 2, unitPrice: 41.90, subtotal: 83.80 },
      { itemId: 'A02', name: 'Anticucho (1)',              qty: 3, unitPrice:  9.90, subtotal: 29.70 },
      { itemId: 'D01', name: 'Torta de chocolate',         qty: 2, unitPrice: 15.50, subtotal: 31.00 },
      { itemId: 'BE02', name: 'Chicha Pardos 1.5L',        qty: 1, unitPrice: 16.90, subtotal: 16.90 },
    ],
  },

  // ── HACE 2 DÍAS ───────────────────────────────────────────────────────────
  {
    id: 'P006', reservationId: 'R010', clientName: 'María García',
    amount: 96.00, method: 'efectivo',
    date: format(subDays(new Date(),2), 'yyyy-MM-dd'), time: '14:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'B03', name: '1 Pardos Brasa (Entero)',    qty: 1, unitPrice: 76.90, subtotal: 76.90 },
      { itemId: 'P07', name: 'Piqueo Chicharrón de Pollo (6 unidades)', qty: 1, unitPrice: 15.90, subtotal: 15.90 },
      { itemId: 'BE01', name: 'Chicha Pardos 500ml',       qty: 4, unitPrice:  6.90, subtotal: 27.60 },
    ],
  },
  {
    id: 'P007', reservationId: 'R012', clientName: 'Patricia Flores',
    amount: 65.00, method: 'yape',
    date: format(subDays(new Date(),2), 'yyyy-MM-dd'), time: '15:30',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 3,
    items: [
      { itemId: 'PA01', name: '1/4 Parrillero Original',  qty: 2, unitPrice: 28.90, subtotal: 57.80 },
      { itemId: 'EN03', name: 'Ensalada Fresca (Regular)', qty: 1, unitPrice: 18.90, subtotal: 18.90 },
      { itemId: 'BE03', name: 'Coca Cola / Inca Kola 500ml', qty: 2, unitPrice: 6.90, subtotal: 13.80 },
    ],
  },

  // ── HACE 3 DÍAS ───────────────────────────────────────────────────────────
  {
    id: 'P008', reservationId: 'R013', clientName: 'Ana López',
    amount: 135.00, method: 'tarjeta',
    date: format(subDays(new Date(),3), 'yyyy-MM-dd'), time: '13:45',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: 'Grupo grande', status: 'paid', guests: 5,
    items: [
      { itemId: 'B02', name: '1/2 Pardos Brasa',          qty: 2, unitPrice: 41.90, subtotal: 83.80 },
      { itemId: 'S01', name: 'Brochetas de Pollo',         qty: 2, unitPrice: 24.90, subtotal: 49.80 },
      { itemId: 'BE02', name: 'Chicha Pardos 1.5L',        qty: 2, unitPrice: 16.90, subtotal: 33.80 },
      { itemId: 'D02', name: 'Tres leches',                qty: 2, unitPrice: 15.50, subtotal: 31.00 },
    ],
  },
  {
    id: 'P009', reservationId: 'R014', clientName: 'Enrique Huamán',
    amount: 190.00, method: 'transferencia',
    date: format(subDays(new Date(),3), 'yyyy-MM-dd'), time: '20:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: 'Corporativo', status: 'paid', guests: 6,
    items: [
      { itemId: 'B03', name: '1 Pardos Brasa (Entero)',    qty: 2, unitPrice: 76.90, subtotal: 153.80 },
      { itemId: 'C01', name: 'Lomo a la Parrilla (Mediano)', qty: 1, unitPrice: 44.90, subtotal: 44.90 },
      { itemId: 'BE04', name: 'Coca Cola / Inca Kola 1.5L', qty: 2, unitPrice: 12.90, subtotal: 25.80 },
      { itemId: 'EN02', name: 'Ensalada Cocida (Grande)',  qty: 2, unitPrice: 22.90, subtotal: 45.80 },
    ],
  },

  // ── HACE 5 DÍAS ───────────────────────────────────────────────────────────
  {
    id: 'P010', reservationId: 'R016', clientName: 'Carlos Quispe',
    amount: 245.00, method: 'transferencia',
    date: format(subDays(new Date(),5), 'yyyy-MM-dd'), time: '14:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: 'Aniversario empresa', status: 'paid', guests: 8,
    items: [
      { itemId: 'B03', name: '1 Pardos Brasa (Entero)',    qty: 3, unitPrice: 76.90, subtotal: 230.70 },
      { itemId: 'P08', name: 'Piqueo Chicharrón de Pollo (12 unidades)', qty: 1, unitPrice: 25.90, subtotal: 25.90 },
      { itemId: 'BE02', name: 'Chicha Pardos 1.5L',        qty: 3, unitPrice: 16.90, subtotal: 50.70 },
      { itemId: 'D04', name: 'Cheesecake de fresa',        qty: 4, unitPrice: 15.50, subtotal: 62.00 },
    ],
  },
  {
    id: 'P011', reservationId: 'R017', clientName: 'Jorge Castillo',
    amount: 88.00, method: 'tarjeta',
    date: format(subDays(new Date(),5), 'yyyy-MM-dd'), time: '21:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'PA02', name: '1/2 Parrillero Original',  qty: 2, unitPrice: 38.90, subtotal: 77.80 },
      { itemId: 'S03', name: 'Anticuchos de Corazón',     qty: 1, unitPrice: 23.90, subtotal: 23.90 },
      { itemId: 'BE01', name: 'Chicha Pardos 500ml',       qty: 4, unitPrice:  6.90, subtotal: 27.60 },
    ],
  },
  {
    id: 'P012', reservationId: 'R018', clientName: 'Valeria Cruz',
    amount: 72.00, method: 'yape',
    date: format(subDays(new Date(),5), 'yyyy-MM-dd'), time: '15:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: 'Cumpleaños', status: 'paid', guests: 3,
    items: [
      { itemId: 'B02', name: '1/2 Pardos Brasa',          qty: 1, unitPrice: 41.90, subtotal: 41.90 },
      { itemId: 'D01', name: 'Torta de chocolate',         qty: 1, unitPrice: 15.50, subtotal: 15.50 },
      { itemId: 'BE03', name: 'Coca Cola / Inca Kola 500ml', qty: 3, unitPrice: 6.90, subtotal: 20.70 },
    ],
  },

  // ── HACE 7 DÍAS ───────────────────────────────────────────────────────────
  {
    id: 'P013', reservationId: 'R019', clientName: 'María García',
    amount: 98.00, method: 'efectivo',
    date: format(subDays(new Date(),7), 'yyyy-MM-dd'), time: '14:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'PA01', name: '1/4 Parrillero Original',  qty: 4, unitPrice: 28.90, subtotal: 115.60 },
      { itemId: 'EN01', name: 'Ensalada Cocida (Regular)', qty: 2, unitPrice: 18.90, subtotal: 37.80 },
      { itemId: 'BE01', name: 'Chicha Pardos 500ml',       qty: 4, unitPrice:  6.90, subtotal: 27.60 },
    ],
  },
  {
    id: 'P014', reservationId: 'R020', clientName: 'Isabel Torres',
    amount: 155.00, method: 'tarjeta',
    date: format(subDays(new Date(),7), 'yyyy-MM-dd'), time: '21:30',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: 'Cena especial', status: 'paid', guests: 6,
    items: [
      { itemId: 'C02', name: 'Lomo a la Parrilla (Grande)', qty: 2, unitPrice: 54.90, subtotal: 109.80 },
      { itemId: 'S04', name: 'Mollejitas a la Parrilla',   qty: 1, unitPrice: 23.90, subtotal: 23.90 },
      { itemId: 'D03', name: 'Pie de limón',               qty: 2, unitPrice: 15.50, subtotal: 31.00 },
      { itemId: 'BE02', name: 'Chicha Pardos 1.5L',        qty: 2, unitPrice: 16.90, subtotal: 33.80 },
    ],
  },

  // ── HACE 10 DÍAS ──────────────────────────────────────────────────────────
  {
    id: 'P015', reservationId: 'R021', clientName: 'Ana López',
    amount: 48.00, method: 'yape',
    date: format(subDays(new Date(),10), 'yyyy-MM-dd'), time: '15:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 2,
    items: [
      { itemId: 'B01', name: '1/4 Pardos Brasa',           qty: 2, unitPrice: 25.90, subtotal: 51.80 },
      { itemId: 'BE03', name: 'Coca Cola / Inca Kola 500ml', qty: 2, unitPrice: 6.90, subtotal: 13.80 },
    ],
  },
  {
    id: 'P016', reservationId: 'R022', clientName: 'Lucia Mendoza',
    amount: 210.00, method: 'tarjeta',
    date: format(subDays(new Date(),10), 'yyyy-MM-dd'), time: '20:30',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: 'Mesa VIP aniversario', status: 'paid', guests: 4,
    items: [
      { itemId: 'B03', name: '1 Pardos Brasa (Entero)',    qty: 2, unitPrice: 76.90, subtotal: 153.80 },
      { itemId: 'A02', name: 'Anticucho (1)',              qty: 4, unitPrice:  9.90, subtotal: 39.60 },
      { itemId: 'D04', name: 'Cheesecake de fresa',        qty: 2, unitPrice: 15.50, subtotal: 31.00 },
      { itemId: 'BE02', name: 'Chicha Pardos 1.5L',        qty: 2, unitPrice: 16.90, subtotal: 33.80 },
    ],
  },
  {
    id: 'P017', reservationId: 'R023', clientName: 'Enrique Huamán',
    amount: 145.00, method: 'transferencia',
    date: format(subDays(new Date(),10), 'yyyy-MM-dd'), time: '14:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: 'Reunión', status: 'paid', guests: 5,
    items: [
      { itemId: 'PA02', name: '1/2 Parrillero Original',  qty: 3, unitPrice: 38.90, subtotal: 116.70 },
      { itemId: 'S05', name: 'Chicharrón de Pollo',        qty: 2, unitPrice: 24.90, subtotal: 49.80 },
      { itemId: 'BE01', name: 'Chicha Pardos 500ml',       qty: 5, unitPrice:  6.90, subtotal: 34.50 },
    ],
  },

  // ── HACE 14 DÍAS ──────────────────────────────────────────────────────────
  {
    id: 'P018', reservationId: 'R024', clientName: 'Patricia Flores',
    amount: 89.00, method: 'efectivo',
    date: format(subDays(new Date(),14), 'yyyy-MM-dd'), time: '21:00',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: '', status: 'paid', guests: 4,
    items: [
      { itemId: 'PA01', name: '1/4 Parrillero Original',  qty: 2, unitPrice: 28.90, subtotal: 57.80 },
      { itemId: 'P07', name: 'Piqueo Chicharrón de Pollo (6 unidades)', qty: 1, unitPrice: 15.90, subtotal: 15.90 },
      { itemId: 'BE01', name: 'Chicha Pardos 500ml',       qty: 4, unitPrice:  6.90, subtotal: 27.60 },
    ],
  },
  {
    id: 'P019', reservationId: 'R025', clientName: 'Valeria Cruz',
    amount: 165.00, method: 'tarjeta',
    date: format(subDays(new Date(),14), 'yyyy-MM-dd'), time: '15:30',
    cashierId: 'u002', cashierName: 'Lucia Torres',
    notes: 'Almuerzo familiar grande', status: 'paid', guests: 6,
    items: [
      { itemId: 'B03', name: '1 Pardos Brasa (Entero)',    qty: 2, unitPrice: 76.90, subtotal: 153.80 },
      { itemId: 'EN04', name: 'Ensalada Fresca (Grande)',  qty: 2, unitPrice: 22.90, subtotal: 45.80 },
      { itemId: 'D02', name: 'Tres leches',                qty: 3, unitPrice: 15.50, subtotal: 46.50 },
      { itemId: 'BE02', name: 'Chicha Pardos 1.5L',        qty: 2, unitPrice: 16.90, subtotal: 33.80 },
    ],
  },
]
