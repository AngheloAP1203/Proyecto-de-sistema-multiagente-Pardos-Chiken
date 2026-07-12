/**
 * src/domain/security/rateGuard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Throttle de intentos del lado del cliente, persistido en localStorage (F-04).
 *
 * Frena el abuso casual de acciones sensibles sin backend — p. ej. probar pares
 * DNI+mesa a repetición en /reclamo para enumerar consumos o farmear recompensas.
 *
 * LÍMITE HONESTO: al vivir en el navegador, un atacante decidido lo evade
 * (borra el storage, usa incógnito). Sube el listón contra el abuso trivial; el
 * control duro requeriría un backend con límite por IP (ver F-05).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * intentoPermitido — Registra un intento bajo `clave` y dice si está dentro del
 * límite (ventana deslizante).
 *
 * @param {string} clave      identificador de la acción (ej. 'reclamo.verify')
 * @param {object} [opts]     { max = 6, windowMs = 300_000 }  (6 por 5 min)
 * @returns {{ ok: boolean, restantes: number, esperaSeg: number }}
 */
export function intentoPermitido(clave, { max = 6, windowMs = 300_000 } = {}) {
  const storageKey = `pardos_rl_${clave}`
  const ahora = Date.now()
  const desde = ahora - windowMs

  let previos = []
  try {
    previos = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (!Array.isArray(previos)) previos = []
  } catch { previos = [] }

  previos = previos.filter(t => typeof t === 'number' && t > desde)

  if (previos.length >= max) {
    const esperaSeg = Math.ceil((previos[0] + windowMs - ahora) / 1000)
    return { ok: false, restantes: 0, esperaSeg: Math.max(esperaSeg, 1) }
  }

  previos.push(ahora)
  try { localStorage.setItem(storageKey, JSON.stringify(previos)) } catch { /* storage lleno/bloqueado */ }
  return { ok: true, restantes: max - previos.length, esperaSeg: 0 }
}
