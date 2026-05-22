/**
 * src/features/cash/CashPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo de Caja — exclusivo para el rol de Cajero (y visible por Admin).
 * Funcionalidades:
 *   - Abrir / cerrar turno de caja con monto de apertura
 *   - Registrar cobros con ítems del menú, precio unitario y total calculado
 *   - Generar boleta de venta con desglose de ítems, IGV y total
 *   - Ver resumen del turno actual: total cobrado por método de pago
 *   - Historial de cobros del día con detalle de boleta al hacer clic
 *
 * Acceso: Cajero, Administrador
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { CreditCard, DollarSign, Plus, Clock, CheckCircle, X, Printer, Receipt, ChevronDown, ChevronUp, Trash2, Search, Calendar, AlertCircle, MessageSquare, Utensils } from 'lucide-react'
import { useCash, PAYMENT_METHODS } from '../../context/CashContext'
import { useReservations, RESERVATION_STATUS } from '../../context/ReservationContext'
import { useAuth } from '../../context/AuthContext'
import { MENU_ITEMS } from '../../context/KitchenContext'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import toast from 'react-hot-toast'
import styles from './CashPage.module.css'

const TODAY_STR = format(new Date(), 'yyyy-MM-dd')

// Statuses que el cajero puede cobrar
const PAYABLE_STATUSES = [
  RESERVATION_STATUS.PENDING,
  RESERVATION_STATUS.SEATED,
]

const IGV_RATE = 0.18   // 18% IGV peruano

const EMPTY_PAYMENT = {
  reservationId: '',
  clientName: '',
  method: 'efectivo',
  guests: '',
  notes: '',
  items: [],
}

// ── Boleta imprimible ─────────────────────────────────────────────────────────
function Boleta({ payment, onClose }) {
  if (!payment) return null
  const method = PAYMENT_METHODS.find(m => m.id === payment.method)
  const subtotal = payment.amount / (1 + IGV_RATE)
  const igv      = payment.amount - subtotal
  const hasItems = payment.items && payment.items.length > 0

  return (
    <div className={styles.boleta}>
      {/* Header */}
      <div className={styles.boletaHeader}>
        <div className={styles.boletaLogo}>🍗</div>
        <h2 className={styles.boletaTitle}>Pardos Chicken</h2>
        <p className={styles.boletaSub}>Sistema de Reservas — Miraflores</p>
        <p className={styles.boletaInfo}>RUC: 20123456789</p>
        <div className={styles.boletaDivider} />
        <p className={styles.boletaType}>BOLETA DE VENTA ELECTRÓNICA</p>
        <p className={styles.boletaNum}>N° {payment.id}</p>
      </div>

      {/* Datos del cliente */}
      <div className={styles.boletaSection}>
        <div className={styles.boletaRow2}>
          <span>Fecha:</span>
          <strong>{payment.date} {payment.time}</strong>
        </div>
        <div className={styles.boletaRow2}>
          <span>Cliente:</span>
          <strong>{payment.clientName}</strong>
        </div>
        <div className={styles.boletaRow2}>
          <span>Personas:</span>
          <strong>{payment.guests}</strong>
        </div>
        <div className={styles.boletaRow2}>
          <span>Cajero:</span>
          <strong>{payment.cashierName}</strong>
        </div>
      </div>

      <div className={styles.boletaDivider} />

      {/* Ítems */}
      {hasItems ? (
        <div className={styles.boletaItems}>
          <div className={styles.boletaItemHeader}>
            <span>Descripción</span>
            <span>Cant.</span>
            <span>P.Unit</span>
            <span>Total</span>
          </div>
          {payment.items.map((item, i) => (
            <div key={i} className={styles.boletaItem}>
              <span className={styles.boletaItemName}>{item.name}</span>
              <span className={styles.boletaItemQty}>{item.qty}</span>
              <span>S/ {(item.price || 0).toFixed(2)}</span>
              <span className={styles.boletaItemTotal}>S/ {((item.price || 0) * item.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.boletaNoItems}>
          <p>Consumo general</p>
        </div>
      )}

      <div className={styles.boletaDivider} />

      {/* Totales */}
      <div className={styles.boletaTotals}>
        <div className={styles.boletaRow2}>
          <span>Subtotal (sin IGV):</span>
          <span>S/ {subtotal.toFixed(2)}</span>
        </div>
        <div className={styles.boletaRow2}>
          <span>IGV (18%):</span>
          <span>S/ {igv.toFixed(2)}</span>
        </div>
        <div className={`${styles.boletaRow2} ${styles.boletaTotal}`}>
          <span>TOTAL:</span>
          <strong>S/ {payment.amount.toFixed(2)}</strong>
        </div>
        <div className={styles.boletaRow2}>
          <span>Método de pago:</span>
          <span>{method?.icon} {method?.label}</span>
        </div>
      </div>

      {payment.notes && (
        <>
          <div className={styles.boletaDivider} />
          <p className={styles.boletaNotes}>Nota: {payment.notes}</p>
        </>
      )}

      <div className={styles.boletaDivider} />
      <p className={styles.boletaFoot}>¡Gracias por su preferencia!</p>
      <p className={styles.boletaFoot}>www.pardoschicken.pe</p>

      <div className={styles.boletaActions}>
        <Button variant="primary" icon={<Printer size={15} />} onClick={() => window.print()} fullWidth id="btn-imprimir-boleta">
          Imprimir boleta
        </Button>
        <Button variant="ghost" onClick={onClose} fullWidth>Cerrar</Button>
      </div>
    </div>
  )
}

// ── Fila de pago en historial ─────────────────────────────────────────────────
function PaymentRow({ p, onViewBoleta }) {
  const [expanded, setExpanded] = useState(false)
  const method = PAYMENT_METHODS.find(m => m.id === p.method)
  const hasItems = p.items && p.items.length > 0

  return (
    <div className={styles.paymentEntry}>
      <div className={styles.paymentItem} onClick={() => hasItems && setExpanded(v => !v)}>
        <span className={styles.payIcon}>{method?.icon || '💰'}</span>
        <div className={styles.payInfo}>
          <span className={styles.payClient}>{p.clientName}</span>
          <span className={styles.payMeta}>{p.time} · {method?.label} · {p.guests} pers.</span>
        </div>
        <span className={styles.payAmount}>S/ {p.amount.toFixed(2)}</span>
        <div className={styles.payActions}>
          <button className={styles.iconBtn} title="Ver boleta" onClick={e => { e.stopPropagation(); onViewBoleta(p) }}>
            <Receipt size={14} />
          </button>
          {hasItems && (
            <button className={styles.iconBtn} title="Ver pedido" onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>
      {expanded && hasItems && (
        <div className={styles.payItemList}>
          {p.items.map((item, i) => (
            <div key={i} className={styles.payItemRow}>
              <span className={styles.payItemName}>{item.qty}× {item.name}</span>
              <span className={styles.payItemPrice}>S/ {((item.price || 0) * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className={styles.payItemTotal}>
            <span>Total</span>
            <strong>S/ {p.amount.toFixed(2)}</strong>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CashPage() {
  const { user } = useAuth()
  const { payments, todayPayments, todayTotal, todayByMethod, shift, openShift, closeShift, addPayment } = useCash()
  const { updateReservation, completeReservation, getReservationsByDate } = useReservations()

  const [isPaymentOpen, setPaymentOpen] = useState(false)
  const [isShiftOpen,   setShiftOpen]   = useState(false)
  const [boletaPayment, setBoletaPayment] = useState(null)
  const [shiftModal,    setShiftModal]  = useState(false)
  const [form,          setForm]        = useState(EMPTY_PAYMENT)
  const [errors,        setErrors]      = useState({})
  const [initialCash,   setInitialCash] = useState('')
  const [closePreview,  setClosePreview] = useState(null)

  // Ítems del pedido en el formulario
  const [orderItems, setOrderItems] = useState([])
  const [activeCategory, setActiveCategory] = useState('Todas')
  const [menuQuery, setMenuQuery] = useState('')
  const [isMenuOpen, setMenuOpen] = useState(false)

  // Fecha seleccionada para filtrar reservas en Caja (default = hoy)
  const [filterDate, setFilterDate] = useState(TODAY_STR)

  // Reservas de la fecha seleccionada (sin pagar y con estado cobrable)
  const reservasDelDia = useMemo(
    () => getReservationsByDate(filterDate).filter(r => !r.isPaid && PAYABLE_STATUSES.includes(r.status)),
    [getReservationsByDate, filterDate]
  )

  const orderTotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(e => ({ ...e, [name]: '' }))
  }

  const addOrderItem = (menuItem) => {
    setOrderItems(prev => {
      const exists = prev.find(i => i.menuId === menuItem.id)
      if (exists) return prev.map(i => i.menuId === menuItem.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { menuId: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1 }]
    })
  }

  const removeOrderItem = (menuId) => {
    setOrderItems(prev => prev.filter(i => i.menuId !== menuId))
  }

  const updateQty = (menuId, delta) => {
    setOrderItems(prev => prev
      .map(i => i.menuId === menuId ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    )
  }

  const validate = () => {
    const e = {}
    if (!form.clientName.trim()) e.clientName = 'Nombre requerido'
    if (!form.method) e.method = 'Método de pago requerido'
    if (orderItems.length === 0 && orderTotal === 0) e.items = 'Agrega al menos un ítem al pedido'
    return e
  }

  const handleRegisterPayment = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const totalAmount = orderTotal > 0 ? orderTotal : 0

    const newPayment = addPayment({
      ...form,
      amount:     totalAmount,
      guests:     Number(form.guests) || 1,
      items:      orderItems,
      cashierId:  user.id,
      cashierName: user.name,
    })

    if (form.reservationId) {
      const res = reservasDelDia.find(r => r.id === form.reservationId)
      if (res && res.status === RESERVATION_STATUS.SEATED) {
        completeReservation(res.id)
        toast.success(`Mesa ${res.tableId} liberada automáticamente`)
      } else if (res) {
        updateReservation(res.id, { isPaid: true })
        toast.success(`Reserva marcada como pagada`)
      }
    }

    toast.success(`Boleta generada: S/ ${totalAmount.toFixed(2)}`)
    setBoletaPayment(newPayment)
    setForm(EMPTY_PAYMENT)
    setOrderItems([])
    setPaymentOpen(false)
  }

  const handleOpenShift = () => {
    openShift({ id: user.id, name: user.name }, Number(initialCash) || 0)
    toast.success('Turno de caja abierto')
    setShiftOpen(false)
    setInitialCash('')
  }

  const handleCloseShift = () => {
    const summary = closeShift()
    setClosePreview(summary)
    setShiftModal(true)
    toast.success('Turno cerrado correctamente')
  }

  const shiftDuration = shift
    ? Math.round((Date.now() - new Date(shift.openedAt).getTime()) / 60000)
    : 0

  // Agrupar menú por categoría
  const categories = [...new Set(MENU_ITEMS.map(m => m.category))]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Caja</h1>
          <p className={styles.subtitle}>Módulo de cobros, boletas y gestión de turno</p>
        </div>
        <div className={styles.headerActions}>
          {shift ? (
            <>
              <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setPaymentOpen(true)} id="btn-nuevo-cobro">
                Nuevo cobro
              </Button>
              <Button variant="danger" icon={<X size={16} />} onClick={handleCloseShift} id="btn-cerrar-turno">
                Cerrar turno
              </Button>
            </>
          ) : (
            <Button variant="primary" icon={<CreditCard size={16} />} onClick={() => setShiftOpen(true)} id="btn-abrir-turno">
              Abrir turno
            </Button>
          )}
        </div>
      </div>

      {/* Estado del turno */}
      {shift ? (
        <div className={styles.shiftBanner}>
          <div className={styles.shiftIndicator} />
          <div>
            <span className={styles.shiftLabel}>Turno activo</span>
            <span className={styles.shiftInfo}>
              Cajero: <strong>{shift.cashierName}</strong> · Abierto hace {shiftDuration} minutos
            </span>
          </div>
          <div className={styles.shiftCash}>
            <span>Apertura:</span>
            <strong>S/ {shift.initialCash?.toFixed(2) || '0.00'}</strong>
          </div>
        </div>
      ) : (
        <div className={styles.noShiftBanner}>
          <CreditCard size={20} /> No hay turno de caja activo. Abre un turno para empezar a cobrar.
        </div>
      )}

      {/* Stats del día */}
      <div className={styles.statsGrid}>
        <StatCard label="Total hoy"       value={`S/ ${todayTotal.toFixed(2)}`}  icon={<DollarSign size={22} />} color="success" />
        <StatCard label="Cobros"          value={todayPayments.length}            icon={<CreditCard size={22} />} color="info" />
        <StatCard label="Promedio"        value={`S/ ${todayPayments.length > 0 ? (todayTotal / todayPayments.length).toFixed(2) : '0.00'}`} icon={<CheckCircle size={22} />} color="primary" />
        <StatCard label="IGV (18%)"       value={`S/ ${(todayTotal * IGV_RATE / (1 + IGV_RATE)).toFixed(2)}`} icon={<Receipt size={22} />} color="warning" />
      </div>


      {/* Panel: Reservas pendientes de cobro — siempre visible */}
      <Card
        title="Reservas pendientes de cobro"
        subtitle="Selecciona una fecha para buscar reservas — abre un turno para cobrar"
      >
        <div className={styles.reservasFiltro}>
          <div className={styles.reservasFiltroRow}>
            <Calendar size={16} className={styles.reservasIcon} />
            <input
              type="date"
              className={styles.dateInput}
              value={filterDate}
              max={TODAY_STR}
              onChange={e => setFilterDate(e.target.value)}
              id="cash-filter-date"
            />
            {filterDate !== TODAY_STR && (
              <button
                className={styles.resetDateBtn}
                onClick={() => setFilterDate(TODAY_STR)}
                title="Volver a hoy"
              >
                Hoy
              </button>
            )}
          </div>

          {reservasDelDia.length === 0 ? (
            <div className={styles.reservasEmpty}>
              <AlertCircle size={20} />
              <span>No hay reservas pendientes de cobro para esta fecha</span>
            </div>
          ) : (
            <div className={styles.reservasList}>
              {reservasDelDia.map(r => (
                <div key={r.id} className={styles.reservaItem}>
                  <div className={styles.reservaInfo}>
                    <span className={styles.reservaClient}>{r.clientName}</span>
                    <span className={styles.reservaMeta}>
                      {r.date} &middot; {r.time} &middot; {r.guests} pers.
                      {r.tableId && <> &middot; Mesa <strong>{r.tableId}</strong></>}
                    </span>
                  </div>
                  <span className={`${styles.reservaStatus} ${styles[`status_${r.status}`]}`}>
                    {r.status === RESERVATION_STATUS.SEATED ? 'En mesa' : 'Pendiente'}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Receipt size={13} />}
                    onClick={() => {
                      if (!shift) {
                        toast.error('Abre un turno de caja antes de cobrar')
                        setShiftOpen(true)
                        return
                      }
                      setForm(f => ({
                        ...f,
                        reservationId: r.id,
                        clientName: r.clientName,
                        guests: r.guests,
                      }))
                      if (r.items && r.items.length > 0) setOrderItems(r.items)
                      setPaymentOpen(true)
                    }}
                    id={`btn-cobrar-${r.id}`}
                  >
                    Cobrar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>


      <div className={styles.grid2}>
        {/* Métodos de pago */}
        <Card title="Cobros por método" subtitle="Resumen del día">
          <div className={styles.methodList}>
            {PAYMENT_METHODS.map(m => {
              const amount = todayByMethod[m.id] || 0
              const pct    = todayTotal > 0 ? (amount / todayTotal) * 100 : 0
              return (
                <div key={m.id} className={styles.methodItem}>
                  <span className={styles.methodIcon}>{m.icon}</span>
                  <div className={styles.methodInfo}>
                    <div className={styles.methodHeader}>
                      <span className={styles.methodLabel}>{m.label}</span>
                      <span className={styles.methodAmount}>S/ {amount.toFixed(2)}</span>
                    </div>
                    <div className={styles.methodBar}>
                      <div className={styles.methodFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.methodPct}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Historial del día */}
        <Card title="Cobros del día" subtitle={`${todayPayments.length} transacciones · S/ ${todayTotal.toFixed(2)}`} noPadding>
          {todayPayments.length === 0 ? (
            <div className={styles.empty}>
              <CreditCard size={36} />
              <p>No hay cobros registrados hoy</p>
            </div>
          ) : (
            <div className={styles.paymentList}>
              {todayPayments.map(p => (
                <PaymentRow key={p.id} p={p} onViewBoleta={setBoletaPayment} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Modal: Nuevo cobro ──────────────────── */}
      <Modal isOpen={isPaymentOpen} onClose={() => { setPaymentOpen(false); setOrderItems([]) }}
        title="Registrar Cobro / Generar Boleta" size="lg">
        <form onSubmit={handleRegisterPayment} className={styles.form} noValidate>
          <div className={styles.row2}>
            <div>
              <div>
                <div style={{display:'flex', gap:'8px', alignItems:'center', marginBottom:'6px'}}>
                  <label style={{fontSize:'12px', fontWeight:600, color:'var(--color-text-secondary)'}}>Fecha de reserva</label>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={filterDate}
                    max={TODAY_STR}
                    onChange={e => {
                      setFilterDate(e.target.value)
                      setForm(f => ({ ...f, reservationId: '', clientName: '', guests: '' }))
                      setOrderItems([])
                    }}
                    style={{flex:1}}
                    id="pay-filter-date"
                  />
                </div>
                <Select label="Vincular a Reserva (Opcional)" name="reservationId" id="pay-res" value={form.reservationId} onChange={(e) => {
                  const val = e.target.value
                  handleChange(e)
                  if (val) {
                    const res = reservasDelDia.find(r => r.id === val)
                    if (res) {
                      setForm(f => ({...f, clientName: res.clientName, guests: res.guests, reservationId: val}))
                      if (res.items && res.items.length > 0) setOrderItems(res.items)
                    }
                  } else {
                    setForm(f => ({...f, clientName: '', guests: '', reservationId: ''}))
                    setOrderItems([])
                  }
                }}>
                  <option value="">-- Cobro general sin reserva --</option>
                  {reservasDelDia.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.clientName} ({r.status === RESERVATION_STATUS.SEATED ? `Mesa ${r.tableId}` : 'Pendiente'}) &mdash; {r.time}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Input label="Nombre del cliente" name="clientName" id="pay-client"
              placeholder="Nombre del cliente" value={form.clientName}
              onChange={handleChange} error={errors.clientName} required />
          </div>

          <div className={styles.row2}>
            <Input label="N° personas" name="guests" id="pay-guests" type="number"
              min={1} max={20} placeholder="2"
              value={form.guests} onChange={handleChange} />
            <Select label="Método de pago" name="method" id="pay-method"
              value={form.method} onChange={handleChange} error={errors.method} required>
              {PAYMENT_METHODS.map(m => (
                <option key={m.id} value={m.id}>{m.icon} {m.label}</option>
              ))}
            </Select>
          </div>

          {/* Resumen del pedido + botón para abrir selector de platos */}
          <div className={styles.menuSection}>
            {errors.items && <p className={styles.errorText}>{errors.items}</p>}

            {/* Vista compacta del pedido actual */}
            {orderItems.length > 0 && (
              <div className={styles.orderSummaryCompact}>
                {orderItems.map(item => (
                  <div key={item.menuId} className={styles.orderRowCompact}>
                    <span className={styles.orderNameCompact}>{item.qty}× {item.name}</span>
                    <div className={styles.orderQtyCtrlCompact}>
                      <button type="button" onClick={() => updateQty(item.menuId, -1)}>−</button>
                      <span>{item.qty}</span>
                      <button type="button" onClick={() => updateQty(item.menuId, +1)}>+</button>
                    </div>
                    <span className={styles.orderPriceCompact}>S/ {(item.price * item.qty).toFixed(2)}</span>
                    <button type="button" className={styles.removeBtn} onClick={() => removeOrderItem(item.menuId)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <div className={styles.orderTotalCompact}>
                  <span>IGV (18%)</span>
                  <span>S/ {(orderTotal - orderTotal / (1 + IGV_RATE)).toFixed(2)}</span>
                </div>
                <div className={`${styles.orderTotalCompact} ${styles.grandTotalCompact}`}>
                  <strong>TOTAL</strong>
                  <strong>S/ {orderTotal.toFixed(2)}</strong>
                </div>
              </div>
            )}

            {/* Botón que abre el overlay fullscreen */}
            <button
              type="button"
              className={styles.openMenuBtn}
              onClick={() => setMenuOpen(true)}
              id="btn-abrir-menu"
            >
              <Plus size={16} strokeWidth={3} />
              {orderItems.length === 0 ? 'Agregar platos del menú' : `Editar pedido · ${orderItems.length} ítem${orderItems.length !== 1 ? 's' : ''}`}
            </button>
          </div>

          <div className={styles.notesBox}>
            <div className={styles.notesBoxHeader}>
              <MessageSquare size={14} />
              <span>Observaciones del cobro</span>
            </div>
            <Textarea name="notes" id="pay-notes"
              placeholder="Ej: cliente prefiere mesa interior, alérgico a mariscos, celebración especial..."
              value={form.notes} onChange={handleChange} />
          </div>

          <div className={styles.formActions}>
            <Button type="button" variant="ghost" onClick={() => { setPaymentOpen(false); setOrderItems([]) }}>Cancelar</Button>
            <Button type="submit" variant="primary" icon={<Receipt size={15} />}
              disabled={orderItems.length === 0}>
              Generar boleta · S/ {orderTotal.toFixed(2)}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Overlay fullscreen: Selector de platos (igual al de la anfitriona) ── */}
      {isMenuOpen && createPortal(
        <div className={styles.menuOverlay}>
          <div className={styles.menuOverlayModal}>

            {/* Header */}
            <div className={styles.menuOverlayHeader}>
              <div className={styles.menuOverlayTitle}>
                <h3>Seleccionar Platos</h3>
                {form.clientName && <span className={styles.menuOverlayBadge}>{form.clientName}</span>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMenuOpen(false)}>✕ Cerrar</Button>
            </div>

            {/* Body: split grid */}
            <div className={styles.menuOverlayBody}>

              {/* Izquierda: Catálogo */}
              <div className={styles.menuOverlayLeft}>
                <div className={styles.menuOverlayControls}>
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

                <div className={styles.menuOverlayCats}>
                  {categories.filter(c => activeCategory === 'Todas' || activeCategory === c).map(cat => {
                    const itemsOfCat = MENU_ITEMS.filter(m =>
                      m.category === cat && (!menuQuery || m.name.toLowerCase().includes(menuQuery.toLowerCase()))
                    )
                    if (itemsOfCat.length === 0) return null
                    return (
                      <div key={cat} className={styles.menuOverlayCat}>
                        <h4 className={styles.menuOverlayCatTitle}>{cat}</h4>
                        <div className={styles.menuOverlayCatGrid}>
                          {itemsOfCat.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              className={styles.menuOverlayCard}
                              onClick={() => addOrderItem(item)}
                            >
                              <div className={styles.menuOverlayCardImg}>
                                <Utensils size={32} opacity={0.5} />
                              </div>
                              <div className={styles.menuOverlayCardName}>{item.name}</div>
                              <div className={styles.menuOverlayCardBottom}>
                                <span className={styles.menuOverlayCardPrice}>S/ {item.price.toFixed(2)}</span>
                                <div className={styles.menuOverlayCardAdd}>
                                  <Plus size={16} strokeWidth={3} />
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

              {/* Derecha: Resumen de orden */}
              <div className={styles.menuOverlayRight}>
                <div className={styles.menuOverlayOrderHeader}>
                  <h3 className={styles.menuOverlayOrderTitle}>Resumen de Pedido</h3>
                  <div className={styles.menuOverlayOrderSub}>
                    {orderItems.length} {orderItems.length === 1 ? 'ítem' : 'ítems'} en la orden
                  </div>
                </div>

                <div className={styles.menuOverlayOrderBody}>
                  {orderItems.length === 0 ? (
                    <div className={styles.menuOverlayOrderEmpty}>
                      <Utensils size={48} />
                      <p>Añade platos del menú para armar la comanda.</p>
                    </div>
                  ) : (
                    <div className={styles.menuOverlayOrderList}>
                      {orderItems.map(item => (
                        <div key={item.menuId} className={styles.menuOverlayOrderRow}>
                          <div className={styles.menuOverlayOrderRowTop}>
                            <span className={styles.menuOverlayOrderName}>{item.name}</span>
                            <button
                              type="button"
                              className={styles.menuOverlayRemoveBtn}
                              onClick={() => removeOrderItem(item.menuId)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className={styles.menuOverlayOrderRowBottom}>
                            <span className={styles.menuOverlayOrderPrice}>S/ {(item.price * item.qty).toFixed(2)}</span>
                            <div className={styles.menuOverlayQtyCtrl}>
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

                <div className={styles.menuOverlayOrderFooter}>
                  <div className={styles.menuOverlayTotalRow}>
                    <span className={styles.menuOverlayTotalLabel}>Total a Pagar</span>
                    <span className={styles.menuOverlayTotalValue}>S/ {orderTotal.toFixed(2)}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.menuOverlayConfirmBtn}
                    onClick={() => setMenuOpen(false)}
                    disabled={orderItems.length === 0}
                    id="btn-confirmar-comanda-caja"
                  >
                    Confirmar pedido · S/ {orderTotal.toFixed(2)}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ── Modal: Boleta ───────────────────────── */}
      <Modal isOpen={!!boletaPayment} onClose={() => setBoletaPayment(null)} title="Boleta de Venta" size="sm">
        <Boleta payment={boletaPayment} onClose={() => setBoletaPayment(null)} />
      </Modal>

      {/* ── Modal: Abrir turno ──────────────────── */}
      <Modal isOpen={isShiftOpen} onClose={() => setShiftOpen(false)} title="Abrir Turno de Caja" size="sm">
        <div className={styles.shiftForm}>
          <p className={styles.shiftDesc}>Ingresa el monto de apertura en efectivo para iniciar el turno.</p>
          <Input label="Efectivo de apertura (S/)" id="shift-cash" type="number"
            min={0} step={10} placeholder="0.00"
            value={initialCash} onChange={e => setInitialCash(e.target.value)} />
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setShiftOpen(false)}>Cancelar</Button>
            <Button variant="success" onClick={handleOpenShift} icon={<Clock size={15} />}>
              Abrir turno
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Resumen de cierre ─────────────── */}
      <Modal isOpen={shiftModal} onClose={() => setShiftModal(false)} title="Turno Cerrado — Resumen" size="md">
        {closePreview && (
          <div className={styles.shiftSummary}>
            <div className={styles.summaryTotal}>
              <span>Total cobrado</span>
              <strong>S/ {closePreview.totalAmount?.toFixed(2) || '0.00'}</strong>
            </div>
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}><span>Transacciones</span><strong>{closePreview.totalTx}</strong></div>
              <div className={styles.summaryRow}><span>Cajero</span><strong>{closePreview.cashierName}</strong></div>
              <div className={styles.summaryRow}><span>Efectivo apertura</span><strong>S/ {closePreview.initialCash?.toFixed(2) || '0.00'}</strong></div>
            </div>
            {PAYMENT_METHODS.map(m => (
              <div key={m.id} className={styles.summaryRow}>
                <span>{m.icon} {m.label}</span>
                <strong>S/ {(closePreview.byMethod?.[m.id] || 0).toFixed(2)}</strong>
              </div>
            ))}
            <Button fullWidth variant="ghost" icon={<Printer size={15} />} onClick={() => window.print()}>
              Imprimir resumen
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
