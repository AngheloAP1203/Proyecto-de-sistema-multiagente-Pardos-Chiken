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
import toast from 'react-hot-toast'

// Importar el tipo de prioridad para los toasts
import { NOTIFICATION_PRIORITY } from '../agents/NotificationAgent.js'

const AgentContext = createContext(null)

export function AgentProvider({ children, reservationActions, kitchenActions, cashActions, clientActions }) {
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
      // El NotificationAgent recibe un callback para disparar toasts
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
  }, [reservationActions, kitchenActions, cashActions, clientActions])

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
