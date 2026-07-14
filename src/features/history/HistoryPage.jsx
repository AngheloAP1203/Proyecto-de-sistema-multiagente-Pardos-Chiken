/**
 * src/features/history/HistoryPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de historial de reservas.
 * Muestra las reservas completadas, canceladas y no-show con:
 *   - Filtros por estado, fecha (rango) y búsqueda por cliente
 *   - Tabla paginada con toda la información
 *   - Estadísticas del historial
 *
 * Acceso: Administrador, Cajero
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { Search, Clock } from 'lucide-react'
import {
  useReservations,
  RESERVATION_STATUS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../../context/ReservationContext'
import { useComplaints } from '../../context/ComplaintContext'
import { Card } from '../../components/ui/Card'
import styles from './HistoryPage.module.css'

const BADGE_MAP = {
  warning: 'badge badge--warning',
  info:    'badge badge--info',
  success: 'badge badge--success',
  error:   'badge badge--error',
  neutral: 'badge badge--neutral',
}

const FILTERS = [
  { value: 'all',                              label: 'Todos' },
  { value: RESERVATION_STATUS.COMPLETED,       label: 'Completadas' },
  { value: RESERVATION_STATUS.CANCELLED,       label: 'Canceladas' },
  { value: RESERVATION_STATUS.NO_SHOW,         label: 'No se presentaron' },
]

const PAGE_SIZE = 15

export default function HistoryPage() {
  const { reservations } = useReservations()
  const { complaints } = useComplaints()

  const [search,     setSearch]  = useState('')
  const [statusFilt, setStatus]  = useState('all')
  const [fromDate,   setFrom]    = useState('')
  const [toDate,     setTo]      = useState('')
  const [page,       setPage]    = useState(1)

  // Historial = reservas no activas
  const historical = reservations.filter(
    r => [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.NO_SHOW].includes(r.status)
  )

  const filtered = historical.filter(r => {
    const matchStatus = statusFilt === 'all' || r.status === statusFilt
    const matchSearch = !search || r.clientName.toLowerCase().includes(search.toLowerCase()) || r.id.includes(search)
    const matchFrom   = !fromDate || r.date >= fromDate
    const matchTo     = !toDate   || r.date <= toDate
    return matchStatus && matchSearch && matchFrom && matchTo
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = {
    completed: historical.filter(r => r.status === RESERVATION_STATUS.COMPLETED).length,
    cancelled: historical.filter(r => r.status === RESERVATION_STATUS.CANCELLED).length,
    noShow:    historical.filter(r => r.status === RESERVATION_STATUS.NO_SHOW).length,
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Historial</h1>
          <p className={styles.subtitle}>{filtered.length} registros en el historial</p>
        </div>
      </div>

      {/* Stats resumen */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statNum} style={{ color: 'var(--color-success)' }}>{stats.completed}</span>
          <span className={styles.statLab}>Completadas</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum} style={{ color: 'var(--color-primary)' }}>{stats.cancelled}</span>
          <span className={styles.statLab}>Canceladas</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum} style={{ color: 'var(--color-text-muted)' }}>{stats.noShow}</span>
          <span className={styles.statLab}>No se presentaron</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum}>{historical.length}</span>
          <span className={styles.statLab}>Total histórico</span>
        </div>
      </div>

      {/* Filtros */}
      <Card noPadding>
        <div className={styles.filters}>
          <div className={styles.searchBox}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="search"
              placeholder="Buscar por cliente o ID..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className={styles.searchInput}
              id="buscar-historial"
            />
          </div>
          <div className={styles.dateRange}>
            <input type="date" value={fromDate} onChange={e => { setFrom(e.target.value); setPage(1) }}
              className={styles.dateInput} title="Desde" />
            <span className={styles.dateSep}>—</span>
            <input type="date" value={toDate} onChange={e => { setTo(e.target.value); setPage(1) }}
              className={styles.dateInput} title="Hasta" />
          </div>
          <div className={styles.statusBtns}>
            {FILTERS.map(f => (
              <button
                key={f.value}
                className={`${styles.statusBtn} ${statusFilt === f.value ? styles.statusActive : ''}`}
                onClick={() => { setStatus(f.value); setPage(1) }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card noPadding>
        {paginated.length === 0 ? (
          <div className={styles.empty}>
            <Clock size={48} />
            <p>No hay registros en el historial con estos filtros</p>
          </div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Personas</th>
                    <th>Consumo</th>
                    <th>Estado</th>
                    <th>Reclamo</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(r => {
                    const linkedComplaint = complaints.find(c => c.reservationId === r.id || c.reservation_id === r.id)
                    const consumoText = r.items?.length 
                      ? r.items.map(i => `${i.qty}x ${i.name}`).join(', ')
                      : 'Sin consumo'

                    return (
                      <tr key={r.id}>
                        <td className={styles.mono}>#{r.id}</td>
                        <td>
                          <div className={styles.clientName}>{r.clientName}</div>
                          <div className={styles.clientPhone}>{r.clientDni}</div>
                        </td>
                        <td>{r.date}</td>
                        <td>{r.time}</td>
                        <td className={styles.center}>{r.guests}</td>
                        <td>
                          <div className={styles.consumo}>{consumoText}</div>
                        </td>
                        <td>
                          <span className={BADGE_MAP[STATUS_COLORS[r.status]] || 'badge'}>
                            {STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td>
                          {linkedComplaint ? (
                            <span className={styles.complaintBadge}>
                              # Cód. Reclamo: {linkedComplaint.id.slice(0, 6).toUpperCase()}
                            </span>
                          ) : (
                            <span className={styles.noComplaint}>Sin reclamos</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  ← Anterior
                </button>
                <span className={styles.pageInfo}>Pág. {page} de {totalPages}</span>
                <button
                  className={styles.pageBtn}
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
