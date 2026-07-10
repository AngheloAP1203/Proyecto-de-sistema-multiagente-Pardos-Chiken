# CLAUDE.md — Pardos Chicken Sistema Multiagente

## Stack

- React 19 + Vite + JavaScript (no TypeScript)
- LangChain.js v1 (`@langchain/core`, `@langchain/google-genai`, `@langchain/groq`)
- LangGraph.js (`@langchain/langgraph`) para flujos de estado
- Modelo por defecto: Llama 3.3 70B en Groq. Gemini 2.5 Flash como alternativa
- CSS Modules para estilos

**LangChain v1:** el método para ligar tools es `bindTools(...)`. `bind({ tools })` no existe
y falla en tiempo de ejecución.

## Arquitectura Multiagente

Topología estrella con `AgentOrchestrator` al centro. 9 agentes, 5 módulos de IA:

| Módulo | Agente | Técnica |
|--------|--------|---------|
| M1 | ComplaintAgent | Chain-of-Thought + Few-Shot → JSON |
| M2 | LeaderAnalystAgent | ReAct via Function Calling |
| M3 | SecurityAuditorAgent | Self-Consistency (5 auditorías) |
| M4 | ResolutionAgent | RAG + cruce de dominios controlado |
| M5 | AssistantAgent | Supervisor + malla de handoffs (LangGraph) |

### M5 — Asistente del líder

Punto de entrada: `AdminPromptPage` → `AssistantAgent.ask()`. **No** usa `PromptInterpreter`
como camino principal; lo conserva como fallback sin LLM.

Grafo en `core/assistantGraph.js`: `agente → herramientas ⇄ caja → verificador`.
El nodo `herramientas` cede el control a `caja` con `Command({ goto: 'caja' })` cuando
KitchenAgent necesita el total del día para calcular la participación del plato estrella.
Ese cruce de dominios se calcula en JS y no gasta una llamada extra al LLM.

El disparador del handoff mira los **datos**, no el texto del prompt: los modelos piden
todas las herramientas en la misma vuelta, así que una regla basada en palabras del
usuario nunca llega a evaluarse.

Degradación en cascada (`ask()` nunca lanza):
`grafo → camino directo (VITE_ASSISTANT_GRAPH=false) → PromptInterpreter → mensaje honesto`

**Streaming:** el nodo `agente` transmite token a token vía `onToken`. El filtro de
`numberGuard.js` retiene cada cifra hasta poder rastrearla a una herramienta, así que una
cifra inventada nunca llega a la pantalla. Si el verificador rechaza la respuesta, `onReset`
borra lo transmitido antes de rehacerla.

**Groq + streaming:** manda `args: "null"` en las tools sin parámetros y LangChain descarta
la llamada al concatenar los chunks — `tool_calls` queda vacío y la herramienta no corre.
`normalizarToolCalls()` la rescata desde `tool_call_chunks`.

**Caché de sesión** (`core/responseCache.js`): las respuestas exitosas se cachean por
rol + prompt normalizado + huella de datos + historial reciente, con TTL de 10 min.
Un pago/reserva/cliente nuevo cambia la huella e invalida. Nunca se cachean respuestas
degradadas ni bloqueadas, y el caché corre DESPUÉS del guardrail. Motivo: los free tiers
se agotan por tokens y en una demo las preguntas se repiten.

**La fecha de hoy va en el system prompt.** Sin ella, el modelo rellena `fecha` con el
"hoy" de su entrenamiento (observado: pasó `2024-07-10` y narró "no hay ventas" sobre un
día con S/. 588.40 en caja). Una fecha pasada con formato válido pasa cualquier validación.

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

### Anti-alucinación (AssistantAgent)

Las herramientas calculan; el LLM solo narra. Verificado contra Gemini y Llama: el modelo
inventa cifras de tres formas, y `core/numberGuard.js` las ataja rastreando **cada número
de la respuesta hasta la salida de una herramienta**. Si una cifra no aparece ahí, se
reintenta en frío y, si insiste, se degrada.

Cubre montos, conteos y porcentajes. **No** cubre afirmaciones cualitativas: el modelo aún
puede decir "las ventas de Yape y Plin son iguales" citando un método que no existe.

Corolarios al añadir una tool:
- Devuelve los agregados ya calculados (`hora_pico`, `ticket_promedio`, `unidades_totales`).
  Si el modelo tiene que sumar o contar una lista, se equivoca.
- Valida los argumentos. Un modelo pequeño pasa `fecha: "hoy"` o una fecha futura; filtrar
  por ella devuelve cero, y el modelo narra un cero falso sin sospechar.
- Si la tool cambia el alcance de lo que devuelve (p. ej. amplía el período), dilo en un
  campo `advertencia`. El prompt obliga al modelo a comunicárselo al líder.

## Contratos del seed (no confiar en los nombres "obvios")

- Pagos: `time: "14:30"` — **no** hay `createdAt`.
- Reservas: `status` en minúscula (`pending`, `seated`, `no_show`). Etiquetas en
  `domain/reservations/reservationStatus.js`.
- Clientes: `vip` (booleano) y `totalReservations`. **No** existen `isVip` ni
  `completedReservations`. Alta en `registeredAt`, no `createdAt`.
- La regla de VIP es la marca `vip`, igual que `ClientContext.vipClients`. El seed tiene
  clientes por encima del umbral de `ClientAgent` sin la marca puesta.

## LLM Client

`src/agents/core/llmClient.js` soporta 4 modos:
- `groq`: `VITE_LLM_PROVIDER=groq` + `VITE_GROQ_API_KEY` (default: `llama-3.3-70b-versatile`)
- `gemini`: `VITE_GEMINI_API_KEY` (default: `gemini-2.5-flash`)
- `proxy`: serverless function (`/api/triage`)
- `mock`: heurísticas offline (sin API key)

`VITE_LLM_MODEL` fuerza un modelo concreto. Útil porque los límites de tokens de Groq son
**por modelo**: cambiar de modelo da una bolsa nueva.

**Modo proxy (M5):** con `VITE_USE_PROXY=true`, el asistente llama a `/api/llm`
(passthrough a Groq con `GROQ_API_KEY` server-side; modelos en allowlist). El bucle ReAct
sigue en el cliente porque los handlers leen localStorage. `ProxyChat` (llmClient) expone
la misma interfaz `bindTools/invoke/stream`; su `stream()` emite la respuesta completa en
un solo fragmento — se cambia granularidad de streaming por no exponer la key.
En dev, vite.config.js monta los mismos handlers de `api/` en el dev server.

Cuotas del free tier que muerden antes que el número de peticiones: Groq 70B tiene
12K tokens/min y 100K tokens/día; Gemini 2.5 Flash, 20 peticiones/día. `withRetry` respeta
la espera que indica el proveedor y degrada de inmediato si la cuota tarda demasiado.

Groq es compatible con OpenAI y **rechaza** el formato `functionDeclarations` de Gemini.
`normalizeTools()` traduce entre ambos.

## Convenciones

- Agentes son singletons exportados como `export const agentName = new Agent()`
- Comunicación inter-agente via EventBus (pub/sub)
- Estado compartido via SharedMemory (RAM in-browser con versioning)
- Estado UI via React Context + localStorage
- Nuevos eventos se declaran en `EVENT_TYPES` con su schema en `EVENT_PAYLOAD_SCHEMAS`
