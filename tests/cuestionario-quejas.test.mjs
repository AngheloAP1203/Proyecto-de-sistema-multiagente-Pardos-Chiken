/**
 * tests/cuestionario-quejas.test.mjs
 * Fija el mapeo DETERMINISTA de respuestas cerradas → severidad + puntos críticos.
 */
import { analizarRespuestas, respuestasATexto } from '../src/domain/complaints/questionnaire.js'

let fail = 0
const ok = (c, l) => { console.log(`${c ? '  PASS' : '  FALL'}  ${l}`); if (!c) fail++ }

console.log('\n1) Reglas Crítica (comida en mal estado / error de cobro)')
ok(analizarRespuestas({ problema: 'comida', satisfaccion: 3 }).severidad === 'Crítica',
  'comida en mal estado → Crítica')
ok(analizarRespuestas({ problema: 'cobro' }).severidad === 'Crítica',
  'error de cobro → Crítica')

console.log('\n2) Severidad por satisfacción')
ok(analizarRespuestas({ problema: 'limpieza', satisfaccion: 1 }).severidad === 'Alta',
  'satisfacción 1 sube a Alta pese a problema Media')
ok(analizarRespuestas({ satisfaccion: 5 }).severidad === 'Baja',
  'satisfacción 5, sin problema grave → Baja')
ok(analizarRespuestas({ satisfaccion: 3 }).severidad === 'Media',
  'satisfacción 3 → Media')

console.log('\n3) Toma siempre la severidad MÁS alta entre las respuestas')
const r = analizarRespuestas({ problema: 'demora', volveria: 'no', satisfaccion: 4 })
ok(r.severidad === 'Alta', 'demora (Alta) + no volvería (Alta) domina sobre satisfacción 4 (Baja)')

console.log('\n4) Puntos críticos derivados de las opciones')
const p = analizarRespuestas({ problema: 'comida', area: 'comida', volveria: 'no' })
ok(p.puntos_criticos.includes('Calidad de comida'), 'incluye el punto del problema')
ok(p.puntos_criticos.includes('Riesgo de pérdida del cliente'), 'incluye el punto de "no volvería"')

console.log('\n5) respuestasATexto arma un mensaje legible con el comentario')
const txt = respuestasATexto({ problema: 'demora', satisfaccion: 2, comentario: 'Esperé 1 hora' })
ok(/demora/i.test(txt) && /2\/5/.test(txt) && /Esperé 1 hora/.test(txt),
  'incluye problema, rating y comentario abierto')

console.log(`\n${fail === 0 ? 'TODO OK' : fail + ' FALLOS'}\n`); process.exit(fail ? 1 : 0)
