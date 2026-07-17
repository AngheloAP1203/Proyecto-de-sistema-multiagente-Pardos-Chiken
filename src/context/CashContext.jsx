/**
 * src/context/CashContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de Caja — módulo del Cajero.
 * Los pagos se persisten en Supabase (tabla `payments`). El detalle de líneas de
 * la boleta y los datos de display (cliente, personas, cajero) se guardan en la
 * columna `items` (jsonb), porque la tabla no tiene esas columnas.
 *
 * El "turno de caja" (shift) es un concepto de sesión del cajero y NO tiene tabla
 * en el esquema, así que se mantiene en localStorage.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { PAYMENT_METHODS } from '../domain/cash/paymentMethods'
import { summarizeShift, calculateTotalByMethod } from '../domain/cash/cashCalculations'
import { supabase } from '../domain/supabase'
import { auditLogger } from '../agents/core/auditLogger'
import { eventBus, EVENT_TYPES } from '../agents/core/EventBus'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

export { PAYMENT_METHODS }

const CashContext = createContext(null)

/** Mapea una fila de `payments` (Supabase) al shape que consume la UI/boleta. */
function mapPayment(p) {
  const meta = p.items || {}
  return {
    id:            p.id,
    reservationId: p.reservation_id,
    amount:        Number(p.amount) || 0,
    method:        p.method,
    status:        p.status,
    date:          p.date,
    time:          p.time,
    items:         Array.isArray(meta.lineas) ? meta.lineas : [],
    clientName:    meta.clientName || p.reservations?.clients?.name || 'Cliente',
    guests:        meta.guests ?? p.reservations?.guests ?? 1,
    notes:         meta.notes || '',
    cashierName:   meta.cashierName || '',
  }
}

export function CashProvider({ children }) {
  const [payments,   setPayments]   = useState([])
  const [shift,      setShift]      = useState(null)
  const [isLoading,  setLoading]    = useState(true)
  const { user } = useAuth()
  const actorName = user ? `${user.name} (${user.role})` : 'Sistema'

  // ── Pagos desde Supabase ──
  const loadPayments = async () => {
    try {
      const { data, error } = await supabase.from('payments')
        .select('*, reservations(guests, clients(name))')
        .order('date', { ascending: false })
        .order('time', { ascending: false })
      if (!error && data) setPayments(data.map(mapPayment))
    } catch (err) {
      console.error('Error cargando pagos:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadShift = async () => {
    try {
      const { data, error } = await supabase.from('cash_shifts')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!error && data) {
        setShift({
          id: data.id,
          cashierName: data.opened_by,
          openedAt: data.opened_at,
          closedAt: data.closed_at,
          initialCash: Number(data.start_balance),
          status: data.status
        })
      } else {
        setShift(null)
      }
    } catch (err) {
      console.error('Error cargando turno:', err)
    }
  }

  useEffect(() => {
    loadPayments()
    loadShift()
  }, [])

  // Poll para reflejar cobros y turnos hechos en otras sesiones.
  useEffect(() => {
    const interval = setInterval(() => {
      loadPayments()
      loadShift()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const openShift = useCallback(async (cashier, initialCash = 0) => {
    const record = {
      opened_by: cashier.name,
      start_balance: initialCash,
      status: 'open'
    }
    const { data: newDbShift, error } = await supabase.from('cash_shifts').insert(record).select().single()
    
    if (error || !newDbShift) {
      toast.error('Error al abrir turno')
      return null
    }

    const newShift = {
      id: newDbShift.id,
      cashierName: newDbShift.opened_by,
      openedAt: newDbShift.opened_at,
      closedAt: newDbShift.closed_at,
      initialCash: Number(newDbShift.start_balance),
      status: newDbShift.status,
    }
    
    setShift(newShift)
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'cash.open_shift', nivel: 'info', detalle: { initialCash } })
    toast.success('Turno de caja abierto')
    return newShift
  }, [actorName])

  const closeShift = useCallback(async () => {
    if (!shift) return null
    const summary = summarizeShift(shift, payments)
    
    const { error } = await supabase.from('cash_shifts')
      .update({
        closed_at: new Date().toISOString(),
        end_balance: summary.expectedTotal,
        status: 'closed'
      })
      .eq('id', shift.id)

    if (error) {
      toast.error('Error cerrando turno en base de datos')
      return null
    }

    setShift(null)
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'cash.close_shift', nivel: 'info', detalle: { summary } })
    toast.success('Turno cerrado correctamente')
    return summary
  }, [shift, payments, actorName])

  /**
   * addPayment — Registra un cobro en Supabase.
   * @param {Object} data { reservationId?, clientName, method, guests, notes,
   *                        items:[{menuId,name,price,qty}], amount, cashierName }
   * @returns {Promise<Object|null>} el pago mapeado para la boleta, o null si falla.
   */
  const addPayment = useCallback(async (data) => {
    const record = {
      reservation_id: data.reservationId || null,
      amount:  Number(data.amount) || 0,
      method:  data.method,
      status:  'paid',
      date:    format(new Date(), 'yyyy-MM-dd'),
      time:    format(new Date(), 'HH:mm'),
      // Snapshot para la boleta (la tabla no tiene columnas de líneas/cliente).
      items: {
        lineas:      data.items || [],
        clientName:  data.clientName || '',
        guests:      Number(data.guests) || 1,
        notes:       data.notes || '',
        cashierName: data.cashierName || '',
      },
    }

    const { data: inserted, error } = await supabase.from('payments')
      .insert(record)
      .select('*, reservations(guests, clients(name))')
      .single()

    if (error || !inserted) {
      console.error('Error registrando pago:', error)
      toast.error('Error al registrar el pago')
      return null
    }

    const mapped = mapPayment(inserted)
    setPayments(prev => [mapped, ...prev])
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'cash.add_payment', nivel: 'info', detalle: { id: mapped.id, amount: mapped.amount, method: mapped.method } })

    // AUTOMATIZACIÓN: el cobro dispara la revisión de stock del almacén.
    // El InventoryAgent escucha este evento, recalcula el stock y, si algo cayó
    // bajo el mínimo, publica una alerta — sin que nadie lo pida. Nunca rompe el cobro.
    try {
      eventBus.publish(EVENT_TYPES.CASH_PAYMENT_REGISTERED, {
        paymentId: mapped.id, amount: mapped.amount, method: mapped.method, clientName: mapped.clientName,
      }, 'CashContext')
    } catch (e) {
      console.warn('[CashContext] No se pudo publicar el evento de cobro', e)
    }

    toast.success('Pago registrado correctamente')
    return mapped
  }, [actorName])

  // Pagos de hoy
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayPayments = payments.filter(p => p.date === todayStr)
  const todayTotal    = todayPayments.reduce((s, p) => s + p.amount, 0)
  const todayByMethod = calculateTotalByMethod(todayPayments)

  const value = {
    payments,
    todayPayments,
    todayTotal,
    todayByMethod,
    shift,
    isLoading,
    openShift,
    closeShift,
    addPayment,
  }

  return <CashContext.Provider value={value}>{children}</CashContext.Provider>
}

export function useCash() {
  const ctx = useContext(CashContext)
  if (!ctx) throw new Error('useCash debe usarse dentro de <CashProvider>')
  return ctx
}
