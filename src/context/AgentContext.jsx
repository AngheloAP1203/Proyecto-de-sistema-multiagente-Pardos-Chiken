/**
 * src/context/AgentContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Context de React que expone el sistema multiagente a toda la aplicación.
 *
 * Este contexto:
 *   1. Al montar, inyecta las funciones de los contexts existentes (Reservation,
 *      Kitchen, Cash, Client) en sus agentes correspondientes
 *   2. Expone el Orquestador para que la UI pueda delegar tareas
 *   3. Mantiene el estado de las métricas del sistema para el panel de monitoreo
 *   4. Re-renderiza el estado del sistema cada 2 segundos para actualizar la UI
 *
 * Uso:
 *   const { orchestrator, systemStatus, eventHistory } = useAgents()
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { orchestrator } from '../agents/core/AgentOrchestrator.js'
import { notificationAgent } from '../agents/NotificationAgent.js'
import { eventBus } from '../agents/core/EventBus.js'
import { auditLogger } from '../agents/core/auditLogger.js'
import toast from 'react-hot-toast'

// Importar el tipo de prioridad para los toasts
import { NOTIFICATION_PRIORITY } from '../agents/NotificationAgent.js'

const AgentContext = createContext(null)

export function AgentProvider({ children, reservationActions, kitchenActions, cashActions, clientActions, complaintActions, resolutionActions }) {
  // Estado del sistema multiagente (para el panel de monitoreo)
  const [systemStatus,  setSystemStatus]  = useState(null)
  const [eventHistory,  setEventHistory]  = useState([])
  const [notifications, setNotifications] = useState([])
  const isInjected = useRef(false)

  // ── Inyección de context actions en los agentes (una sola vez) ────────────
  useEffect(() => {
    if (isInjected.current) return
    if (!reservationActions || !kitchenActions || !cashActions || !clientActions) return

    // Inyectar todas las funciones de los contexts en los agentes
    orchestrator.injectContextActions({
      reservation:  reservationActions,
      kitchen:      kitchenActions,
      cash:         cashActions,
      client:       clientActions,
      complaint:    complaintActions,
      resolution:   resolutionActions,
      notification: (notification) => {
        // Agregar a la lista local de notificaciones
        setNotifications(prev => [notification, ...prev].slice(0, 30))

        // Mostrar toast según prioridad
        const toastMsg = `${notification.title}: ${notification.message}`
        if (notification.priority === NOTIFICATION_PRIORITY.URGENT) {
          toast.error(toastMsg, { duration: 6000 })
        } else if (notification.priority === NOTIFICATION_PRIORITY.IMPORTANT) {
          toast(toastMsg, {
            icon: '🔔',
            duration: 4500,
            style: { background: '#fff8e1', border: '1px solid #f59e0b', color: '#92400e' },
          })
        } else if (notification.priority === NOTIFICATION_PRIORITY.SUCCESS) {
          toast.success(toastMsg, { duration: 3500 })
        } else {
          toast(toastMsg, { duration: 3000 })
        }
      },
    })

    isInjected.current = true

    // Exponer el orquestador globalmente para debugging y benchmark desde la consola.
    // Permite ejecutar: window.__pardosOrchestrator.getSystemStatus()
    // o el benchmark: runBenchmark(window.__pardosOrchestrator)
    if (typeof window !== 'undefined') {
      window.__pardosOrchestrator = orchestrator
      window.__pardosEventBus     = eventBus
      console.log('[AgentContext] 🔧 Orquestador expuesto en window.__pardosOrchestrator')
    }

    // Auditor: engancha el EventBus para registrar toda actividad inter-agente.
    auditLogger.conectarEventBus()
  }, [reservationActions, kitchenActions, cashActions, clientActions, complaintActions, resolutionActions])

  // ── Polling del estado del sistema (cada 2 segundos) ─────────────────────
  useEffect(() => {
    const updateStatus = () => {
      setSystemStatus(orchestrator.getSystemStatus())
      setEventHistory(eventBus.getHistory(20))
    }

    // Actualización inmediata al montar
    updateStatus()

    // Polling cada 2 segundos para actualizar métricas en la UI
    const interval = setInterval(updateStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  // ── API pública del contexto ──────────────────────────────────────────────

  /**
   * approveReservation — Swarm que aprueba reserva + actualiza cliente en paralelo.
   */
  const approveReservation = useCallback(async (id, tableId, approvedBy, reservationData) => {
    return orchestrator.approveReservationSwarm({ id, tableId, approvedBy, reservationData })
  }, [])

  /**
   * seatWithKitchen — Swarm que sienta al cliente + crea ticket de cocina en paralelo.
   */
  const seatWithKitchen = useCallback(async (reservation) => {
    return orchestrator.seatWithKitchenSwarm({ reservation })
  }, [])

  /**
   * registerPayment — Swarm que registra pago + completa reserva en paralelo.
   */
  const registerPayment = useCallback(async (paymentData, reservation, shift, cashier) => {
    return orchestrator.registerPaymentSwarm({ paymentData, reservation, shift, cashier })
  }, [])

  /**
   * validateReservation — Valida una reserva usando el ReservationAgent.
   */
  const validateReservation = useCallback(async (data) => {
    return orchestrator.validateReservation(data)
  }, [])

  /**
   * clearNotifications — Limpia las notificaciones del panel.
   */
  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // ── Módulo de Quejas con IA (M1, M2, M3) ──────────────────────────────────

  /** triageComplaint — M1: analiza y registra una queja de cliente. */
  const triageComplaint = useCallback(async (data) => {
    return orchestrator.triageComplaint(data)
  }, [])

  /** askLeaderQuery — M2: responde una pregunta del líder sobre las quejas. */
  const askLeaderQuery = useCallback(async (pregunta) => {
    return orchestrator.askLeaderQuery(pregunta)
  }, [])

  /** auditProcess — M3: audita un proceso con Self-Consistency. */
  const auditProcess = useCallback(async (data) => {
    return orchestrator.auditProcess(data)
  }, [])

  // ── Módulo de Resolución con IA (M4) ──────────────────────────────────────

  /** resolveComplaintAction — M4: inicia resolución inteligente. */
  const resolveComplaintAction = useCallback(async (data) => {
    return orchestrator.resolveComplaint(data)
  }, [])

  /** proposeResponse — M4: genera propuesta RAG para una resolución. */
  const proposeResponse = useCallback(async (data) => {
    return orchestrator.proposeResponse(data)
  }, [])

  /** handleDirectResolution — M4: mesero se encarga directamente. */
  const handleDirectResolution = useCallback(async (data) => {
    return orchestrator.handleDirectResolution(data)
  }, [])

  /** cancelResolution — M4: cancela resolución. */
  const cancelResolution = useCallback(async (data) => {
    return orchestrator.cancelResolution(data)
  }, [])

  const value = {
    // Acceso directo al orquestador (para llamadas avanzadas)
    orchestrator,

    // Estado del sistema multiagente
    systemStatus,
    eventHistory,
    notifications,

    // Acciones orquestadas (Swarms)
    approveReservation,
    seatWithKitchen,
    registerPayment,
    validateReservation,
    clearNotifications,

    // Módulo de Quejas con IA
    triageComplaint,
    askLeaderQuery,
    auditProcess,

    // Módulo de Resolución (M4)
    resolveComplaintAction,
    proposeResponse,
    handleDirectResolution,
    cancelResolution,

    // Delegación directa a un agente específico
    delegate: (agentName, tool, params) => orchestrator.delegate(agentName, tool, params),
  }

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
}

export function useAgents() {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgents debe usarse dentro de <AgentProvider>')
  return ctx
}

export default AgentContext
