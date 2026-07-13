import { analizarRespuestas, respuestasATexto } from '../src/domain/complaints/questionnaire.js'

let fail = 0
const ok = (c, l) => { console.log(`${c ? '  PASS' : '  FALL'}  ${l}`); if (!c) fail++ }

console.log('\n1) Reglas Crítica (comida en mal estado / error de cobro)')
ok(analizarRespuestas({ categoria: 'comida', detalle_comida: 'contaminado' }).severidad === 'Crítica',
  'comida contaminada → Crítica')
ok(analizarRespuestas({ categoria: 'cobro' }).severidad === 'Crítica',
  'cualquier problema de cobro (por categoría principal o detalle) → Crítica')

console.log('\n2) Severidad por satisfacción')
ok(analizarRespuestas({ satisfaccion: 1 }).severidad === 'Crítica',
  'satisfacción 1 sube a Crítica')
ok(analizarRespuestas({ satisfaccion: 2 }).severidad === 'Alta',
  'satisfacción 2 sube a Alta')
ok(analizarRespuestas({ satisfaccion: 5 }).severidad === 'Baja',
  'satisfacción 5, sin problema grave → Baja')
ok(analizarRespuestas({ satisfaccion: 3 }).severidad === 'Media',
  'satisfacción 3 → Media')

console.log('\n3) Toma siempre la severidad MÁS alta entre las respuestas')
const r = analizarRespuestas({ categoria: 'ambiente', impacto: 'arruino', satisfaccion: 4 })
ok(r.severidad === 'Crítica', 'impacto arruinó (Crítica) domina sobre satisfacción 4 (Baja)')

console.log('\n4) Puntos críticos derivados de las opciones')
const p = analizarRespuestas({ categoria: 'comida', detalle_comida: 'fria', volveria: 'no' })
ok(p.puntos_criticos.includes('Comida fría'), 'incluye el punto de comida fria')
ok(p.puntos_criticos.includes('Riesgo de pérdida del cliente'), 'incluye el punto de retorno no')

console.log('\n5) respuestasATexto arma un mensaje legible con el comentario')
const txt = respuestasATexto({ categoria: 'tiempos', satisfaccion: 2, comentario: 'Esperé 1 hora' })
console.log('TXT:', txt)
ok(/Demora/i.test(txt) && /2\/5/.test(txt) && /Esperé 1 hora/.test(txt),
  'incluye categoría, rating y comentario abierto')

console.log(`\n${fail === 0 ? 'TODO OK' : fail + ' FALLOS'}\n`); process.exit(fail ? 1 : 0)
