/**
 * src/agents/core/AgentOrchestrator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Orquestador Central — Núcleo del sistema multiagente (Topología ESTRELLA).
 *
 * El Orquestador es el punto central que:
 *   1. Registra todos los subagentes en el AgentRegistry
 *   2. Recibe las solicitudes de la UI y las delega al agente correcto
 *   3. Coordina flujos multi-agente (Swarms) donde múltiples agentes
 *      actúan EN PARALELO para una misma tarea
 *   4. Gestiona los conflictos detectados por la SharedMemory
 *   5. Provee acceso a las métricas agregadas de todos los agentes
 *
 * TOPOLOGÍA ESTRELLA (Hub-and-Spoke):
 *
 *                    ┌──────────────────────┐
 *                    │  AgentOrchestrator   │  ← HUB central
 *                    └──────┬───────────────┘
 *          ┌────────┬───────┼───────┬────────┐
 *          ▼        ▼       ▼       ▼        ▼
 *    Reservation Kitchen  Cash  Client  Notification
 *      Agent     Agent   Agent  Agent     Agent
 *
 * SWARMS (flujos paralelos):
 *   - approve_reservation_swarm: ReservationAgent + ClientAgent en paralelo
 *   - seat_with_kitchen_swarm:   ReservationAgent + KitchenAgent en paralelo
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { reservationAgent } from '../ReservationAgent.js'
import { kitchenAgent }     from '../KitchenAgent.js'
import { cashAgent }        from '../CashAgent.js'
import { clientAgent }      from '../ClientAgent.js'
import { notificationAgent } from '../NotificationAgent.js'
import { eventBus, EVENT_TYPES } from './EventBus.js'
import { sharedMemory, MEMORY_KEYS } from './SharedMemory.js'

/**
 * AgentRegistry — Registro centralizado de todos los agentes del sistema.
 *
 * Patrón de diseño: SERVICE LOCATOR
 * El AgentRegistry permite al Orquestador descubrir en tiempo de ejecución
 * qué agentes están disponibles, sus capacidades (capabilities) y las tools
 * que exponen. Esto desacopla el Orquestador de las implementaciones concretas.
 *
 * Ciclo de vida:
 *   1. Al inicializar el sistema (_initialize), se registran los 5 subagentes.
 *   2. El Orquestador usa registry.get(name) para obtener un agente y delegarle.
 *   3. registry.getCapabilities() es usado por el panel de monitoreo.
 */
class AgentRegistry {
  constructor() {
    // Map: agentName → instancia del agente (AgentBase)
    this._agents = new Map()
  }

  /**
   * register — Registra un agente en el sistema.
   * @param {AgentBase} agent - Instancia del agente a registrar
   */
  register(agent) {
    this._agents.set(agent.name, agent)
    console.log(`[AgentRegistry] Agente registrado: ${agent.name} (${agent.capabilities.length} capabilities)`)
  }

  /**
   * get — Obtiene un agente por nombre.
   * Retorna null si no existe (el Orquestador maneja el caso de error).
   */
  get(name) {
    return this._agents.get(name) || null
  }

  /** getAll — Retorna todos los agentes registrados. */
  getAll() {
    return [...this._agents.values()]
  }

  /**
   * getCapabilities — Retorna el mapa de capacidades de todos los agentes.
   * Usado por el panel de monitoreo para mostrar qué tools tiene cada agente.
   */
  getCapabilities() {
    return [...this._agents.entries()].map(([name, agent]) => ({
      name,
      capabilities: agent.capabilities,
      tools:        agent.getTools(),
      isActive:     agent.isActive,
    }))
  }
}

// ── Clase OrchestratorAgent ───────────────────────────────────────────────────
class AgentOrchestratorClass {
  constructor() {
    this.name     = 'OrchestratorAgent'
    this.topology = 'star'  // Topología estrella

    // Registro de agentes
    this.registry = new AgentRegistry()

    // Métricas del orquestador
    this._metrics = {
      totalOrchestrations: 0,
      swarmExecutions:     0,
      parallelTasksTotal:  0,
      startedAt:           new Date().toISOString(),
    }

    // Inicializar sistema
    this._initialize()
  }

  /**
   * _initialize — Registra todos los agentes y conecta el sistema.
   * Este es el método de bootstrap del sistema multiagente.
   */
  _initialize() {
    // 1. Registrar todos los subagentes en el registry
    this.registry.register(reservationAgent)
    this.registry.register(kitchenAgent)
    this.registry.register(cashAgent)
    this.registry.register(clientAgent)
    this.registry.register(notificationAgent)

    // 2. Inicializar memoria compartida con estado base
    sharedMemory.set(MEMORY_KEYS.AGENT_METRICS, {
      initialized: true,
      topology:    this.topology,
      agentCount:  this.registry.getAll().length,
      startedAt:   new Date().toISOString(),
    }, this.name)

    // 3. Suscribir el orquestador a eventos de sistema para logging central
    eventBus.subscribe(EVENT_TYPES.AGENT_ERROR, (msg) => {
      console.error(`[Orchestrator] Error en agente ${msg.payload.agentName}:`, msg.payload.error)
    })

    eventBus.subscribe(EVENT_TYPES.CONFLICT_DETECTED, (msg) => {
      console.warn(`[Orchestrator] Conflicto detectado:`, msg.payload)
    })

    console.log(`[Orchestrator] Sistema multiagente inicializado — ${this.registry.getAll().length} agentes registrados`)
  }

