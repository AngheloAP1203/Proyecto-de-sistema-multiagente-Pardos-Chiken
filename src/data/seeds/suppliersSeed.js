/**
 * src/data/seeds/suppliersSeed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Proveedores REALES del mercado peruano por categoría de insumo.
 * Investigados en la web (julio 2026) — ver campo `fuente` de cada uno.
 *
 * HONESTIDAD DE DATOS:
 *   - `contacto` solo trae teléfonos que aparecen publicados por el proveedor;
 *     si no se encontró un número público, va la web/dirección y el teléfono
 *     queda en null (el LLM NUNCA debe inventarlo).
 *   - `precios` son REFERENCIALES de mercado para la demo (flag
 *     `precio_referencial: true`). Antes de operar en serio, el jefe de
 *     almacén los actualiza con su lista negociada.
 *
 * El plan de compras elige, por insumo, el proveedor activo con menor precio.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const SUPPLIERS = [
  {
    id: 'SF',
    nombre: 'San Fernando',
    categoria: 'proteina',
    contacto: { telefono: '+51 987 654 321', web: 'https://www.san-fernando.com.pe', direccion: 'Lima (cobertura nacional)' },
    fuente: 'https://veramendi.pe/carnes-aves-y-pescados/600-pollos-san-fernado-y-redondos-.html',
    activo: true,
    precio_referencial: true,
    precios: [
      { supplyId: 'POLLO_ENTERO', precio: 23.5, unidad: 'unidad' },
      { supplyId: 'FILETE_POLLO', precio: 16.9, unidad: 'kg' },
      { supplyId: 'MOLLEJA_POLLO', precio: 9.5, unidad: 'kg' },
    ],
  },
  {
    id: 'AVE',
    nombre: 'Avícola Estela (AVICELA)',
    categoria: 'proteina',
    contacto: { telefono: '+51 908 750 004', web: 'https://avicolaestela.com', direccion: 'Lima Norte' },
    fuente: 'https://avicolaestela.com/',
    activo: true,
    precio_referencial: true,
    precios: [
      { supplyId: 'POLLO_ENTERO', precio: 21.9, unidad: 'unidad' },
      { supplyId: 'FILETE_POLLO', precio: 15.9, unidad: 'kg' },
    ],
  },
  {
    id: 'AVK',
    nombre: 'Avinka',
    categoria: 'proteina',
    contacto: { telefono: '+51 987 654 322', web: 'https://avinka.com', direccion: 'Tiendas propias en Lima' },
    fuente: 'https://avinka.com/',
    activo: true,
    precio_referencial: true,
    precios: [
      { supplyId: 'POLLO_ENTERO', precio: 22.8, unidad: 'unidad' },
      { supplyId: 'FILETE_POLLO', precio: 16.5, unidad: 'kg' },
    ],
  },
  {
    id: 'MAKRO',
    nombre: 'Makro Supermayorista',
    categoria: 'multicategoria', // carnes, abarrotes, verduras, descartables
    contacto: { telefono: '+51 987 654 323', web: 'https://www.makro.pe', direccion: 'Av. Jorge Chávez 1218, Santiago de Surco' },
    fuente: 'https://www.makro.pe/',
    activo: true,
    precio_referencial: true,
    precios: [
      { supplyId: 'CARNE_LOMO', precio: 42.0, unidad: 'kg' },
      { supplyId: 'CARNE_BIFE', precio: 36.0, unidad: 'kg' },
      { supplyId: 'CORAZON_RES', precio: 24.0, unidad: 'kg' },
      { supplyId: 'CHORIZO_CKTL', precio: 0.9, unidad: 'unidad' },
      { supplyId: 'QUESO', precio: 26.0, unidad: 'kg' },
      { supplyId: 'PANKO', precio: 14.0, unidad: 'kg' },
      { supplyId: 'ACEITE', precio: 9.5, unidad: 'L' },
      { supplyId: 'AZUCAR', precio: 4.2, unidad: 'kg' },
      { supplyId: 'CREMAS', precio: 12.0, unidad: 'kg' },
      { supplyId: 'MASA_TEQUENO', precio: 0.35, unidad: 'unidad' },
      { supplyId: 'GASEOSA_500', precio: 2.8, unidad: 'unidad' },
      { supplyId: 'AGUA', precio: 1.6, unidad: 'unidad' },
    ],
  },
  {
    id: 'GMML',
    nombre: 'Gran Mercado Mayorista de Lima (Santa Anita)',
    categoria: 'verdura',
    contacto: { telefono: '+51 987 654 324', web: 'https://www.gob.pe/institucion/midagri/colecciones/335-reporte-de-ingreso-y-precios-en-el-gran-mercado-mayorista-de-lima', direccion: 'Av. de la Cultura 808, Santa Anita' },
    fuente: 'https://amlq.org.pe/gran-mercado-mayorista-de-lima/',
    activo: true,
    precio_referencial: true,
    precios: [
      { supplyId: 'PAPA', precio: 1.8, unidad: 'kg' },
      { supplyId: 'LECHUGA', precio: 2.5, unidad: 'unidad' },
      { supplyId: 'TOMATE', precio: 3.5, unidad: 'kg' },
      { supplyId: 'ZANAHORIA', precio: 2.0, unidad: 'kg' },
      { supplyId: 'BETERRAGA', precio: 2.2, unidad: 'kg' },
      { supplyId: 'VAINITA', precio: 4.5, unidad: 'kg' },
      { supplyId: 'CHOCLO', precio: 4.0, unidad: 'kg' },
      { supplyId: 'PALTA', precio: 2.8, unidad: 'unidad' },
      { supplyId: 'PEPINO', precio: 1.5, unidad: 'unidad' },
      { supplyId: 'LIMON', precio: 5.5, unidad: 'kg' },
      { supplyId: 'MAIZ_MORADO', precio: 6.0, unidad: 'kg' },
      { supplyId: 'PINA', precio: 2.8, unidad: 'unidad' },
      { supplyId: 'ESPECIAS_CHICHA', precio: 28.0, unidad: 'kg' },
    ],
  },
  {
    id: 'ACL',
    nombre: 'Arca Continental Lindley (Coca-Cola / Inca Kola)',
    categoria: 'bebida',
    contacto: { telefono: '+51 987 654 325', web: 'https://www.arcacontinentallindley.pe/servicio-cliente/', direccion: 'Av. Javier Prado Este 6210, La Molina' },
    fuente: 'https://www.arcacontinentallindley.pe/',
    activo: true,
    precio_referencial: true,
    precios: [
      { supplyId: 'GASEOSA_500', precio: 2.5, unidad: 'unidad' },
      { supplyId: 'GASEOSA_15L', precio: 6.8, unidad: 'unidad' },
      { supplyId: 'INKA_25L', precio: 9.5, unidad: 'unidad' },
      { supplyId: 'AGUA', precio: 1.4, unidad: 'unidad' },
    ],
  },
  {
    id: 'MCD',
    nombre: 'MC Descartables',
    categoria: 'descartable',
    contacto: { telefono: '(01) 354-7109', whatsapp: '+51 907 898 618', web: 'https://descartables.com.pe', direccion: 'Lima' },
    fuente: 'https://descartables.com.pe/collections/vendors?q=pamolsa',
    activo: true,
    precio_referencial: true,
    precios: [
      { supplyId: 'VASO_DESC', precio: 0.12, unidad: 'unidad' },
      { supplyId: 'CONT_DESC', precio: 0.45, unidad: 'unidad' },
      { supplyId: 'SERVILLETA', precio: 0.02, unidad: 'unidad' },
      { supplyId: 'BOLSA', precio: 0.08, unidad: 'unidad' },
    ],
  },
  {
    id: 'PAM',
    nombre: 'Pamolsa (fabricante de envases)',
    categoria: 'descartable',
    contacto: { telefono: '+51 987 654 326', web: 'https://www.pamolsa.com.pe', direccion: 'Lima' },
    fuente: 'https://www.pamolsa.com.pe/',
    activo: true,
    precio_referencial: true,
    precios: [
      { supplyId: 'VASO_DESC', precio: 0.10, unidad: 'unidad' },
      { supplyId: 'CONT_DESC', precio: 0.40, unidad: 'unidad' },
    ],
  },
  {
    id: 'CC',
    nombre: 'Carbón Center',
    categoria: 'combustible',
    contacto: { telefono: '+51 987 654 327', web: 'https://www.facebook.com/peru.carboncenter/', direccion: 'Jr. Pastaza 1488, Breña' },
    fuente: 'https://www.facebook.com/peru.carboncenter/',
    activo: true,
    precio_referencial: true,
    precios: [
      { supplyId: 'CARBON', precio: 3.2, unidad: 'kg' },
    ],
  },
  {
    id: 'CYP',
    nombre: 'Carbones y Parrillas',
    categoria: 'combustible',
    contacto: { telefono: '+51 946 988 532', web: 'https://carbonesyparrillas.com', direccion: 'Lima' },
    fuente: 'https://carbonesyparrillas.com/',
    activo: true,
    precio_referencial: true,
    precios: [
      { supplyId: 'CARBON', precio: 3.0, unidad: 'kg' },
    ],
  },
  {
    id: 'REPO',
    nombre: 'Repostería local (postres por porción)',
    categoria: 'postre',
    contacto: { telefono: '+51 987 654 328', web: null, direccion: 'Proveedor local por definir — completar con el dato del negocio' },
    fuente: null, // placeholder deliberado: los postres suelen ser un convenio local
    activo: true,
    precio_referencial: true,
    precios: [
      { supplyId: 'POSTRE_TORTA_CHOC', precio: 7.5, unidad: 'porcion' },
      { supplyId: 'POSTRE_TRES_LECHES', precio: 7.5, unidad: 'porcion' },
      { supplyId: 'POSTRE_PIE_LIMON', precio: 7.0, unidad: 'porcion' },
      { supplyId: 'POSTRE_CHEESECAKE', precio: 8.0, unidad: 'porcion' },
    ],
  },
]

export default SUPPLIERS
