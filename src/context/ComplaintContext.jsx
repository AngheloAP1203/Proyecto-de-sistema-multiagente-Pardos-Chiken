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
    const { data, error } = await supabase.from('complaints').select('*').order('fecha', { ascending: false })
    if (!error && data) {
      // Mapear campos de supabase a los esperados por el frontend
      const mapped = data.map(c => ({
        id: c.id,
        fecha: c.fecha,
        canal: c.canal,
        cliente: c.cliente,
        telefono: c.telefono,
        mensaje: c.mensaje,
        tableId: c.table_id,
        razonamiento: c.razonamiento,
        sentimiento: c.sentimiento,
        prioridad: c.prioridad,
        sede: c.sede,
        puntos_criticos: c.puntos_criticos,
        respuesta_cliente: c.respuesta_cliente,
        estado: c.estado,
        createdAt: c.created_at
      }))
      setComplaints(mapped)
    }
    setIsLoading(false)
  }

  // Cargar quejas desde Supabase
  useEffect(() => {
    loadComplaints()
  }, [])

  const addComplaint = useCallback(async (complaint) => {
    const record = {
      fecha: complaint.fecha || new Date().toISOString().split('T')[0],
      canal: complaint.canal || 'Web',
      cliente: complaint.cliente || 'Desconocido',
      telefono: complaint.telefono || '',
      mensaje: complaint.mensaje || '',
      table_id: complaint.tableId || null,
      razonamiento: complaint.razonamiento || '',
      sentimiento: complaint.sentimiento || '',
      prioridad: complaint.prioridad || 'Baja',
      sede: complaint.sede || 'San Isidro',
      puntos_criticos: complaint.puntos_criticos || null,
      respuesta_cliente: complaint.respuesta_cliente || '',
      estado: complaint.estado || 'nueva'
    }
    
    const { data: inserted, error } = await supabase.from('complaints').insert(record).select().single()
    if (!error && inserted) {
      const mapped = {
        id: inserted.id,
        fecha: inserted.fecha,
        canal: inserted.canal,
        cliente: inserted.cliente,
        telefono: inserted.telefono,
        mensaje: inserted.mensaje,
        tableId: inserted.table_id,
        razonamiento: inserted.razonamiento,
        sentimiento: inserted.sentimiento,
        prioridad: inserted.prioridad,
        sede: inserted.sede,
        puntos_criticos: inserted.puntos_criticos,
        respuesta_cliente: inserted.respuesta_cliente,
        estado: inserted.estado,
        createdAt: inserted.created_at
      }
      setComplaints(prev => [mapped, ...prev])
    }
    
    const isClientAction = !user
    auditLogger.record({
      actor: isClientAction ? `${complaint.cliente || 'Cliente'} (${complaint.canal || 'Web'})` : actorName,
      tipoActor: isClientAction ? 'cliente' : 'usuario',
      accion: 'complaint.create',
      nivel: 'warn',
      detalle: { id: record.id }
    })

    return { ...complaint, id: record.id }
  }, [user, actorName])

  const updateComplaint = useCallback(async (id, updates) => {
    const recordUpdates = {}
    if (updates.estado) recordUpdates.status = updates.estado
    if (updates.resolution) recordUpdates.resolution = JSON.stringify(updates.resolution)
    
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

