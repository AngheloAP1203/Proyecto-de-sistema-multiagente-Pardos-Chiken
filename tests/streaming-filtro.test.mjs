const base = '../src/agents/'
const { crearFiltroDeCifras } = await import(base + 'core/numberGuard.js')

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

// Salidas reales de herramientas: total 588.4, 7 transacciones, ticket 84.06
const results = [{ total: 588.4, transacciones: 7, ticket_promedio: 84.06 }]

// Simula la llegada por tokens, como los envía el modelo
const correr = (texto, trozo = 4) => {
  let emitido = ''
  const f = crearFiltroDeCifras(results, (s) => { emitido += s })
  for (let i = 0; i < texto.length; i += trozo) f.push(texto.slice(i, i + trozo))
  f.flush()
  return { emitido, invento: f.hayInvento }
}

console.log('\n1) Texto con cifras REALES → pasa entero')
let r = correr('Hoy vendimos S/. 588.40 en 7 transacciones, con un ticket de S/. 84.06.')
ok(r.invento === false, 'no marca invención')
ok(r.emitido.includes('588.40') && r.emitido.includes('7 transacciones') && r.emitido.includes('84.06'),
   'las tres cifras respaldadas llegan a pantalla')

console.log('\n2) Monto inventado → NUNCA llega a pantalla')
r = correr('Hoy vendimos S/. 9,999.99 en total.')
ok(r.invento === true, 'marca invención')
ok(!r.emitido.includes('9,999.99') && !r.emitido.includes('9999'), `el monto falso no se emitió (emitido: "${r.emitido.trim()}")`)

console.log('\n3) Conteo inventado → tampoco (la trampa del "7 transacciones")')
r = correr('Tuvimos 158 transacciones hoy.')
ok(r.invento === true, 'marca invención')
ok(!r.emitido.includes('158'), `el conteo falso no se emitió (emitido: "${r.emitido.trim()}")`)

console.log('\n4) El número se retiene hasta conocer la palabra que lo sigue')
r = correr('Tuvimos 7 transacciones.')   // 7 solo es válido junto a "transacciones"
ok(r.invento === false && r.emitido.includes('7 transacciones'), 'conteo respaldado sí pasa')
r = correr('Tuvimos 6 transacciones.')   // 6 no está en results
ok(r.invento === true && !r.emitido.includes('6 transacciones'), 'conteo cercano pero falso, retenido')

console.log('\n5) Sin cifras → fluye igual, sea cual sea el tamaño del token')
for (const t of [1, 3, 9, 50]) {
  const s = correr('¡Hola! ¿En qué te puedo ayudar hoy?', t)
  ok(s.invento === false && s.emitido === '¡Hola! ¿En qué te puedo ayudar hoy?', `trozos de ${t} chars → texto íntegro`)
}


console.log('\n6) Cifras REALES partidas en trozos raros → sin falsos positivos')
for (const t of [1, 2, 3, 5, 7, 11]) {
  const s = correr('El ticket promedio es S/. 84.06 en 7 transacciones.', t)
  ok(s.invento === false, `trozos de ${t}: "84.06" y "7 transacciones" nunca parecen inventados`)
}

console.log('\n7) La mentira se corta aunque venga texto verdadero antes')
const x = correr('Vendimos S/. 588.40 pero tuvimos 158 transacciones y todo bien.')
ok(x.invento === true, 'detecta el conteo falso que viene después')
ok(x.emitido.includes('588.40'), 'lo verdadero anterior sí se emitió')
ok(!x.emitido.includes('158'), 'lo falso nunca llegó a pantalla')


console.log('\n8) Nunca se emiten fragmentos vacíos (turno que solo pide herramientas)')
{
  const vacios = []
  const f = crearFiltroDeCifras(results, (s) => vacios.push(s))
  f.flush()                       // sin contenido: es un turno de tool_calls
  ok(vacios.length === 0, 'flush() sin buffer no emite nada')

  const emit = []
  const g = crearFiltroDeCifras(results, (s) => emit.push(s))
  'Hola mundo bonito'.split('').forEach(c => g.push(c))
  g.flush()
  ok(emit.every(s => s.length > 0), 'ningún fragmento emitido es cadena vacía')
  ok(emit.join('') === 'Hola mundo bonito', 'y el texto llega íntegro')
}

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
