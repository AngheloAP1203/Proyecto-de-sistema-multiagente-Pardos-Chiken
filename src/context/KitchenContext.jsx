/**
 * src/context/KitchenContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de Cocina — persistido en Supabase.
 *
 * Modelo (esquema real):
 *   kitchen_tickets(id, reservation_id, status)         ← se enlaza por reserva
 *   ticket_items(id, ticket_id, menu_item_id, quantity, status)  ← estado POR plato
 *
 * La mesa, el cliente y el n° de personas se derivan del JOIN a `reservations`.
 * El nombre/precio del plato, del JOIN a `menu_items`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { TICKET_STATUS, TICKET_STATUS_LABELS, TICKET_STATUS_COLORS } from '../domain/kitchen/ticketStatus'
import { MENU_ITEMS } from '../domain/kitchen/menu'
import { supabase } from '../domain/supabase'
import { auditLogger } from '../agents/core/auditLogger'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

export { TICKET_STATUS, TICKET_STATUS_LABELS, TICKET_STATUS_COLORS, MENU_ITEMS }

const KitchenContext = createContext(null)

const ITEM_FLOW = ['pending', 'preparing', 'ready']

/** Mapea una fila de kitchen_tickets (con joins) al shape que consume la UI. */
function mapTicket(kt) {
  return {
    id:            kt.id,
    reservationId: kt.reservation_id,
    tableId:       kt.reservations?.table_id || '—',
    clientName:    kt.reservations?.clients?.name || 'Cliente',
    guests:        kt.reservations?.guests || 1,
    date:          kt.reservations?.date,
    status:        kt.status || TICKET_STATUS.PENDING,
    items: (kt.ticket_items || []).map(ti => ({
      id:         ti.id,
      menuId:     ti.menu_item_id,
      name:       ti.menu_items?.name || 'Plato',
      price:      Number(ti.menu_items?.price) || 0,
      qty:        ti.quantity,
      itemStatus: ti.status || 'pending',
    })),
    createdAt: kt.created_at,
  }
}

/** Deriva el estado del ticket a partir del estado de sus ítems. */
function deriveTicketStatus(items, current) {
  const allReady     = items.every(i => (i.itemStatus || 'pending') === 'ready')
  const allPreparing = items.every(i => ['preparing', 'ready'].includes(i.itemStatus || 'pending'))
  if (current === TICKET_STATUS.SERVED) return TICKET_STATUS.SERVED
  if (allReady) return TICKET_STATUS.READY
  if (allPreparing) return TICKET_STATUS.PREPARING
  return TICKET_STATUS.PENDING
}

const SELECT = '*, reservations(table_id, guests, date, clients(name)), ticket_items(*, menu_items(id, name, price))'

