# 🧪 Guía de Pruebas — Pardos Chicken Sistema Multiagente

> Documento para verificar que el sistema cumple con **todos los criterios** de la rúbrica de evaluación.  
> Ejecutar estas pruebas en el navegador con `npm run dev` corriendo en `http://localhost:5173`

---

## 🔐 MÓDULO 1: Autenticación y Control de Acceso

### P1.1 — Login exitoso (caso normal)
```
URL: http://localhost:5173/login
Acción: Ingresar admin@pardos.com / admin123
Resultado esperado: ✅ Toast "Bienvenido, Carlos Mendes" + redirect a /dashboard
```

### P1.2 — Login fallido (caso adversarial)
```
Acción: Ingresar email correcto pero contraseña incorrecta
Resultado esperado: ❌ Toast de error "Correo o contraseña incorrectos"
                    Sin redirect. Formulario limpio para reintento
```

### P1.3 — Acceso denegado por rol (edge case)
```
Sesión: cajero@pardos.com / cajero123
URL directa: http://localhost:5173/analiticas
Resultado esperado: ❌ Redirect a /no-autorizado con mensaje de acceso denegado
Verificar: El cajero NO debe ver el menú de Analíticas en el sidebar
```

### P1.4 — Restaurar sesión (persistencia)
```
Acción: Login como admin → recargar la página (F5)
Resultado esperado: ✅ Sesión mantenida, permanece en el dashboard
                    No pide login nuevamente
```

### P1.5 — Logout
```
Acción: Hacer clic en el nombre de usuario → Cerrar sesión
Resultado esperado: ✅ Toast "Sesión cerrada" + redirect a /login
                    localStorage limpiado
```

---

## 📅 MÓDULO 2: Reservas — Reglas de Negocio

### P2.1 — Crear reserva en horario válido (caso normal)
```
Sesión: hostess@pardos.com / hostess123
URL: /reservas → Nueva Reserva
Datos: Teléfono: 987654999, Nombre: Test Cliente, 
       Fecha: mañana, Hora: 13:00, Personas: 2, Mesa: T01
Resultado esperado: ✅ Toast "Reserva creada correctamente"
                    Aparece en la lista de reservas
                    EventBus registra evento reservation:created
```

### P2.2 — REGLA DE NEGOCIO: Hora fuera del horario (edge case crítico)
```
[Este test verifica la regla 11 AM - 10 PM]
En BookingPage (/reservar):
  - Verificar que los TIME_SLOTS empiezan en 11:00 y terminan en 21:30
  - NO debe aparecer 22:00 ni 22:30
En ReservationForm (panel interno):
  - Misma verificación
Resultado esperado: ✅ Solo slots entre 11:00 y 21:30
```

### P2.3 — REGLA DE NEGOCIO: Fecha pasada (adversarial)
```
Sesión: admin
Formulario de nueva reserva
Dato: Fecha = fecha de ayer
Resultado esperado: ❌ Campo de fecha no permite seleccionar fechas pasadas
                    (atributo min en el input)
```

### P2.4 — REGLA DE NEGOCIO: Capacidad de mesa insuficiente (edge case)
```
Sesión: hostess
Datos: Personas: 8, Mesa: T01 (capacidad 2)
Resultado esperado: ❌ Error de validación: "La mesa T01 tiene capacidad para 2 personas..."
                    La reserva NO se crea
```

### P2.5 — Aprobar solicitud web (Swarm paralelo)
```
URL: /reservar (pública, sin sesión)
Acción: Llenar y enviar el formulario de solicitud
  - Nombre: Juan Pérez, Teléfono: 911111111
  - Fecha: 3 días en el futuro, Hora: 14:00
  - Personas: 3

Luego: Sesión con hostess@pardos.com
URL: /reservas
Verificar: Banner rojo con "1 solicitud en espera de aprobación"
Acción: Clic en "Aprobar" → asignar Mesa T04 → Confirmar

Resultado esperado (SWARM):
  ✅ ReservationAgent: reserva pasa a estado PENDING
  ✅ ClientAgent: Juan Pérez se registra automáticamente en /clientes
  ✅ EventBus: eventos reservation:approved + client:created
  ✅ NotificationAgent: toast "Solicitud aprobada"
  ✅ Panel de agentes en Dashboard muestra 2 llamadas paralelas
```

### P2.6 — Rechazar solicitud
```
Contexto: Hay una solicitud REQUESTED pendiente
Acción: Clic en "Rechazar" → ingresar motivo "No hay disponibilidad" → Confirmar
Resultado esperado: ✅ Toast "Solicitud rechazada"
                    El estado cambia a REJECTED
                    La solicitud desaparece del banner
```

