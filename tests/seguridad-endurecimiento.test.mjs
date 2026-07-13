/**
 * tests/seguridad-endurecimiento.test.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Fija al golden set los controles de seguridad activos:
 *   · F-01 — guard de los proxies (allowlist de origen + rate-limit por IP)
 *   · F-04 — throttle de intentos del lado del cliente
 * Si una regresión los debilita, el build falla.
 *
 * Nota: la autenticación migró a Supabase Auth (signInWithPassword), que
 * supera al hashing de cliente anterior (F-03); por eso ya no se testea aquí.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { verificarOrigen, rateLimit } from '../api/_guard.js'
import { intentoPermitido } from '../src/domain/security/rateGuard.js'

let fail = 0
const ok = (c, l) => { console.log(`${c ? '  PASS' : '  FALL'}  ${l}`); if (!c) fail++ }

// Polyfill mínimo de localStorage para el throttle del cliente (F-04).
const _store = new Map()
globalThis.localStorage = {
  getItem: k => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: k => _store.delete(k),
}

const req = (headers) => ({ headers, socket: { remoteAddress: '9.9.9.9' } })

console.log('\n1) F-01 — Allowlist de origen del proxy')
ok(verificarOrigen(req({ host: 'app.vercel.app', origin: 'https://app.vercel.app' })),
  'acepta petición del mismo origen (host == origin)')
ok(!verificarOrigen(req({ host: 'app.vercel.app', origin: 'https://evil.com' })),
  'rechaza origen ajeno (otra web usando el proxy)')
ok(!verificarOrigen(req({ host: 'app.vercel.app' })),
  'rechaza petición sin Origin ni Referer (curl pelado)')
ok(verificarOrigen(req({ host: 'x', referer: 'http://localhost:5173/reclamo' })),
  'acepta desarrollo local vía Referer')

console.log('\n2) F-01 — Rate-limit por IP (ventana deslizante)')
const ip = req({ 'x-forwarded-for': '1.2.3.4' })
let ultimos = []
for (let i = 0; i < 5; i++) ultimos.push(rateLimit(ip, { max: 3, windowMs: 60_000 }))
ok(ultimos.slice(0, 3).every(Boolean), 'las primeras 3 dentro del límite pasan')
ok(ultimos[3] === false && ultimos[4] === false, 'la 4.ª y 5.ª se bloquean')
ok(rateLimit(req({ 'x-forwarded-for': '5.6.7.8' }), { max: 3, windowMs: 60_000 }),
  'otra IP tiene su propio cupo (no se contamina)')

console.log('\n3) F-04 — Throttle de intentos del cliente')
let res = null
for (let i = 0; i < 8; i++) res = intentoPermitido('test.verify', { max: 6, windowMs: 300_000 })
ok(res.ok === false && res.esperaSeg > 0, 'tras 6 intentos, el 7.º/8.º se bloquea con espera sugerida')
ok(intentoPermitido('otra.accion', { max: 6, windowMs: 300_000 }).ok,
  'cada acción tiene su propio contador independiente')

console.log(`\n${fail === 0 ? 'TODO OK' : fail + ' FALLOS'}\n`); process.exit(fail ? 1 : 0)
