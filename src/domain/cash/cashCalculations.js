import { PAYMENT_METHODS, IGV_RATE } from './paymentMethods'

export const calculateTotalByMethod = (payments) => {
  return PAYMENT_METHODS.reduce((acc, m) => {
    acc[m.id] = payments.filter(p => p.method === m.id).reduce((s, p) => s + p.amount, 0)
    return acc
  }, {})
}

export const calculateIGV = (amount) => {
  return amount * IGV_RATE
}

export const summarizeShift = (shift, payments) => {
  if (!shift) return null
  const shiftPayments = payments.filter(
    p => p.cashierId === shift.cashierId && p.date === new Date().toISOString().split('T')[0]
  )
  return {
    ...shift,
    closedAt:    new Date().toISOString(),
    status:      'closed',
    totalAmount: shiftPayments.reduce((s, p) => s + p.amount, 0),
    totalTx:     shiftPayments.length,
    byMethod:    calculateTotalByMethod(shiftPayments),
  }
}
