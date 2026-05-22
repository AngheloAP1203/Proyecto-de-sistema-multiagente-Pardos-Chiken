/**
 * src/features/reservations/ReservationCard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tarjeta individual de una reserva.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Edit2, UserCheck, XCircle, Clock, Users, MapPin, Phone, Utensils, Trash2, Plus, Search, MessageSquare, ChevronRight } from 'lucide-react'
import { RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS } from '../../context/ReservationContext'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { MENU_ITEMS } from '../../domain/kitchen/menu'
import styles from './ReservationCard.module.css'

const BADGE_CLASS = {
  warning: 'badge badge--warning',
  info:    'badge badge--info',
  success: 'badge badge--success',
  error:   'badge badge--error',
  neutral: 'badge badge--neutral',
}

export default function ReservationCard({ reservation: r, onEdit, onSeat, onCancel, canCancel, onDelete, onUpdateItems, canAddItems }) {
  const [showCancelInput, setShowCancelInput] = useState(false)
  const [cancelReason, setCancelReason]       = useState('')
  const [isMenuOpen, setMenuOpen]             = useState(false)
  const [localItems, setLocalItems]           = useState(r.items || [])
  const [activeCategory, setActiveCategory]   = useState('Todas')
  const [menuQuery, setMenuQuery]             = useState('')
  const [orderNotes, setOrderNotes]           = useState(r.notes || '')

  const handleCancel = () => {
    onCancel(cancelReason)
    setShowCancelInput(false)
    setCancelReason('')
  }

  const isActive   = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.SEATED].includes(r.status)
  const isPending  = r.status === RESERVATION_STATUS.PENDING
  const isSeated   = r.status === RESERVATION_STATUS.SEATED
  const statusCls  = BADGE_CLASS[STATUS_COLORS[r.status]] || 'badge'

  const categories = [...new Set(MENU_ITEMS.map(m => m.category))]
  const orderTotal = localItems.reduce((s, i) => s + (i.price * i.qty), 0)

  const handleAddOrderItem = (menuItem) => {
    setLocalItems(prev => {
      const exists = prev.find(i => i.menuId === menuItem.id)
      if (exists) return prev.map(i => i.menuId === menuItem.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { menuId: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1 }]
    })
  }

  const updateQty = (menuId, delta) => {
    setLocalItems(prev => prev.map(i => i.menuId === menuId ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
  }

  const removeOrderItem = (menuId) => {
    setLocalItems(prev => prev.filter(i => i.menuId !== menuId))
  }

  const handleSaveItems = () => {
    onUpdateItems(localItems, orderNotes)
    setMenuOpen(false)
  }

  return (
    <article className={`${styles.card} ${styles[`card--${r.status}`]}`}>
      <div className={`${styles.strip} ${styles[`strip--${r.status}`]}`} />

      <div className={styles.body}>
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.clientName}>
              {r.clientName}
              {r.isPaid && <span className={styles.hasItemsBadge} style={{marginLeft: 8, background: '#d1fae5', color: '#047857'}}>Pagado</span>}
            </h3>

          </div>
          <span className={statusCls}>{STATUS_LABELS[r.status]}</span>
        </div>

        <div className={styles.info}>
          <div className={styles.infoItem}>
            <Clock size={14} />
            <span>{r.time} — {r.date}</span>
          </div>
          <div className={styles.infoItem}>
            <Users size={14} />
            <span>{r.guests} persona{r.guests !== 1 ? 's' : ''}</span>
          </div>
          <div className={styles.infoItem}>
            <MapPin size={14} />
            <span>Mesa {r.tableId}</span>
          </div>
          {r.clientPhone && (
            <div className={styles.infoItem}>
              <Phone size={14} />
              <span>{r.clientPhone}</span>
            </div>
          )}
        </div>

        {r.items && r.items.length > 0 && (
          <div className={styles.infoItem} style={{marginTop: 8}}>
            <Utensils size={14} />
            <span style={{fontWeight: 600}}>Pedido en curso: {r.items.reduce((s,i)=>s+i.qty,0)} platos</span>
          </div>
        )}

        {r.notes && (
          <p className={styles.notes}>{r.notes}</p>
        )}

        <div className={styles.reservationId}>#{r.id}</div>

        {isActive && !showCancelInput && (
          <div className={styles.actions}>
            {onSeat && isPending && (
              <Button variant="success" size="sm" icon={<UserCheck size={14} />} onClick={onSeat}>
                Sentar
              </Button>
            )}

            
            {canAddItems && (
              <Button variant="secondary" size="sm" icon={<Utensils size={14} />} onClick={() => { setLocalItems(r.items || []); setMenuOpen(true); }}>
                Platos
              </Button>
            )}

            {onEdit && (
              <Button variant="ghost" size="sm" icon={<Edit2 size={14} />} onClick={onEdit}>
                Editar
              </Button>
            )}
            {canCancel && (
              <Button variant="ghost" size="sm" icon={<XCircle size={14} />} onClick={() => setShowCancelInput(true)}>
                Cancelar
              </Button>
            )}
            {onDelete && (
              <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={onDelete}>
                Eliminar
              </Button>
            )}
          </div>
        )}

        {showCancelInput && (
          <div className={styles.cancelBox}>
            <input
              type="text"
              placeholder="Motivo de cancelación (opcional)"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className={styles.cancelInput}
              autoFocus
            />
            <div className={styles.cancelActions}>
              <Button variant="danger" size="sm" onClick={handleCancel}>
                Confirmar cancelación
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowCancelInput(false)}>
                Atrás
              </Button>
            </div>
          </div>
        )}
      </div>

      {isMenuOpen && createPortal(
        <div className={styles.menuModalOverlay}>
          <div className={styles.menuModal}>
            
            {/* Header */}
            <div className={styles.menuModalHeader}>
              <div className={styles.headerTitle}>
                <h3>Comanda — Mesa {r.tableId}</h3>
                <span className={styles.headerBadge}>{r.clientName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMenuOpen(false)}>✕ Cerrar</Button>
            </div>

            {/* Body */}
            <div className={styles.menuModalBody}>
              
              {/* Left Side: Menu Grid */}
              <div className={styles.menuMainArea}>
                <div className={styles.menuControls}>
                  <Input
                    placeholder="Buscar plato o bebida..."
                    value={menuQuery}
                    onChange={e => setMenuQuery(e.target.value)}
                    icon={<Search size={16} />}
                  />
                  <Select value={activeCategory} onChange={e => setActiveCategory(e.target.value)}>
                    <option value="Todas">Todas las categorías</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>

                <div className={styles.menuCategories}>
                  {categories.filter(c => activeCategory === 'Todas' || activeCategory === c).map(cat => {
                    const itemsOfCat = MENU_ITEMS.filter(m => m.category === cat && (!menuQuery || m.name.toLowerCase().includes(menuQuery.toLowerCase())))
                    if (itemsOfCat.length === 0) return null
                    
                    return (
                      <div key={cat} className={styles.menuCat}>
                        <h4 className={styles.catTitle}>{cat}</h4>
                        <div className={styles.catGrid}>
                          {itemsOfCat.map(item => (
                            <button key={item.id} type="button"
                              className={styles.menuItemBtn}
                              onClick={() => handleAddOrderItem(item)}>
                              <div className={styles.menuItemImgPlaceholder}>
                                <Utensils size={32} opacity={0.6} />
                              </div>
                              <div className={styles.menuItemName}>{item.name}</div>
                              <div className={styles.menuItemBottom}>
                                <span className={styles.menuItemPrice}>S/ {item.price.toFixed(2)}</span>
                                <div className={styles.menuItemAdd}>
                                  <Plus size={16} strokeWidth={3}/>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right Side: Order Summary */}
              <div className={styles.orderSide}>
                <div className={styles.orderHeader}>
                  <h3 className={styles.menuTitle}>Resumen de Pedido</h3>
                  <div className={styles.orderSubtitle}>
                    {localItems.length} {localItems.length === 1 ? 'ítem' : 'ítems'} en la orden
                  </div>
                </div>

                <div className={styles.orderBody}>
                  {localItems.length === 0 ? (
                    <div className={styles.orderEmpty}>
                      <Utensils size={48} />
                      <p>Añade platos del menú para armar la comanda de la mesa.</p>
                    </div>
                  ) : (
                    <div className={styles.orderList}>
                      {localItems.map(item => (
                        <div key={item.menuId} className={styles.orderRow}>
                          <div className={styles.orderRowTop}>
                            <span className={styles.orderName}>{item.name}</span>
                            <button type="button" className={styles.removeBtn} onClick={() => removeOrderItem(item.menuId)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className={styles.orderRowBottom}>
                            <span className={styles.orderPrice}>S/ {((item.price || 0) * item.qty).toFixed(2)}</span>
                            <div className={styles.orderQtyCtrl}>
                              <button type="button" onClick={() => updateQty(item.menuId, -1)}>−</button>
                              <span>{item.qty}</span>
                              <button type="button" onClick={() => updateQty(item.menuId, +1)}>+</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.orderFooter}>
                  <div className={styles.orderTotalRow}>
                    <span className={styles.orderTotalLabel}>Total a Pagar</span>
                    <span className={styles.orderTotalValue}>S/ {orderTotal.toFixed(2)}</span>
                  </div>

                  {/* Observaciones de la comanda */}
                  <div className={styles.notesBox}>
                    <div className={styles.notesBoxHeader}>
                      <MessageSquare size={13} />
                      <span>Observaciones de la comanda</span>
                    </div>
                    <textarea
                      className={styles.notesTextarea}
                      placeholder="Ej: sin cebolla, bien cocido, alergia a nueces..."
                      value={orderNotes}
                      onChange={e => setOrderNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <Button
                    variant="primary"
                    fullWidth
                    icon={<ChevronRight size={18} />}
                    onClick={handleSaveItems}
                    disabled={localItems.length === 0 && r.items?.length === 0}
                    id={`btn-confirm-comanda-${r.id}`}
                  >
                    Confirmar Comanda
                  </Button>
                </div>
              </div>
            </div>
            
          </div>
        </div>,
        document.body
      )}
    </article>
  )
}