### P2.7 — Sentar cliente (Swarm seat+kitchen)
```
Condición: Reserva con ítems de pedido pre-cargados
Sesión: hostess
Acción: Botón "Sentar" en una reserva con estado PENDING

Resultado esperado (SWARM):
  ✅ ReservationAgent: estado → SEATED
  ✅ KitchenAgent: ticket creado en /cocina
  ✅ Ambos ocurren en PARALELO (verificar en panel de agentes: 2 llamadas simultáneas)
  ✅ Toast "Cliente en mesa"
```

### P2.8 — Cancelar reserva
```
Sesión: admin (únicos que pueden cancelar cualquier reserva)
Acción: Botón de cancelar → ingresar motivo → confirmar
Resultado esperado: ✅ Estado → CANCELLED con motivo registrado
```

### P2.9 — Buscar reserva
```
URL: /reservas
Acción: Escribir "María" en el buscador
Resultado esperado: ✅ Solo muestra reservas de clientes con "María" en el nombre
```

---

## 🍳 MÓDULO 3: Cocina

### P3.1 — Ver panel Kanban (caso normal)
```
Sesión: cocina@pardos.com / cocina123
URL: /cocina
Resultado esperado: ✅ Columnas: Pendiente | En preparación | Listo
                    Tickets asignados con items individuales
```

### P3.2 — Avanzar estado de ítem
```
Acción: Clic en un ítem de pedido en columna "Pendiente"
Resultado esperado: ✅ Ítem pasa a "En preparación"
                    Si todos los ítems están en preparación → ticket avanza de columna
```

### P3.3 — Todos los ítems listos
```
Acción: Avanzar todos los ítems al estado "Listo"
Resultado esperado: ✅ Ticket aparece en columna "Listo"
                    Toast/notificación de pedido listo
                    NotificationAgent genera alerta para mozo
```

### P3.4 — Acceso denegado a cocina (edge case)
```
Sesión: cajero@pardos.com
URL directa: /cocina
Resultado esperado: ❌ Redirect a /no-autorizado
```

---

## 💳 MÓDULO 4: Caja — Reglas Críticas

### P4.1 — REGLA CRÍTICA: Cobrar sin turno activo (adversarial)
```
Sesión: cajero@pardos.com / cajero123
URL: /caja
Estado: Sin turno activo
Acción: Clic en botón "Cobrar" de cualquier reserva
Resultado esperado: ❌ Toast de error "No hay turno de caja activo. Abre un turno antes de cobrar."
                    Modal de apertura de turno se abre automáticamente
                    El pago NO se registra
```

### P4.2 — Abrir turno de caja
```
Acción: Botón "Abrir turno" → ingresar S/ 500 de apertura → Confirmar
Resultado esperado: ✅ Banner verde "Turno activo"
                    Cajero y monto de apertura visible
                    CashAgent publica evento cash:shift_opened
```

### P4.3 — Registrar cobro con ítems (caso normal)
```
Precondición: Turno activo
Acción: Botón "Nuevo cobro" → seleccionar cliente 
        → abrir menú → agregar platos → confirmar
        → elegir método: Yape
        → Generar boleta
Resultado esperado: ✅ Boleta generada con IGV 18% calculado correctamente
                    Subtotal + IGV = Total
                    Stats actualizados (Total hoy, N° cobros)
```

### P4.4 — Verificar cálculo de IGV (validación matemática)
```
Dato: Pedido de S/ 100.00
Cálculo esperado:
  - Total: S/ 100.00
  - Subtotal (sin IGV): S/ 84.75 (= 100 / 1.18)
  - IGV (18%): S/ 15.25 (= 100 - 84.75)
Verificar en la boleta que los números son correctos
```

### P4.5 — Cobro vinculado a reserva (Swarm payment)
```
Precondición: Reserva con estado SEATED en la lista
Acción: Seleccionar esa reserva en el dropdown → agregar platos → cobrar
Resultado esperado (SWARM):
  ✅ CashAgent: pago registrado con IGV
  ✅ ReservationAgent: reserva completa automáticamente
  ✅ Toast "Mesa T0X liberada automáticamente"
  ✅ Reserva desaparece de la lista de cobros pendientes
```

### P4.6 — Cerrar turno y ver resumen
```
Acción: Botón "Cerrar turno"
Resultado esperado: ✅ Modal con resumen: Total cobrado, N° transacciones, 
                    desglose por método de pago (efectivo, tarjeta, Yape, Plin)
```

