const base = '../src/agents/'
const { cifrasSinRespaldo, crearFiltroDeCifras } = await import(base + 'core/numberGuard.js')

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

// El handoff calculó 11.7%; el sistema reporta 100% de tasa de éxito
const results = [{ participacion_pct: 11.7, total_del_dia: 588.4 }, { tasa_exito_pct: 100 }]

console.log('\n1) Porcentajes inventados → detectados')
ok(cifrasSinRespaldo('Representa aproximadamente el 15% de las unidades', results).includes(15), '"15%" no viene de ninguna tool')
ok(cifrasSinRespaldo('y el 7% de los ingresos totales', results).includes(7), '"7%" tampoco')

console.log('\n2) Porcentajes respaldados → aceptados')
ok(cifrasSinRespaldo('Representa el 11.7% del día', results).length === 0, '"11.7%" lo calculó el handoff en JS')
ok(cifrasSinRespaldo('La tasa de éxito es del 100%', results).length === 0, '"100%" viene del estado del sistema')
ok(cifrasSinRespaldo('Representa el 11,7% del día', results).length === 0, 'acepta la coma decimal')

console.log('\n3) No confunde porcentajes con otras cifras')
ok(cifrasSinRespaldo('Un descuento del 100 % aplicado', results).length === 0, 'espacio antes del % también se lee')
ok(cifrasSinRespaldo('El 2026 fue buen año', results).length === 0, 'un año suelto no es porcentaje')

console.log('\n4) En streaming, un porcentaje inventado no llega a pantalla')
{
  let emitido = ''
  const f = crearFiltroDeCifras(results, s => emitido += s)
  const txt = 'Esto representa aproximadamente el 15% de las unidades vendidas.'
  for (let i=0;i<txt.length;i+=3) f.push(txt.slice(i,i+3))
  f.flush()
  ok(f.hayInvento === true, 'marca invención')
  ok(!emitido.includes('15%'), `"15%" retenido (visto: "${emitido.trim()}")`)
}

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
