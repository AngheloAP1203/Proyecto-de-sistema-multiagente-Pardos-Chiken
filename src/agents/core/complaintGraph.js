/**
 * src/agents/core/complaintGraph.js
 * ─────────────────────────────────────────────────────────────────────────────
 * StateGraph de LangGraph.js para el flujo de quejas y resolución.
 *
 * Modela: triaje (M1) → buscar mesa + verificar pago → notificar mesero →
 *         acción del mesero → propuesta RAG (si aplica) → fin.
 *
 * Usa los agentes existentes como nodos del grafo (no los reemplaza).
 * ─────────────────────────────────────────────────────────────────────────────
 */

let StateGraph, Annotation, END

const _langGraphReady = import('@langchain/langgraph')
  .then((mod) => {
    StateGraph = mod.StateGraph
    Annotation = mod.Annotation
    END = mod.END
    return true
  })
  .catch((e) => {
    console.warn('[complaintGraph] LangGraph no disponible, usando flujo imperativo:', e.message)
    return false
  })

// ── Estado del grafo ────────────────────────────────────────────────────────

function createGraphState() {
  return Annotation.Root({
    mensaje:        Annotation({ reducer: (_, v) => v, default: () => '' }),
    canal:          Annotation({ reducer: (_, v) => v, default: () => 'WhatsApp' }),
    cliente:        Annotation({ reducer: (_, v) => v, default: () => '' }),
    dni:            Annotation({ reducer: (_, v) => v, default: () => '' }),
    tableId:        Annotation({ reducer: (_, v) => v, default: () => null }),
    triageResult:   Annotation({ reducer: (_, v) => v, default: () => null }),
    complaint:      Annotation({ reducer: (_, v) => v, default: () => null }),
    resolution:     Annotation({ reducer: (_, v) => v, default: () => null }),
    notification:   Annotation({ reducer: (_, v) => v, default: () => null }),
    escalated:      Annotation({ reducer: (_, v) => v, default: () => false }),
    error:          Annotation({ reducer: (_, v) => v, default: () => null }),
  })
}

// ── Nodos del grafo ─────────────────────────────────────────────────────────

function createNodes(orchestrator) {
  return {
    async triaje(state) {
      try {
        const result = await orchestrator.triageComplaint({
          mensaje: state.mensaje,
          canal: state.canal,
          cliente: state.cliente,
          dni: state.dni,
        })
        if (!result.success) return { error: result.error }
        return {
          triageResult: result,
          complaint: result.result,
          escalated: result.escalated || false,
          tableId: result.result?.tableId || state.tableId,
        }
      } catch (e) {
        return { error: e.message }
      }
    },

    async resolveComplaint(state) {
      if (!state.complaint?.id) return { error: 'No hay queja para resolver' }
      try {
        const result = await orchestrator.resolveComplaint({
          complaintId: state.complaint.id,
          tableId: state.tableId,
        })
        if (!result.success) return { error: result.error }
        return {
          resolution: result.result,
          notification: result.notification,
        }
      } catch (e) {
        return { error: e.message }
      }
    },
  }
}

// ── Edges condicionales ─────────────────────────────────────────────────────

function routeAfterTriage(state) {
  if (state.error) return '__end__'
  return 'resolveComplaint'
}

// ── Compilar el grafo ───────────────────────────────────────────────────────

export async function createComplaintGraph(orchestrator) {
  const ready = await _langGraphReady
  if (!ready) return null

  const GraphState = createGraphState()
  const nodes = createNodes(orchestrator)

  const graph = new StateGraph(GraphState)
    .addNode('triaje', nodes.triaje)
    .addNode('resolveComplaint', nodes.resolveComplaint)
    .addEdge('__start__', 'triaje')
    .addConditionalEdges('triaje', routeAfterTriage)
    .addEdge('resolveComplaint', '__end__')

  return graph.compile()
}

// ── Flujo imperativo (fallback si LangGraph no está disponible) ─────────────

export async function runComplaintFlowImperative(orchestrator, data) {
  const triageResult = await orchestrator.triageComplaint(data)
  if (!triageResult.success) return triageResult

  const resolutionResult = await orchestrator.resolveComplaint({
    complaintId: triageResult.result.id,
    tableId: data.tableId || triageResult.result.tableId,
  })

  return {
    success: true,
    triage: triageResult,
    resolution: resolutionResult.success ? resolutionResult : null,
    escalated: triageResult.escalated || false,
  }
}

// ── API pública ─────────────────────────────────────────────────────────────

let _compiledGraph = null

export async function getComplaintGraph(orchestrator) {
  if (_compiledGraph) return _compiledGraph
  _compiledGraph = await createComplaintGraph(orchestrator)
  return _compiledGraph
}

export async function runComplaintFlow(orchestrator, data) {
  const graph = await getComplaintGraph(orchestrator)
  if (graph) {
    try {
      const result = await graph.invoke({
        mensaje: data.mensaje,
        canal: data.canal || 'WhatsApp',
        cliente: data.cliente || '',
        dni: data.dni || '',
        tableId: data.tableId || null,
      })
      return {
        success: !result.error,
        error: result.error || null,
        triage: result.triageResult,
        complaint: result.complaint,
        resolution: result.resolution,
        notification: result.notification,
        escalated: result.escalated,
      }
    } catch (e) {
      console.warn('[complaintGraph] Error en grafo, fallback imperativo:', e.message)
    }
  }
  return runComplaintFlowImperative(orchestrator, data)
}

export default { runComplaintFlow, getComplaintGraph, createComplaintGraph }
