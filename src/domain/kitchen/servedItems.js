/**
 * src/domain/kitchen/servedItems.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Determina qué platos de una mesa están SERVIDOS para poder cobrarlos (M-Caja).
 * Función pura y determinista: la Caja no debe cobrar platos que la cocina aún
 * no terminó.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Un ticket se considera entregado si está en estos estados.
const TICKET_SERVIDO = new Set(['served', 'ready', 'completed'])
// Un ítem se considera servido si su cocina terminó (o su ticket ya salió).
const ITEM_SERVIDO = new Set(['ready', 'served'])

/**
 * platosServidosDeTickets — Recolecta los ítems servidos de una lista de tickets
 * (los de UNA mesa/reserva) y los agrupa por plato sumando cantidades.
 *
 * Un ítem cuenta como servido si `itemStatus` es ready/served, o si el ticket
 * completo está servido/listo/completado (compatibilidad con comandas del seed
 * que no llevan estado por ítem).
 *
 * @param {Array} tickets - [{ status, items:[{ menuId, name, price, qty, itemStatus }] }]
 * @returns {Array} [{ menuId, name, price, qty }] listo para `orderItems` de Caja.
 */
export function platosServidosDeTickets(tickets = []) {
  const acc = new Map() // clave (menuId|name) → { menuId, name, price, qty }

  for (const t of tickets || []) {
    const ticketServido = TICKET_SERVIDO.has(t?.status)
    for (const it of t?.items || []) {
      const servido = ticketServido || ITEM_SERVIDO.has(it?.itemStatus)
      if (!servido) continue

      const clave = it.menuId || it.name
      const qty = Number(it.qty) || 0
      if (qty <= 0) continue

      const prev = acc.get(clave)
      if (prev) {
        prev.qty += qty
      } else {
        acc.set(clave, {
          menuId: it.menuId,
          name:   it.name,
          price:  Number(it.price) || 0,
          qty,
        })
      }
    }
  }

  return [...acc.values()]
}
