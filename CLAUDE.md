# CLAUDE.md — Pardos Chicken Sistema Multiagente

## Stack

- React 19 + Vite + JavaScript (no TypeScript)
- LangChain.js (`@langchain/core`, `@langchain/google-genai`) para LLM
- LangGraph.js (`@langchain/langgraph`) para flujos de estado
- Gemini 1.5 Flash como modelo de IA
- CSS Modules para estilos

## Arquitectura Multiagente

Topología estrella con `AgentOrchestrator` al centro. 9 agentes, 4 módulos de IA:

| Módulo | Agente | Técnica |
|--------|--------|---------|
| M1 | ComplaintAgent | Chain-of-Thought + Few-Shot → JSON |
| M2 | LeaderAnalystAgent | ReAct via Function Calling |
| M3 | SecurityAuditorAgent | Self-Consistency (5 auditorías) |
| M4 | ResolutionAgent | RAG + cruce de dominios controlado |

## Reglas de Aislamiento de Datos

Cada agente tiene permisos definidos en `AGENT_PERMISSIONS` (SharedMemory.js). Reglas clave:

- **ComplaintAgent** solo escribe en `COMPLAINTS` y `COMPLAINTS_BY_SEDE`. No accede a reservas, pagos ni cocina.
- **LeaderAnalystAgent** solo lee `COMPLAINTS` (read-only). No inventa datos.
- **SecurityAuditorAgent** no accede a SharedMemory. Solo recibe texto descriptivo.
- **ResolutionAgent** tiene acceso cross-domain **controlado** a través de funciones intermediarias JS que filtran datos antes de pasarlos al LLM (anti-alucinación).

### Anti-alucinación (ResolutionAgent)

El LLM nunca recibe arrays crudos de otros dominios. Las funciones intermediarias son:
- `_findTable(tableId)` → devuelve solo `{ tableId, status, guestName }`
- `_hasClientPaid(tableId)` → devuelve solo `boolean`
- `_findPolicy(puntosCriticos)` → devuelve solo la política que matchea
- `_findPromotion(promoId)` → devuelve solo la promo activa

## Contratos de Datos

### Queja (COMPLAINTS)
```
{ id, fecha, canal, cliente, telefono, mensaje, tableId?,
  razonamiento, sentimiento, prioridad, sede, puntos_criticos[],
  respuesta_cliente, estado }
```
- `estado`: "nueva" | "escalada" | "en_resolucion" | "resuelta"
- `prioridad`: "Baja" | "Media" | "Alta" | "Crítica"

### Resolución (ACTIVE_RESOLUTIONS)
```
{ id, complaintId, tableId?, guestName, problema, clientePago,
  policyId?, accionElegida, respuestaRAG?, promocion?, status, timestamp }
```
- `status`: "pendiente" | "aceptada" | "rechazada" | "completada"
- `accionElegida`: "encargo_directo" | "proponer_respuesta" | "cancelar"

## LLM Client

`src/agents/core/llmClient.js` soporta 3 modos (env `VITE_GEMINI_API_KEY`):
- `gemini`: API directa via LangChain
- `proxy`: serverless function (`/api/triage`)
- `mock`: heurísticas offline (sin API key)

## Convenciones

- Agentes son singletons exportados como `export const agentName = new Agent()`
- Comunicación inter-agente via EventBus (pub/sub)
- Estado compartido via SharedMemory (RAM in-browser con versioning)
- Estado UI via React Context + localStorage
- Nuevos eventos se declaran en `EVENT_TYPES` con su schema en `EVENT_PAYLOAD_SCHEMAS`
