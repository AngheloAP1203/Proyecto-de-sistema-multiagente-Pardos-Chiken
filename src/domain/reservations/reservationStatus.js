export const RESERVATION_STATUS = {
  REQUESTED: 'requested',  // Solicitada por cliente externo — en espera de aprobación
  PENDING:   'pending',    // Aprobada, esperando al cliente
  SEATED:    'seated',     // Cliente ya llegó y está sentado
  COMPLETED: 'completed',  // Reserva completada (histórico)
  CANCELLED: 'cancelled',  // Cancelada (histórico)
  REJECTED:  'rejected',   // Rechazada por el personal
  NO_SHOW:   'no_show',    // Cliente no se presentó (histórico)
}

export const STATUS_LABELS = {
  requested: 'Solicitud',
  pending:   'Pendiente',
  seated:    'En Mesa',
  completed: 'Completada',
  cancelled: 'Cancelada',
  rejected:  'Rechazada',
  no_show:   'No se presentó',
}

export const STATUS_COLORS = {
  requested: 'purple',
  pending:   'warning',
  seated:    'info',
  completed: 'success',
  cancelled: 'error',
  rejected:  'error',
  no_show:   'neutral',
}
