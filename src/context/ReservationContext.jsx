/**
 * src/context/ReservationContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de reservas.
 * Centraliza el estado de todas las reservas consultando directamente a Supabase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS } from '../domain/reservations/reservationStatus'
import { isHistorical, isToday } from '../domain/reservations/reservationRules'
import { supabase } from '../domain/supabase'
import { auditLogger } from '../agents/core/auditLogger'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

export { RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS }

const ReservationContext = createContext(null)

export function ReservationProvider({ children }) {
  const [reservations, setReservations] = useState([])
  const [tables, setTables] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const actorName = user ? `${user.name} (${user.role})` : 'Sistema'

  const loadData = async () => {
    try {
      // 1. Cargar Mesas
      const { data: tablesData, error: tablesError } = await supabase.from('tables').select('*').order('id')
      if (tablesData && !tablesError) setTables(tablesData)

      // 2. Cargar Reservas con JOIN a clientes
      const { data, error } = await supabase.from('reservations')
        .select('*, clients(*)')
        .order('date', { ascending: false })
        .order('time', { ascending: false })

      if (!error && data) {
        const mapped = data.map(r => ({
          id: r.id,
          client_id: r.client_id,
          clientName: r.clients?.name || 'Desconocido',
          clientDni: r.clients?.dni || '00000000',
          tableId: r.table_id,
          date: r.date,
          time: r.time,
          pax: r.guests,
          status: r.status,
          notes: r.notes,
          createdAt: r.created_at
        }))
        setReservations(mapped)
      }
    } catch (err) {
      console.error('Error loading reservations:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Poll de Supabase cada 10s para nuevas reservas web
  useEffect(() => {
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  const addReservation = useCallback(async (data) => {
    if (!data.clientId) {
      toast.error('Se requiere un cliente registrado para crear la reserva')
      return null
    }

    const newReservation = {
      client_id: data.clientId,
      date: data.date,
      time: data.time,
      table_id: data.tableId || 'T01',
      guests: data.guests || data.pax || 2,
      status: RESERVATION_STATUS.PENDING,
      notes: data.notes || ''
    }
    
    // Select con JOIN para devolver el cliente inmediatamente a la UI
    const { data: inserted, error } = await supabase.from('reservations')
      .insert(newReservation)
      .select('*, clients(*)').single()
    
    if (error) {
      console.error('Insert error:', error)
      toast.error('Error al crear reserva')
      return null
    }

    const mapped = {
      id: inserted.id,
      client_id: inserted.client_id,
      clientName: inserted.clients?.name,
      clientDni: inserted.clients?.dni,
      tableId: inserted.table_id,
      date: inserted.date,
      time: inserted.time,
      pax: inserted.guests,
      status: inserted.status,
      notes: inserted.notes,
      createdAt: inserted.created_at
    }

    setReservations(prev => [mapped, ...prev])
    
    auditLogger.record({
      actor: actorName,
      tipoActor: 'usuario',
      accion: 'reservation.create',
      nivel: 'info',
      detalle: { id: mapped.id, client: mapped.clientName }
    })

    toast.success('Reserva creada exitosamente')
    return mapped
  }, [actorName])

  const updateReservation = useCallback(async (id, updates) => {
    const dbUpdates = {}
    if (updates.clientId) dbUpdates.client_id = updates.clientId
    if (updates.tableId) dbUpdates.table_id = updates.tableId
    if (updates.date) dbUpdates.date = updates.date
    if (updates.time) dbUpdates.time = updates.time
    if (updates.pax) dbUpdates.guests = updates.pax
    if (updates.status) dbUpdates.status = updates.status
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes

    const { data: updated, error } = await supabase.from('reservations')
      .update(dbUpdates).eq('id', id).select('*, clients(*)').single()
    
    if (!error && updated) {
      const mapped = {
        id: updated.id,
        client_id: updated.client_id,
        clientName: updated.clients?.name,
        clientDni: updated.clients?.dni,
        tableId: updated.table_id,
        date: updated.date,
        time: updated.time,
        pax: updated.guests,
        status: updated.status,
        notes: updated.notes,
        createdAt: updated.created_at
      }
      setReservations(prev => prev.map(r => r.id === id ? mapped : r))
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.update', nivel: 'info', detalle: { id, updates } })
      toast.success('Reserva actualizada')
    } else {
      console.error(error)
      toast.error('Error actualizando reserva')
    }
  }, [actorName])

  const cancelReservation = useCallback(async (id, reason = '') => {
    const { error } = await supabase.from('reservations').update({ status: RESERVATION_STATUS.CANCELLED }).eq('id', id)
    if (!error) {
      setReservations(prev =>
        prev.map(r => r.id === id ? { ...r, status: RESERVATION_STATUS.CANCELLED, cancelReason: reason } : r)
      )
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.cancel', nivel: 'warn', detalle: { id, reason } })
      toast.success('Reserva cancelada')
    }
  }, [actorName])

  const completeReservation = useCallback(async (id) => {
    const { error } = await supabase.from('reservations').update({ status: RESERVATION_STATUS.COMPLETED }).eq('id', id)
    if (!error) {
      setReservations(prev =>
        prev.map(r => r.id === id ? { ...r, status: RESERVATION_STATUS.COMPLETED } : r)
      )
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.complete', nivel: 'info', detalle: { id } })
      toast.success('Reserva completada')
    }
  }, [actorName])

  const seatReservation = useCallback(async (id) => {
    const { error } = await supabase.from('reservations').update({ status: RESERVATION_STATUS.SEATED }).eq('id', id)
    if (!error) {
      setReservations(prev =>
        prev.map(r => r.id === id ? { ...r, status: RESERVATION_STATUS.SEATED } : r)
      )
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'reservation.seat', nivel: 'info', detalle: { id } })
      toast.success('Cliente en mesa')
    }
  }, [actorName])

  const requestReservation = useCallback(async (data) => {
    // Si viene de la web, asume que el cliente existe o se creará de alguna manera antes.
    if (!data.clientId) return null
    const newReservation = {
      client_id: data.clientId,
      date: data.date,
      time: data.time,
      table_id: data.tableId || 'T00',
      guests: data.guests || data.pax || 2,
      status: RESERVATION_STATUS.REQUESTED
    }
    
    const { data: inserted, error } = await supabase.from('reservations').insert(newReservation).select('*, clients(*)').single()
    if (!error && inserted) {
      const mapped = {
        id: inserted.id,
        client_id: inserted.client_id,
        clientName: inserted.clients?.name,
        clientDni: inserted.clients?.dni,
        tableId: inserted.table_id,
        date: inserted.date,
        time: inserted.time,
        pax: inserted.guests,
        status: inserted.status,
        createdAt: inserted.created_at
      }
      setReservations(prev => [mapped, ...prev])
      toast.success('Solicitud enviada')
      return mapped
    } else {
      toast.error('Error enviando solicitud')
      return null
    }
  }, [])

  const approveReservation = useCallback(async (id, tableId, approvedBy) => {
    // Use proper mapped column names for the update
    const { error } = await supabase.from('reservations').update({ status: RESERVATION_STATUS.PENDING, table_id: tableId }).eq('id', id)
    if (!error) {
      setReservations(prev =>
        prev.map(r => r.id === id ? { ...r, status: RESERVATION_STATUS.PENDING, tableId } : r)
      )
      toast.success('Solicitud aprobada')
    }
  }, [])

  const rejectReservation = useCallback(async (id, reason = '') => {
    const { error } = await supabase.from('reservations').update({ status: RESERVATION_STATUS.CANCELLED }).eq('id', id)
    if (!error) {
      setReservations(prev =>
        prev.map(r => r.id === id ? { ...r, status: RESERVATION_STATUS.CANCELLED } : r)
      )
      toast.success('Solicitud rechazada')
    }
  }, [])

  const deleteReservationFromDB = useCallback(async (id) => {
    const { error } = await supabase.from('reservations').delete().eq('id', id)
    if (!error) {
      setReservations(prev => prev.filter(r => r.id !== id))
      toast.success('Reserva eliminada')
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
