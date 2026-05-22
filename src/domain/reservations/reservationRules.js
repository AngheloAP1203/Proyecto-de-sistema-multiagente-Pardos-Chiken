import { RESERVATION_STATUS } from './reservationStatus'
import { format } from 'date-fns'

export const generateReservationId = () => `R${Date.now().toString().slice(-6)}`

export const isHistorical = (reservation) => {
  return [
    RESERVATION_STATUS.COMPLETED,
    RESERVATION_STATUS.CANCELLED,
    RESERVATION_STATUS.NO_SHOW,
    RESERVATION_STATUS.REJECTED
  ].includes(reservation.status)
}

export const isToday = (reservation) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  return reservation.date === todayStr &&
    reservation.status !== RESERVATION_STATUS.CANCELLED &&
    reservation.status !== RESERVATION_STATUS.REJECTED
}
