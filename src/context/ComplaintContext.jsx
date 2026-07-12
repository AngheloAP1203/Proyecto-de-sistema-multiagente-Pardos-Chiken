/**
 * src/context/ComplaintContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de quejas (módulo de IA).
 * Centraliza el registro, listado y actualización de las quejas triadas.
 * Espejo de ClientContext, con un ref para que los agentes lean siempre el
 * estado más reciente (evita closures obsoletos al inyectar context actions).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { SAMPLE_COMPLAINTS } from '../data/seeds/complaintsSeed'
import { readJSON, writeJSON } from '../data/storage/localStorage'
import { auditLogger } from '../agents/core/auditLogger'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

const ComplaintContext = createContext(null)

export function ComplaintProvider({ children }) {
  const [complaints, setComplaints] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const actorName = user ? `${user.name} (${user.role})` : 'Sistema'

  // Ref siempre actualizado → los agentes leen la lista más reciente
  const complaintsRef = useRef([])
  useEffect(() => { complaintsRef.current = complaints }, [complaints])

  // Cargar quejas desde localStorage (o seeds)
  useEffect(() => {
    const saved = readJSON('pardos_complaints', null)
    setComplaints(saved || SAMPLE_COMPLAINTS)
    setIsLoading(false)
  }, [])

  // Persistir en localStorage
  useEffect(() => {
    if (!isLoading) writeJSON('pardos_complaints', complaints)
  }, [complaints, isLoading])

  /**
   * addComplaint — Inserta una queja ya triada (la genera el ComplaintAgent).
   * Si no trae id, se genera uno.
   */
  const addComplaint = useCallback((complaint) => {
    const record = {
      id: complaint.id || `Q${Date.now().toString().slice(-6)}`,
      fecha: complaint.fecha || new Date().toISOString(),
      estado: complaint.estado || 'nueva',
      ...complaint,
    }
    setComplaints(prev => [record, ...prev])
    
    // Log as client if it comes from the agent/web, else as system/user
    const isClientAction = !user
    auditLogger.record({
      actor: isClientAction ? `${complaint.cliente || 'Cliente'} (${complaint.canal || 'Web'})` : actorName,
      tipoActor: isClientAction ? 'cliente' : 'usuario',
      accion: 'complaint.create',
      nivel: 'warn',
      detalle: { id: record.id, sede: record.sede }
    })

    return record
  }, [user, actorName])

  const updateComplaint = useCallback((id, updates) => {
    setComplaints(prev =>
      prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)
    )
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'complaint.update', nivel: 'info', detalle: { id, updates } })
  }, [actorName])

  const deleteComplaint = useCallback((id) => {
    setComplaints(prev => prev.filter(c => c.id !== id))
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'complaint.delete', nivel: 'warn', detalle: { id } })
    toast.success('Queja eliminada')
  }, [actorName])

  /** Lectura síncrona del estado más reciente (para los agentes). */
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
