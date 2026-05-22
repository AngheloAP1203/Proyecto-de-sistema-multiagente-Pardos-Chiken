/**
 * src/tests/agentBenchmark.js
 * ─────────────────────────────────────────────────────────────────────────────
 * BENCHMARK Y PRUEBAS AUTOMATIZADAS DEL SISTEMA MULTIAGENTE
 *
 * Ejecuta una batería de casos de prueba contra los agentes del sistema y
 * genera un reporte con métricas cuantitativas:
 *   · Latencia promedio por agente (ms)
 *   · Tasa de éxito (%)
 *   · Token usage estimado
 *   · Resultados por caso (happy path, adversarial, edge case)
 *
 * CÓMO EJECUTAR (desde el Dashboard, tab "Monitoreo"):
 *   import { runBenchmark } from './tests/agentBenchmark.js'
 *   const report = await runBenchmark(orchestrator)
 *   console.table(report.summary)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Casos de prueba por agente ─────────────────────────────────────────────────

/**
 * Genera los casos de prueba del benchmark.
 * @returns {Array<{ id, category, agentName, toolName, params, expectSuccess, description }>}
 */
export function getTestCases() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 2)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  return [
    // ── HAPPY PATH — Flujos normales ─────────────────────────────────────────
    {
      id: 'HP-01',
      category: 'happy_path',
      agentName: 'ReservationAgent',
      toolName: 'validate_reservation',
      params: { date: tomorrowStr, time: '13:00', guests: 3, tableCapacity: 4, source: 'internal' },
      expectSuccess: true,
      description: 'Validar reserva en horario y capacidad válidos',
    },
    {
      id: 'HP-02',
      category: 'happy_path',
      agentName: 'ReservationAgent',
      toolName: 'validate_reservation',
      params: { date: tomorrowStr, time: '20:00', guests: 1, tableCapacity: 2, source: 'internal' },
      expectSuccess: true,
      description: 'Reserva nocturna válida (dentro de 21:30)',
    },
    {
      id: 'HP-03',
      category: 'happy_path',
      agentName: 'CashAgent',
      toolName: 'validate_payment',
      params: { amount: 150.00, method: 'card', reservationId: 'RES-001' },
      expectSuccess: true,
      description: 'Validar pago con tarjeta — monto válido',
    },

    // ── ADVERSARIAL — Entradas maliciosas/inválidas ──────────────────────────
    {
      id: 'ADV-01',
      category: 'adversarial',
      agentName: 'ReservationAgent',
      toolName: 'validate_reservation',
      params: { date: yesterdayStr, time: '14:00', guests: 2, tableCapacity: 4, source: 'internal' },
      expectSuccess: false,
      description: '[ADVERSARIAL] Fecha en el pasado — debe rechazar',
    },
    {
      id: 'ADV-02',
      category: 'adversarial',
      agentName: 'ReservationAgent',
      toolName: 'validate_reservation',
      params: { date: tomorrowStr, time: '23:00', guests: 2, tableCapacity: 4, source: 'internal' },
      expectSuccess: false,
      description: '[ADVERSARIAL] Hora fuera de horario (23:00) — debe rechazar',
    },
    {
      id: 'ADV-03',
      category: 'adversarial',
      agentName: 'ReservationAgent',
      toolName: 'validate_reservation',
      params: { date: tomorrowStr, time: '14:00', guests: 8, tableCapacity: 2, source: 'internal' },
      expectSuccess: false,
      description: '[ADVERSARIAL] Capacidad insuficiente (8 personas, mesa para 2) — debe rechazar',
    },
    {
      id: 'ADV-04',
      category: 'adversarial',
      agentName: 'ReservationAgent',
      toolName: 'validate_reservation',
      params: { date: tomorrowStr, time: '14:00', guests: 25, tableCapacity: 30, source: 'internal' },
      expectSuccess: false,
      description: '[ADVERSARIAL] Más de 20 personas (límite del sistema) — debe rechazar',
    },
    {
      id: 'ADV-05',
      category: 'adversarial',
      agentName: 'CashAgent',
      toolName: 'validate_payment',
      params: { amount: -50, method: 'cash', reservationId: 'RES-001' },
      expectSuccess: false,
      description: '[ADVERSARIAL] Monto negativo — debe rechazar',
    },
    {
      id: 'ADV-06',
      category: 'adversarial',
      agentName: 'CashAgent',
      toolName: 'validate_payment',
      params: { amount: 0, method: 'cash', reservationId: 'RES-001' },
      expectSuccess: false,
      description: '[ADVERSARIAL] Monto cero — debe rechazar',
    },

    // ── EDGE CASES — Límites exactos ─────────────────────────────────────────
    {
      id: 'EDGE-01',
      category: 'edge_case',
      agentName: 'ReservationAgent',
      toolName: 'validate_reservation',
      params: { date: tomorrowStr, time: '21:30', guests: 1, tableCapacity: 2, source: 'internal' },
      expectSuccess: true,
      description: '[EDGE] Última hora permitida exacta (21:30) — debe aceptar',
    },
    {
      id: 'EDGE-02',
      category: 'adversarial',
      agentName: 'ReservationAgent',
      toolName: 'validate_reservation',
      params: { date: tomorrowStr, time: '21:31', guests: 1, tableCapacity: 2, source: 'internal' },
      expectSuccess: false,
      description: '[EDGE] Un minuto después del límite (21:31) — debe rechazar',
    },
    {
      id: 'EDGE-03',
      category: 'edge_case',
      agentName: 'ReservationAgent',
      toolName: 'validate_reservation',
      params: { date: tomorrowStr, time: '11:00', guests: 1, tableCapacity: 2, source: 'internal' },
      expectSuccess: true,
      description: '[EDGE] Primera hora de apertura exacta (11:00) — debe aceptar',
    },
    {
      id: 'EDGE-04',
      category: 'edge_case',
      agentName: 'ReservationAgent',
      toolName: 'validate_reservation',
      params: { date: tomorrowStr, time: '14:00', guests: 20, tableCapacity: 20, source: 'internal' },
      expectSuccess: true,
      description: '[EDGE] Máximo exacto de personas (20) — debe aceptar',
    },
  ]
}

