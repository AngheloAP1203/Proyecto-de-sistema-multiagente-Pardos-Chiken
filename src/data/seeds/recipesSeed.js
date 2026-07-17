/**
 * src/data/seeds/recipesSeed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lista de materiales (BOM): traduce cada plato de la carta (MENU_ITEMS, por id)
 * a los insumos del almacén (SUPPLIES, por id) que consume UNA unidad vendida.
 *
 * Es la pieza que convierte "se vendieron 20 × 1/4 Pardos Brasa" en
 * "se consumieron 5 pollos enteros y 5 kg de papa".
 *
 * Cantidades = consumo estándar por porción (receta de operación, no de chef):
 *   - 1/4 pollo = 0.25 POLLO_ENTERO · 1/2 = 0.5 · entero = 1
 *   - El carbón se prorratea por pollo servido (~1 kg por pollo entero).
 *   - Todo plato de mesa consume servilletas; las bebidas frías, vaso descartable.
 *
 * Los platos sin receta registrada se reportan en el plan de compras como
 * "sin receta" — nunca se ignoran en silencio.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const RECIPES = {
  // ── Aperitivos ──
  A01: [ { supplyId: 'CHORIZO_CKTL', cantidad: 4 }, { supplyId: 'CREMAS', cantidad: 0.03 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  A02: [ { supplyId: 'CORAZON_RES', cantidad: 0.15 }, { supplyId: 'PAPA', cantidad: 0.1 }, { supplyId: 'CHOCLO', cantidad: 0.05 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  A03: [ { supplyId: 'MASA_TEQUENO', cantidad: 3 }, { supplyId: 'QUESO', cantidad: 0.06 }, { supplyId: 'ACEITE', cantidad: 0.05 }, { supplyId: 'CREMAS', cantidad: 0.03 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  A04: [ { supplyId: 'MASA_TEQUENO', cantidad: 6 }, { supplyId: 'QUESO', cantidad: 0.12 }, { supplyId: 'ACEITE', cantidad: 0.08 }, { supplyId: 'CREMAS', cantidad: 0.05 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],

  // ── Piqueos ──
  P01: [ { supplyId: 'CHORIZO_CKTL', cantidad: 6 }, { supplyId: 'PAPA', cantidad: 0.15 }, { supplyId: 'CREMAS', cantidad: 0.04 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  P02: [ { supplyId: 'FILETE_POLLO', cantidad: 0.2 }, { supplyId: 'PAPA', cantidad: 0.15 }, { supplyId: 'CREMAS', cantidad: 0.04 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  P03: [ { supplyId: 'MOLLEJA_POLLO', cantidad: 0.25 }, { supplyId: 'PAPA', cantidad: 0.15 }, { supplyId: 'CREMAS', cantidad: 0.04 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  P04: [ { supplyId: 'CORAZON_RES', cantidad: 0.2 }, { supplyId: 'PAPA', cantidad: 0.15 }, { supplyId: 'CREMAS', cantidad: 0.04 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  P05: [ { supplyId: 'FILETE_POLLO', cantidad: 0.18 }, { supplyId: 'PANKO', cantidad: 0.05 }, { supplyId: 'ACEITE', cantidad: 0.08 }, { supplyId: 'CREMAS', cantidad: 0.03 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  P06: [ { supplyId: 'FILETE_POLLO', cantidad: 0.36 }, { supplyId: 'PANKO', cantidad: 0.1 }, { supplyId: 'ACEITE', cantidad: 0.12 }, { supplyId: 'CREMAS', cantidad: 0.05 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  P07: [ { supplyId: 'FILETE_POLLO', cantidad: 0.25 }, { supplyId: 'PANKO', cantidad: 0.06 }, { supplyId: 'ACEITE', cantidad: 0.1 }, { supplyId: 'CREMAS', cantidad: 0.04 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  P08: [ { supplyId: 'FILETE_POLLO', cantidad: 0.5 }, { supplyId: 'PANKO', cantidad: 0.12 }, { supplyId: 'ACEITE', cantidad: 0.15 }, { supplyId: 'CREMAS', cantidad: 0.06 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],

  // ── Carnívoros ──
  C01: [ { supplyId: 'CARNE_LOMO', cantidad: 0.3 }, { supplyId: 'PAPA', cantidad: 0.25 }, { supplyId: 'CARBON', cantidad: 0.3 }, { supplyId: 'CREMAS', cantidad: 0.05 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],
  C02: [ { supplyId: 'CARNE_LOMO', cantidad: 0.4 }, { supplyId: 'PAPA', cantidad: 0.3 }, { supplyId: 'CARBON', cantidad: 0.35 }, { supplyId: 'CREMAS', cantidad: 0.05 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],
  C03: [ { supplyId: 'CARNE_BIFE', cantidad: 0.35 }, { supplyId: 'PAPA', cantidad: 0.25 }, { supplyId: 'CARBON', cantidad: 0.3 }, { supplyId: 'CREMAS', cantidad: 0.05 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],

  // ── Pardos Brasa (pollo a la brasa con papas) ──
  B01: [ { supplyId: 'POLLO_ENTERO', cantidad: 0.25 }, { supplyId: 'PAPA', cantidad: 0.25 }, { supplyId: 'CARBON', cantidad: 0.25 }, { supplyId: 'CREMAS', cantidad: 0.05 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],
  B02: [ { supplyId: 'POLLO_ENTERO', cantidad: 0.5 },  { supplyId: 'PAPA', cantidad: 0.45 }, { supplyId: 'CARBON', cantidad: 0.5 },  { supplyId: 'CREMAS', cantidad: 0.08 }, { supplyId: 'SERVILLETA', cantidad: 4 } ],
  B03: [ { supplyId: 'POLLO_ENTERO', cantidad: 1 },    { supplyId: 'PAPA', cantidad: 0.8 },  { supplyId: 'CARBON', cantidad: 1 },    { supplyId: 'CREMAS', cantidad: 0.12 }, { supplyId: 'SERVILLETA', cantidad: 6 } ],

  // ── Pardos Parrillero ──
  PA01: [ { supplyId: 'POLLO_ENTERO', cantidad: 0.25 }, { supplyId: 'PAPA', cantidad: 0.25 }, { supplyId: 'CARBON', cantidad: 0.3 }, { supplyId: 'CREMAS', cantidad: 0.05 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],
  PA02: [ { supplyId: 'POLLO_ENTERO', cantidad: 0.5 },  { supplyId: 'PAPA', cantidad: 0.45 }, { supplyId: 'CARBON', cantidad: 0.55 }, { supplyId: 'CREMAS', cantidad: 0.08 }, { supplyId: 'SERVILLETA', cantidad: 4 } ],
  PA03: [ { supplyId: 'POLLO_ENTERO', cantidad: 0.25 }, { supplyId: 'PAPA', cantidad: 0.25 }, { supplyId: 'CARBON', cantidad: 0.3 }, { supplyId: 'CREMAS', cantidad: 0.06 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],
  PA04: [ { supplyId: 'POLLO_ENTERO', cantidad: 0.5 },  { supplyId: 'PAPA', cantidad: 0.45 }, { supplyId: 'CARBON', cantidad: 0.55 }, { supplyId: 'CREMAS', cantidad: 0.09 }, { supplyId: 'SERVILLETA', cantidad: 4 } ],

  // ── Sabor con Esquina ──
  S01: [ { supplyId: 'FILETE_POLLO', cantidad: 0.25 }, { supplyId: 'PAPA', cantidad: 0.2 }, { supplyId: 'CARBON', cantidad: 0.2 }, { supplyId: 'CREMAS', cantidad: 0.04 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],
  S02: [ { supplyId: 'FILETE_POLLO', cantidad: 0.2 }, { supplyId: 'CHORIZO_CKTL', cantidad: 2 }, { supplyId: 'PAPA', cantidad: 0.2 }, { supplyId: 'CARBON', cantidad: 0.2 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],
  S03: [ { supplyId: 'CORAZON_RES', cantidad: 0.3 }, { supplyId: 'PAPA', cantidad: 0.2 }, { supplyId: 'CHOCLO', cantidad: 0.08 }, { supplyId: 'CARBON', cantidad: 0.2 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],
  S04: [ { supplyId: 'MOLLEJA_POLLO', cantidad: 0.3 }, { supplyId: 'PAPA', cantidad: 0.2 }, { supplyId: 'CARBON', cantidad: 0.2 }, { supplyId: 'CREMAS', cantidad: 0.04 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],
  S05: [ { supplyId: 'FILETE_POLLO', cantidad: 0.3 }, { supplyId: 'PANKO', cantidad: 0.07 }, { supplyId: 'ACEITE', cantidad: 0.12 }, { supplyId: 'PAPA', cantidad: 0.2 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],

  // ── Especiales al plato ──
  E01: [ { supplyId: 'FILETE_POLLO', cantidad: 0.35 }, { supplyId: 'PANKO', cantidad: 0.08 }, { supplyId: 'ACEITE', cantidad: 0.14 }, { supplyId: 'PAPA', cantidad: 0.25 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],
  E02: [ { supplyId: 'MOLLEJA_POLLO', cantidad: 0.35 }, { supplyId: 'PAPA', cantidad: 0.25 }, { supplyId: 'CARBON', cantidad: 0.25 }, { supplyId: 'CREMAS', cantidad: 0.05 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],
  E03: [ { supplyId: 'CORAZON_RES', cantidad: 0.35 }, { supplyId: 'PAPA', cantidad: 0.25 }, { supplyId: 'CARBON', cantidad: 0.25 }, { supplyId: 'CREMAS', cantidad: 0.05 }, { supplyId: 'SERVILLETA', cantidad: 3 } ],

  // ── Ensaladas ──
  EN01: [ { supplyId: 'VAINITA', cantidad: 0.1 }, { supplyId: 'ZANAHORIA', cantidad: 0.1 }, { supplyId: 'BETERRAGA', cantidad: 0.1 }, { supplyId: 'PAPA', cantidad: 0.1 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  EN02: [ { supplyId: 'VAINITA', cantidad: 0.15 }, { supplyId: 'ZANAHORIA', cantidad: 0.15 }, { supplyId: 'BETERRAGA', cantidad: 0.15 }, { supplyId: 'PAPA', cantidad: 0.15 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  EN03: [ { supplyId: 'LECHUGA', cantidad: 0.5 }, { supplyId: 'TOMATE', cantidad: 0.12 }, { supplyId: 'PEPINO', cantidad: 0.5 }, { supplyId: 'PALTA', cantidad: 0.5 }, { supplyId: 'LIMON', cantidad: 0.03 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  EN04: [ { supplyId: 'LECHUGA', cantidad: 0.8 }, { supplyId: 'TOMATE', cantidad: 0.18 }, { supplyId: 'PEPINO', cantidad: 0.8 }, { supplyId: 'PALTA', cantidad: 0.8 }, { supplyId: 'LIMON', cantidad: 0.05 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],
  EN05: [ { supplyId: 'LECHUGA', cantidad: 0.6 }, { supplyId: 'TOMATE', cantidad: 0.12 }, { supplyId: 'PALTA', cantidad: 0.6 }, { supplyId: 'CHOCLO', cantidad: 0.08 }, { supplyId: 'ZANAHORIA', cantidad: 0.08 }, { supplyId: 'SERVILLETA', cantidad: 2 } ],

  // ── Postres (porciones compradas) ──
  D01: [ { supplyId: 'POSTRE_TORTA_CHOC', cantidad: 1 }, { supplyId: 'SERVILLETA', cantidad: 1 } ],
  D02: [ { supplyId: 'POSTRE_TRES_LECHES', cantidad: 1 }, { supplyId: 'SERVILLETA', cantidad: 1 } ],
  D03: [ { supplyId: 'POSTRE_PIE_LIMON', cantidad: 1 }, { supplyId: 'SERVILLETA', cantidad: 1 } ],
  D04: [ { supplyId: 'POSTRE_CHEESECAKE', cantidad: 1 }, { supplyId: 'SERVILLETA', cantidad: 1 } ],

  // ── Bebidas ──
  // Chicha: producción propia — maíz morado, piña, especias y azúcar por vaso/jarra.
  BE01: [ { supplyId: 'MAIZ_MORADO', cantidad: 0.08 }, { supplyId: 'PINA', cantidad: 0.05 }, { supplyId: 'ESPECIAS_CHICHA', cantidad: 0.003 }, { supplyId: 'AZUCAR', cantidad: 0.04 }, { supplyId: 'VASO_DESC', cantidad: 1 } ],
  BE02: [ { supplyId: 'MAIZ_MORADO', cantidad: 0.24 }, { supplyId: 'PINA', cantidad: 0.15 }, { supplyId: 'ESPECIAS_CHICHA', cantidad: 0.009 }, { supplyId: 'AZUCAR', cantidad: 0.12 } ],
  // Gaseosas y agua: se compran listas, 1 a 1.
  BE03: [ { supplyId: 'GASEOSA_500', cantidad: 1 } ],
  BE04: [ { supplyId: 'GASEOSA_15L', cantidad: 1 } ],
  BE05: [ { supplyId: 'INKA_25L', cantidad: 1 } ],
  BE06: [ { supplyId: 'AGUA', cantidad: 1 } ],
}

export default RECIPES
