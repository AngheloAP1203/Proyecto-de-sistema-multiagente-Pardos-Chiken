import { supabase } from '../../domain/supabase'

export const fetchRequested = async () => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('status', 'requested')
      
    if (error) return []
    // Mapear de supabase a frontend format
    return data.map(r => ({
      id: r.id,
      clientName: r.client_name,
      clientDni: r.client_dni,
      tableId: r.table_id,
      date: r.date,
      time: r.time,
      pax: r.pax,
      status: r.status,
      notes: r.notes || ''
    }))
  } catch {
    return []
  }
}

export const patchReservation = async (id, payload) => {
  try {
    const updatePayload = {}
    if (payload.status) updatePayload.status = payload.status
    if (payload.tableId) updatePayload.table_id = payload.tableId

    await supabase
      .from('reservations')
      .update(updatePayload)
      .eq('id', id)
  } catch {
    // Silent error handler corresponding to existing behaviour
  }
}
