/**
 * src/agents/ClientAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agente especializado en la gestión del CRM de clientes.
 *
 * PRINCIPIO DE RESPONSABILIDAD ÚNICA (SRP):
 *   ClientAgent es el único dueño del perfil de los clientes.
 *   ReservationAgent NO crea clientes directamente; le pide a ClientAgent que lo haga.
 *
 * DETECCIÓN AUTOMÁTICA DE CLIENTES VIP:
 *   Regla: Un cliente con ≥ 5 reservas COMPLETADAS es promovido a VIP automáticamente.
 *   Flujo:
 *     1. Al aprobar una reserva, el Swarm llama a sync_from_reservation en paralelo.
 *     2. ClientAgent busca al cliente por teléfono.
 *     3. Si existe: incrementa contador y verifica umbral VIP (5 reservas).
 *     4. Si no existe: lo crea automáticamente con datos de la reserva.
 *     5. Si alcanzó el umbral: actualiza vip=true y lo registra en el log.
 *
 * PATRÓN OBSERVER (secundario):
 *   ClientAgent también escucha eventos del EventBus directamente via
 *   _setupAutoActions(), sin pasar por el Orquestador, para sincronizar
 *   el perfil de cliente automáticamente cuando se aprueba una reserva.
 *
 * INTERACCIÓN CON OTROS AGENTES (Swarm):
 *   - Swarm approve_reservation: activa EN PARALELO con ReservationAgent
 *
 * COMUNICACIÓN (MCP via EventBus):
 *   Publica: client:created, client:updated
 *   Suscrito a: reservation:approved
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AgentBase } from './core/AgentBase.js'
import { EVENT_TYPES } from './core/EventBus.js'
import { MEMORY_KEYS } from './core/SharedMemory.js'

// Umbral de reservas completadas para promoción automática a VIP
// Este es el criterio de negocio que distingue a los clientes frecuentes
const VIP_THRESHOLD = 5

export class ClientAgent extends AgentBase {
  constructor() {
    super(
      'ClientAgent',
      `Eres el agente de clientes de Pardos Chicken Miraflores.
       Tu ÚNICA responsabilidad es gestionar el perfil de clientes.
       
       REGLAS:
       1. Un cliente con 5 o más reservas completadas es automáticamente VIP
       2. Cuando se aprueba una reserva, busca al cliente por teléfono:
          - Si existe → actualiza su contador de reservas
          - Si no existe → créalo automáticamente
       3. Preserva las preferencias y alergias del cliente en cada visita
       4. Nunca elimines información de un cliente sin confirmación explícita
       
       Actúas EN PARALELO con el ReservationAgent en el flujo de aprobación.`,
      ['find_client', 'create_client', 'update_client', 'sync_from_reservation', 'mark_vip']
    )
    this._contextActions = null
    this._registerTools()

    // Suscribirse a eventos relevantes para actuar automáticamente
    this._setupAutoActions()
  }

  setContextActions(actions) {
    this._contextActions = actions
  }

  _setupAutoActions() {
    // Cuando se aprueba una reserva → actualizar/crear cliente automáticamente
    this.bus.subscribe(EVENT_TYPES.RESERVATION_APPROVED, async (message) => {
      const { payload } = message
      if (payload.reservationData && this._contextActions) {
        await this.execute('sync_from_reservation', {
          reservation: payload.reservationData,
        }, message.correlationId)
      }
    })
  }

  _registerTools() {
    this.registerTool(
      'find_client',
      'Busca un cliente por teléfono o email',
      this._findClient
    )
    this.registerTool(
      'create_client',
      'Crea un nuevo cliente en el sistema',
      this._createClient
    )
    this.registerTool(
      'update_client',
      'Actualiza el perfil de un cliente existente',
      this._updateClient
    )
    this.registerTool(
      'sync_from_reservation',
      'Sincroniza el perfil de cliente desde los datos de una reserva aprobada (acción paralela)',
      this._syncFromReservation
    )
    this.registerTool(
      'mark_vip',
      'Marca o desmarca un cliente como VIP manualmente',
      this._markVip
    )
    this.registerTool(
      'check_vip_threshold',
      'Verifica si un cliente alcanzó el umbral de VIP automático (5 reservas)',
      this._checkVipThreshold
    )
  }

  async _findClient({ phone, email }) {
    if (!phone && !email) return { success: false, error: 'Se requiere teléfono o email para buscar' }

    if (this._contextActions?.findByPhone && phone) {
      const client = this._contextActions.findByPhone(phone)
      return { success: true, client: client || null, found: !!client }
    }
    return { success: false, client: null, found: false }
  }

  async _createClient({ name, phone, email, notes = '', preferences = '', allergies = '' }, correlationId) {
    if (!name || !phone) return { success: false, error: 'Nombre y teléfono son requeridos' }

    if (this._contextActions?.addClient) {
      const client = this._contextActions.addClient({
        name, phone, email: email || '',
        notes, preferences, allergies,
        totalReservations: 1,
        vip: false,
        createdAt: new Date().toISOString(),
      })

      this.bus.publish(EVENT_TYPES.CLIENT_CREATED, {
        clientId: client?.id,
        name,
        phone,
      }, this.name, correlationId)

      return { success: true, client, message: `Cliente ${name} registrado` }
    }
    return { success: false }
  }

  async _updateClient({ clientId, updates }, correlationId) {
    if (!clientId) return { success: false, error: 'Se requiere ID de cliente' }

    if (this._contextActions?.updateClient) {
      this._contextActions.updateClient(clientId, updates)

      this.bus.publish(EVENT_TYPES.CLIENT_UPDATED, { clientId, updates }, this.name, correlationId)
      return { success: true, message: 'Cliente actualizado' }
    }
    return { success: false }
  }

  /**
   * _syncFromReservation — Acción paralela al ReservationAgent.
   * Cuando se aprueba una reserva, este agente actúa simultáneamente para
   * registrar o actualizar el cliente en el sistema.
   */
  async _syncFromReservation({ reservation }, correlationId) {
    if (!reservation || !this._contextActions) return { success: false }

    // Buscar si el cliente ya existe
    const existingClient = this._contextActions.findByPhone?.(reservation.clientPhone)

    if (existingClient) {
      // Cliente existente → incrementar contador de reservas
      const newCount = (existingClient.totalReservations || 0) + 1
      const isVip    = newCount >= VIP_THRESHOLD

      this._contextActions.updateClient?.(existingClient.id, {
        totalReservations: newCount,
        vip: isVip || existingClient.vip,
        email: existingClient.email || reservation.clientEmail || '',
        lastVisit: new Date().toISOString(),
      })

      if (isVip && !existingClient.vip) {
        this.log('info', `Cliente ${existingClient.name} alcanzó estatus VIP (${newCount} reservas)`)
      }

      return {
        success: true,
        action:  'updated',
        clientId: existingClient.id,
        newReservationCount: newCount,
        becameVip: isVip && !existingClient.vip,
      }
    } else {
      // Cliente nuevo → crear automáticamente
      const result = await this._createClient({
        name:  reservation.clientName,
        phone: reservation.clientPhone,
        email: reservation.clientEmail || '',
        notes: reservation.notes
          ? `Registrado vía aprobación de reserva. Nota: ${reservation.notes}`
          : 'Registrado automáticamente al aprobar reserva.',
      }, correlationId)

      return { ...result, action: 'created' }
    }
  }

  async _markVip({ clientId, vip = true }, correlationId) {
    return this._updateClient({ clientId, updates: { vip } }, correlationId)
  }

  async _checkVipThreshold({ clientId, totalReservations }) {
    const isVip = totalReservations >= VIP_THRESHOLD
    return {
      success: true,
      isVip,
      threshold: VIP_THRESHOLD,
      reservationsUntilVip: isVip ? 0 : VIP_THRESHOLD - totalReservations,
    }
  }
}

export const clientAgent = new ClientAgent()
export default clientAgent
