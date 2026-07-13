/**
 * src/context/ReservationContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de reservas.
 * Centraliza el estado de todas las reservas consultando directamente a Supabase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS } from '../domain/reservations/reservationStatus'
import { isHistorical, isToday } from '../domain/reservations/reservationRules'
import { INITIAL_TABLES } from '../data/seeds/reservationsSeed'
import { supabase } from '../domain/supabase'
import { auditLogger } from '../agents/core/auditLogger'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

export { RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS }

const ReservationContext = createContext(null)

export function ReservationProvider({ children }) {
  const [reservations, setReservations] = useState([])
  const [tables, setTables] = useState(INITIAL_TABLES)
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const actorName = user ? `${user.name} (${user.role})` : 'Sistema'

  const loadReservations = async () => {
    const { data, error } = await supabase.from('reservations').select('*').order('date', { ascending: false }).order('time', { ascending: false })
    if (!error && data) {
      const mapped = data.map(r => ({
        id: r.id,
        clientName: r.client_name,
        clientDni: r.client_dni,
        tableId: r.table_id,
        date: r.date,
        time: r.time,
        pax: r.guests,
        status: r.status,
        createdAt: r.created_at
      }))
      setReservations(mapped)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadReservations()
  }, [])

  // Poll de Supabase cada 10s para nuevas reservas web
  useEffect(() => {
    const interval = setInterval(loadReservations, 10000)
    return () => clearInterval(interval)
  }, [])

  const addReservation = useCallback(async (data) => {
    const newReservation = {
      client_name: data.clientName,
      client_dni: data.clientDni || '00000000',
      date: data.date,
      time: data.time,
      table_id: data.tableId || 'T01',
      guests: data.guests || 2,
      status: RESERVATION_STATUS.PENDING
    }
    
    const { data: inserted, error } = await supabase.from('reservations').insert(newReservation).select().single()
    
    if (error) {
      console.error('Insert error:', error)
      toast.error('Error al crear reserva (quizá falta seleccionar mesa)')
      return null
    }

    const mapped = {
      id: inserted.id,
      clientName: inserted.client_name,
      clientDni: inserted.client_dni,
      tableId: inserted.table_id,
      date: inserted.date,
      time: inserted.time,
      pax: inserted.guests,
      status: inserted.status,
      notes: inserted.notes,
      occasion: inserted.occasion,
      items: inserted.items,
      createdAt: inserted.created_at
    }

    setReservations(prev => [mapped, ...prev])
    
    auditLogger.record({
      actor: actorName,
      tipoActor: 'usuario',
      accion: 'reservation.create',
      nivel: 'info',
      detalle: { id: mapped.id, client: data.clientName }
    })

    toast.success('Reserva creada exitosamente')
    return mapped
  }, [actorName])

  const updateReservation = useCallback(async (id, updates) => {
    const dbUpdates = {}
    if (updates.clientName) dbUpdates.client_name = updates.clientName
    if (updates.clientDni) dbUpdates.client_dni = updates.clientDni
    if (updates.tableId) dbUpdates.table_id = updates.tableId
    if (updates.date) dbUpdates.date = updates.date
    if (updates.time) dbUpdates.time = updates.time
    if (updates.pax) dbUpdates.guests = updates.pax
    if (updates.status) dbUpdates.status = updates.status

    const { error } = await supabase.from('reservations').update(dbUpdates).eq('id', id)
    
    if (!error) {
      setReservations(prev =>
        prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)
      )
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.update', nivel: 'info', detalle: { id, updates } })
      toast.success('Reserva actualizada')
    } else {
      toast.error('Error actualizando reserva')
    }
  }, [actorName])

  const cancelReservation = useCallback(async (id, reason = '') => {
    const { error } = await supabase.from('reservations').update({ status: RESERVATION_STATUS.CANCELLED }).eq('id', id)
    if (!error) {
      setReservations(prev =>
        prev.map(r =>
          r.id === id
            ? { ...r, status: RESERVATION_STATUS.CANCELLED, cancelReason: reason, updatedAt: new Date().toISOString() }
            : r
        )
      )
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.cancel', nivel: 'warn', detalle: { id, reason } })
      toast.success('Reserva cancelada')
    }
  }, [actorName])

  const completeReservation = useCallback(async (id) => {
    const { error } = await supabase.from('reservations').update({ status: RESERVATION_STATUS.COMPLETED }).eq('id', id)
    if (!error) {
      setReservations(prev =>
        prev.map(r =>
          r.id === id
            ? { ...r, status: RESERVATION_STATUS.COMPLETED, updatedAt: new Date().toISOString() }
            : r
        )
      )
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.complete', nivel: 'info', detalle: { id } })
      toast.success('Reserva completada')
    }
  }, [actorName])

  const seatReservation = useCallback(async (id) => {
    const { error } = await supabase.from('reservations').update({ status: RESERVATION_STATUS.SEATED }).eq('id', id)
    if (!error) {
      setReservations(prev =>
        prev.map(r =>
          r.id === id
            ? { ...r, status: RESERVATION_STATUS.SEATED, seatedAt: new Date().toISOString() }
            : r
        )
      )
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.seat', nivel: 'info', detalle: { id } })
      toast.success('Cliente en mesa')
    }
  }, [actorName])

  const requestReservation = useCallback(async (data) => {
    const newReservation = {
      client_name: data.clientName,
      client_dni: data.clientDni || '00000000',
      date: data.date,
      time: data.time,
      table_id: data.tableId || 'T00',
      guests: data.guests || 2,
      status: RESERVATION_STATUS.REQUESTED
    }
    
    const { data: inserted, error } = await supabase.from('reservations').insert(newReservation).select().single()
    if (!error && inserted) {
      const mapped = {
        id: inserted.id,
        clientName: inserted.client_name,
        clientDni: inserted.client_dni,
        tableId: inserted.table_id,
        date: inserted.date,
        time: inserted.time,
        pax: inserted.guests,
        status: inserted.status,
        createdAt: inserted.created_at
      }
      setReservations(prev => [mapped, ...prev])
      
      auditLogger.record({
        actor: `${data.clientName} (Web)`,
        tipoActor: 'cliente',
        accion: 'reservation.request',
        nivel: 'info',
        detalle: { id: mapped.id, pax: data.pax }
      })

      toast.success('Solicitud enviada')
      return mapped
    } else {
      toast.error('Error enviando solicitud')
      return null
    }
  }, [])

  const approveReservation = useCallback(async (id, tableId, approvedBy) => {
    const { error } = await supabase.from('reservations').update({ status: RESERVATION_STATUS.PENDING, table_id: tableId }).eq('id', id)
    if (!error) {
      setReservations(prev =>
        prev.map(r =>
          r.id === id
            ? { ...r, status: RESERVATION_STATUS.PENDING, tableId, approvedBy, approvedAt: new Date().toISOString() }
            : r
        )
      )
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.approve', nivel: 'info', detalle: { id, tableId } })
      toast.success('Solicitud aprobada')
    }
  }, [actorName])

  const rejectReservation = useCallback(async (id, reason = '') => {
    const { error } = await supabase.from('reservations').update({ status: RESERVATION_STATUS.CANCELLED }).eq('id', id)
    if (!error) {
      setReservations(prev =>
        prev.map(r =>
          r.id === id
            ? { ...r, status: RESERVATION_STATUS.CANCELLED, rejectReason: reason, updatedAt: new Date().toISOString() }
            : r
        )
      )
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.reject', nivel: 'warn', detalle: { id, reason } })
      toast.success('Solicitud rechazada')
    }
  }, [actorName])

  const deleteReservationFromDB = useCallback(async (id) => {
    const { error } = await supabase.from('reservations').delete().eq('id', id)
    if (!error) {
      setReservations(prev => prev.filter(r => r.id !== id))
      toast.success('Reserva eliminada')
    } else {
      toast.error('Error eliminando reserva')
    }
  }, [])

  const todayReservations = reservations.filter(isToday)
  const pendingRequests = reservations.filter(r => r.status === RESERVATION_STATUS.REQUESTED)
  const historicalReservations = reservations.filter(isHistorical)

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