// ── Motor de benchmark ────────────────────────────────────────────────────────

/**
 * runBenchmark — Ejecuta todos los casos de prueba y genera un reporte.
 * @param {AgentOrchestratorClass} orchestrator - Instancia del orquestador
 * @returns {Promise<BenchmarkReport>}
 */
export async function runBenchmark(orchestrator) {
  const testCases = getTestCases()
  const results   = []

  console.log(`\n${'─'.repeat(60)}`)
  console.log('🧪 PARDOS CHICKEN — BENCHMARK DE AGENTES MULTIAGENTE')
  console.log(`${'─'.repeat(60)}`)
  console.log(`Ejecutando ${testCases.length} casos de prueba...\n`)

  for (const tc of testCases) {
    const startTime = performance.now()

    // Ejecutar el caso de prueba
    const response = await orchestrator.delegate(tc.agentName, tc.toolName, tc.params)

    const latency  = Math.round(performance.now() - startTime)
    const passed   = tc.expectSuccess
      ? response.success === true
      : response.success === false

    const result = {
      ...tc,
      latency,
      actualSuccess: response.success,
      passed,
      status: passed ? '✅ PASS' : '❌ FAIL',
      error: response.error || null,
    }

    results.push(result)

    // Log en tiempo real
    console.log(
      `${result.status} [${tc.id}] ${tc.description}\n` +
      `         Latencia: ${latency}ms | Esperado: success=${tc.expectSuccess} | Obtenido: success=${response.success}`
    )
  }

  // ── Generar reporte de métricas ───────────────────────────────────────────
  const totalTests   = results.length
  const passedTests  = results.filter(r => r.passed).length
  const failedTests  = totalTests - passedTests
  const successRate  = ((passedTests / totalTests) * 100).toFixed(1)
  const avgLatency   = Math.round(results.reduce((s, r) => s + r.latency, 0) / totalTests)
  const maxLatency   = Math.max(...results.map(r => r.latency))
  const minLatency   = Math.min(...results.map(r => r.latency))

  // Por categoría
  const byCategory = ['happy_path', 'adversarial', 'edge_case'].reduce((acc, cat) => {
    const catResults = results.filter(r => r.category === cat)
    acc[cat] = {
      total:      catResults.length,
      passed:     catResults.filter(r => r.passed).length,
      successRate: catResults.length > 0
        ? ((catResults.filter(r => r.passed).length / catResults.length) * 100).toFixed(1)
        : 'N/A',
      avgLatency: catResults.length > 0
        ? Math.round(catResults.reduce((s, r) => s + r.latency, 0) / catResults.length)
        : 0,
    }
    return acc
  }, {})

  // Por agente
  const agentNames = [...new Set(results.map(r => r.agentName))]
  const byAgent = agentNames.reduce((acc, name) => {
    const agentResults = results.filter(r => r.agentName === name)
    acc[name] = {
      total:      agentResults.length,
      passed:     agentResults.filter(r => r.passed).length,
      successRate: ((agentResults.filter(r => r.passed).length / agentResults.length) * 100).toFixed(1),
      avgLatency: Math.round(agentResults.reduce((s, r) => s + r.latency, 0) / agentResults.length),
    }
    return acc
  }, {})

  // Métricas del sistema (si orchestrator provee getSystemStatus)
  let systemMetrics = null
  try {
    systemMetrics = orchestrator.getSystemStatus()
  } catch (_) { /* puede no estar disponible en contexto de test */ }

  const report = {
    timestamp:   new Date().toISOString(),
    summary: {
      totalTests,
      passedTests,
      failedTests,
      successRate:     `${successRate}%`,
      avgLatency:      `${avgLatency}ms`,
      maxLatency:      `${maxLatency}ms`,
      minLatency:      `${minLatency}ms`,
    },
    byCategory,
    byAgent,
    systemMetrics,
    results,
  }

  // ── Imprimir resumen ──────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`)
  console.log('📊 RESUMEN DEL BENCHMARK')
  console.log(`${'─'.repeat(60)}`)
  console.log(`Total de pruebas : ${totalTests}`)
  console.log(`Pruebas pasadas  : ${passedTests} ✅`)
  console.log(`Pruebas fallidas : ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`)
  console.log(`Tasa de éxito    : ${successRate}%`)
  console.log(`Latencia promedio: ${avgLatency}ms`)
  console.log(`Latencia máx/mín : ${maxLatency}ms / ${minLatency}ms`)
  console.log('\n📋 Por categoría:')
  console.table(byCategory)
  console.log('\n🤖 Por agente:')
  console.table(byAgent)

  if (systemMetrics) {
    const { orchestrator: orch } = systemMetrics
    console.log('\n⚡ Métricas del sistema:')
    console.log(`  Swarms ejecutados  : ${orch.swarmExecutions}`)
    console.log(`  Orquestaciones tot.: ${orch.totalOrchestrations}`)
    console.log(`  Tokens estimados   : ${orch.totalTokens}`)
  }

  console.log(`\n${'─'.repeat(60)}\n`)

  return report
}

/**
 * runQuickSanity — Ejecuta solo happy path para verificación rápida.
 * Útil para confirmar que el sistema funciona antes de la demo.
 */
export async function runQuickSanity(orchestrator) {
  const happyPath = getTestCases().filter(tc => tc.category === 'happy_path')
  const results   = []

  for (const tc of happyPath) {
    const t0  = performance.now()
    const res = await orchestrator.delegate(tc.agentName, tc.toolName, tc.params)
    results.push({ id: tc.id, passed: res.success === tc.expectSuccess, latency: Math.round(performance.now() - t0) })
  }

  const allPassed = results.every(r => r.passed)
  console.log(`[SANITY] ${allPassed ? '✅ SISTEMA OK' : '❌ FALLA DETECTADA'} — ${results.length} casos verificados`)
  return { allPassed, results }
}
