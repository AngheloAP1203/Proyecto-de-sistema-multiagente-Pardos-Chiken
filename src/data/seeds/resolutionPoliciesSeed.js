/**
 * src/data/seeds/resolutionPoliciesSeed.js
 * Políticas de resolución por tipo de problema.
 * Cada política define la acción según el estado del cliente (en mesa vs ya pagó).
 */

export const RESOLUTION_POLICIES = [
  {
    id: 'POL001',
    problema: 'pollo_frio',
    palabras_clave: ['frío', 'fria', 'frio', 'helado', 'helada', 'temperatura', 'tibio'],
    categoria: 'comida',
    accion_mesa: 'Dirigirse a la mesa, disculparse y ofrecer cambio de plato inmediato. Verificar con cocina el tiempo de preparación del reemplazo.',
    accion_pagado: 'Contactar al cliente por teléfono, disculparse formalmente y ofrecer un cupón de descuento para su próxima visita.',
    requiere_promo: true,
    promo_sugerida: 'P001',
  },
  {
    id: 'POL002',
    problema: 'demora',
    palabras_clave: ['demora', 'demorado', 'tardó', 'tarda', 'esperando', 'lento', 'horas', 'hora'],
    categoria: 'servicio',
    accion_mesa: 'Ir a la mesa, informar el estado del pedido y ofrecer una cortesía mientras espera (bebida o entrada de chicharrón de pollo).',
    accion_pagado: 'Contactar al cliente con disculpa formal y ofrecer un cupón de delivery gratis para su próximo pedido.',
    requiere_promo: true,
    promo_sugerida: 'P003',
  },
  {
    id: 'POL003',
    problema: 'cobro_doble',
    palabras_clave: ['cobro doble', 'cobraron dos', 'doble cobro', 'duplicado', 'duplicada', 'dos veces', 'cobro duplicado'],
    categoria: 'cobro',
    accion_mesa: 'Escalar inmediatamente a caja para verificar el cobro y procesar la devolución. Informar al cliente que se resolverá en máximo 10 minutos.',
    accion_pagado: 'Contactar al cliente con disculpa, gestionar la devolución directa con Finanzas y ofrecer un cupón compensatorio adicional.',
    requiere_promo: true,
    promo_sugerida: 'P002',
  },
  {
    id: 'POL004',
    problema: 'pedido_incompleto',
    palabras_clave: ['incompleto', 'falta', 'faltó', 'faltan', 'no enviaron', 'no mandaron', 'sin papas', 'sin cremas', 'sin ensalada'],
    categoria: 'comida',
    accion_mesa: 'Llevar los items faltantes a la mesa de inmediato. Disculparse por el error y verificar que el pedido quede completo.',
    accion_pagado: 'Contactar al cliente con disculpa y coordinar el envío de los items faltantes sin costo alguno.',
    requiere_promo: false,
    promo_sugerida: null,
  },
  {
    id: 'POL005',
    problema: 'higiene',
    palabras_clave: ['higiene', 'sucio', 'sucia', 'cucaracha', 'pelo', 'cabello', 'insecto', 'contaminado', 'mal estado', 'podrido', 'descompuesto', 'asco'],
    categoria: 'higiene',
    accion_mesa: 'Retirar el plato inmediatamente, disculparse profundamente, ofrecer reemplazo completo sin costo y reportar el incidente a cocina y control de calidad.',
    accion_pagado: 'Contactar con disculpa formal del gerente de sede, ofrecer cupón generoso de compensación y reportar a control de calidad para investigación interna.',
    requiere_promo: true,
    promo_sugerida: 'P001',
  },
  {
    id: 'POL006',
    problema: 'mal_sabor',
    palabras_clave: ['sabor', 'crudo', 'cruda', 'salado', 'insípido', 'raro', 'mal sabor', 'no me gustó', 'feo'],
    categoria: 'comida',
    accion_mesa: 'Preguntar al cliente qué específicamente no le gustó, ofrecer cambio de plato o guarnición alternativa sin costo.',
    accion_pagado: 'Registrar el feedback para mejora de receta, disculparse y ofrecer cupón para próxima visita.',
    requiere_promo: true,
    promo_sugerida: 'P004',
  },
  {
    id: 'POL007',
    problema: 'atencion',
    palabras_clave: ['atención', 'mozo', 'mesero', 'grosero', 'grosera', 'ignoraron', 'mal trato', 'no atienden', 'descortés'],
    categoria: 'servicio',
    accion_mesa: 'El supervisor debe acudir a la mesa, disculparse por la atención recibida y asignar otro mesero. Ofrecer una cortesía.',
    accion_pagado: 'Contactar al cliente con disculpa del gerente de sede, investigar el incidente con el personal involucrado y ofrecer cupón.',
    requiere_promo: true,
    promo_sugerida: 'P004',
  },
]

export default RESOLUTION_POLICIES