  /**
   * injectContextActions — Inyecta las funciones de los contexts de React en cada agente.
   * Esto permite a los agentes actuar sobre el estado real de la aplicación.
   * Se llama desde el AgentContext.jsx al montar el contexto.
   *
   * @param {Object} actions - Mapa de agentName → actions
   */
  injectContextActions(actions) {
    if (actions.reservation) reservationAgent.setContextActions(actions.reservation)
    if (actions.kitchen)     kitchenAgent.setContextActions(actions.kitchen)
    if (actions.cash)        cashAgent.setContextActions(actions.cash)
    if (actions.client)      clientAgent.setContextActions(actions.client)
    if (actions.notification) notificationAgent.setNotificationCallback(actions.notification)

    console.log('[Orchestrator] Context actions inyectadas en todos los agentes')
  }

  // ── Delegación de tareas a subagentes ─────────────────────────────────────

  /**
   * delegate — Delega una tarea a un agente específico.
   * Este es el flujo estándar de comunicación en la topología estrella.
   *
   * @param {string} agentName - Nombre del agente destino
   * @param {string} toolName - Herramienta a ejecutar
   * @param {Object} params - Parámetros para la herramienta
   * @param {string} [correlationId] - ID de correlación del flujo
   */
  async delegate(agentName, toolName, params = {}, correlationId = null) {
    this._metrics.totalOrchestrations++

    const agent = this.registry.get(agentName)
    if (!agent) {
      console.error(`[Orchestrator] Agente no encontrado: ${agentName}`)
      return { success: false, error: `Agente "${agentName}" no registrado` }
    }

    return agent.execute(toolName, params, correlationId)
  }

  // ── SWARMS (flujos paralelos con Promise.all) ────────────────────────────
  //
  // Un SWARM es un flujo donde múltiples agentes actúan SIMULTÁNEAMENTE
  // usando Promise.all(). Esto maximiza el throughput del sistema:
  //
  //   Sin Swarm (secuencial):  [AgentA: 50ms] → [AgentB: 50ms] = 100ms total
  //   Con Swarm (paralelo):    [AgentA: 50ms] 
  //                            [AgentB: 50ms] (en paralelo)    = ~50ms total
  //
  // El correlationId compartido permite trazar ambos eventos en el EventBus
  // y verificar que provienen del mismo flujo.

  /**
   * approveReservationSwarm — SWARM de aprobación: 2 agentes en paralelo.
   *
   * Flujo paralelo:
   *   1. ReservationAgent.approve_request → cambia estado a PENDING, asigna mesa
   *   2. ClientAgent.sync_from_reservation → busca/crea el cliente automáticamente
   *
   * Ambas operaciones usan el mismo correlationId para trazabilidad en el EventBus.
   * El evaluador puede verificar esto en el tab "Eventos" del panel de monitoreo.
   *
   * @param {string} id - ID de la reserva a aprobar
   * @param {string} tableId - Mesa asignada
   * @param {string} approvedBy - Nombre del aprobador
   * @param {Object} reservationData - Datos completos de la reserva (para ClientAgent)
   */
  async approveReservationSwarm({ id, tableId, approvedBy, reservationData }) {
    this._metrics.swarmExecutions++
    this._metrics.parallelTasksTotal += 2

    const correlationId = `swarm_approve_${id}_${Date.now()}`

    console.log(`[Orchestrator] 🌀 SWARM: approve_reservation — Ejecutando 2 agentes en paralelo`)

    // EJECUCIÓN PARALELA — Promise.all()
    const [reservationResult, clientResult] = await Promise.all([
      // Agente 1: Aprobar reserva
      reservationAgent.execute('approve_request', {
        id, tableId, approvedBy,
      }, correlationId),

      // Agente 2: Sincronizar cliente (actúa simultáneamente)
      clientAgent.execute('sync_from_reservation', {
        reservation: reservationData,
      }, correlationId),
    ])

    return {
      success:           reservationResult.success,
      swarmType:         'approve_reservation',
      agentsInvolved:    ['ReservationAgent', 'ClientAgent'],
      correlationId,
      results: {
        reservation: reservationResult,
        client:      clientResult,
      },
    }
  }

