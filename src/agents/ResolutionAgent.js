/**
 * src/agents/ResolutionAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * MÓDULO 4 — Agente de Resolución Inteligente (RAG + cruce de dominios controlado).
 *
 * Cuando se registra una queja, identifica el problema, busca la mesa asociada,
 * verifica si el cliente ya pagó, y genera una notificación interactiva con 3
 * opciones de acción para el mesero/empleado.
 *
 * Si el mesero elige "Propón una respuesta", el agente evalúa políticas de
 * resolución y, si aplica, sugiere un cupón/vale de compensación.
 *
 * AISLAMIENTO: lee RESERVATIONS y TODAY_PAYMENTS solo a través de funciones
 * intermediarias que filtran y acotan los datos (anti-alucinación).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AgentBase } from './core/AgentBase.js'
import { EVENT_TYPES } from './core/EventBus.js'
import { MEMORY_KEYS } from './core/SharedMemory.js'
import { retrieveSimilar } from './core/ragStore.js'
import { complete } from './core/llmClient.js'

const PROMPT_RESOLUTION = `
Eres el Asistente de Resolución de Problemas de Pardos Chicken (Perú).
Tu trabajo es proponer una respuesta concreta y empática para que el mesero la ejecute.

Recibirás:
- El problema reportado por el cliente
- Si el cliente está en la mesa o ya pagó
- La política de resolución de la empresa para este tipo de problema
- Quejas similares anteriores (contexto RAG)
- Si aplica, la promoción/cupón sugerida

Tu respuesta debe ser:
1. Directa y accionable (el mesero debe saber exactamente qué hacer)
2. Empática con el cliente (tono Pardos: cercano, peruano, profesional)
3. Incluir el código del vale si se ofrece una promoción

AISLAMIENTO: solo usas la información que recibes. No inventes datos de otros sistemas.
`.trim()

export class ResolutionAgent extends AgentBase {
  constructor() {
    super(
      'ResolutionAgent',
      `Eres el agente de resolución inteligente de Pardos Chicken. Cruzas datos de
       quejas, mesas y pagos (de forma controlada) para generar notificaciones
       interactivas y proponer respuestas al personal. Usas RAG para enriquecer
       las propuestas con contexto de quejas similares.`,
      ['resolve_complaint', 'propose_response', 'handle_direct', 'cancel_resolution']
    )
    this._contextActions = null
    this._resolutionActions = null
    this._registerTools()
  }

  setContextActions(actions) { this._contextActions = actions }
  setResolutionActions(actions) { this._resolutionActions = actions }

  _registerTools() {
    this.registerTool('resolve_complaint', 'Inicia el flujo de resolución para una queja (busca mesa, verifica pago, notifica)', this._resolveComplaint)
    this.registerTool('propose_response', 'Genera una propuesta de respuesta usando RAG y políticas de resolución', this._proposeResponse)
    this.registerTool('handle_direct', 'Registra que el mesero se encargará directamente', this._handleDirect)
    this.registerTool('cancel_resolution', 'Cancela la resolución (mesa no registrada)', this._cancelResolution)
  }

  // ── Funciones intermediarias de lectura (anti-alucinación) ─────────────────

  _findTable(tableId) {
    if (!tableId) return null
    const reservations = this.memory.getValue(MEMORY_KEYS.RESERVATIONS, [])
    const match = reservations.find((r) =>
      String(r.tableId) === String(tableId) &&
      (r.status === 'seated' || r.status === 'approved' || r.status === 'confirmed')
    )
    if (!match) return null
    return { tableId: match.tableId, status: match.status, guestName: match.name || match.clientName || 'Cliente' }
  }

  _hasClientPaid(tableId) {
    if (!tableId) return false
    const payments = this.memory.getValue(MEMORY_KEYS.TODAY_PAYMENTS, [])
    const reservations = this.memory.getValue(MEMORY_KEYS.RESERVATIONS, [])
    const reservation = reservations.find((r) => String(r.tableId) === String(tableId))
    if (!reservation) return false
    return payments.some((p) => p.reservationId === reservation.id)
  }

  _findPolicy(puntosCriticos) {
    const policies = this.memory.getValue(MEMORY_KEYS.RESOLUTION_POLICIES, [])
    const texto = (puntosCriticos || []).join(' ').toLowerCase()
    return policies.find((pol) =>
      pol.palabras_clave?.some((kw) => texto.includes(kw)) || texto.includes(pol.problema)
    ) || null
  }

  _findPromotion(promoId) {
    if (!promoId) return null
    const promos = this.memory.getValue(MEMORY_KEYS.PROMOTIONS, [])
    return promos.find((p) => p.id === promoId && p.activa) || null
  }

  _findComplaint(complaintId) {
    const complaints = this.memory.getValue(MEMORY_KEYS.COMPLAINTS, [])
    return complaints.find((c) => c.id === complaintId) || null
  }

  _detectTableFromMessage(mensaje) {
    const m = String(mensaje || '').match(/mesa\s*#?\s*(\d+)/i)
    return m ? m[1] : null
  }

  // ── Tools ─────────────────────────────────────────────────────────────────

  async _resolveComplaint({ complaintId, tableId: explicitTableId }, correlationId) {
    const complaint = this._findComplaint(complaintId)
    if (!complaint) return { success: false, error: `Queja ${complaintId} no encontrada` }

    const tableId = explicitTableId || complaint.tableId || this._detectTableFromMessage(complaint.mensaje)
    const tableInfo = this._findTable(tableId)
    const hasPaid = this._hasClientPaid(tableId)
    const policy = this._findPolicy(complaint.puntos_criticos)
    const problema = (complaint.puntos_criticos || []).join(', ') || 'Problema general'

    const resolution = {
      id: `R${Date.now().toString().slice(-6)}`,
      complaintId,
      tableId: tableId || null,
      tableFound: !!tableInfo,
      guestName: tableInfo?.guestName || complaint.cliente || 'Cliente',
      problema,
      clientePago: hasPaid,
      policyId: policy?.id || null,
      accionElegida: null,
      respuestaRAG: null,
      promocion: null,
      status: 'pendiente',
      timestamp: new Date().toISOString(),
    }

    this._resolutionActions?.addResolution?.(resolution)

    const resolutions = this.memory.getValue(MEMORY_KEYS.ACTIVE_RESOLUTIONS, [])
    this.memory.set(MEMORY_KEYS.ACTIVE_RESOLUTIONS, [...resolutions, resolution], this.name)

    this.bus.publish(EVENT_TYPES.COMPLAINT_RESOLUTION_REQUESTED, {
      complaintId,
      resolutionId: resolution.id,
      tableId: tableId || null,
      problema,
      prioridad: complaint.prioridad,
      sede: complaint.sede,
      hasPaid,
      guestName: resolution.guestName,
    }, this.name, correlationId)

    return {
      success: true,
      result: resolution,
      notification: {
        actionable: true,
        title: tableId ? `PROBLEMA EN MESA ${tableId}` : `PROBLEMA REPORTADO`,
        message: `${problema} · ${complaint.prioridad} · ${complaint.sede}`,
        actions: [
          { id: 'direct', label: 'Me encargaré directamente', action: 'handle_direct' },
          { id: 'propose', label: 'Propón una respuesta', action: 'propose_response' },
          { id: 'cancel', label: 'Esa mesa no está registrada, cancela', action: 'cancel_resolution' },
        ],
        resolutionId: resolution.id,
      },
    }
  }

  async _proposeResponse({ resolutionId }, correlationId) {
    const resolution = this._getResolution(resolutionId)
    if (!resolution) return { success: false, error: `Resolución ${resolutionId} no encontrada` }

    const complaint = this._findComplaint(resolution.complaintId)
    const policy = resolution.policyId
      ? this.memory.getValue(MEMORY_KEYS.RESOLUTION_POLICIES, []).find((p) => p.id === resolution.policyId)
      : this._findPolicy(complaint?.puntos_criticos)

    const hasPaid = resolution.clientePago
    let promo = null
    let voucherCode = null

    if (hasPaid && policy?.requiere_promo && policy?.promo_sugerida) {
      promo = this._findPromotion(policy.promo_sugerida)
      if (promo) {
        voucherCode = this._resolutionActions?.generateVoucherCode?.(resolution.complaintId, promo.id)
          || `VALE-${resolution.complaintId}-${promo.id}`
      }
    }

    let similarContext = ''
    try {
      const similares = await retrieveSimilar(complaint?.mensaje || resolution.problema, 3)
      if (similares.length > 0) {
        const lines = similares.map((s) => `  - ${s.sede}: ${s.puntos_criticos?.join(', ') || s.texto} (${s.prioridad})`)
        similarContext = `\nQuejas similares recientes:\n${lines.join('\n')}`
      }
    } catch {}

    const accion = hasPaid ? (policy?.accion_pagado || 'Contactar al cliente con disculpa formal') : (policy?.accion_mesa || 'Dirigirse a la mesa y resolver el problema directamente')

    let propuesta
    try {
      const promptText = [
        `Problema: ${resolution.problema}`,
        `Mesa: ${resolution.tableId || 'No identificada'}`,
        `Cliente: ${resolution.guestName}`,
        `¿Ya pagó? ${hasPaid ? 'SÍ' : 'NO'}`,
        `Política de resolución: ${accion}`,
        promo ? `Promoción sugerida: ${promo.nombre} (${promo.condiciones}). Código: ${voucherCode}` : '',
        similarContext,
      ].filter(Boolean).join('\n')

      propuesta = await complete({ system: PROMPT_RESOLUTION, prompt: promptText, temperature: 0.3 })
    } catch {
      propuesta = hasPaid
        ? `El cliente ya pagó. ${accion}${promo ? ` Ofrecerle ${promo.nombre} con código ${voucherCode}.` : ''}`
        : `El cliente está en la mesa. ${accion}`
    }

    this._updateResolution(resolutionId, {
      accionElegida: 'proponer_respuesta',
      respuestaRAG: propuesta,
      promocion: promo ? { id: promo.id, nombre: promo.nombre, valor: promo.valor, tipo: promo.tipo, codigo: voucherCode } : null,
    })

    this.bus.publish(EVENT_TYPES.COMPLAINT_RESOLUTION_PROPOSED, {
      resolutionId,
      complaintId: resolution.complaintId,
      propuesta,
      hasPaid,
      promocion: promo?.nombre || null,
    }, this.name, correlationId)

    return {
      success: true,
      result: {
        propuesta,
        hasPaid,
        promocion: promo ? { ...promo, codigo: voucherCode } : null,
        similares: similarContext || null,
      },
    }
  }

  async _handleDirect({ resolutionId }, correlationId) {
    const resolution = this._getResolution(resolutionId)
    if (!resolution) return { success: false, error: `Resolución ${resolutionId} no encontrada` }

    this._updateResolution(resolutionId, { accionElegida: 'encargo_directo', status: 'aceptada' })
    this._updateComplaintStatus(resolution.complaintId, 'en_resolucion')

    this.bus.publish(EVENT_TYPES.COMPLAINT_RESOLUTION_ACTION, {
      resolutionId,
      complaintId: resolution.complaintId,
      accionElegida: 'encargo_directo',
    }, this.name, correlationId)

    this.bus.publish(EVENT_TYPES.COMPLAINT_RESOLVED, {
      complaintId: resolution.complaintId,
      resolutionId,
    }, this.name, correlationId)

    return { success: true, result: { message: 'Resolución aceptada. El mesero se encargará directamente.' } }
  }

  async _cancelResolution({ resolutionId }, correlationId) {
    const resolution = this._getResolution(resolutionId)
    if (!resolution) return { success: false, error: `Resolución ${resolutionId} no encontrada` }

    this._updateResolution(resolutionId, { accionElegida: 'cancelar', status: 'rechazada' })
    this._updateComplaintStatus(resolution.complaintId, 'nueva')

    this.bus.publish(EVENT_TYPES.COMPLAINT_RESOLUTION_ACTION, {
      resolutionId,
      complaintId: resolution.complaintId,
      accionElegida: 'cancelar',
    }, this.name, correlationId)

    return { success: true, result: { message: 'Resolución cancelada. La queja vuelve a estado "nueva".' } }
  }

  // ── Helpers internos ──────────────────────────────────────────────────────

  _getResolution(id) {
    const fromCtx = this._resolutionActions?.getResolution?.(id)
    if (fromCtx) return fromCtx
    const all = this.memory.getValue(MEMORY_KEYS.ACTIVE_RESOLUTIONS, [])
    return all.find((r) => r.id === id) || null
  }

  _updateResolution(id, updates) {
    this._resolutionActions?.updateResolution?.(id, updates)
    const all = this.memory.getValue(MEMORY_KEYS.ACTIVE_RESOLUTIONS, [])
    const updated = all.map((r) => r.id === id ? { ...r, ...updates } : r)
    this.memory.set(MEMORY_KEYS.ACTIVE_RESOLUTIONS, updated, this.name)
  }

  _updateComplaintStatus(complaintId, estado) {
    this._contextActions?.updateComplaint?.(complaintId, { estado })
    const complaints = this.memory.getValue(MEMORY_KEYS.COMPLAINTS, [])
    const updated = complaints.map((c) => c.id === complaintId ? { ...c, estado } : c)
    this.memory.set(MEMORY_KEYS.COMPLAINTS, updated, this.name)
  }
}

export const resolutionAgent = new ResolutionAgent()
export default resolutionAgent
