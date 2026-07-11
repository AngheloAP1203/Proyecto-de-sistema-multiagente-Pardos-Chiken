/**
 * src/agents/core/assistantGraph.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Grafo del Asistente IA (LangGraph) — supervisor con malla de handoffs.
 *
 * TOPOLOGÍA:
 *
 *        START
 *          │
 *          ▼
 *      ┌────────┐  tool_calls   ┌──────────────┐
 *      │ agente │──────────────▶│ herramientas │
 *      └────────┘◀──────────────└──────┬───────┘
 *          │  ▲                        │ handoff (sin pasar por el supervisor)
 *          │  │ reintento estricto     ▼
 *          │  │                  ┌──────────┐
 *          │  └──────────────────│   caja   │
 *          ▼                     └──────────┘
 *    ┌─────────────┐
 *    │ verificador │──▶ END  (o marca degraded)
 *    └─────────────┘
 *
 * POR QUÉ UNA MALLA Y NO SOLO UN SUPERVISOR:
 *   Cuando KitchenAgent obtiene el plato estrella, necesita el total del día
 *   —dato de otro dominio— para saber qué porcentaje representa. En vez de
 *   devolver el control al supervisor y gastar otra llamada al LLM, el nodo
 *   `herramientas` cede el control a `caja` (CashAgent) con
 *   Command({ goto: 'caja' }). El cruce se calcula en JS y vuelve al supervisor
 *   ya resuelto. El modelo solo lo narra: tiene prohibido hacer aritmética.
 *
 *   El disparador es el DATO, no el texto del prompt: una regla basada en las
 *   palabras del líder resultó inalcanzable, porque los modelos piden todas las
 *   herramientas en la misma vuelta y el handoff nunca llegaba a evaluarse.
 *
 * POR QUÉ SIGUE HABIENDO UN SUPERVISOR:
 *   La frontera con el usuario necesita un único punto de entrada y salida donde
 *   vivan el guardrail y el filtro por rol. Una malla pura repartiría esa
 *   responsabilidad entre todos los nodos: nueve puertas en vez de una.
 *
 * El grafo es OPCIONAL. Si LangGraph no carga, `createAssistantGraph` devuelve
 * null y AssistantAgent usa el camino directo (completeWithTools).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getChatModel } from './llmClient.js'
import { verificarCifras, crearFiltroDeCifras } from './numberGuard.js'
import { buildToolsForRole, TOOL_REGISTRY } from '../tools/assistantTools.js'

const RECURSION_LIMIT = 12   // corta bucles de handoffs: lanza GraphRecursionError
const TEMP_NORMAL     = 0.3
const TEMP_ESTRICTA   = 0.1

const REFUERZO =
  'OBLIGATORIO: no escribas ninguna cifra que no te haya devuelto una herramienta. ' +
  'No sumes, no cuentes elementos de una lista, no recalcules promedios.'

// ── Carga perezosa de LangGraph (el grafo es opcional) ───────────────────────

let _lg = null
const langGraph = () => (_lg ??= import('@langchain/langgraph').catch((e) => {
  console.warn('[assistantGraph] LangGraph no disponible, se usará el camino directo:', e.message)
  return null
}))

// ── Regla de handoff KitchenAgent → CashAgent ────────────────────────────────

/**
 * ¿KitchenAgent debe ceder el control a CashAgent?
 *
 * El disparador es el DATO, no el texto del prompt. Una regla basada en las
 * palabras del líder es inalcanzable: los modelos piden varias herramientas en
 * la misma vuelta, así que cuando este nodo evalúa, cocina y caja ya corrieron.
 *
 * Aquí, en cambio, KitchenAgent acaba de obtener el plato estrella y necesita el
 * total del día —que vive en otro dominio— para saber qué porcentaje representa.
 * El supervisor no puede anticiparlo: no conoce el plato hasta que la
 * herramienta responde. Y no puede calcularlo: tiene prohibido hacer aritmética.
 *
 * El permiso se comprueba también aquí: un handoff jamás elude el rol.
 */
export function necesitaHandoffACaja({ role, toolsLlamadas, handoffsHechos }) {
  if (!toolsLlamadas.includes('read_top_items')) return false
  if (handoffsHechos.length > 0) return false
  return TOOL_REGISTRY.read_sales_summary.roles.includes(role)
}

/**
 * Participación del plato estrella en las ventas del día. JS puro, no el LLM.
 *
 * Devuelve null si los dos dominios no hablan del mismo período. `read_top_items`
 * amplía el rango al histórico cuando el día pedido tiene pocos pagos; dividir
 * esos ingresos entre el total de hoy da un porcentaje sin ningún significado
 * (observado: 39.9%, cruzando 234.60 histórico con 588.40 de hoy).
 */
