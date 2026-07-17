/**
 * src/data/seeds/suppliesSeed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Catálogo de insumos del almacén (M7 — Planificación de compras).
 *
 * Cada insumo es la unidad en la que COMPRA el jefe de almacén, no la unidad
 * en la que se vende el plato. La conversión plato → insumo vive en
 * recipesSeed.js (lista de materiales / BOM).
 *
 * `stock_actual` es el inventario del seed (demo). `stock_minimo` es el
 * colchón de seguridad: el plan de compras nunca deja el almacén por debajo
 * de este nivel.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const SUPPLIES = [
  // ── Proteínas ──
  { id: 'POLLO_ENTERO',  nombre: 'Pollo entero fresco (~2.4 kg)', unidad: 'unidad', categoria: 'proteina', stock_actual: 22, stock_minimo: 10 },
  { id: 'CARNE_LOMO',    nombre: 'Lomo de res',                   unidad: 'kg',     categoria: 'proteina', stock_actual: 6,  stock_minimo: 3 },
  { id: 'CARNE_BIFE',    nombre: 'Bife de res',                   unidad: 'kg',     categoria: 'proteina', stock_actual: 5,  stock_minimo: 3 },
  { id: 'CORAZON_RES',   nombre: 'Corazón de res (anticucho)',    unidad: 'kg',     categoria: 'proteina', stock_actual: 4,  stock_minimo: 2 },
  { id: 'MOLLEJA_POLLO', nombre: 'Mollejitas de pollo',           unidad: 'kg',     categoria: 'proteina', stock_actual: 3,  stock_minimo: 2 },
  { id: 'FILETE_POLLO',  nombre: 'Filete de pollo (chicharrón/brocheta/panko)', unidad: 'kg', categoria: 'proteina', stock_actual: 8, stock_minimo: 4 },
  { id: 'CHORIZO_CKTL',  nombre: 'Chorizo cocktail',              unidad: 'unidad', categoria: 'proteina', stock_actual: 60, stock_minimo: 24 },

  // ── Abarrotes de cocina ──
  { id: 'MASA_TEQUENO',  nombre: 'Masa para tequeños (unidad)',   unidad: 'unidad', categoria: 'abarrote', stock_actual: 90, stock_minimo: 36 },
  { id: 'QUESO',         nombre: 'Queso para tequeños',           unidad: 'kg',     categoria: 'abarrote', stock_actual: 2,  stock_minimo: 1 },
  { id: 'PANKO',         nombre: 'Panko / apanadura',             unidad: 'kg',     categoria: 'abarrote', stock_actual: 3,  stock_minimo: 1 },
  { id: 'ACEITE',        nombre: 'Aceite vegetal (fritura)',      unidad: 'L',      categoria: 'abarrote', stock_actual: 15, stock_minimo: 8 },
  { id: 'CREMAS',        nombre: 'Cremas y ajíes (mayonesa, ají, chimichurri)', unidad: 'kg', categoria: 'abarrote', stock_actual: 6, stock_minimo: 3 },
  { id: 'AZUCAR',        nombre: 'Azúcar rubia',                  unidad: 'kg',     categoria: 'abarrote', stock_actual: 10, stock_minimo: 5 },

  // ── Verduras y frutas (ensaladas, guarniciones, chicha) ──
  { id: 'PAPA',          nombre: 'Papa para freír',               unidad: 'kg',     categoria: 'verdura', stock_actual: 40, stock_minimo: 20 },
  { id: 'LECHUGA',       nombre: 'Lechuga',                       unidad: 'unidad', categoria: 'verdura', stock_actual: 12, stock_minimo: 6 },
  { id: 'TOMATE',        nombre: 'Tomate',                        unidad: 'kg',     categoria: 'verdura', stock_actual: 5,  stock_minimo: 3 },
  { id: 'ZANAHORIA',     nombre: 'Zanahoria',                     unidad: 'kg',     categoria: 'verdura', stock_actual: 4,  stock_minimo: 2 },
  { id: 'BETERRAGA',     nombre: 'Beterraga',                     unidad: 'kg',     categoria: 'verdura', stock_actual: 3,  stock_minimo: 2 },
  { id: 'VAINITA',       nombre: 'Vainita',                       unidad: 'kg',     categoria: 'verdura', stock_actual: 2,  stock_minimo: 1 },
  { id: 'CHOCLO',        nombre: 'Choclo desgranado',             unidad: 'kg',     categoria: 'verdura', stock_actual: 3,  stock_minimo: 2 },
  { id: 'PALTA',         nombre: 'Palta',                         unidad: 'unidad', categoria: 'verdura', stock_actual: 10, stock_minimo: 5 },
  { id: 'PEPINO',        nombre: 'Pepino',                        unidad: 'unidad', categoria: 'verdura', stock_actual: 8,  stock_minimo: 4 },
  { id: 'LIMON',         nombre: 'Limón',                         unidad: 'kg',     categoria: 'verdura', stock_actual: 3,  stock_minimo: 2 },
  { id: 'MAIZ_MORADO',   nombre: 'Maíz morado (chicha)',          unidad: 'kg',     categoria: 'verdura', stock_actual: 6,  stock_minimo: 3 },
  { id: 'PINA',          nombre: 'Piña (chicha)',                 unidad: 'unidad', categoria: 'verdura', stock_actual: 4,  stock_minimo: 2 },
  { id: 'ESPECIAS_CHICHA', nombre: 'Canela y clavo (chicha)',     unidad: 'kg',     categoria: 'abarrote', stock_actual: 1, stock_minimo: 0.5 },

  // ── Bebidas embotelladas (se compran listas) ──
  { id: 'GASEOSA_500',   nombre: 'Coca Cola / Inca Kola 500 ml',  unidad: 'unidad', categoria: 'bebida', stock_actual: 48, stock_minimo: 24 },
  { id: 'GASEOSA_15L',   nombre: 'Coca Cola / Inca Kola 1.5 L',   unidad: 'unidad', categoria: 'bebida', stock_actual: 24, stock_minimo: 12 },
  { id: 'INKA_25L',      nombre: 'Inca Kola 2.5 L sin azúcar',    unidad: 'unidad', categoria: 'bebida', stock_actual: 12, stock_minimo: 6 },
  { id: 'AGUA',          nombre: 'Agua con/sin gas (botella)',    unidad: 'unidad', categoria: 'bebida', stock_actual: 36, stock_minimo: 18 },

  // ── Postres (se compran por porción a repostería) ──
  { id: 'POSTRE_TORTA_CHOC', nombre: 'Torta de chocolate (porción)',   unidad: 'porcion', categoria: 'postre', stock_actual: 8, stock_minimo: 4 },
  { id: 'POSTRE_TRES_LECHES', nombre: 'Tres leches (porción)',         unidad: 'porcion', categoria: 'postre', stock_actual: 8, stock_minimo: 4 },
  { id: 'POSTRE_PIE_LIMON',  nombre: 'Pie de limón (porción)',         unidad: 'porcion', categoria: 'postre', stock_actual: 8, stock_minimo: 4 },
  { id: 'POSTRE_CHEESECAKE', nombre: 'Cheesecake de fresa (porción)',  unidad: 'porcion', categoria: 'postre', stock_actual: 8, stock_minimo: 4 },

  // ── Combustible y descartables ──
  { id: 'CARBON',        nombre: 'Carbón vegetal',                unidad: 'kg',     categoria: 'combustible', stock_actual: 50, stock_minimo: 30 },
  { id: 'VASO_DESC',     nombre: 'Vaso descartable (chicha/refresco)', unidad: 'unidad', categoria: 'descartable', stock_actual: 200, stock_minimo: 100 },
  { id: 'CONT_DESC',     nombre: 'Contenedor descartable (delivery/sobras)', unidad: 'unidad', categoria: 'descartable', stock_actual: 120, stock_minimo: 60 },
  { id: 'SERVILLETA',    nombre: 'Servilletas',                   unidad: 'unidad', categoria: 'descartable', stock_actual: 800, stock_minimo: 400 },
  { id: 'BOLSA',         nombre: 'Bolsa para llevar',             unidad: 'unidad', categoria: 'descartable', stock_actual: 150, stock_minimo: 80 },
]

export default SUPPLIES
