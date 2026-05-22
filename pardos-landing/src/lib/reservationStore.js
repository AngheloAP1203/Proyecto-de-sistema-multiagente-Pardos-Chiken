/**
 * pardos-landing/src/lib/reservationStore.js
 * ──────────────────────────────────────────────────────────────────────
 * Envía reservas al servidor API compartido (localhost:3001).
 * El servidor guarda las reservas en db.json y el sistema de empleados
 * las lee desde la misma API → comunicación real entre las dos apps.
 * ──────────────────────────────────────────────────────────────────────
 */

const API_URL = 'http://localhost:3001/api'

/**
 * submitReservation — Envía una nueva solicitud de reserva a la API.
 * @param {object} data — datos del formulario
 * @returns {Promise<object>} la reserva creada con su ID
 */
export async function submitReservation(data) {
  const response = await fetch(`${API_URL}/reservations`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Error al enviar la reserva. Intenta de nuevo.')
  }

  return response.json()
}
