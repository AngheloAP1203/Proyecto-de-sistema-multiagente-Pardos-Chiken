/**
 * src/agents/ForecastAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agente de Predicción de Demanda Dinámica.
 * Se encarga de analizar el historial de ventas y ajustar automáticamente
 * los puntos de reorden (stock_minimo) para evitar quiebres de stock.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AgentBase } from './core/AgentBase.js'
import { EVENT_TYPES } from './core/EventBus.js'
import { loadInventoryData, fetchVentasDesdePagos, updateStockMinimo } from '../data/api/inventoryApi.js'
import { planificarCompras } from '../domain/inventory/purchasePlanner.js'

const mananaISO = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export class ForecastAgent extends AgentBase {
  constructor() {
    super(
      'ForecastAgent',
      `Agente de predicción de demanda. Ajusta los mínimos de stock automáticamente basándose en tendencias de venta y fechas especiales.`
    )
    this._setupEventListeners()
  }

  _setupEventListeners() {
    // Escucha el cierre de caja para correr la predicción de mañana
    this.bus.subscribe(EVENT_TYPES.CASH_SHIFT_CLOSED, async (msg) => {
      try {
        console.log('[ForecastAgent] Evaluando predicción de demanda para mañana...')
        await this._ejecutarPrediccion(msg.correlationId)
      } catch (e) {
        console.warn('[ForecastAgent] Error al ejecutar predicción', e)
      }
    })
  }

  async _ejecutarPrediccion(correlationId) {
    const { supplies, recipes, suppliers } = await loadInventoryData()
    const ventas = await fetchVentasDesdePagos()
    const manana = mananaISO()

    // 1. Usar el planificador para simular el consumo de mañana (tiene en cuenta fechas especiales)
    const plan = planificarCompras({
      historico: ventas,
      fechaObjetivo: manana,
      recetas: recipes,
      supplies: supplies,
      suppliers: suppliers
    })

    const insumosAjustados = []

    // 2. Ajustar stock mínimo dinámicamente:
    // Si la demanda proyectada es mayor al stock mínimo actual, se sube el mínimo (como colchón).
    for (const [supplyId, cantidadProyectada] of Object.entries(plan.consumo_insumos)) {
      const insumo = supplies.find(s => s.id === supplyId)
      if (!insumo) continue

      // Regla dinámica: El stock mínimo para mañana debe ser al menos el 80% de lo que se va a consumir
      const nuevoMinimoSugerido = Math.ceil(cantidadProyectada * 0.8)
      const stockMinimoActual = Number(insumo.stock_minimo) || 0

      if (nuevoMinimoSugerido > stockMinimoActual) {
        await updateStockMinimo(supplyId, nuevoMinimoSugerido)
        insumosAjustados.push({
          nombre: insumo.nombre,
          anterior: stockMinimoActual,
          nuevo: nuevoMinimoSugerido,
          razon: plan.fecha_especial ? `Campaña: ${plan.fecha_especial.nombre}` : 'Ajuste de demanda'
        })
      }
    }

    if (insumosAjustados.length > 0) {
      this.bus.publish(EVENT_TYPES.INVENTORY_MINIMUM_ADJUSTED, {
        insumos: insumosAjustados,
        fecha_objetivo: manana
      }, this.name, correlationId || `forecast-${Date.now()}`)
      console.log(`[ForecastAgent] Stock mínimo ajustado para ${insumosAjustados.length} insumos.`)
    }
  }
}

export const forecastAgent = new ForecastAgent()
export default forecastAgent
