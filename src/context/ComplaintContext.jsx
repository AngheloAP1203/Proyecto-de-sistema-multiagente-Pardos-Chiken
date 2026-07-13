/**
 * src/context/ComplaintContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de quejas.
 * Centraliza el registro, listado y actualización de las quejas consultando a Supabase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../domain/supabase'
import { auditLogger } from '../agents/core/auditLogger'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

const ComplaintContext = createContext(null)

export function ComplaintProvider({ children }) {
  const [complaints, setComplaints] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const actorName = user ? `${user.name} (${user.role})` : 'Sistema'

  const complaintsRef = useRef([])
  useEffect(() => { complaintsRef.current = complaints }, [complaints])

  const loadComplaints = async () => {
    try {
      const { data, error } = await supabase.from('complaints')
        .select('*, clients(*), reservations(*)')
        .order('fecha', { ascending: false })
        
      if (!error && data) {
        // Mapear campos de supabase a los esperados por el frontend
        const mapped = data.map(c => {
          const resObj = c.resolution || {}
          return {
            id: c.id,
            reservation_id: c.reservation_id,
            fecha: c.fecha,
            canal: c.canal,
            cliente: c.clients?.name || 'Desconocido',
            telefono: c.clients?.phone || '',
            email: c.clients?.email || '',
            mensaje: c.mensaje,
            tableId: c.reservations?.table_id,
            razonamiento: resObj.razonamiento || '',
            sentimiento: resObj.sentimiento || '',
            prioridad: c.severidad || 'Baja',
            sede: resObj.sede || 'San Isidro',
            puntos_criticos: resObj.puntos_criticos || null,
            respuesta_cliente: resObj.respuesta_cliente || '',
            estado: c.estado,
            createdAt: c.created_at
          }
        })
        setComplaints(mapped)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // Cargar quejas desde Supabase
  useEffect(() => {
    loadComplaints()
  }, [])

  const addComplaint = useCallback(async (complaint) => {
    // Si no hay clientId asume que necesita ser asignado. En un caso real crearíamos el cliente primero.
    if (!complaint.clientId) {
      toast.error('Se requiere un cliente registrado para crear una queja')
      return null
    }

    const resolutionObj = {
      razonamiento: complaint.razonamiento || '',
      sentimiento: complaint.sentimiento || '',
      sede: complaint.sede || 'San Isidro',
      puntos_criticos: complaint.puntos_criticos || null,
      respuesta_cliente: complaint.respuesta_cliente || '',
      // Respuestas del cuestionario guiado (preguntas cerradas + abierta), si las hay.
      respuestas: complaint.respuestas || null,
    }

    const record = {
      client_id: complaint.clientId,
      reservation_id: complaint.reservationId || null,
      fecha: complaint.fecha || new Date().toISOString().split('T')[0],
      canal: complaint.canal || 'Web',
      estado: complaint.estado || 'nueva',
      severidad: complaint.prioridad || 'Baja',
      mensaje: complaint.mensaje || '',
      resolution: resolutionObj
    }
    
    const { data: inserted, error } = await supabase.from('complaints').insert(record).select('*, clients(*), reservations(*)').single()
    if (!error && inserted) {
      const resObj = inserted.resolution || {}
      const mapped = {
        id: inserted.id,
        reservation_id: inserted.reservation_id,
        fecha: inserted.fecha,
        canal: inserted.canal,
        cliente: inserted.clients?.name || 'Desconocido',
        telefono: inserted.clients?.phone || '',
        mensaje: inserted.mensaje,
        tableId: inserted.reservations?.table_id,
        razonamiento: resObj.razonamiento || '',
        sentimiento: resObj.sentimiento || '',
        prioridad: inserted.severidad || 'Baja',
        sede: resObj.sede || 'San Isidro',
        puntos_criticos: resObj.puntos_criticos || null,
        respuesta_cliente: resObj.respuesta_cliente || '',
        estado: inserted.estado,
        createdAt: inserted.created_at
      }
      setComplaints(prev => [mapped, ...prev])
      
      const isClientAction = !user
      auditLogger.record({
        actor: isClientAction ? `${mapped.cliente} (${mapped.canal})` : actorName,
        tipoActor: isClientAction ? 'cliente' : 'usuario',
        accion: 'complaint.create',
        nivel: 'warn',
        detalle: { id: record.id }
      })

      return mapped
    } else {
      console.error(error)
      toast.error('Error al registrar la queja')
      return null
    }
  }, [user, actorName])

  const updateComplaint = useCallback(async (id, updates) => {
    const recordUpdates = {}
    if (updates.estado) recordUpdates.estado = updates.estado
    // We can merge resolution if needed, but for now we just overwrite if passed
    if (updates.resolution) recordUpdates.resolution = updates.resolution
    
    const { error } = await supabase.from('complaints').update(recordUpdates).eq('id', id)
    if (!error) {
      setComplaints(prev =>
        prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)
      )
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'complaint.update', nivel: 'info', detalle: { id, updates } })
    }
  }, [actorName])

  const deleteComplaint = useCallback(async (id) => {
    const { error } = await supabase.from('complaints').delete().eq('id', id)
    if (!error) {
      setComplaints(prev => prev.filter(c => c.id !== id))
      auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'complaint.delete', nivel: 'warn', detalle: { id } })
      toast.success('Queja eliminada')
    } else {
      toast.error('Error al eliminar queja')
    }
  }, [actorName])

  const getComplaints = useCallback(() => complaintsRef.current, [])

  const getBySede = useCallback((sede) => {
    const s = (sede || '').toLowerCase()
    return complaintsRef.current.filter(c => (c.sede || '').toLowerCase().includes(s))
  }, [])

  const criticas = complaints.filter(c => c.prioridad === 'Crítica')

  const value = {
    complaints,
    isLoading,
    totalComplaints: complaints.length,
    criticas,
    criticasCount: criticas.length,
    addComplaint,
    updateComplaint,
    deleteComplaint,
    getComplaints,
    getBySede,
  }

  return <ComplaintContext.Provider value={value}>{children}</ComplaintContext.Provider>
}

export function useComplaints() {
  const ctx = useContext(ComplaintContext)
  if (!ctx) throw new Error('useComplaints debe usarse dentro de <ComplaintProvider>')
  return ctx
}

export default ComplaintContext

