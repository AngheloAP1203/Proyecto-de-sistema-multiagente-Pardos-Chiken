/**
 * src/data/seeds/promotionsSeed.js
 * Cupones y vales disponibles para compensar a clientes afectados.
 */

export const PROMOTIONS = [
  {
    id: 'P001',
    nombre: 'Vale 20% próxima visita',
    tipo: 'descuento_porcentaje',
    valor: 20,
    condiciones: 'Válido en cualquier sede de Pardos Chicken, consumo mínimo S/50. No acumulable con otras promociones.',
    vigencia_dias: 30,
    activa: true,
  },
  {
    id: 'P002',
    nombre: 'Vale S/30 de descuento',
    tipo: 'descuento_monto',
    valor: 30,
    condiciones: 'Aplica en consumo mayor a S/80 en cualquier sede. Una sola vez por cliente.',
    vigencia_dias: 15,
    activa: true,
  },
  {
    id: 'P003',
    nombre: 'Delivery gratis',
    tipo: 'delivery_gratis',
    valor: 0,
    condiciones: 'Un delivery gratis en pedido por la web o app. Pedido mínimo S/40.',
    vigencia_dias: 30,
    activa: true,
  },
  {
    id: 'P004',
    nombre: '1/4 pollo a la brasa de cortesía',
    tipo: 'producto_gratis',
    valor: 0,
    condiciones: '1/4 de pollo a la brasa con papas de cortesía en tu próxima visita a cualquier sede.',
    vigencia_dias: 30,
    activa: true,
  },
  {
    id: 'P005',
    nombre: 'Combo familiar con 25% de descuento',
    tipo: 'descuento_porcentaje',
    valor: 25,
    condiciones: 'Aplica solo en combos familiares (pollo entero + complementos). Cualquier sede.',
    vigencia_dias: 45,
    activa: true,
  },
]

export default PROMOTIONS
