const API_URL = 'http://localhost:3001/api/reservations'

export const fetchRequested = async () => {
  try {
    const res = await fetch(`${API_URL}/requested`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export const patchReservation = async (id, payload) => {
  try {
    await fetch(`${API_URL}/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
  } catch {
    // Silent error handler corresponding to existing behaviour
  }
}
