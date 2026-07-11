/**
 * src/agents/RewardAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * M6 — Agente de Recompensas al cliente.
 *
 * Evalúa un reclamo y, SOLO si pasa la verificación anti-fraude determinista,
 * asigna una recompensa acorde a la severidad y redacta un mensaje empático.
 *
 * Reparto de responsabilidades (el mismo de todo el sistema):
 *   · JavaScript decide la ELEGIBILIDAD (claimVerifier: teléfono + mesa + consumo).
 *   · JavaScript elige la RECOMPENSA (política + promoción por severidad).
 *   · El LLM solo REDACTA el mensaje. No decide si hay premio ni cuál.
 *
 * Un reclamo que no pasa la verificación se RECHAZA sin recompensa (decisión de
 * negocio) y nunca llega al LLM.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { complete, llmMode } from './core/llmClient.js'
import { verificarReclamo, VEREDICTO } from './core/claimVerifier.js'
import { PROMPT_RECOMPENSA } from './prompts.js'

// Recompensa por defecto según severidad, cuando ninguna política matchea el problema.
const PROMO_POR_SEVERIDAD = {
  'Crítica': 'P002',   // Vale S/30
  'Alta':    'P001',   // Vale 20%
  'Media':   'P004',   // 1/4 pollo de cortesía
  'Baja':    'P003',   // Delivery gratis
}

class RewardAgentClass {
  constructor() {
    this.name = 'RewardAgent'
    this._history = []
  }

  /** Busca la política de resolución cuyo problema matchea los puntos críticos. */
  _politica(puntosCriticos, policies = []) {
    const texto = (puntosCriticos || []).join(' ').toLowerCase()
    return policies.find(pol =>
      pol.palabras_clave?.some(kw => texto.includes(kw.toLowerCase())) ||
      (pol.problema && texto.includes(pol.problema))
    ) || null
  }

  /** Elige la promoción a otorgar: la de la política, o la default por severidad. */
  _recompensa({ puntosCriticos, prioridad }, { policies = [], promotions = [] }) {
    const politica = this._politica(puntosCriticos, policies)
    const promoId = (politica?.requiere_promo && politica.promo_sugerida) || PROMO_POR_SEVERIDAD[prioridad] || 'P001'
    const promo = promotions.find(p => p.id === promoId && p.activa)
      || promotions.find(p => p.activa)
      || null
    return { politica, promo }
  }

  /**
   * evaluar — Punto de entrada (M6).
   *
   * @param {Object} reclamo  - { tableId, telefono, fecha, cliente, mensaje,
   *                              puntos_criticos, prioridad }  (post-triaje M1)
   * @param {Object} datos    - { reservations, payments, kitchenTickets, policies, promotions }
   * @returns {Promise<Object>} resultado listo para la UI. Nunca lanza.
   */
  async evaluar(reclamo = {}, datos = {}) {
    const inicio = Date.now()
    const fecha = reclamo.fecha || new Date().toISOString().split('T')[0]

    // 1. VERIFICACIÓN ANTI-FRAUDE (determinista, antes que cualquier LLM).
    const verif = verificarReclamo({ tableId: reclamo.tableId, telefono: reclamo.telefono, fecha }, datos)

    if (!verif.elegible) {
      const res = {
        elegible:   false,
        veredicto:  verif.veredicto,
        recompensa: null,
        mensaje:    this._mensajeRechazo(verif),
        motivo:     verif.motivo,
        agentsUsed: ['RewardAgent'],
        latency:    Date.now() - inicio,
        timestamp:  new Date().toISOString(),
      }
      this._history.push(res)
      return res
    }

    // 2. RECOMPENSA (determinista, por severidad/política).
    const { politica, promo } = this._recompensa({
      puntosCriticos: reclamo.puntos_criticos, prioridad: reclamo.prioridad,
    }, datos)

    // 3. MENSAJE (el LLM solo redacta; si no hay LLM, plantilla determinista).
    const mensaje = await this._redactar({
      cliente: verif.cliente || reclamo.cliente,
      problema: (reclamo.puntos_criticos || []).join(', ') || reclamo.mensaje,
      recompensa: promo,
    })

    const res = {
      elegible:      true,
      veredicto:     verif.veredicto,
      cliente:       verif.cliente || reclamo.cliente,
      reservationId: verif.reservationId,
      pagoVerificado: verif.pago,
      recompensa:    promo ? {
        id: promo.id, nombre: promo.nombre, tipo: promo.tipo,
        valor: promo.valor, condiciones: promo.condiciones, vigencia_dias: promo.vigencia_dias,
      } : null,
      politica:   politica?.id || null,
      mensaje,
      agentsUsed: llmMode === 'mock' ? ['RewardAgent'] : ['RewardAgent', 'LLM'],
      latency:    Date.now() - inicio,
      timestamp:  new Date().toISOString(),
    }
    this._history.push(res)
    return res
  }

  async _redactar({ cliente, problema, recompensa }) {
    if (!recompensa) {
      return `¡Hola ${cliente || ''}! Lamentamos el inconveniente con ${problema}. ` +
        `Ya registramos tu caso y un asesor te contactará para compensarte. ¡Gracias por avisarnos!`
    }

    // Plantilla determinista (fallback sin LLM): siempre veraz sobre la recompensa.
    const plantilla = `¡Hola ${cliente || ''}! De verdad lamentamos lo de ${problema}. ` +
      `Como disculpa, te damos: ${recompensa.nombre}. ${recompensa.condiciones || ''} ` +
      `Gracias por reportarlo — nos ayudas a mejorar. ¡Te esperamos pronto!`

    if (llmMode === 'mock') return plantilla.trim()

    try {
      const texto = await complete({
        system: PROMPT_RECOMPENSA,
        prompt: JSON.stringify({
          cliente: cliente || 'cliente',
          problema,
          recompensa: { nombre: recompensa.nombre, condiciones: recompensa.condiciones },
        }),
        temperature: 0.6,
      })
      const limpio = String(texto).trim()
      // El LLM debe mencionar la recompensa; si no la nombra, usamos la plantilla veraz.
      return limpio && limpio.length > 20 ? limpio : plantilla.trim()
    } catch {
      return plantilla.trim()
    }
  }

  _mensajeRechazo(verif) {
    switch (verif.veredicto) {
      case VEREDICTO.SIN_MESA:
        return 'Para atender tu reclamo necesitamos el número de mesa donde consumiste. ' +
          'Sin ese dato no podemos verificar tu pedido ni asignarte una compensación.'
      case VEREDICTO.SIN_COMANDA:
        return 'No encontramos un pedido registrado en esa mesa para la fecha indicada. ' +
          'Si crees que es un error, acércate a caja con tu boleta y lo revisamos juntos.'
      case VEREDICTO.RECHAZADO:
        return 'No pudimos verificar que el reclamo corresponda a quien consumió en esa mesa. ' +
          'Por seguridad, las compensaciones solo aplican al cliente registrado del pedido. ' +
          'Si es un error, acércate a caja con tu boleta.'
      default:
        return 'No pudimos verificar tu reclamo en este momento.'
    }
  }

  getHistory(limit = 20) { return this._history.slice(-limit) }
}

export const rewardAgent = new RewardAgentClass()
export default rewardAgent
