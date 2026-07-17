/**
 * src/context/ClientContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de clientes.
 * Centraliza el registro, búsqueda y actualización de clientes del restaurante.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../domain/supabase'
import toast from 'react-hot-toast'

const ClientContext = createContext(null)

export function ClientProvider({ children }) {
  const [clients, setClients] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Cargar clientes desde Supabase
  const fetchClients = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
      if (error) throw error
      // Supabase entrega `is_vip`; la UI (dashboard, reportes, clientes) lee `vip`.
      // Se normaliza aquí para que ambos nombres funcionen en toda la app.
      setClients((data || []).map(c => ({ ...c, vip: c.is_vip === true })))
    } catch (err) {
      console.error('Error fetching clients:', err)
      toast.error('Error al cargar clientes')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const addClient = useCallback(async (data) => {
    try {
      // Fake a UUID for offline robustness if needed, but supabase generates it.
      // We send it to supabase.
      const payload = {
        name: data.name,
        dni: data.dni,
        email: data.email || null,
        phone: data.phone || null,
        is_vip: data.vip || false
      }
      const { data: inserted, error } = await supabase.from('clients').insert(payload).select().single()
      if (error) throw error

      setClients(prev => [{ ...inserted, vip: inserted.is_vip === true }, ...prev])
      toast.success('Cliente registrado correctamente')
      return inserted
    } catch (err) {
      console.error('Error adding client:', err)
      toast.error('Error al registrar cliente')
      return null
    }
  }, [])

  const updateClient = useCallback(async (id, updates) => {
    try {
      const payload = {}
      if (updates.name !== undefined) payload.name = updates.name
      if (updates.dni !== undefined) payload.dni = updates.dni
      if (updates.email !== undefined) payload.email = updates.email
      if (updates.phone !== undefined) payload.phone = updates.phone
      if (updates.vip !== undefined) payload.is_vip = updates.vip

      const { data: updated, error } = await supabase.from('clients').update(payload).eq('id', id).select().single()
      if (error) throw error

      setClients(prev => prev.map(c => c.id === id ? { ...updated, vip: updated.is_vip === true } : c))
      toast.success('Cliente actualizado')
    } catch (err) {
      console.error('Error updating client:', err)
      toast.error('Error al actualizar cliente')
    }
  }, [])

  const deleteClient = useCallback(async (id) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
      setClients(prev => prev.filter(c => c.id !== id))
      toast.success('Cliente eliminado')
    } catch (err) {
      console.error('Error deleting client:', err)
      toast.error('Error al eliminar cliente (puede tener reservas asociadas)')
    }
  }, [])

  const searchClients = useCallback((query) => {
    if (!query || query.length < 2) return clients
    const q = query.toLowerCase()
    return clients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.dni?.includes(q)
    )
  }, [clients])

  const getClientById = useCallback((id) => {
    return clients.find(c => c.id === id) || null
  }, [clients])

  const findByDni = useCallback((dni) => {
    if (!dni) return null
    return clients.find(c => c.dni === dni.trim()) || null
  }, [clients])

  const value = {
    clients,
    isLoading,
    totalClients: clients.length,
    vipClients: clients.filter(c => c.is_vip),
    addClient,
    updateClient,
    deleteClient,
    searchClients,
    getClientById,
    findByDni,
    refreshClients: fetchClients
  }

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>
}

export function useClients() {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClients debe usarse dentro de <ClientProvider>')
  return ctx
}