---

## 👤 MÓDULO 5: Clientes — CRM

### P5.1 — Buscar cliente por teléfono en reserva
```
Sesión: hostess
URL: /reservas → Nueva Reserva
Acción: Escribir teléfono de cliente existente (ej: 987654321)
Resultado esperado: ✅ Toast "Cliente encontrado: María García"
                    Campos de nombre y email se completan automáticamente
                    Badge "✓ Cliente encontrado"
```

### P5.2 — Detección automática de cliente VIP
```
Contexto: Cliente "María García" tiene varias reservas
Acción: Ver en /clientes
Resultado esperado: ✅ Badge VIP si tiene 5+ reservas completadas
```

### P5.3 — Eliminar cliente (solo admin)
```
Sesión: admin
URL: /clientes → botón eliminar
Resultado esperado: ✅ Confirmación → cliente eliminado
Sesión: hostess → botón eliminar (no debe aparecer)
Resultado esperado: ❌ Botón de eliminar NO visible para hostess
```

---

## 🌐 MÓDULO 6: Sistema Multiagente — EventBus MCP

### P6.1 — Verificar mensajes MCP en el panel
```
URL: /dashboard
Verificar: Panel "Sistema Multiagente" visible
Acción: Ir a Tab "Eventos"
Resultado esperado: ✅ Lista de eventos en formato JSON con:
                    - type (ej: reservation:created)
                    - source (ej: ReservationAgent)
                    - timestamp
                    - correlationId (para correlacionar flujos)
```

### P6.2 — Verificar métricas de agentes
```
Tab "Agentes" en el panel
Resultado esperado: ✅ 5 tarjetas de agentes con:
                    - Nombre, ícono, color diferenciado
                    - N° de llamadas
                    - Tasa de éxito (%)
                    - Latencia promedio (ms)
                    - Barra de éxito visual
```

### P6.3 — Verificar topología estrella
```
Tab "Topología"
Resultado esperado: ✅ Diagrama ASCII del hub central
                    Lista de los 3 Swarms disponibles
                    Descripción de la arquitectura
```

### P6.4 — Swarm approve y verificar paralelismo
```
Contexto: P2.5 ejecutado
Dashboard → Tab "Agentes"
Verificar: ReservationAgent.totalCalls >= 1
           ClientAgent.totalCalls >= 1
Dashboard → Tab "Eventos"
Verificar: eventos reservation:approved Y client:created
           Con el mismo correlationId (mismo flujo)
```

---

## ⚡ MÓDULO 7: Edge Cases y Casos Adversariales

### P7.1 — Formulario vacío (validación completa)
```
URL: /reservar
Acción: Clic directo en "Enviar solicitud" sin rellenar nada
Resultado esperado: ❌ Mensajes de error en TODOS los campos obligatorios:
                    "Tu nombre es requerido"
                    "Tu teléfono es requerido"
                    "Selecciona una fecha"
                    "Selecciona un horario"
                    Sin enviar la solicitud
```

### P7.2 — Teléfono inválido
```
URL: /reservar
Datos: Teléfono = "abc123"
Resultado esperado: ❌ "Ingresa un teléfono válido (9-12 dígitos)"
```

### P7.3 — Personas fuera de rango
```
Datos: Personas = 0 o Personas = 25
Resultado esperado: ❌ "Entre 1 y 30 personas" (booking) / "Máximo 20 personas" (interno)
```

### P7.4 — Sin sesión en ruta protegida
```
Sin sesión activa
URL directa: /dashboard
Resultado esperado: ❌ Redirect automático a /login
```

### P7.5 — Ruta inexistente (404)
```
URL: /esta-ruta-no-existe
Resultado esperado: ✅ Página 404 con botón "Volver al inicio"
```

### P7.6 — Reserva pública con fecha hoy (adversarial)
```
URL: /reservar
Datos: Fecha = hoy (mismo día)
Resultado esperado: ❌ Campo fecha tiene min = mañana
                    No es posible seleccionar hoy para reservas online
```

---

## 📊 MÉTRICAS ESPERADAS TRAS EJECUTAR TODAS LAS PRUEBAS

| Métrica | Valor Esperado |
|---|---|
| Total de mensajes EventBus | >= 15 mensajes |
| Tasa de éxito global | >= 90% |
| Swarms ejecutados | >= 3 |
| Tareas paralelas | >= 6 |
| Latencia promedio por agente | < 200ms |
| Conflictos resueltos | >= 0 (resolución automática) |

---

## ✅ Checklist Final para Evaluación

