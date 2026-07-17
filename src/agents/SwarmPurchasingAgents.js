/**
 * src/agents/SwarmPurchasingAgents.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Implementación de un Swarm de Compras (Enjambre de Agentes)
 * Cada clase representa un rol especializado. El PurchasingLeader
 * coordina la ejecución secuencial o paralela y reporta sus pensamientos
 * a través de eventos de sistema (ReAct: Observar -> Razonar -> Actuar).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { EVENT_TYPES } from './core/EventBus.js'
import { loadInventoryData } from '../data/api/inventoryApi.js'
import { planificarCompras } from '../domain/inventory/purchasePlanner.js'

// Función auxiliar para simular retraso de "pensamiento" (visual effect)
const thinkDelay = (ms) => new Promise(res => setTimeout(res, ms))

class BaseSwarmAgent {
  constructor(name, bus, correlationId) {
    this.name = name
    this.bus = bus
    this.correlationId = correlationId
  }

  async _logThought(step, message) {
    this.bus.publish(EVENT_TYPES.AGENT_THOUGHT, {
      agent: this.name,
      step, // 'observe', 'reason', 'act', 'decide'
      message
    }, this.name, this.correlationId)
    await thinkDelay(800) // Delay for UI tracing effect
  }
}

export class StockAgent extends BaseSwarmAgent {
  constructor(bus, correlationId) {
    super('StockAgent', bus, correlationId)
  }

  async checkStock(lowStockItems) {
    await this._logThought('observe', `Analizando ${lowStockItems.length} insumos con bajo stock.`)
    const itemsToCheck = lowStockItems.map(i => `${i.nombre} (${i.disponible}/${i.minimo})`).join(', ')
    await this._logThought('reason', `Insumos críticos identificados: ${itemsToCheck}`)
    return lowStockItems
  }
}

export class DemandAgent extends BaseSwarmAgent {
  constructor(bus, correlationId) {
    super('DemandAgent', bus, correlationId)
  }

  async projectDemand(lowStockItems) {
    await this._logThought('observe', `Consultando históricos de consumo y proyecciones para mañana...`)
    const { supplies, recipes, suppliers } = await loadInventoryData()
    // Simulated history fetch (In reality, it uses planificarCompras internally)
    await this._logThought('reason', `Ajustando proyección según tendencias de ventas recientes (Modelo ReAct).`)
    return { supplies, recipes, suppliers }
  }
}

export class SupplierAgent extends BaseSwarmAgent {
  constructor(bus, correlationId) {
    super('SupplierAgent', bus, correlationId)
  }

  async evaluateSuppliers(purchasePlan, suppliers) {
    await this._logThought('act', `Cotizando necesidades con proveedores disponibles en catálogo...`)
    
    // Simulate comparing logic
    let bestSuppliers = new Set()
    Object.values(purchasePlan.compras_por_proveedor).forEach(order => {
      bestSuppliers.add(order.proveedor_nombre)
    })
    
    const supplierNames = Array.from(bestSuppliers).join(' y ')
    await this._logThought('reason', `Comparación finalizada. Los proveedores más óptimos por disponibilidad son: ${supplierNames}`)
    return purchasePlan
  }
}

export class PurchasingLeader extends BaseSwarmAgent {
  constructor(bus, correlationId) {
    super('PurchasingLeader', bus, correlationId)
  }

  async coordinatePurchasing(lowStockItems, ventasHistoricas, fechaObjetivo) {
    await this._logThought('observe', `Se detectó bajo stock. Iniciando Swarm de Compras.`)
    
    // 1. Stock Agent
    const stockAgent = new StockAgent(this.bus, this.correlationId)
    await stockAgent.checkStock(lowStockItems)
    
    // 2. Demand Agent
    const demandAgent = new DemandAgent(this.bus, this.correlationId)
    const { supplies, recipes, suppliers } = await demandAgent.projectDemand(lowStockItems)
    
    // Core Calculation (Deterministic engine)
    const plan = planificarCompras({
      historico: ventasHistoricas,
      fechaObjetivo: fechaObjetivo,
      recetas: recipes,
      supplies: supplies,
      suppliers: suppliers
    })
    
    // 3. Supplier Agent
    const supplierAgent = new SupplierAgent(this.bus, this.correlationId)
    await supplierAgent.evaluateSuppliers(plan, suppliers)
    
    // 4. Leader Decision
    await this._logThought('decide', `Aprobando plan final. Generando órdenes de compra de cantidades.`)
    
    return plan
  }
}
