/**
 * src/context/ClientContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de clientes.
 * Centraliza el registro, búsqueda y actualización de clientes del restaurante.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { SAMPLE_CLIENTS } from '../data/seeds/clientsSeed'
import { readJSON, writeJSON } from '../data/storage/localStorage'
import toast from 'react-hot-toast'

const ClientContext = createContext(null)

export function ClientProvider({ children }) {
  const [clients, setClients] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Cargar clientes desde localStorage
  useEffect(() => {
    const saved = readJSON('pardos_clients', null)
    if (saved) {
      setClients(saved)
    } else {
      setClients(SAMPLE_CLIENTS)
    }
    setIsLoading(false)
  }, [])

  // Persistir en localStorage
  useEffect(() => {
    if (!isLoading) {
      writeJSON('pardos_clients', clients)
    }
  }, [clients, isLoading])

  const generateId = () => `C${Date.now().toString().slice(-6)}`

  const addClient = useCallback((data) => {
    const newClient = {
      ...data,
      id: generateId(),
      totalVisits: 0,
      totalReservations: 0,
      lastVisit: null,
      registeredAt: new Date().toISOString(),
      vip: false,
    }
    setClients(prev => [newClient, ...prev])
    toast.success('Cliente registrado correctamente')
    return newClient
  }, [])

  const updateClient = useCallback((id, updates) => {
    setClients(prev =>
      prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)
    )
    toast.success('Cliente actualizado')
  }, [])

  const deleteClient = useCallback((id) => {
    setClients(prev => prev.filter(c => c.id !== id))
    toast.success('Cliente eliminado')
  }, [])

  const searchClients = useCallback((query) => {
    if (!query || query.length < 2) return clients
    const q = query.toLowerCase()
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.dni?.includes(q)
    )
  }, [clients])

  const getClientById = useCallback((id) => {
    return clients.find(c => c.id === id) || null
  }, [clients])

  const incrementVisits = useCallback((id) => {
    setClients(prev =>
      prev.map(c =>
        c.id === id
          ? {
              ...c,
              totalVisits: (c.totalVisits || 0) + 1,
              lastVisit: new Date().toISOString().split('T')[0],
            }
          : c
      )
    )
  }, [])

  const findByPhone = useCallback((phone) => {
    return clients.find(c => c.phone === phone.trim()) || null
  }, [clients])

  const value = {
    clients,
    isLoading,
    totalClients: clients.length,
    vipClients: clients.filter(c => c.vip),
    addClient,
    updateClient,
    deleteClient,
    searchClients,
    getClientById,
    incrementVisits,
    findByPhone,
  }

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>
}

export function useClients() {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClients debe usarse dentro de <ClientProvider>')
  return ctx
}
