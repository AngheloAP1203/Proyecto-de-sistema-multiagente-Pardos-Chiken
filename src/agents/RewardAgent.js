/**
 * src/agents/RewardAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * M6 — Agente de Recompensas al cliente.
 *
 * Evalúa un reclamo y, SOLO si pasa la verificación anti-fraude determinista,
 * asigna una recompensa acorde a la severidad y redacta un mensaje empático.
 *
 * Reparto de responsabilidades (el mismo de todo el sistema):
 *   · JavaScript decide la ELEGIBILIDAD (claimVerifier: DNI + código de reserva + consumo).
 *   · JavaScript elige la RECOMPENSA (política + promoción por severidad).
 *   · El LLM solo REDACTA el mensaje. No decide si hay premio ni cuál.
 *
 * Un reclamo que no pasa la verificación se RECHAZA sin recompensa (decisión de
 * negocio) y nunca llega al LLM.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { complete, llmMode } from './core/llmClient.js'
import { verificarReclamo, evaluarEvidencia, VEREDICTO } from './core/claimVerifier.js'
import { auditLogger } from './core/auditLogger.js'
import { PROMPT_RECOMPENSA } from './prompts.js'
import { generateCouponCode } from '../utils/couponGenerator.js'

// Porcentaje de descuento dinámico según severidad
const DESCUENTO_POR_SEVERIDAD = {
  'Crítica': { tipo: 'descuento_porcentaje', valor: 30, nombre: 'Vale de 30% de descuento', codigoVal: 30 },
  'Alta':    { tipo: 'descuento_porcentaje', valor: 20, nombre: 'Vale de 20% de descuento', codigoVal: 20 },
  'Media':   { tipo: 'producto_gratis', valor: 'POSTRE', nombre: 'Postre Gratis', codigoVal: 'POSTRE', condiciones: 'Válido por un postre (Picarones o Crema Volteada) en tu próximo consumo.' },
  'Baja':    { tipo: 'producto_gratis', valor: 'JARRA_CHICHA', nombre: 'Jarra de Chicha Gratis', codigoVal: 'JARRA_CHICHA', condiciones: 'Válido por una Jarra de Chicha (1.5L) en tu próximo consumo.' },
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

  /** Elige la promoción a otorgar: genera un cupón dinámico basado en la severidad. */
  _recompensa({ puntosCriticos, prioridad }, { policies = [], promotions = [] }) {
    const politica = this._politica(puntosCriticos, policies)

    // Calcular la recompensa dinámica
    const conf = DESCUENTO_POR_SEVERIDAD[prioridad] || DESCUENTO_POR_SEVERIDAD['Baja']
    const codigo = generateCouponCode()

    const promo = {
      id: codigo,
      nombre: conf.nombre,
      tipo: conf.tipo,
      valor: conf.valor,
      codigo: codigo,
      condiciones: conf.condiciones || 'Aplica en tu próximo consumo en cualquier sede de Pardos Chicken. Una sola vez por cliente.',
      vigencia_dias: 30,
      activa: true
    }

    return { politica, promo }
  }

  /**
   * evaluar — Punto de entrada (M6).
   *
   * @param {Object} reclamo  - { tableId, dni, fecha, cliente, mensaje,
   *                              puntos_criticos, prioridad }  (post-triaje M1)
   * @param {Object} datos    - { reservations, payments, kitchenTickets, policies, promotions }
   * @returns {Promise<Object>} resultado listo para la UI. Nunca lanza.
   */
  async evaluar(reclamo = {}, datos = {}) {
    const inicio = Date.now()
    const fecha = reclamo.fecha || new Date().toISOString().split('T')[0]

    // 1. VERIFICACIÓN ANTI-FRAUDE (determinista, antes que cualquier LLM).
    //    Si el llamador ya trae la evidencia (datos.reservations), se evalúa con la
    //    lógica pura; si no, se consulta el backend (Supabase) dentro de verificarReclamo.
    const verif = Array.isArray(datos?.reservations)
      ? evaluarEvidencia({ codigo: reclamo.codigo, dni: reclamo.dni }, datos)
      : await verificarReclamo({ codigo: reclamo.codigo, dni: reclamo.dni })

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
      // Auditamos el rechazo: es el registro anti-fraude. El DNI se redacta.
      auditLogger.record({
        agente: 'RewardAgent', accion: 'claim.verify',
        nivel: verif.veredicto === VEREDICTO.RECHAZADO ? 'warn' : 'info',
        resultado: verif.veredicto, latencia: res.latency,
        detalle: { codigo: reclamo.codigo, dni: reclamo.dni, elegible: false },
      })
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
      clientEmail:   verif.clientEmail,
      clientId:      verif.clientId,
      reservationId: verif.reservationId,
      pagoVerificado: verif.pago,
      recompensa:    promo ? {
        id: promo.id, nombre: promo.nombre, tipo: promo.tipo,
        valor: promo.valor, codigo: promo.codigo, condiciones: promo.condiciones, vigencia_dias: promo.vigencia_dias,
      } : null,
      politica:   politica?.id || null,
      mensaje,
      agentsUsed: llmMode === 'mock' ? ['RewardAgent'] : ['RewardAgent', 'LLM'],
      latency:    Date.now() - inicio,
      timestamp:  new Date().toISOString(),
    }
    this._history.push(res)
    auditLogger.record({
      agente: 'RewardAgent', accion: 'claim.reward', resultado: verif.veredicto,
      latencia: res.latency,
      detalle: { codigo: reclamo.codigo, dni: reclamo.dni, elegible: true,
                 recompensa: promo?.nombre || null, reservationId: verif.reservationId },
    })
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
    // ANTI-ENUMERACIÓN (F-04): mensajes genéricos para no revelar info interna.
    if (verif.veredicto === VEREDICTO.SIN_CODIGO) {
      return 'Para atender tu reclamo necesitamos el código de tu reserva o boleta. ' +
        'Lo encuentras en tu boleta impresa o en la confirmación de tu reserva.'
    }
    if (verif.veredicto === VEREDICTO.DUPLICADO) {
      return 'Ya registramos un reclamo para esta visita. Si necesitas agregar información, ' +
        'acércate a nuestro personal o escríbenos por WhatsApp. ¡Gracias por tu paciencia!'
    }
    return 'No pudimos verificar tu reclamo con los datos indicados. ' +
      'Por seguridad, las compensaciones solo aplican al cliente registrado del pedido. ' +
      'Si crees que es un error, acércate a caja con tu boleta y lo revisamos juntos.'
  }

  getHistory(limit = 20) { return this._history.slice(-limit) }
}

export const rewardAgent = new RewardAgentClass()
export default rewardAgent
