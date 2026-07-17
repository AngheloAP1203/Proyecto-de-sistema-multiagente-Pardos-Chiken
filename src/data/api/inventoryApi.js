import { supabase } from '../../domain/supabase.js'
import { RECIPES as seedRecipes } from '../seeds/recipesSeed.js'
import { SUPPLIES as seedSupplies } from '../seeds/suppliesSeed.js'
import { SUPPLIERS as seedSuppliers } from '../seeds/suppliersSeed.js'

/**
 * Carga el estado actual del almacén (insumos, recetas, proveedores, fechas)
 * desde Supabase. Si hay un error o las tablas están vacías, hace fallback a los seeds.
 */
export async function loadInventoryData() {
  let supplies = seedSupplies
  let recipes = seedRecipes
  let suppliers = seedSuppliers

  try {
    // 1. Insumos
    const { data: dbSupplies, error: e1 } = await supabase.from('supplies').select('*')
    if (!e1 && dbSupplies && dbSupplies.length > 0) {
      supplies = dbSupplies
    }

    // 2. Recetas
    const { data: dbRecipes, error: e2 } = await supabase.from('recipes').select('*')
    if (!e2 && dbRecipes && dbRecipes.length > 0) {
      const groupedRecipes = {}
      for (const row of dbRecipes) {
        if (!groupedRecipes[row.menu_code]) groupedRecipes[row.menu_code] = []
        groupedRecipes[row.menu_code].push({
          supplyId: row.supply_id,
          cantidad: Number(row.cantidad)
        })
      }
      recipes = groupedRecipes
    }

    // 3. Proveedores y precios
    const { data: dbSuppliers, error: e3 } = await supabase.from('suppliers').select('*')
    const { data: dbPrices, error: e4 } = await supabase.from('supplier_prices').select('*')
    
    if (!e3 && !e4 && dbSuppliers && dbSuppliers.length > 0 && dbPrices) {
      const pricesBySupplier = {}
      for (const price of dbPrices) {
        if (!pricesBySupplier[price.supplier_id]) pricesBySupplier[price.supplier_id] = []
        pricesBySupplier[price.supplier_id].push({
          supplyId: price.supply_id,
          precio: Number(price.precio),
          unidad: price.unidad
        })
      }

      suppliers = dbSuppliers.map(s => ({
        id: s.id,
        nombre: s.nombre,
        categoria: s.categoria,
        contacto: { telefono: s.telefono, whatsapp: s.whatsapp, web: s.web, direccion: s.direccion },
        fuente: s.fuente,
        activo: s.activo,
        precio_referencial: s.precio_referencial,
        precios: pricesBySupplier[s.id] || []
      }))
    }
  } catch (error) {
    console.warn('[inventoryApi] Error cargando datos de Supabase, usando fallback (seeds)', error)
  }

  return { supplies, recipes, suppliers }
}

/**
 * fetchPaymentsItems — Trae los pagos (cobros) desde Supabase con sus líneas de
 * consumo, para derivar el consumo real de insumos. Devuelve
 * [{ fecha, menuId, qty }] listo para el planificador y el cálculo de stock.
 *
 * Fuente de verdad = pagos realmente cobrados. Si no hay conexión, [].
 */
export async function fetchVentasDesdePagos() {
  try {
    const { data, error } = await supabase.from('payments').select('date, items')
    if (error || !data) return []
    const ventas = []
    for (const p of data) {
      const lineas = p.items?.lineas || []
      for (const it of lineas) {
        const menuId = it.menuId || it.itemId
        if (!menuId) continue
        ventas.push({ fecha: p.date, menuId, qty: Number(it.qty) || 0 })
      }
    }
    return ventas
  } catch (e) {
    console.warn('[inventoryApi] No se pudieron leer los pagos', e)
    return []
  }
}

/**
 * fetchSupplyBatches — Trae los lotes de insumos y sus fechas de caducidad.
 */
export async function fetchSupplyBatches() {
  try {
    const { data, error } = await supabase.from('supply_batches').select('*')
    if (error || !data) return []
    return data
  } catch (e) {
    console.warn('[inventoryApi] Error obteniendo lotes', e)
    return []
  }
}

/**
 * updateStockMinimo — Actualiza el stock mínimo sugerido por el ForecastAgent.
 */
export async function updateStockMinimo(supplyId, newMinimo) {
  try {
    const { error } = await supabase
      .from('supplies')
      .update({ stock_minimo: newMinimo })
      .eq('id', supplyId)
    if (error) throw error
    return true
  } catch (e) {
    console.warn(`[inventoryApi] Error actualizando stock mínimo para ${supplyId}`, e)
    return false
  }
}
