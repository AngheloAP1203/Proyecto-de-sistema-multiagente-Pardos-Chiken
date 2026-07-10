function esperaSugerida(err) {
  const texto = String(err?.message || '')
  const m = texto.match(/try again in (?:(\d+)m)?([\d.]+)\s*s/i) || texto.match(/retryDelay"\s*:\s*"(\d+)s/i)
  if (!m) return null
  const segundos = m.length === 3 ? (parseInt(m[1]||0,10)*60) + parseFloat(m[2]) : parseFloat(m[1])
  return Number.isFinite(segundos) ? Math.ceil(segundos*1000)+300 : null
}
const MAX = 8000
const decision = ms => ms == null ? 'backoff ciego' : (ms > MAX ? 'DEGRADA YA' : `espera ${ms}ms`)
const casos = [
  ['Groq TPM 8B',  'Limit 6000, Used 4354. Please try again in 6.6s. Need more tokens?', 6900],
  ['Groq TPD 70B', 'tokens per day (TPD): Limit 100000. Please try again in 26m41.856s.', 1602156],
  ['Groq TPM 70B', 'Please try again in 4.274999999s.', 4575],
  ['Gemini 429',   '[429] quota... {"@type":"RetryInfo","retryDelay":"48s"}', 48300],
  ['sin dato',     'Internal server error', null],
]
let fail=0
for (const [n,msg,esp] of casos) { const r = esperaSugerida({message:msg}); const ok = r===esp
  console.log(`${ok?'  PASS':'  FALL'}  ${n.padEnd(13)} → ${String(r).padStart(8)}ms  ⇒ ${decision(r)}`); if(!ok) fail++ }
console.log(fail? `\n${fail} FALLOS` : '\nTODO OK'); process.exit(fail?1:0)
