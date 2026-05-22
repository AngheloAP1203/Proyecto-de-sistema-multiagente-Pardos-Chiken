/**
 * src/context/CashContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de Caja — módulo exclusivo del Cajero.
 * Gestiona:
 *   - Cobros de reservas (genera tickets de venta)
 *   - Estado del turno de caja (apertura / cierre)
 *   - Resumen del turno: total cobrado, n° transacciones
 *   - Historial de pagos por turno y por fecha
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { SAMPLE_PAYMENTS } from '../data/seeds/paymentsSeed'
import { PAYMENT_METHODS } from '../domain/cash/paymentMethods'
import { summarizeShift, calculateTotalByMethod } from '../domain/cash/cashCalculations'
import { readJSON, writeJSON, remove } from '../data/storage/localStorage'
import toast from 'react-hot-toast'

export { PAYMENT_METHODS }

const CashContext = createContext(null)

export function CashProvider({ children }) {
  const [payments,   setPayments]   = useState([])
  const [shift,      setShift]      = useState(null)
  const [isLoading,  setLoading]    = useState(true)

  // Cargar desde localStorage
  useEffect(() => {
    const savedPay = readJSON('pardos_payments', null)
    const savedShift = readJSON('pardos_shift', null)
    
    setPayments(savedPay || SAMPLE_PAYMENTS)
    setShift(savedShift || null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isLoading) writeJSON('pardos_payments', payments)
  }, [payments, isLoading])

  useEffect(() => {
    if (!isLoading) {
      if (shift) writeJSON('pardos_shift', shift)
      else remove('pardos_shift')
    }
  }, [shift, isLoading])

  const generateId = () => `P${Date.now().toString().slice(-6)}`

  const openShift = useCallback((cashier, initialCash = 0) => {
    const newShift = {
      id: `T${Date.now().toString().slice(-6)}`,
      cashierId:   cashier.id,
      cashierName: cashier.name,
      openedAt:    new Date().toISOString(),
      closedAt:    null,
      initialCash,
      status:      'open',
    }
    setShift(newShift)
    toast.success('Turno de caja abierto')
    return newShift
  }, [])

  const closeShift = useCallback(() => {
    if (!shift) return null
    const summary = summarizeShift(shift, payments)
    setShift(null)
    toast.success('Turno cerrado correctamente')
    return summary
  }, [shift, payments])

  const addPayment = useCallback((data) => {
    const newPayment = {
      ...data,
      id:     generateId(),
      date:   format(new Date(), 'yyyy-MM-dd'),
      time:   format(new Date(), 'HH:mm'),
      status: 'paid',
    }
    setPayments(prev => [newPayment, ...prev])
    toast.success('Pago registrado correctamente')
    return newPayment
  }, [])

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
