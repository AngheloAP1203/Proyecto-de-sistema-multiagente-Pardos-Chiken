/**
 * src/context/KitchenContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de Cocina — módulo exclusivo del Jefe de Cocina.
 * Gestiona los tickets/pedidos que llegan a la cocina según las reservas
 * activas, permite cambiar su estado: pendiente → en preparación → listo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { TICKET_STATUS, TICKET_STATUS_LABELS, TICKET_STATUS_COLORS } from '../domain/kitchen/ticketStatus'
import { MENU_ITEMS } from '../domain/kitchen/menu'
import { readJSON, writeJSON } from '../data/storage/localStorage'
import toast from 'react-hot-toast'

export { TICKET_STATUS, TICKET_STATUS_LABELS, TICKET_STATUS_COLORS, MENU_ITEMS }

const KitchenContext = createContext(null)

export function KitchenProvider({ children }) {
  const [tickets,  setTickets]  = useState([])
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    const saved = readJSON('pardos_kitchen', null)
    // Filtra IDs de seeds de demostración para que no aparezcan en producción
    const clean = (saved || []).filter(t => !['TK001', 'TK002'].includes(t.id))
    setTickets(clean)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isLoading) writeJSON('pardos_kitchen', tickets)
  }, [tickets, isLoading])

  const generateId = () => `TK${Date.now().toString().slice(-4)}`

  const addTicket = useCallback((data) => {
    const ticket = {
      ...data,
      id:        generateId(),
      status:    TICKET_STATUS.PENDING,
      createdAt: new Date().toISOString(),
    }
    setTickets(prev => [ticket, ...prev])
    toast.success('Ticket enviado a cocina')
    return ticket
  }, [])

  const updateTicketStatus = useCallback((id, newStatus) => {
    setTickets(prev =>
      prev.map(t =>
        t.id === id ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t
      )
    )
    toast.success('Estado del pedido actualizado')
  }, [])

  const updateTicket = useCallback((id, updates) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }, [])

  // Avanza el estado de UN ítem individual: pending → preparing → ready
  // El ticket cambia de columna SOLO cuando TODOS los ítems alcanzan esa fase:
  //   todos en "preparing" → ticket pasa a PREPARING
  //   todos en "ready"     → ticket pasa a READY
  const advanceItem = useCallback((ticketId, itemIndex) => {
    const ITEM_FLOW = ['pending', 'preparing', 'ready']
    setTickets(prev =>
      prev.map(t => {
        if (t.id !== ticketId) return t
        const newItems = t.items.map((item, i) => {
          if (i !== itemIndex) return item
          const curr = item.itemStatus || 'pending'
          const currIdx = ITEM_FLOW.indexOf(curr)
          const next = ITEM_FLOW[Math.min(currIdx + 1, ITEM_FLOW.length - 1)]
          return { ...item, itemStatus: next }
        })
        const allPreparing = newItems.every(item => ['preparing', 'ready'].includes(item.itemStatus || 'pending'))
        const allReady     = newItems.every(item => (item.itemStatus || 'pending') === 'ready')

        let newStatus = t.status
        if (allReady) newStatus = TICKET_STATUS.READY
        else if (allPreparing && t.status === TICKET_STATUS.PENDING) newStatus = TICKET_STATUS.PREPARING

        return { ...t, items: newItems, status: newStatus }
      })
    )
  }, [])

  const toggleItemReady = useCallback((id, itemIndex) => {
    setTickets(prev =>
      prev.map(t => {
        if (t.id !== id) return t
        const newItems = [...t.items]
        newItems[itemIndex] = { ...newItems[itemIndex], isReady: !newItems[itemIndex].isReady }
        return { ...t, items: newItems }
      })
    )
  }, [])

  // Tickets activos (no servidos)
  const activeTickets = tickets.filter(t => t.status !== TICKET_STATUS.SERVED)
  const pendingCount  = tickets.filter(t => t.status === TICKET_STATUS.PENDING).length
  const preparingCount = tickets.filter(t => t.status === TICKET_STATUS.PREPARING).length
  const readyCount    = tickets.filter(t => t.status === TICKET_STATUS.READY).length

  const value = {
    tickets,
    activeTickets,
    isLoading,
    pendingCount,
    preparingCount,
    readyCount,
    addTicket,
    updateTicketStatus,
    updateTicket,
    toggleItemReady,
    advanceItem,
    menuItems: MENU_ITEMS,
  }

  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>
}

export function useKitchen() {
  const ctx = useContext(KitchenContext)
  if (!ctx) throw new Error('useKitchen debe usarse dentro de <KitchenProvider>')
  return ctx
}
