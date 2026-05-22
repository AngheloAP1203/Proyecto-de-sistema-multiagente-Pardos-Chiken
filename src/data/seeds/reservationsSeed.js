import { format, subDays } from 'date-fns'
import { RESERVATION_STATUS } from '../../domain/reservations/reservationStatus'

export const INITIAL_TABLES = Array.from({ length: 20 }, (_, i) => ({
  id: `T${String(i + 1).padStart(2, '0')}`,
  number: i + 1,
  capacity: [2, 2, 4, 4, 4, 6, 6, 2, 4, 4, 6, 2, 4, 8, 4, 6, 2, 4, 4, 6][i],
  zone: i < 8 ? 'Salón Principal' : i < 14 ? 'Terraza' : 'VIP',
  isAvailable: true,
}))

const d = (daysAgo) => format(subDays(new Date(), daysAgo), 'yyyy-MM-dd')
const today = format(new Date(), 'yyyy-MM-dd')

export const SAMPLE_RESERVATIONS = [
  // ── HOY — activas ──────────────────────────────────
  {
    id: 'R001', clientId: 'C001',
    clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
    date: today, time: '13:00', guests: 4, tableId: 'T03',
    status: RESERVATION_STATUS.PENDING,
    notes: 'Cumpleaños, pedir torta de chocolate', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: 'Cumpleaños',
  },
  {
    id: 'R002', clientId: 'C002',
    clientName: 'Roberto Silva', clientPhone: '912345678', clientEmail: 'roberto@email.com',
    date: today, time: '14:30', guests: 2, tableId: 'T01',
    status: RESERVATION_STATUS.SEATED,
    notes: '', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R003', clientId: 'C004',
    clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
    date: today, time: '19:00', guests: 6, tableId: 'T06',
    status: RESERVATION_STATUS.PENDING,
    notes: 'Cena de aniversario', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: 'Aniversario',
  },
  {
    id: 'R004', clientId: 'C005',
    clientName: 'Carlos Quispe', clientPhone: '956781234', clientEmail: 'carlos_q@email.com',
    date: today, time: '20:30', guests: 8, tableId: 'T14',
    status: RESERVATION_STATUS.PENDING,
    notes: 'Reunión de empresa', createdAt: new Date().toISOString(),
    createdBy: 'u002', occasion: 'Reunión',
  },
  {
    id: 'R005', clientId: 'C006',
    clientName: 'Lucia Mendoza', clientPhone: '999888777', clientEmail: 'lucia_m@email.com',
    date: today, time: '21:00', guests: 4, tableId: 'T15',
    status: RESERVATION_STATUS.PENDING,
    notes: 'Mesa VIP solicitada', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: '',
  },

  // ── AYER ──────────────────────────────────────────
  {
    id: 'R006', clientId: 'C003',
    clientName: 'Ana López', clientPhone: '998877665', clientEmail: 'ana@email.com',
    date: d(1), time: '13:30', guests: 3, tableId: 'T05',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 1).toISOString(),
    createdBy: 'u004', occasion: 'Almuerzo familiar',
  },
  {
    id: 'R007', clientId: 'C007',
    clientName: 'Jorge Castillo', clientPhone: '988112233', clientEmail: 'jorge_c@email.com',
    date: d(1), time: '14:00', guests: 2, tableId: 'T02',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 1).toISOString(),
    createdBy: 'u002', occasion: '',
  },
  {
    id: 'R008', clientId: 'C008',
    clientName: 'Isabel Torres', clientPhone: '912233445', clientEmail: 'isabel@email.com',
    date: d(1), time: '20:00', guests: 5, tableId: 'T11',
    status: RESERVATION_STATUS.COMPLETED,
    notes: 'Solicitar mesa tranquila', createdAt: subDays(new Date(), 1).toISOString(),
    createdBy: 'u004', occasion: 'Cena',
  },
  {
    id: 'R009', clientId: 'C009',
    clientName: 'Pedro Vásquez', clientPhone: '977665544', clientEmail: 'pedro@email.com',
    date: d(1), time: '19:30', guests: 4, tableId: 'T10',
    status: RESERVATION_STATUS.CANCELLED,
    cancelReason: 'Cliente llamó para cancelar',
    notes: '', createdAt: subDays(new Date(), 1).toISOString(),
    createdBy: 'u002', occasion: '',
  },

  // ── HACE 2 DÍAS ───────────────────────────────────
  {
    id: 'R010', clientId: 'C001',
    clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
    date: d(2), time: '13:00', guests: 4, tableId: 'T04',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 2).toISOString(),
    createdBy: 'u004', occasion: 'Almuerzo familiar',
  },
  {
    id: 'R011', clientId: 'C010',
    clientName: 'Sandra Reyes', clientPhone: '944332211', clientEmail: 'sandra@email.com',
    date: d(2), time: '20:00', guests: 2, tableId: 'T01',
    status: RESERVATION_STATUS.NO_SHOW,
    notes: '', createdAt: subDays(new Date(), 2).toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R012', clientId: 'C004',
    clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
    date: d(2), time: '14:30', guests: 3, tableId: 'T07',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 2).toISOString(),
    createdBy: 'u004', occasion: '',
  },

  // ── HACE 3 DÍAS ───────────────────────────────────
  {
    id: 'R013', clientId: 'C003',
    clientName: 'Ana López', clientPhone: '998877665', clientEmail: 'ana@email.com',
    date: d(3), time: '12:30', guests: 5, tableId: 'T06',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 3).toISOString(),
    createdBy: 'u002', occasion: 'Reunión',
  },
  {
    id: 'R014', clientId: 'C011',
    clientName: 'Enrique Huamán', clientPhone: '955443322', clientEmail: 'enrique@email.com',
    date: d(3), time: '19:00', guests: 6, tableId: 'T12',
    status: RESERVATION_STATUS.COMPLETED,
    notes: 'Corporativo', createdAt: subDays(new Date(), 3).toISOString(),
    createdBy: 'u002', occasion: 'Reunión',
  },
  {
    id: 'R015', clientId: 'C002',
    clientName: 'Roberto Silva', clientPhone: '912345678', clientEmail: 'roberto@email.com',
    date: d(3), time: '20:30', guests: 2, tableId: 'T08',
    status: RESERVATION_STATUS.CANCELLED,
    cancelReason: 'Cambio de planes',
    notes: '', createdAt: subDays(new Date(), 3).toISOString(),
    createdBy: 'u004', occasion: '',
  },

  // ── HACE 5 DÍAS ───────────────────────────────────
  {
    id: 'R016', clientId: 'C005',
    clientName: 'Carlos Quispe', clientPhone: '956781234', clientEmail: 'carlos_q@email.com',
    date: d(5), time: '13:00', guests: 8, tableId: 'T14',
    status: RESERVATION_STATUS.COMPLETED,
    notes: 'Aniversario empresa', createdAt: subDays(new Date(), 5).toISOString(),
    createdBy: 'u002', occasion: 'Aniversario',
  },
  {
    id: 'R017', clientId: 'C007',
    clientName: 'Jorge Castillo', clientPhone: '988112233', clientEmail: 'jorge_c@email.com',
    date: d(5), time: '20:00', guests: 4, tableId: 'T10',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 5).toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R018', clientId: 'C012',
    clientName: 'Valeria Cruz', clientPhone: '966554433', clientEmail: 'valeria@email.com',
    date: d(5), time: '14:00', guests: 3, tableId: 'T05',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 5).toISOString(),
    createdBy: 'u004', occasion: 'Cumpleaños',
  },

  // ── HACE 7 DÍAS ───────────────────────────────────
  {
    id: 'R019', clientId: 'C001',
    clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
    date: d(7), time: '13:00', guests: 4, tableId: 'T03',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 7).toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R020', clientId: 'C008',
    clientName: 'Isabel Torres', clientPhone: '912233445', clientEmail: 'isabel@email.com',
    date: d(7), time: '20:30', guests: 6, tableId: 'T11',
    status: RESERVATION_STATUS.COMPLETED,
    notes: 'Cena especial', createdAt: subDays(new Date(), 7).toISOString(),
    createdBy: 'u004', occasion: 'Cena',
  },

  // ── HACE 10 DÍAS ──────────────────────────────────
  {
    id: 'R021', clientId: 'C003',
    clientName: 'Ana López', clientPhone: '998877665', clientEmail: 'ana@email.com',
    date: d(10), time: '14:00', guests: 2, tableId: 'T09',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 10).toISOString(),
    createdBy: 'u002', occasion: '',
  },
  {
    id: 'R022', clientId: 'C006',
    clientName: 'Lucia Mendoza', clientPhone: '999888777', clientEmail: 'lucia_m@email.com',
    date: d(10), time: '19:30', guests: 4, tableId: 'T15',
    status: RESERVATION_STATUS.COMPLETED,
    notes: 'Mesa VIP', createdAt: subDays(new Date(), 10).toISOString(),
    createdBy: 'u004', occasion: 'Aniversario',
  },
  {
    id: 'R023', clientId: 'C011',
    clientName: 'Enrique Huamán', clientPhone: '955443322', clientEmail: 'enrique@email.com',
    date: d(10), time: '13:00', guests: 5, tableId: 'T06',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 10).toISOString(),
    createdBy: 'u002', occasion: 'Reunión',
  },

  // ── HACE 14 DÍAS ──────────────────────────────────
  {
    id: 'R024', clientId: 'C004',
    clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
    date: d(14), time: '20:00', guests: 4, tableId: 'T10',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 14).toISOString(),
    createdBy: 'u004', occasion: 'Cena',
  },
  {
    id: 'R025', clientId: 'C012',
    clientName: 'Valeria Cruz', clientPhone: '966554433', clientEmail: 'valeria@email.com',
    date: d(14), time: '14:30', guests: 6, tableId: 'T12',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 14).toISOString(),
    createdBy: 'u002', occasion: 'Almuerzo familiar',
  },
]