export function calcularParticipacion(topItems, ventas) {
  const estrella = topItems?.items?.find(i => i.nombre !== 'Otros')
  if (!estrella || !ventas?.total) return null
  if (!topItems.es_del_dia) return null
  if (topItems.fecha_solicitada !== ventas.fecha) return null

  return {
    fecha: ventas.fecha,
    plato_estrella: estrella.nombre,
    unidades: estrella.unidades,
    ingresos_del_plato: estrella.ingresos,
    total_del_dia: ventas.total,
    participacion_pct: Math.round((estrella.ingresos / ventas.total) * 1000) / 10,
  }
}

/**
 * normalizarToolCalls — Rescata las llamadas a herramientas de un mensaje que
 * llegó por streaming.
 *
 * `tool_calls` puede venir vacío aunque el modelo sí pidiera una herramienta:
 * Groq envía `args: "null"` cuando la tool no lleva parámetros, y el parser de
 * LangChain lo descarta. Aquí `null`, `""` y `"null"` se tratan como `{}`.
 */
export function normalizarToolCalls(mensaje) {
  if (mensaje?.tool_calls?.length) return mensaje.tool_calls

  return (mensaje?.tool_call_chunks || [])
    .filter(c => c.name)
    .map(c => {
      let args = {}
      try {
        const parseado = JSON.parse(c.args || '{}')
        if (parseado && typeof parseado === 'object') args = parseado
      } catch { /* argumentos malformados: la tool corre con sus defaults */ }
      return { name: c.name, args, id: c.id || c.name, type: 'tool_call' }
    })
}

// ── Construcción del grafo ───────────────────────────────────────────────────

/**
 * createAssistantGraph — Compila el grafo para un rol y un contexto concretos.
 * Devuelve `{ invoke }` o null si LangGraph no está disponible.
 */
