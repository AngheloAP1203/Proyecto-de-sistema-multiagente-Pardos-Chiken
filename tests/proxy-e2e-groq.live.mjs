/**
 * E2E REAL del modo proxy: bucle ReAct completo (ProxyChat → /api/llm → Groq)
 * con las herramientas reales del proyecto y datos conocidos. Replica el ciclo
 * del nodo `herramientas` del grafo: invoke → tool_calls → handler → invoke.
 */
const base = '../src/agents/'
const { ProxyChat } = await import(base + 'core/llmClient.js')
const { buildToolsForRole } = await import(base + 'tools/assistantTools.js')
const { verificarCifras } = await import(base + 'core/numberGuard.js')
const { SystemMessage, HumanMessage, ToolMessage } = await import('@langchain/core/messages')

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

const hoy = new Date().toISOString().split('T')[0]
const ctx = { payments: [
  { id:'P1', date: hoy, amount: 110,   method:'tarjeta',  time:'14:30', items:[{name:'1/2 Pardos Brasa', qty:2, subtotal:83.8}] },
  { id:'P2', date: hoy, amount: 478.4, method:'efectivo', time:'15:00', items:[{name:'Chicha', qty:10, subtotal:69}] },
], reservations: [], clients: [], systemStatus: null }

const { tools, handlers, results, agentsUsed } = buildToolsForRole('admin', ctx)
// mismo formato genérico que produce normalizeTools fuera de gemini
const genericas = tools.flatMap(t => t.functionDeclarations).map(d => ({ name: d.name, description: d.description, schema: d.parameters }))

const llm = new ProxyChat({ model: 'llama-3.1-8b-instant', temperature: 0.1, url: 'http://localhost:5174/api/llm' }).bindTools(genericas)

const messages = [
  new SystemMessage(`Eres el asistente del líder de Pardos Chicken. Toda cifra viene de una herramienta. Nunca inventes números.

HOY es ${hoy}. Si el líder pregunta por hoy o no menciona fecha, NO pases el parámetro fecha a las herramientas.`),
  new HumanMessage('¿cuánto vendimos hoy?'),
]

console.log('\n1) Primera vuelta: el modelo pide la herramienta A TRAVÉS DEL PROXY')
let resp = await llm.invoke(messages)
ok(resp.tool_calls?.length > 0, `pidió tool_calls: ${JSON.stringify(resp.tool_calls?.map(c=>c.name))}`)

console.log('\n2) Ejecución real del handler y segunda vuelta')
messages.push(resp)
for (const call of resp.tool_calls) {
  const salida = await handlers[call.name](call.args || {})
  messages.push(new ToolMessage({ content: JSON.stringify(salida), tool_call_id: call.id, name: call.name }))
}
resp = await llm.invoke(messages)
const texto = String(resp.content)
ok(!resp.tool_calls?.length, 'segunda vuelta ya no pide herramientas')
ok(/588\.4/.test(texto), `la cifra final es real: "${texto.slice(0,90)}"`)

console.log('\n3) El verificador acepta la respuesta (todas las cifras con respaldo)')
const v = verificarCifras(texto, results, agentsUsed.size)
ok(v.invento === false, 'ninguna cifra huérfana')

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
