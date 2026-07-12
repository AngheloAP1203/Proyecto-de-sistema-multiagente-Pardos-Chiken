/**
 * src/domain/auth/passwordHash.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hashing de contraseñas del lado del cliente (F-03).
 *
 * SHA-256(`${id}:${PEPPER}:${password}`) vía Web Crypto. La sal por-usuario (el
 * id) evita que dos usuarios con la misma contraseña compartan hash y rompe las
 * rainbow tables genéricas. NO sustituye un backend con hashing lento; ver la
 * nota de alcance en usersSeed.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PASSWORD_PEPPER } from '../../data/seeds/usersSeed.js'

/** Devuelve el hash hex de la contraseña para un usuario dado. */
export async function hashPassword(userId, password) {
  const data = new TextEncoder().encode(`${userId}:${PASSWORD_PEPPER}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
