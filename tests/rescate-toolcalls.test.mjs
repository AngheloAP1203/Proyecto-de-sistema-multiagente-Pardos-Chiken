const base = '../src/agents/'
const { normalizarToolCalls } = await import(base + 'core/assistantGraph.js')

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

console.log('\nRescate de tool_calls perdidas en streaming')
ok(normalizarToolCalls({ tool_calls: [{ name:'read_sales_summary', args:{fecha:'2026-07-10'} }] })[0].args.fecha === '2026-07-10',
   'si tool_calls ya viene bien, se respeta tal cual')

// El caso observado en Groq: args = "null" → LangChain lo descarta
let r = normalizarToolCalls({ tool_calls: [], tool_call_chunks: [{ name:'read_sales_summary', args:'null', id:'a1' }] })
ok(r.length === 1 && r[0].name === 'read_sales_summary', 'args:"null" → la llamada se rescata')
ok(JSON.stringify(r[0].args) === '{}', 'y los argumentos quedan en {}')
ok(r[0].id === 'a1', 'conserva el id, necesario para casar con el ToolMessage')

r = normalizarToolCalls({ tool_call_chunks: [{ name:'read_top_items', args:'{"top_n":3}' }] })
ok(r[0].args.top_n === 3, 'args JSON válidos se parsean')

r = normalizarToolCalls({ tool_call_chunks: [{ name:'read_top_items', args:'' }] })
ok(JSON.stringify(r[0].args) === '{}', 'args vacíos → {}')

r = normalizarToolCalls({ tool_call_chunks: [{ name:'read_top_items', args:'{roto' }] })
ok(JSON.stringify(r[0].args) === '{}', 'args malformados → {} (la tool usa sus defaults)')

r = normalizarToolCalls({ tool_call_chunks: [{ args:'{}' }] })
ok(r.length === 0, 'chunk sin nombre → se ignora')

ok(normalizarToolCalls(null).length === 0, 'mensaje nulo → sin llamadas')
ok(normalizarToolCalls({ content:'hola' }).length === 0, 'respuesta de solo texto → sin llamadas')

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
