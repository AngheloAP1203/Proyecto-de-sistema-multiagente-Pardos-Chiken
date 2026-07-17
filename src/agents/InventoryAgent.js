/**
 * src/agents/InventoryAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * M7 — Agente de almacén y planificación de compras.
 *
 * PRINCIPIO DE RESPONSABILIDAD ÚNICA (SRP):
 *   InventoryAgent es el único agente que conoce recetas (BOM), stock,
 *   proveedores y fechas especiales. No cobra, no cocina, no reserva:
 *   planifica el reabastecimiento.
 *
 * AUTOMATIZA EL TRABAJO MANUAL DEL JEFE DE ALMACÉN:
 *   1. Convierte ventas por plato en consumo de insumos (explosión BOM):
 *      "20 × 1/4 pollo = 5 pollos enteros + 5 kg de papa"
 *   2. Proyecta la demanda de mañana (promedio por día de semana del histórico)
 *   3. Ajusta por fechas especiales peruanas (Día de la Madre ×2.5,
 *      Día del Pollo a la Brasa ×3, Fiestas Patrias ×2…)
 *   4. Cruza contra el stock y arma la orden de compra con el proveedor
 *      más barato registrado y su contacto real.
 *
 * TODO EL CÁLCULO ES DETERMINISTA (domain/inventory/purchasePlanner.js).
 * El LLM solo narra el plan; cada cifra es trazable a la salida de la tool
 * (numberGuard). Los contactos de proveedores salen del seed investigado,
 * jamás los genera el modelo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AgentBase } from './core/AgentBase.js'
import { EVENT_TYPES } from './core/EventBus.js'
import { planificarCompras, explotarVentasAInsumos, calcularConsumoDia, aplicarStockVivo } from '../domain/inventory/purchasePlanner.js'
import { loadInventoryData, fetchVentasDesdePagos, fetchSupplyBatches } from '../data/api/inventoryApi.js'

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export class InventoryAgent extends AgentBase {
  constructor() {
    super(
      'InventoryAgent',
      `Eres el agente de almacén y compras de Pardos Chicken Miraflores.
       Tu ÚNICA responsabilidad es planificar el reabastecimiento de insumos.

       REGLAS CRÍTICAS:
       1. Las cantidades a comprar las calcula el planificador determinista, nunca tú
       2. Solo recomiendas proveedores del registro; jamás inventes contactos ni precios
       3. Los precios del seed son referenciales: recuérdalo al narrar
       4. En fechas especiales (Día de la Madre, Día del Pollo a la Brasa) la
          demanda se multiplica — comunica siempre el factor aplicado`,
      ['plan_purchases', 'explode_sales_to_supplies', 'get_stock']
    )
    this._registerTools()
    this._setupEventListeners()
  }

  /**
   * _setupEventListeners — AUTOMATIZACIÓN EVENT-DRIVEN.
   *
   * Cada vez que se COBRA un pedido (cash:payment_registered), el agente
   * recalcula el stock disponible del día a partir de los cobros reales y, si
   * algún insumo cayó por debajo de su mínimo, publica `inventory:low_stock`.
   * El NotificationAgent lo convierte en una alerta para el líder de almacén.
   *
   * Nadie pregunta ni pulsa un botón: el proceso corre solo tras el cobro.
   * Envuelto en try/catch para no interferir jamás con el flujo de caja.
   */
  _setupEventListeners() {
    this.bus.subscribe(EVENT_TYPES.CASH_PAYMENT_REGISTERED, async (msg) => {
      try {
        const bajos = await this._detectarBajoStock()
        if (bajos.length > 0) {
          this.bus.publish(EVENT_TYPES.INVENTORY_LOW_STOCK, {
            insumos: bajos.map(b => ({ nombre: b.nombre, disponible: b.stock_actual, minimo: b.stock_minimo, unidad: b.unidad })),
            disparado_por: 'cobro',
          }, this.name, msg.correlationId || `inv-${Date.now()}`)
        }

        // Nueva Automatización: Chequeo de caducidad (FIFO)
        const porVencer = await this._detectarLotesPorVencer()
        if (porVencer.length > 0) {
          this.bus.publish(EVENT_TYPES.INVENTORY_EXPIRING_SOON, {
            lotes: porVencer,
            disparado_por: 'cobro',
          }, this.name, msg.correlationId || `inv-exp-${Date.now()}`)
        }
      } catch (e) {
        console.warn('[InventoryAgent] No se pudo evaluar el stock tras el cobro', e)
      }
    })
  }

  /** Busca lotes que vencen en <= 2 días */
  async _detectarLotesPorVencer() {
    const lotes = await fetchSupplyBatches()
    if (!lotes || lotes.length === 0) return []
    
    const hoy = new Date()
    const msEnDosDias = 2 * 24 * 60 * 60 * 1000
    
    return lotes.filter(l => {
      if (l.cantidad_restante <= 0) return false
      const caducidad = new Date(l.fecha_caducidad)
      const diff = caducidad.getTime() - hoy.getTime()
      return diff <= msEnDosDias
    }).map(l => ({
      loteId: l.id,
      insumo: l.supply_id,
      fecha_caducidad: l.fecha_caducidad,
      restante: l.cantidad_restante
    }))
  }

  /** Recalcula el stock disponible de hoy y devuelve los insumos bajo mínimo. */
  async _detectarBajoStock() {
    const { supplies, recipes } = await loadInventoryData()
    const ventas = await fetchVentasDesdePagos()
    const ventasHoy = ventas.filter(v => v.fecha === hoyISO())
    const consumo = calcularConsumoDia(ventasHoy, recipes, supplies)
    return aplicarStockVivo(supplies, consumo).filter(s => s.bajo_minimo)
  }

  _registerTools() {
    this.registerTool(
      'plan_purchases',
      'Genera el plan de compras para una fecha: proyección de demanda, consumo de insumos y orden con proveedor más barato',
      this._planPurchases
    )
    this.registerTool(
      'explode_sales_to_supplies',
      'Convierte ventas por plato en consumo de insumos usando las recetas (BOM)',
      this._explodeSales
    )
    this.registerTool(
      'get_stock',
      'Devuelve el stock actual del almacén por insumo con su mínimo de seguridad',
      this._getStock
    )
  }

  /**
   * @param {Object} p { historico: [{fecha, menuId, qty}], fechaObjetivo: 'YYYY-MM-DD' }
   */
  async _planPurchases({ historico = [], fechaObjetivo }) {
    if (!fechaObjetivo) {
      return { success: false, error: 'Se requiere fechaObjetivo (YYYY-MM-DD)' }
    }
    const { supplies, recipes, suppliers } = await loadInventoryData()
    const plan = planificarCompras({
      historico,
      fechaObjetivo,
      recetas:   recipes,
      supplies:  supplies,
      suppliers: suppliers,
    })
    return { success: true, ...plan }
  }

  async _explodeSales({ ventas = [] }) {
    const { recipes } = await loadInventoryData()
    const { insumos, sin_receta } = explotarVentasAInsumos(ventas, recipes)
    return { success: true, insumos, sin_receta }
  }

  async _getStock() {
    const { supplies } = await loadInventoryData()
    return {
      success: true,
      insumos: supplies.map(s => ({
        id: s.id, nombre: s.nombre, unidad: s.unidad,
        stock_actual: s.stock_actual, stock_minimo: s.stock_minimo,
        bajo_minimo: s.stock_actual < s.stock_minimo,
      })),
    }
  }
}

export const inventoryAgent = new InventoryAgent()
export default inventoryAgent
