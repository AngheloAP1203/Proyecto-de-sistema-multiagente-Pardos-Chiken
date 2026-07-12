/**
 * src/context/ReservationContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de reservas.
 * Centraliza el estado de todas las reservas (actuales e históricas),
 * las mesas disponibles y los clientes registrados.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS } from '../domain/reservations/reservationStatus'
import { generateReservationId, isHistorical, isToday } from '../domain/reservations/reservationRules'
import { SAMPLE_RESERVATIONS, INITIAL_TABLES } from '../data/seeds/reservationsSeed'
import { fetchRequested, patchReservation } from '../data/api/reservationsApi'
import { readJSON, writeJSON } from '../data/storage/localStorage'
import { auditLogger } from '../agents/core/auditLogger'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

export { RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS }

const ReservationContext = createContext(null)

export function ReservationProvider({ children }) {
  const [reservations, setReservations] = useState([])
  const [tables, setTables] = useState(INITIAL_TABLES)
  const [isLoading, setIsLoading] = useState(true)
  const seenApiIds = useRef(new Set())
  const { user } = useAuth()
  const actorName = user ? `${user.name} (${user.role})` : 'Sistema'

  // Cargar datos desde localStorage al montar.
  // Igual que en CashContext: si lo guardado no tiene ninguna reserva de hoy
  // (visita de un día anterior), se refrescan los seeds para que la demo
  // nunca muestre un día vacío.
  useEffect(() => {
    const saved = readJSON('pardos_reservations', null)
    const hoy = new Date().toISOString().split('T')[0]
    const tieneDatosDeHoy = Array.isArray(saved) && saved.some(r => r.date === hoy)
    setReservations(tieneDatosDeHoy ? saved : SAMPLE_RESERVATIONS)
    setIsLoading(false)
  }, [])

  // Persistir reservas en localStorage cada vez que cambian
  useEffect(() => {
    if (!isLoading) {
      writeJSON('pardos_reservations', reservations)
    }
  }, [reservations, isLoading])

  useEffect(() => {
    const pollApi = async () => {
      try {
        const apiRequested = await fetchRequested()
        if (apiRequested.length === 0) return

        setReservations(prev => {
          const existingIds = new Set(prev.map(r => r.id))
          const newOnes = apiRequested.filter(r => {
            if (existingIds.has(r.id)) return false
            if (seenApiIds.current.has(r.id)) return false
            return true
          })
          if (newOnes.length === 0) return prev
          newOnes.forEach(r => seenApiIds.current.add(r.id))
          return [...newOnes, ...prev]
        })
      } catch {
        // Silent block
      }
    }

    pollApi()
    const interval = setInterval(pollApi, 5000)
    return () => clearInterval(interval)
  }, [])

  const addReservation = useCallback((data) => {
    const newReservation = {
      ...data,
      id: generateReservationId(),
      status: RESERVATION_STATUS.PENDING,
      createdAt: new Date().toISOString(),
    }
    setReservations(prev => [newReservation, ...prev])
    
    auditLogger.record({
      actor: actorName,
      tipoActor: 'usuario',
      accion: 'reservation.create',
      nivel: 'info',
      detalle: { id: newReservation.id, client: data.clientName }
    })

    toast.success('Reserva creada exitosamente')
    return newReservation
  }, [actorName])

  const updateReservation = useCallback((id, updates) => {
    setReservations(prev =>
      prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)
    )
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.update', nivel: 'info', detalle: { id, updates } })
    toast.success('Reserva actualizada')
  }, [actorName])

  const cancelReservation = useCallback((id, reason = '') => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.CANCELLED, cancelReason: reason, updatedAt: new Date().toISOString() }
          : r
      )
    )
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.cancel', nivel: 'warn', detalle: { id, reason } })
    toast.success('Reserva cancelada')
  }, [actorName])

  const completeReservation = useCallback((id) => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.COMPLETED, updatedAt: new Date().toISOString() }
          : r
      )
    )
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.complete', nivel: 'info', detalle: { id } })
    toast.success('Reserva completada')
  }, [actorName])

  const seatReservation = useCallback((id) => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.SEATED, seatedAt: new Date().toISOString() }
          : r
      )
    )
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.seat', nivel: 'info', detalle: { id } })
    toast.success('Cliente en mesa')
  }, [actorName])

  const requestReservation = useCallback((data) => {
    const newReservation = {
      ...data,
      id:        generateReservationId(),
      status:    RESERVATION_STATUS.REQUESTED,
      createdAt: new Date().toISOString(),
      source:    'public',
    }
    setReservations(prev => [newReservation, ...prev])
    
    auditLogger.record({
      actor: `${data.clientName} (Web)`,
      tipoActor: 'cliente',
      accion: 'reservation.request',
      nivel: 'info',
      detalle: { id: newReservation.id, pax: data.pax }
    })

    toast.success('Solicitud enviada')
    return newReservation
  }, [])

  const approveReservation = useCallback((id, tableId, approvedBy) => {
    const approvedAt = new Date().toISOString()
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.PENDING, tableId, approvedBy, approvedAt }
          : r
      )
    )
    patchReservation(id, { status: 'pending', tableId, approvedBy, approvedAt })
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.approve', nivel: 'info', detalle: { id, tableId } })
    toast.success('Solicitud aprobada')
  }, [actorName])

  const rejectReservation = useCallback((id, reason = '') => {
    const updatedAt = new Date().toISOString()
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.REJECTED, rejectReason: reason, updatedAt }
          : r
      )
    )
    patchReservation(id, { status: 'rejected', rejectReason: reason, updatedAt })
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.reject', nivel: 'warn', detalle: { id, reason } })
    toast.success('Solicitud rechazada')
  }, [actorName])

  const deleteReservationFromDB = useCallback((id) => {
    setReservations(prev => prev.filter(r => r.id !== id))
    // En API se usaría un DELETE /api/reservations/:id
    toast.success('Reserva eliminada')
  }, [])

  const todayReservations = reservations.filter(isToday)
  const pendingRequests = reservations.filter(r => r.status === RESERVATION_STATUS.REQUESTED)
  const historicalReservations = reservations.filter(isHistorical)

  // Devuelve reservas de una fecha específica (para Caja, que puede cobrar cualquier día)
  const getReservationsByDate = useCallback((dateStr) => {
    return reservations.filter(r =>
      r.date === dateStr &&
      r.status !== RESERVATION_STATUS.CANCELLED &&
      r.status !== RESERVATION_STATUS.REJECTED &&
      r.status !== RESERVATION_STATUS.COMPLETED
    )
  }, [reservations])

  const value = {
    reservations,
    todayReservations,
    historicalReservations,
    pendingRequests,
    tables,
    isLoading,
    addReservation,
    updateReservation,
    cancelReservation,
    completeReservation,
    seatReservation,
    requestReservation,
    approveReservation,
    rejectReservation,
    deleteReservationFromDB,
    getReservationsByDate,
  }

  return <ReservationContext.Provider value={value}>{children}</ReservationContext.Provider>
}

export function useReservations() {
  const ctx = useContext(ReservationContext)
  if (!ctx) throw new Error('useReservations debe usarse dentro de <ReservationProvider>')
  return ctx
}