export function KitchenProvider({ children }) {
  const [tickets,  setTickets]  = useState([])
  const [isLoading, setLoading] = useState(true)
  const { user } = useAuth()
  const actorName = user ? `${user.name} (${user.role})` : 'Sistema'

  // Cache nombre-de-plato → menu_item_id (UUID de Supabase), para insertar comandas.
  const menuMapRef = useRef(null)

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase.from('kitchen_tickets')
        .select(SELECT)
        .order('created_at', { ascending: false })
      if (!error && data) setTickets(data.map(mapTicket))
    } catch (err) {
      console.error('Error cargando cocina:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTickets() }, [])
  useEffect(() => {
    const interval = setInterval(loadTickets, 10000)
    return () => clearInterval(interval)
  }, [])

  /** Devuelve el mapa nombre→menu_item_id, cargándolo una vez desde Supabase. */
  const getMenuMap = useCallback(async () => {
    if (menuMapRef.current) return menuMapRef.current
    const { data } = await supabase.from('menu_items').select('id, name')
    const map = {}
    for (const m of data || []) map[m.name] = m.id
    menuMapRef.current = map
    return map
  }, [])

  /**
   * addTicket — Crea una comanda para una reserva.
   * @param {Object} data { reservationId, items:[{ name, qty }] }
   */
  const addTicket = useCallback(async (data) => {
    if (!data.reservationId) {
      console.warn('[kitchen] addTicket sin reservationId — no se puede crear la comanda')
      return null
    }
    const { data: kt, error } = await supabase.from('kitchen_tickets')
      .insert({ reservation_id: data.reservationId, status: TICKET_STATUS.PENDING })
      .select('id').single()
    if (error || !kt) {
      console.error('Error creando comanda:', error)
      return null
    }

    const menuMap = await getMenuMap()
    const rows = (data.items || [])
      .map(it => ({
        ticket_id:    kt.id,
        menu_item_id: menuMap[it.name] || null,
        quantity:     it.qty || 1,
        status:       'pending',
      }))
      .filter(r => r.menu_item_id)
    if (rows.length) await supabase.from('ticket_items').insert(rows)

    await loadTickets()
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'kitchen.add_ticket', nivel: 'info', detalle: { id: kt.id, reservationId: data.reservationId } })
    toast.success('Comanda enviada a cocina')
    return kt.id
  }, [actorName, getMenuMap])

  const syncTicketItems = useCallback(async (reservationId, newItems) => {
    let { data: ticket } = await supabase.from('kitchen_tickets')
      .select('id').eq('reservation_id', reservationId).order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (!ticket) {
      const { data: newTicket, error } = await supabase.from('kitchen_tickets')
        .insert({ reservation_id: reservationId, status: TICKET_STATUS.PENDING })
        .select('id').single()
      if (error || !newTicket) {
        toast.error('Error al crear comanda')
        return
      }
      ticket = newTicket
    }

    const ticketId = ticket.id
    const menuMap = await getMenuMap()

    if (newItems.length === 0) {
      await supabase.from('ticket_items').delete().eq('ticket_id', ticketId).in('status', ['pending', 'preparing'])
    } else {
      const { data: currentItems } = await supabase.from('ticket_items').select('*').eq('ticket_id', ticketId)

      for (const it of newItems) {
        if (it.id) {
          // Ya existe, actualizamos cantidad
          await supabase.from('ticket_items').update({ quantity: it.qty }).eq('id', it.id)
        } else {
          // Es nuevo, lo insertamos
          await supabase.from('ticket_items').insert({
            ticket_id: ticketId,
            menu_item_id: menuMap[it.name] || it.menuId,
            quantity: it.qty,
            status: 'pending'
          })
        }
      }

      const newIds = newItems.map(i => i.id).filter(Boolean)
      const toDelete = (currentItems || []).filter(c => !newIds.includes(c.id) && ['pending', 'preparing'].includes(c.status))
      for (const d of toDelete) {
        await supabase.from('ticket_items').delete().eq('id', d.id)
      }
    }

    await loadTickets()
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'kitchen.sync_ticket', nivel: 'info', detalle: { ticketId, items: newItems.length } })
    toast.success('Comanda actualizada en cocina')
  }, [actorName, getMenuMap])

  const updateTicketStatus = useCallback(async (id, newStatus) => {
    const { error } = await supabase.from('kitchen_tickets').update({ status: newStatus }).eq('id', id)
    if (error) { toast.error('No se pudo actualizar el pedido'); return }
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'kitchen.update_status', nivel: 'info', detalle: { id, newStatus } })
    toast.success('Estado del pedido actualizado')
  }, [actorName])

  /** Avanza UN ítem (pending→preparing→ready) y recalcula el estado del ticket. */
  const advanceItem = useCallback(async (ticketId, itemIndex) => {
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket) return
    const item = ticket.items[itemIndex]
    if (!item) return
    const curr = item.itemStatus || 'pending'
    const next = ITEM_FLOW[Math.min(ITEM_FLOW.indexOf(curr) + 1, ITEM_FLOW.length - 1)]
    if (next === curr) return

    const { error } = await supabase.from('ticket_items').update({ status: next }).eq('id', item.id)
    if (error) { toast.error('No se pudo avanzar el plato'); return }

    const newItems = ticket.items.map((it, i) => i === itemIndex ? { ...it, itemStatus: next } : it)
    const newStatus = deriveTicketStatus(newItems, ticket.status)
    if (newStatus !== ticket.status) {
      await supabase.from('kitchen_tickets').update({ status: newStatus }).eq('id', ticketId)
    }
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, items: newItems, status: newStatus } : t))
    auditLogger.record({ actor: actorName, tipoActor: 'usuario', accion: 'kitchen.advance_item', nivel: 'info', detalle: { ticketId, itemIndex } })
  }, [tickets, actorName])

  const updateTicket = useCallback(async (id, updates) => {
    if (updates.status) await updateTicketStatus(id, updates.status)
  }, [updateTicketStatus])

  // Derivados
  const activeTickets  = tickets.filter(t => t.status !== TICKET_STATUS.SERVED)
  const pendingCount   = tickets.filter(t => t.status === TICKET_STATUS.PENDING).length
  const preparingCount = tickets.filter(t => t.status === TICKET_STATUS.PREPARING).length
  const readyCount     = tickets.filter(t => t.status === TICKET_STATUS.READY).length

  const value = {
    tickets,
    activeTickets,
    isLoading,
    pendingCount,
    preparingCount,
    readyCount,
    addTicket,
    syncTicketItems,
    updateTicketStatus,
    updateTicket,
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
