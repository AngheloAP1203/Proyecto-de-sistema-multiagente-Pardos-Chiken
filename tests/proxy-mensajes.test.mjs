const base = '../src/agents/'
const { toOpenAIMessages } = await import(base + 'core/llmClient.js')
const { SystemMessage, HumanMessage, AIMessage, ToolMessage } = await import('@langchain/core/messages')

let fail = 0
const ok = (c, l) => { console.log(`${c?'  PASS':'  FALL'}  ${l}`); if(!c) fail++ }

console.log('\nConversión LangChain → OpenAI (lo que viaja al proxy)')
const msgs = toOpenAIMessages([
  new SystemMessage('Eres el asistente.'),
  new HumanMessage('¿cuánto vendimos?'),
  new AIMessage({ content: '', tool_calls: [{ id:'c1', name:'read_sales_summary', args:{ fecha:'2026-07-10' } }] }),
  new ToolMessage({ content: '{"total":588.4}', tool_call_id: 'c1', name: 'read_sales_summary' }),
  new AIMessage({ content: 'Vendimos S/. 588.40' }),
])
ok(msgs[0].role === 'system' && msgs[0].content === 'Eres el asistente.', 'system')
ok(msgs[1].role === 'user', 'human → user')
ok(msgs[2].role === 'assistant' && msgs[2].tool_calls?.[0]?.function?.name === 'read_sales_summary', 'ai con tool_calls')
ok(msgs[2].tool_calls[0].function.arguments === '{"fecha":"2026-07-10"}', 'args serializados como string JSON')
ok(msgs[2].tool_calls[0].id === 'c1', 'conserva el id')
ok(msgs[3].role === 'tool' && msgs[3].tool_call_id === 'c1', 'tool con su tool_call_id')
ok(msgs[4].role === 'assistant' && msgs[4].content === 'Vendimos S/. 588.40' && !msgs[4].tool_calls, 'ai de solo texto, sin tool_calls')

const sinTc = toOpenAIMessages([ new AIMessage({ content: 'hola', tool_calls: [] }) ])
ok(!('tool_calls' in sinTc[0]), 'tool_calls vacío no se envía (Groq lo rechaza)')

console.log(`\n${fail===0?'TODO OK':fail+' FALLOS'}\n`); process.exit(fail?1:0)