- [ ] Sistema arranca sin errores (`npm run dev`)
- [ ] Login funciona para los 5 roles
- [ ] Horario de atención correcto (11:00 - 21:30 únicamente)
- [ ] Capacidad de mesa validada antes de crear reserva
- [ ] No se puede cobrar sin turno activo
- [ ] IGV 18% calculado correctamente en boletas
- [ ] Swarm approve: ReservationAgent + ClientAgent en paralelo
- [ ] Swarm seat: ReservationAgent + KitchenAgent en paralelo
- [ ] Swarm payment: CashAgent + ReservationAgent en paralelo
- [ ] EventBus registra todos los eventos con schema MCP
- [ ] Panel de agentes muestra métricas en tiempo real
- [ ] README técnico completo con arquitectura y pasos
- [ ] Validaciones de formularios con mensajes claros
- [ ] Restricciones de rol funcionando correctamente

---

## 🤖 MÓDULO 9: Benchmark Automatizado (Métricas Cuantitativas)

Este módulo ejecuta las pruebas programáticamente y genera un reporte con métricas cuantitativas reales. Requiere acceso al orquestador desde la consola del navegador.

### ¿Por qué es importante?

La rúbrica exige "métricas cuantitativas reportadas (latencia, tasa de éxito, token usage)". Este benchmark las genera automáticamente con datos reales del sistema.

### Cómo ejecutar

**Opción A — Desde la consola del navegador:**

```javascript
// 1. Abrir http://localhost:5173 con el sistema corriendo
// 2. Abrir DevTools (F12) → pestaña Console
// 3. Ejecutar:

const { runBenchmark } = await import('/src/tests/agentBenchmark.js')
// El orchestrator está expuesto globalmente desde AgentContext
const report = await runBenchmark(window.__pardosOrchestrator)
```

**Opción B — Ver métricas en vivo desde el Dashboard:**

```
Sesión: admin@pardos.com
URL: /dashboard → Tab "Monitoreo de Agentes"
Ver: Tasa de éxito, latencia promedio, token usage por agente
```

### Resultados esperados del benchmark (referencia)

El sistema fue evaluado con 13 casos de prueba distribuidos en 3 categorías:

| Categoría | Casos | Tasa de éxito esperada | Latencia promedio |
|---|---|---|---|
| Happy Path | 3 | 100% | < 10ms |
| Adversarial | 6 | 100% (todos deben rechazar) | < 10ms |
| Edge Cases | 4 | 100% | < 10ms |
| **TOTAL** | **13** | **100%** | **< 10ms** |

> **Nota sobre latencia:** Los agentes procesan en memoria sin I/O real, por lo que la latencia es inherentemente baja. En un sistema con llamadas reales a la API de Claude, la latencia esperada sería 300–2000ms por agente, con los Swarms reduciendo el tiempo total en ~50% gracias a `Promise.all`.

### Casos adversariales verificados programáticamente

| ID | Caso | Comportamiento esperado |
|---|---|---|
| ADV-01 | Fecha en el pasado | `success: false` — rechazado por ReservationAgent |
| ADV-02 | Hora fuera de horario (23:00) | `success: false` — regla de negocio bloqueada |
| ADV-03 | Capacidad insuficiente (8 personas, mesa para 2) | `success: false` — validación de capacidad activa |
| ADV-04 | Más de 20 personas (límite del sistema) | `success: false` — límite máximo rechazado |
| ADV-05 | Monto de pago negativo | `success: false` — CashAgent rechaza montos inválidos |
| ADV-06 | Monto de pago cero | `success: false` — CashAgent rechaza monto cero |

### Métricas de token usage

El sistema estima el uso de tokens por cada llamada a agente usando la heurística:
- `prompt_tokens` ≈ (longitud del system prompt + params JSON) / 4 caracteres
- `completion_tokens` ≈ longitud del resultado JSON / 4 caracteres

Estas métricas son visibles en el panel de monitoreo del Dashboard y en `orchestrator.getSystemStatus().agents[n].totalTokens`.

### Verificar validación de payload JSON Schema

El EventBus ahora valida el PAYLOAD de cada evento contra su JSON Schema específico, no solo los campos del envelope MCP. Para verificarlo:

```javascript
// En la consola del navegador:
const { eventBus } = await import('/src/agents/core/EventBus.js')
console.log(eventBus.getPayloadSchemas())  // Muestra los 19 schemas registrados
console.log(eventBus.getMetrics())          // schemasRegistered: 19
```
- [ ] Página 404 y acceso no autorizado funcionan
