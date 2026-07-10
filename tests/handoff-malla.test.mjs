const base = '../src/agents/'
const { necesitaHandoffACaja } = await import(base + 'core/assistantGraph.js')

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

console.log('\n1) DISPARADOR — el handoff depende del dato, no del prompt')
ok(necesitaHandoffACaja({ role:'admin',  toolsLlamadas:['read_top_items'], handoffsHechos:[] }) === true,
   'cocina consultada → cede a caja')
ok(necesitaHandoffACaja({ role:'admin',  toolsLlamadas:['read_sales_summary','read_top_items'], handoffsHechos:[] }) === true,
   'funciona aunque el modelo agrupe ambas tools en una vuelta')
ok(necesitaHandoffACaja({ role:'cajero', toolsLlamadas:['read_top_items'], handoffsHechos:[] }) === true,
   'cajero también tiene ambos dominios')

console.log('\n2) NO se dispara')
ok(necesitaHandoffACaja({ role:'admin', toolsLlamadas:['read_sales_summary'], handoffsHechos:[] }) === false,
   'sin consultar cocina, no hay nada que cruzar')
ok(necesitaHandoffACaja({ role:'admin', toolsLlamadas:['read_top_items'], handoffsHechos:['KitchenAgent→CashAgent'] }) === false,
   'no se repite: corta el bucle de handoffs')
ok(necesitaHandoffACaja({ role:'admin', toolsLlamadas:[], handoffsHechos:[] }) === false,
   'sin tools ejecutadas')

console.log('\n3) SEGURIDAD — el handoff jamás elude el rol')
ok(necesitaHandoffACaja({ role:'hostess', toolsLlamadas:['read_top_items'], handoffsHechos:[] }) === false,
   'hostess no tiene ventas → sin handoff')
ok(necesitaHandoffACaja({ role:'mozo', toolsLlamadas:['read_top_items'], handoffsHechos:[] }) === false,
   'mozo sin permisos → sin handoff')

// El cruce de dominios (calcularParticipacion) se prueba en periodo.mjs

console.log(`
${fail===0?'TODO OK':fail+' FALLOS'}
`); process.exit(fail?1:0)
