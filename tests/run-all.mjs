/**
 * tests/run-all.mjs — Golden set del Asistente IA (M5).
 *
 * Cada suite es un conjunto de casos con entrada y salida esperada, verificados
 * de forma determinista (§2.6 y §5 del documento de diseño): guardrails,
 * permisos por rol, exactitud de cifras, procedencia (anti-alucinación),
 * handoffs de la malla, streaming filtrado, caché y proxy.
 *
 * Uso:
 *   npm run test:agents            → suites deterministas (sin red, sin key)
 *   node tests/proxy-e2e-groq.live.mjs
 *                                  → E2E real contra Groq vía /api/llm
 *                                    (requiere `npx vite --port 5174` y GROQ_API_KEY)
 */
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const suites = readdirSync(aqui).filter(f => f.endsWith('.test.mjs')).sort()

let totalChecks = 0
let suitesFallidas = 0

for (const suite of suites) {
  const r = spawnSync(process.execPath, [join(aqui, suite)], { encoding: 'utf-8' })
  const passes = (r.stdout.match(/PASS/g) || []).length
  const fallos = (r.stdout.match(/FALL/g) || []).length
  totalChecks += passes

  const estado = r.status === 0 ? 'OK    ' : 'FALLOS'
  console.log(`  ${estado}  ${suite.padEnd(42)} ${String(passes).padStart(3)} checks${fallos ? ` · ${fallos} fallos` : ''}`)
  if (r.status !== 0) {
    suitesFallidas++
    // muestra solo las líneas que fallaron, no todo el log
    console.log(r.stdout.split('\n').filter(l => l.includes('FALL')).map(l => `      ${l.trim()}`).join('\n'))
  }
}

console.log(`\n  ${'─'.repeat(60)}`)
console.log(`  TOTAL: ${totalChecks} comprobaciones · ${suitesFallidas} suites con fallos\n`)
process.exit(suitesFallidas ? 1 : 0)
