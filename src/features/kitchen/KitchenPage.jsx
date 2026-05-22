/**
 * src/features/kitchen/KitchenPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de Cocina — Jefe de Cocina y Admin.
 * Recibe tickets automáticamente cuando una reserva pasa a estado "En Mesa".
 * Cada ítem avanza de forma INDIVIDUAL: pending → preparing → ready.
 * Cuando TODOS los ítems están en 'ready', el ticket pasa a "Listo para servir".
 * El cocinero NO puede crear ni modificar tickets manualmente.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react'
import { ChefHat, Clock, AlertTriangle, CheckCircle2, Flame, ChevronRight } from 'lucide-react'
import {
  useKitchen,
  TICKET_STATUS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
} from '../../context/KitchenContext'
import { StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'
import styles from './KitchenPage.module.css'

// ── Temporizador ──────────────────────────────────────────────────────────────
function ElapsedTimer({ createdAt }) {
  const [mins, setMins] = useState(
    () => Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  )
  useEffect(() => {
    const iv = setInterval(() =>
      setMins(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
    , 30000)
    return () => clearInterval(iv)
  }, [createdAt])
  return (
    <span className={`${styles.timer} ${mins > 20 ? styles.timerAlert : ''}`}>
      <Clock size={12} /> {mins} min
    </span>
  )
}

// ── Colores y etiquetas por fase de ítem ──────────────────────────────────────
const ITEM_STATUS_META = {
  pending:   { label: 'Pendiente',  color: '#f59e0b', bg: '#fef3c7' },
  preparing: { label: 'Preparando', color: '#3b82f6', bg: '#dbeafe' },
  ready:     { label: 'Listo ✓',   color: '#10b981', bg: '#d1fae5' },
}

// ── Fila de ítem individual con botón de avance ───────────────────────────────
function ItemRow({ item, index, ticketId, onAdvanceItem, ticketStatus }) {
  const phase    = item.itemStatus || 'pending'
  const meta     = ITEM_STATUS_META[phase]
  const isDone   = phase === 'ready'
  const canClick = !isDone && ticketStatus !== TICKET_STATUS.SERVED

  return (
    <li className={`${styles.item} ${isDone ? styles.itemReady : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <span className={styles.itemQty}>{item.qty}×</span>
        <span className={styles.itemName}>{item.name}</span>
        {item.notes && <span className={styles.itemNote}>({item.notes})</span>}
      </div>
      <button
        type="button"
        disabled={!canClick}
        onClick={() => canClick && onAdvanceItem(ticketId, index)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 10px', borderRadius: '20px',
          border: `1.5px solid ${meta.color}`, background: meta.bg, color: meta.color,
          fontSize: '11px', fontWeight: 700,
          cursor: canClick ? 'pointer' : 'default',
          whiteSpace: 'nowrap', transition: 'all 0.2s',
        }}
        title={isDone ? 'Ítem listo' : 'Avanzar al siguiente paso'}
      >
        {meta.label}
        {!isDone && <ChevronRight size={11} strokeWidth={3} />}
      </button>
    </li>
  )
}

// ── Ticket card ───────────────────────────────────────────────────────────────
function TicketCard({ ticket, onAdvance, onAdvanceItem }) {
  const color      = TICKET_STATUS_COLORS[ticket.status]
  const doneCount  = ticket.items.filter(i => (i.itemStatus || 'pending') === 'ready').length
  const totalCount = ticket.items.length
  const pct        = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <article
      className={`${styles.ticket} ${ticket.priority === 'high' ? styles.ticketHigh : ''}`}
      style={{ borderTopColor: color }}
    >
      {ticket.priority === 'high' && (
        <div className={styles.priorityBadge}>
          <AlertTriangle size={11} /> Alta prioridad
        </div>
      )}

      <div className={styles.ticketHeader}>
        <div>
          <span className={styles.ticketTable}>Mesa {ticket.tableId}</span>
          <h3 className={styles.ticketClient}>{ticket.clientName}</h3>
        </div>
        <div className={styles.ticketMeta}>
          <ElapsedTimer createdAt={ticket.createdAt} />
          <span className={styles.ticketGuests}>👥 {ticket.guests}</span>
        </div>
      </div>

      {/* Barra de progreso */}
      <div style={{ margin: '8px 0', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', height: '6px' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: pct === 100 ? '#10b981' : '#3b82f6',
          transition: 'width 0.4s ease', borderRadius: '8px',
        }} />
      </div>
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
        {doneCount}/{totalCount} ítems listos
      </div>

      {/* Ítems individuales */}
      <ul className={styles.itemList}>
        {ticket.items.map((item, i) => (
          <ItemRow
            key={i} item={item} index={i}
            ticketId={ticket.id} onAdvanceItem={onAdvanceItem}
            ticketStatus={ticket.status}
          />
        ))}
      </ul>

      {ticket.notes && (
        <p className={styles.ticketNote}>
          <AlertTriangle size={12} /> {ticket.notes}
        </p>
      )}

      {/* Solo en "Listo para servir" aparece el botón de marcar servido */}
      {ticket.status === TICKET_STATUS.READY && (
        <div className={styles.ticketActions}>
          <Button
            variant="success" size="sm"
            icon={<CheckCircle2 size={14} />}
            onClick={() => onAdvance(ticket.id, TICKET_STATUS.SERVED)}
          >
            Marcar Servido
          </Button>
        </div>
      )}
    </article>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function KitchenPage() {
  const {
    activeTickets, tickets, pendingCount, preparingCount, readyCount,
    updateTicketStatus, advanceItem,
  } = useKitchen()

  const pending   = activeTickets.filter(t => t.status === TICKET_STATUS.PENDING)
  const preparing = activeTickets.filter(t => t.status === TICKET_STATUS.PREPARING)
  const ready     = activeTickets.filter(t => t.status === TICKET_STATUS.READY)

  const handleAdvance = (id, newStatus) => {
    updateTicketStatus(id, newStatus)
    if (newStatus === TICKET_STATUS.SERVED) {
      toast.success('✅ Pedido marcado como servido')
    }
  }

  const handleAdvanceItem = (ticketId, itemIndex) => {
    advanceItem(ticketId, itemIndex)
    toast.success('Plato avanzado')
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Panel de Cocina</h1>
          <p className={styles.subtitle}>Los pedidos llegan automáticamente cuando se sienta una mesa</p>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <StatCard label="Pendientes"     value={pendingCount}   icon={<Clock size={20} />}       color="warning" />
        <StatCard label="En preparación" value={preparingCount} icon={<Flame size={20} />}        color="info" />
        <StatCard label="Listos"         value={readyCount}     icon={<CheckCircle2 size={20} />} color="success" />
        <StatCard label="Total del día"  value={tickets.length} icon={<ChefHat size={20} />}      color="primary" />
      </div>

      {/* Tablero Kanban */}
      <div className={styles.kanban}>
        {/* Pendientes */}
        <div className={styles.column}>
          <div className={styles.colHeader} style={{ borderBottomColor: TICKET_STATUS_COLORS.pending }}>
            <Clock size={16} style={{ color: TICKET_STATUS_COLORS.pending }} />
            <span>Pendiente</span>
            <span className={styles.colCount}>{pending.length}</span>
          </div>
          <div className={styles.colBody}>
            {pending.length === 0 ? (
              <div className={styles.colEmpty}>Sin pedidos pendientes 🎉</div>
            ) : (
              pending.map(t => (
                <TicketCard key={t.id} ticket={t}
                  onAdvance={handleAdvance} onAdvanceItem={handleAdvanceItem} />
              ))
            )}
          </div>
        </div>

        {/* En preparación */}
        <div className={styles.column}>
          <div className={styles.colHeader} style={{ borderBottomColor: TICKET_STATUS_COLORS.preparing }}>
            <Flame size={16} style={{ color: TICKET_STATUS_COLORS.preparing }} />
            <span>En Preparación</span>
            <span className={styles.colCount}>{preparing.length}</span>
          </div>
          <div className={styles.colBody}>
            {preparing.length === 0 ? (
              <div className={styles.colEmpty}>Nada en preparación</div>
            ) : (
              preparing.map(t => (
                <TicketCard key={t.id} ticket={t}
                  onAdvance={handleAdvance} onAdvanceItem={handleAdvanceItem} />
              ))
            )}
          </div>
        </div>

        {/* Listos */}
        <div className={styles.column}>
          <div className={styles.colHeader} style={{ borderBottomColor: TICKET_STATUS_COLORS.ready }}>
            <CheckCircle2 size={16} style={{ color: TICKET_STATUS_COLORS.ready }} />
            <span>Listo para servir</span>
            <span className={styles.colCount}>{ready.length}</span>
          </div>
          <div className={styles.colBody}>
            {ready.length === 0 ? (
              <div className={styles.colEmpty}>Nada listo aún</div>
            ) : (
              ready.map(t => (
                <TicketCard key={t.id} ticket={t}
                  onAdvance={handleAdvance} onAdvanceItem={handleAdvanceItem} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
