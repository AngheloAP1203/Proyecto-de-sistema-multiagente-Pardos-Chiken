/**
 * src/utils/couponGenerator.js
 * Generador de códigos de cupones seguros, únicos y cortos.
 */

// Caracteres permitidos excluyendo confusos (O, 0, I, 1, L)
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Genera un código de cupón único.
 * Formato: PRD-[DESCUENTO]-[4-CARACTERES]
 * @param {number} porcentaje - Porcentaje de descuento (ej. 30).
 * @returns {string} Código del cupón (ej. PRD-30-X4KL).
 */
export function generateCouponCode(porcentaje) {
  let randomPart = ''
  for (let i = 0; i < 4; i++) {
    randomPart += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return `PRD-${porcentaje}-${randomPart}`
}
