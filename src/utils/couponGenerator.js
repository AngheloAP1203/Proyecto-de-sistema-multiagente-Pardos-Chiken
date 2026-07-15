/**
 * src/utils/couponGenerator.js
 * Generador de códigos de cupones seguros, únicos y cortos.
 */

// Caracteres permitidos excluyendo confusos (O, 0, I, 1, L)
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateCouponCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return code
}