export async function createAssistantGraph({ role, contextData, systemPrompt, onToken, onReset, model }) {
  const mod = await langGraph()
  if (!mod) return null

  const { StateGraph, Annotation, Command, START, END } = mod
  const { tools, handlers, emitted, results, agentsUsed, isEmpty } = buildToolsForRole(role, contextData)
  if (isEmpty) return null

  const modelo = await getChatModel({ tools, temperature: TEMP_NORMAL, model })
  if (!modelo) return null

  const modeloEstricto = await getChatModel({ tools, temperature: TEMP_ESTRICTA, model })

  const reemplazar = (_, v) => v
  const concatenar = (a, b) => [...(a || []), ...(b || [])]

  const Estado = Annotation.Root({
    prompt:        Annotation({ reducer: reemplazar, default: () => '' }),
    messages:      Annotation({ reducer: concatenar, default: () => [] }),
    toolsLlamadas: Annotation({ reducer: concatenar, default: () => [] }),
    handoffs:      Annotation({ reducer: concatenar, default: () => [] }),
    estricto:      Annotation({ reducer: reemplazar, default: () => false }),
    texto:         Annotation({ reducer: reemplazar, default: () => '' }),
    degraded:      Annotation({ reducer: reemplazar, default: () => false }),
    sinRespaldo:   Annotation({ reducer: reemplazar, default: () => [] }),
  })

  // ── Nodo supervisor: única llamada al LLM del ciclo ────────────────────────
  async function agente(state) {
    const llm = state.estricto ? modeloEstricto : modelo
    const respuesta = onToken
      ? await invocarConStreaming(llm, state.messages)
      : await llm.invoke(state.messages)

    if (respuesta.tool_calls?.length) {
      return new Command({ goto: 'herramientas', update: { messages: [respuesta] } })
    }

    const texto = typeof respuesta.content === 'string'
      ? respuesta.content
      : JSON.stringify(respuesta.content)

    return new Command({ goto: 'verificador', update: { messages: [respuesta], texto } })
  }

  /**
   * Transmite la respuesta token a token, filtrando las cifras.
   *
   * El filtro retiene cada número hasta poder rastrearlo a una herramienta, así
   * que una cifra inventada NUNCA llega a la pantalla del líder. En los turnos
   * que solo piden herramientas no hay contenido que emitir, y no se emite nada.
   */
  async function invocarConStreaming(llm, messages) {
    const { AIMessage } = await import('@langchain/core/messages')
    const filtro = crearFiltroDeCifras(results, onToken)
    let acumulado = null

    for await (const chunk of await llm.stream(messages)) {
      acumulado = acumulado ? acumulado.concat(chunk) : chunk
      const delta = typeof chunk.content === 'string' ? chunk.content : ''
      if (delta) filtro.push(delta)
    }
    filtro.flush()

    // Groq manda `args: "null"` en las tools sin parámetros. Al concatenar los
    // chunks, LangChain lo considera inválido y `tool_calls` queda VACÍO: la
    // llamada a la herramienta se perdería en silencio y el modelo respondería
    // sin datos. Reconstruimos las tool_calls a partir de los chunks crudos.
    const llamadas = normalizarToolCalls(acumulado)
    if (llamadas.length > 0 && !acumulado.tool_calls?.length) {
      return new AIMessage({ content: acumulado.content ?? '', tool_calls: llamadas })
    }
    return acumulado
  }

  // ── Nodo de herramientas (CashAgent, ReservationAgent, ClientAgent…) ───────
  async function herramientas(state) {
    const { ToolMessage } = await import('@langchain/core/messages')
    const ultima = state.messages[state.messages.length - 1]
    const nuevas = []
    const llamadas = []

    for (const call of ultima.tool_calls || []) {
      let salida
      try {
        const handler = handlers[call.name]
        // Un modelo puede inventar el nombre de una tool que su rol no tiene.
        salida = handler
          ? await handler(call.args || {})
          : { error: `La herramienta "${call.name}" no existe o no está permitida para tu rol.` }
      } catch (e) {
        salida = { error: e.message }
      }
      if (handlers[call.name]) llamadas.push(call.name)
      nuevas.push(new ToolMessage({
        content: JSON.stringify(salida),
        tool_call_id: call.id || call.name,
        name: call.name,
      }))
    }

    const yaLlamadas = [...state.toolsLlamadas, ...llamadas]

    // ── Handoff horizontal: cocina cede a caja sin volver al supervisor ──────
    if (necesitaHandoffACaja({ role, toolsLlamadas: yaLlamadas, handoffsHechos: state.handoffs })) {
      return new Command({ goto: 'caja', update: { messages: nuevas, toolsLlamadas: llamadas } })
    }

    return new Command({ goto: 'agente', update: { messages: nuevas, toolsLlamadas: llamadas } })
  }

  /**
   * Nodo de dominio CashAgent, alcanzado por handoff desde KitchenAgent.
   * Calcula en JS una métrica que ningún dominio tiene por sí solo.
   */
  async function caja() {
    const { SystemMessage } = await import('@langchain/core/messages')

    const topItems = results.find(r => Array.isArray(r?.items))
    const ventas   = results.find(r => typeof r?.total === 'number')
                     ?? await handlers.read_sales_summary({ fecha: topItems?.fecha_solicitada })

    // Sin cruce posible (períodos distintos, sin platos, sin ventas): no inventamos nada.
    const cruce = calcularParticipacion(topItems, ventas)
    if (!cruce) return new Command({ goto: 'agente', update: { handoffs: ['KitchenAgent→CashAgent (sin cruce)'] } })

    // La métrica se añade a `results` para que el verificador la acepte como
    // cifra con respaldo: la calculó JavaScript, no el modelo.
    results.push(cruce)
    agentsUsed.add('CashAgent')

    return new Command({
      goto: 'agente',
      update: {
        handoffs: ['KitchenAgent→CashAgent'],
        messages: [new SystemMessage(
          'CashAgent responde al handoff de KitchenAgent. Estos datos ya están calculados, ' +
          `úsalos tal cual y no rehagas la división: ${JSON.stringify(cruce)}`
        )],
      },
    })
  }

  // ── Nodo verificador: procedencia de las cifras ────────────────────────────
  async function verificador(state) {
    const { SystemMessage } = await import('@langchain/core/messages')
    const { invento, sinRespaldo, motivo } = verificarCifras(state.texto, results, state.toolsLlamadas.length)

    if (!invento) return new Command({ goto: END })

    if (!state.estricto) {
      console.warn('[assistantGraph] Reintento estricto —', motivo)
      onReset?.()   // descarta lo ya transmitido: la respuesta se rehace desde cero
      return new Command({
        goto: 'agente',
        update: { estricto: true, sinRespaldo, messages: [new SystemMessage(REFUERZO)] },
      })
    }

    console.warn('[assistantGraph] Persiste la alucinación tras el reintento —', motivo, '. Degradando.')
    return new Command({ goto: END, update: { degraded: true, sinRespaldo } })
  }

  const grafo = new StateGraph(Estado)
    .addNode('agente', agente, { ends: ['herramientas', 'verificador'] })
    .addNode('herramientas', herramientas, { ends: ['agente', 'caja'] })
    .addNode('caja', caja, { ends: ['agente'] })
    .addNode('verificador', verificador, { ends: ['agente', END] })
    .addEdge(START, 'agente')
    .compile()

  return {
    async invoke(prompt, mensajesIniciales) {
      const final = await grafo.invoke(
        { prompt, messages: mensajesIniciales },
        { recursionLimit: RECURSION_LIMIT },
      )
      return {
        texto:       final.texto,
        degraded:    final.degraded,
        sinRespaldo: final.sinRespaldo,
        handoffs:    final.handoffs,
        toolsLlamadas: final.toolsLlamadas,
        emitted,
        results,
        agentsUsed,
      }
    },
    systemPrompt,
  }
}
