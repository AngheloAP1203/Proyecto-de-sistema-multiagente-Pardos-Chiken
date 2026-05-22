/**
 * src/features/reservations/ReservationsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de gestión de reservas en tiempo real.
 * Permite:
 *   - Ver solicitudes pendientes de aprobación (estado REQUESTED) con banner
 *   - Aprobar o rechazar solicitudes con asignación de mesa
 *   - Ver todas las reservas del día con filtros por estado
 *   - Crear una nueva reserva (abre modal con formulario)
 *   - Cambiar el estado de una reserva (sentar, completar, cancelar)
 *   - Buscar reservas por nombre de cliente
 *
 * Acceso: Todos los roles (con restricciones según permisos)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { Plus, Search, CalendarCheck, Bell, CheckCircle2, XCircle, Clock, Users, Phone } from 'lucide-react'
import { useReservations, RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS } from '../../context/ReservationContext'
import { useAuth } from '../../context/AuthContext'
import { useClients } from '../../context/ClientContext'
import { useKitchen } from '../../context/KitchenContext'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import ReservationForm from './ReservationForm'
import ReservationCard from './ReservationCard'
import styles from './ReservationsPage.module.css'

const STATUS_FILTERS = [
  { value: 'all',                              label: 'Todas' },
  { value: RESERVATION_STATUS.PENDING,         label: 'Pendientes' },
  { value: RESERVATION_STATUS.SEATED,          label: 'En mesa' },
  { value: RESERVATION_STATUS.COMPLETED,       label: 'Completadas' },
  { value: RESERVATION_STATUS.CANCELLED,       label: 'Canceladas' },
]

// Mesas disponibles para asignar al aprobar
const TABLES = Array.from({ length: 20 }, (_, i) => ({
  id: `T${String(i + 1).padStart(2, '0')}`,
  label: `Mesa ${i + 1}`,
}))

// ── Panel de aprobación de solicitudes ────────────────────────────────────────
function RequestsPanel({ requests, onApprove, onReject }) {
  const [selected, setSelected]   = useState(null)  // request being reviewed
  const [tableId,  setTableId]    = useState('T01')
  const [reason,   setReason]     = useState('')
  const [action,   setAction]     = useState(null)  // 'approve' | 'reject'

  if (requests.length === 0) return null

  const handleConfirm = () => {
    if (action === 'approve') {
      onApprove(selected.id, tableId)
    } else if (action === 'reject') {
      onReject(selected.id, reason)
    }
    setSelected(null)
    setAction(null)
    setReason('')
    setTableId('T01')
  }


  return (
    <>
      <div className={styles.requestsBanner}>
        <div className={styles.requestsBannerInner}>
          <Bell size={18} className={styles.requestsBell} />
          <div>
            <span className={styles.requestsLabel}>Solicitudes de clientes pendientes</span>
            <span className={styles.requestsCount}>{requests.length} solicitud{requests.length !== 1 ? 'es' : ''} en espera de aprobación</span>
          </div>
        </div>

        <div className={styles.requestsList}>
          {requests.map(r => (
            <div key={r.id} className={styles.requestCard}>
              <div className={styles.requestInfo}>
                <div className={styles.requestHeader}>
                  <span className={styles.requestId}>#{r.id}</span>
                  {r.source === 'public' && <span className={styles.requestSource}>🌐 Web</span>}
                </div>
                <h4 className={styles.requestName}>{r.clientName}</h4>
                <div className={styles.requestMeta}>
                  <span><Phone size={11} /> {r.clientPhone}</span>
                  <span><CalendarCheck size={11} /> {r.date} · {r.time}</span>
                  <span><Users size={11} /> {r.guests} personas</span>
                </div>
                {r.notes && <p className={styles.requestNote}>📝 {r.notes}</p>}
              </div>
              <div className={styles.requestActions}>
                <button className={styles.approveBtn}
                  onClick={() => { setSelected(r); setAction('approve') }}>
                  <CheckCircle2 size={14} /> Aprobar
                </button>
                <button className={styles.rejectBtn}
                  onClick={() => { setSelected(r); setAction('reject') }}>
                  <XCircle size={14} /> Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de confirmación */}
      <Modal isOpen={!!selected} onClose={() => { setSelected(null); setAction(null) }}
        title={action === 'approve' ? '✅ Aprobar solicitud' : '❌ Rechazar solicitud'}
        size="sm">
        {selected && (
          <div className={styles.approveModal}>
            <div className={styles.approveInfo}>
              <p><strong>{selected.clientName}</strong> · {selected.date} {selected.time} · {selected.guests} pers.</p>
            </div>

            {action === 'approve' ? (
              <>
                <label className={styles.approveLabel}>Asignar mesa:</label>
                <select className={styles.approveSelect}
                  value={tableId} onChange={e => setTableId(e.target.value)}>
                  {TABLES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <div className={styles.approveActions}>
                  <Button variant="ghost" onClick={() => { setSelected(null); setAction(null) }}>Cancelar</Button>
                  <Button variant="success" icon={<CheckCircle2 size={15} />} onClick={handleConfirm}>
                    Confirmar aprobación
                  </Button>
                </div>
              </>
            ) : (
              <>
                <label className={styles.approveLabel}>Motivo de rechazo (opcional):</label>
                <textarea className={styles.rejectTextarea}
                  placeholder="Ej: No hay disponibilidad en esa fecha..."
                  value={reason} onChange={e => setReason(e.target.value)} rows={3} />
                <div className={styles.approveActions}>
                  <Button variant="ghost" onClick={() => { setSelected(null); setAction(null) }}>Cancelar</Button>
                  <Button variant="danger" icon={<XCircle size={15} />} onClick={handleConfirm}>
                    Confirmar rechazo
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ReservationsPage() {
  const {
    reservations, todayReservations, pendingRequests,
    addReservation, updateReservation, cancelReservation,
    seatReservation, completeReservation,
    approveReservation, rejectReservation,
    deleteReservationFromDB,
  } = useReservations()
  const { user, hasPermission } = useAuth()
  const { findByPhone, addClient, updateClient } = useClients()
  const { addTicket } = useKitchen()

  const [search,       setSearch]     = useState('')
  const [statusFilter, setStatus]     = useState('all')
  const [dateFilter,   setDate]       = useState('today')
  const [isModalOpen,  setModalOpen]  = useState(false)
  const [editReservation, setEdit]    = useState(null)

  const baseList = dateFilter === 'today' ? todayReservations : reservations.filter(
    r => r.status !== RESERVATION_STATUS.REQUESTED
  )

  const filtered = baseList.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    const matchSearch = !search ||
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.clientPhone?.includes(search) || r.id.includes(search)
    return matchStatus && matchSearch
  })

  const handleCreate = (data) => {
    addReservation({ ...data, createdBy: user.id })
    setModalOpen(false)
  }

  const handleEdit = (reservation) => {
    setEdit(reservation)
    setModalOpen(true)
  }

  const handleUpdate = (data) => {
    if (editReservation) updateReservation(editReservation.id, data)
    setModalOpen(false)
    setEdit(null)
  }

  // Al sentar: cambia el estado de la reserva Y envía un ticket a cocina si hay platos
  const handleSeat = (reservation) => {
    seatReservation(reservation.id)
    if (reservation.items && reservation.items.length > 0) {
      addTicket({
        tableId:    reservation.tableId,
        clientName: reservation.clientName,
        guests:     reservation.guests,
        notes:      reservation.notes || '',
        priority:   'normal',
        items:      reservation.items.map(item => ({ ...item, itemStatus: 'pending' })),
      })
    }
  }


  /**
   * handleApprove — Aprueba la reserva y registra/actualiza el cliente.
   * - Si el cliente ya existe (por teléfono) → incrementa sus reservas.
   * - Si es nuevo → lo crea automáticamente en el módulo de clientes.
   */
  const handleApprove = (id, tableId) => {
    const reservation = reservations.find(r => r.id === id)
    approveReservation(id, tableId, user.name)

    if (reservation) {
      const existing = findByPhone(reservation.clientPhone)
      if (existing) {
        // Cliente ya registrado → actualizar contador y email si faltaba
        updateClient(existing.id, {
          totalReservations: (existing.totalReservations || 0) + 1,
          email: existing.email || reservation.clientEmail || '',
        })
      } else {
        // Cliente nuevo → registrar automáticamente
        addClient({
          name:              reservation.clientName,
          phone:             reservation.clientPhone,
          email:             reservation.clientEmail || '',
          dni:               '',
          birthday:          '',
          preferences:       '',
          allergies:         '',
          notes:             reservation.notes
                               ? `Registrado vía web. Nota: ${reservation.notes}`
                               : 'Registrado automáticamente al aprobar reserva web.',
          totalReservations: 1,
          vip:               false,
        })
      }
    }
  }

  const handleReject = (id, reason) => {
    rejectReservation(id, reason)
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reservas</h1>
          <p className={styles.subtitle}>
            {filtered.length} reserva{filtered.length !== 1 ? 's' : ''} · {pendingRequests.length > 0 && (
              <span className={styles.badgeIndicator}>{pendingRequests.length} solicitud{pendingRequests.length > 1 ? 'es' : ''} pendiente{pendingRequests.length > 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        {hasPermission('canManageReservations') && (
          <Button variant="primary" icon={<Plus size={16} />}
            onClick={() => { setEdit(null); setModalOpen(true) }}
            id="btn-nueva-reserva">
            Nueva Reserva
          </Button>
        )}
      </div>

      {/* ── Solicitudes pendientes de aprobación ── */}
      {hasPermission('canManageReservations') && (
        <RequestsPanel
          requests={pendingRequests}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Filtros */}
      <Card noPadding>
        <div className={styles.filterBar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input type="search" placeholder="Buscar por cliente, teléfono o ID..."
              value={search} onChange={e => setSearch(e.target.value)}
              className={styles.searchInput} id="buscar-reserva" />
          </div>
          <div className={styles.dateToggle}>
            <button className={`${styles.toggleBtn} ${dateFilter === 'today' ? styles.toggleActive : ''}`}
              onClick={() => setDate('today')}>Hoy</button>
            <button className={`${styles.toggleBtn} ${dateFilter === 'all' ? styles.toggleActive : ''}`}
              onClick={() => setDate('all')}>Todas</button>
          </div>
          <div className={styles.statusFilters}>
            {STATUS_FILTERS.map(f => (
              <button key={f.value}
                className={`${styles.statusBtn} ${statusFilter === f.value ? styles.statusActive : ''}`}
                onClick={() => setStatus(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <CalendarCheck size={56} />
          <h3>No hay reservas</h3>
          <p>No se encontraron reservas con los filtros aplicados.</p>
          {hasPermission('canManageReservations') && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
              Crear primera reserva
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.reservationGrid}>
          {filtered.map(r => (
            <ReservationCard
              key={r.id}
              reservation={r}
              onEdit={hasPermission('canManageReservations') ? () => handleEdit(r) : null}
              onSeat={hasPermission('canSeatGuests') ? () => handleSeat(r) : null}
              onCancel={(reason) => cancelReservation(r.id, reason)}
              canCancel={hasPermission('canCancelAnyReservation')}
              onDelete={hasPermission('canDeleteReservations') ? () => deleteReservationFromDB(r.id) : null}
              onUpdateItems={(newItems, notes) => updateReservation(r.id, { items: newItems, ...(notes !== undefined && { notes }) })}
              canAddItems={['mozo', 'cajero', 'admin'].includes(user?.role)}
            />
          ))}
        </div>
      )}

      {/* Modal formulario */}
      <Modal isOpen={isModalOpen} onClose={() => { setModalOpen(false); setEdit(null) }}
        title={editReservation ? 'Editar Reserva' : 'Nueva Reserva'} size="lg">
        <ReservationForm
          initialData={editReservation}
          onSubmit={editReservation ? handleUpdate : handleCreate}
          onCancel={() => { setModalOpen(false); setEdit(null) }}
        />
      </Modal>
    </div>
  )
}