  /**
   * seatWithKitchenSwarm — SWARM: Sienta a un cliente y crea ticket de cocina.
   *
   * Agentes que actúan EN PARALELO:
   *   1. ReservationAgent → cambia estado a SEATED
   *   2. KitchenAgent → crea el ticket de cocina con los ítems del pedido
   */
  async seatWithKitchenSwarm({ reservation }) {
    this._metrics.swarmExecutions++
    this._metrics.parallelTasksTotal += 2

    const correlationId = `swarm_seat_${reservation.id}_${Date.now()}`

    console.log(`[Orchestrator] 🌀 SWARM: seat_with_kitchen — Ejecutando 2 agentes en paralelo`)

    const [seatResult, kitchenResult] = await Promise.all([
      // Agente 1: Sentar al cliente
      reservationAgent.execute('seat_reservation', {
        id: reservation.id,
      }, correlationId),

      // Agente 2: Crear ticket de cocina (si hay ítems)
      kitchenAgent.execute('add_ticket', {
        tableId:    reservation.tableId,
        clientName: reservation.clientName,
        guests:     reservation.guests,
        items:      (reservation.items || []).map(i => ({ ...i, itemStatus: 'pending' })),
        notes:      reservation.notes || '',
        priority:   'normal',
      }, correlationId),
    ])

    return {
      success:        seatResult.success,
      swarmType:      'seat_with_kitchen',
      agentsInvolved: ['ReservationAgent', 'KitchenAgent'],
      correlationId,
      results: {
        seat:    seatResult,
        kitchen: kitchenResult,
      },
    }
  }

  /**
   * registerPaymentSwarm — SWARM: Registra pago y completa la reserva.
   *
   * Agentes que actúan EN PARALELO:
   *   1. CashAgent → registra el pago con IGV
   *   2. ReservationAgent → completa la reserva (si estaba SEATED)
   */
  async registerPaymentSwarm({ paymentData, reservation, shift, cashier }) {
    this._metrics.swarmExecutions++
    this._metrics.parallelTasksTotal += reservation ? 2 : 1

    const correlationId = `swarm_payment_${Date.now()}`

    console.log(`[Orchestrator] 🌀 SWARM: register_payment — Ejecutando ${reservation ? 2 : 1} agente(s) en paralelo`)

    const tasks = [
      cashAgent.execute('register_payment', { paymentData, shift, cashier }, correlationId),
    ]

    if (reservation) {
      tasks.push(
        reservationAgent.execute('complete_reservation', { id: reservation.id }, correlationId)
      )
    }

    const [cashResult, reservationResult] = await Promise.all(tasks)

    return {
      success:        cashResult.success,
      swarmType:      'register_payment',
      agentsInvolved: reservation ? ['CashAgent', 'ReservationAgent'] : ['CashAgent'],
      correlationId,
      results: {
        cash:        cashResult,
        reservation: reservationResult || null,
      },
    }
  }

  // ── Validaciones (delegan al agente correcto) ─────────────────────────────

  /**
   * validateReservation — Valida una reserva usando el ReservationAgent.
   */
  async validateReservation(data) {
    return reservationAgent.execute('validate_reservation', data)
  }

  /**
   * validatePayment — Valida un pago usando el CashAgent.
   */
  async validatePayment(data) {
    return cashAgent.execute('validate_payment', data)
  }

  // ── Métricas y estado del sistema ─────────────────────────────────────────

  /**
   * getSystemStatus — Retorna el estado completo del sistema multiagente.
   * Usado por el panel de monitoreo en el Dashboard.
   */
  getSystemStatus() {
    const agents = this.registry.getAll().map(agent => ({
      ...agent.getMetrics(),
      agentName: agent.name, // Asegurar que agentName existe (getMetrics a veces no lo incluye)
      tools: agent.getTools(), // Incluir la lista de funciones del agente
      isActive: agent.isActive,
    }))

    const grandTotalTokens = agents.reduce((sum, a) => sum + (a.totalTokens || 0), 0)

    return {
      orchestrator: {
        name:                this.name,
        topology:            this.topology,
        ...this._metrics,
        uptime:              Math.round((Date.now() - new Date(this._metrics.startedAt).getTime()) / 1000),
        totalTokens:         grandTotalTokens,
      },
      agents,
      eventBus:      eventBus.getMetrics(),
      sharedMemory:  sharedMemory.getMetrics(),
      agentCount:    agents.length,
      activeAgents:  agents.filter(a => a.isActive).length,
      totalSwarms:   this._metrics.swarmExecutions,
    }
  }

  /**
   * getEventHistory — Retorna el historial de mensajes del EventBus.
   */
  getEventHistory(limit = 30) {
    return eventBus.getHistory(limit)
  }

  /**
   * getAgentHistory — Retorna el historial de conversación de un agente.
   */
  getAgentHistory(agentName, limit = 20) {
    const agent = this.registry.get(agentName)
    return agent?.getConversationHistory(limit) || []
  }
}

// Singleton — un único orquestador para todo el sistema
export const orchestrator = new AgentOrchestratorClass()
export default orchestrator
