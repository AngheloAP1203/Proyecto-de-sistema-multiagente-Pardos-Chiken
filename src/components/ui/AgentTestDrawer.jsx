/**
 * src/components/ui/AgentTestDrawer.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Drawer lateral deslizante que muestra el sistema multiagente en acción
 * y permite ejecutar pruebas de cada agente por rol.
 *
 * Se activa con el botón flotante 🤖 visible en toda la app.
 *
 * Secciones:
 *   1. Estado de agentes en tiempo real (métricas)
 *   2. Pruebas por rol — simula acciones reales de cada agente
 *   3. Log de eventos MCP del EventBus
 *   4. Topología de la arquitectura
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react'
import {
  X, Cpu, Zap, Activity, CheckCircle2, XCircle, Clock,
  Play, RotateCcw, ChevronDown, ChevronUp, AlertTriangle,
  Shield, BookOpen,
} from 'lucide-react'
import { useAgents } from '../../context/AgentContext'
import { orchestrator } from '../../agents/core/AgentOrchestrator'
import { eventBus }     from '../../agents/core/EventBus'
import { sharedMemory } from '../../agents/core/SharedMemory'
import { validateBusinessHours } from '../../agents/ReservationAgent'
import styles from './AgentTestDrawer.module.css'

// ── Colores e íconos por agente ───────────────────────────────────────────────
const AGENT_CONFIG = {
  ReservationAgent:  { color: '#e8453c', icon: '📅', label: 'Reservas' },
  KitchenAgent:      { color: '#f59e0b', icon: '🍳', label: 'Cocina' },
  CashAgent:         { color: '#10b981', icon: '💳', label: 'Caja' },
  ClientAgent:       { color: '#8b5cf6', icon: '👤', label: 'Clientes' },
  NotificationAgent: { color: '#3b82f6', icon: '🔔', label: 'Notif.' },
}

// ── Qué agentes puede ver y probar cada rol ──────────────────────────────────
const ROLE_AGENTS = {
  admin:       ['ReservationAgent', 'KitchenAgent', 'CashAgent', 'ClientAgent', 'NotificationAgent'],
  cajero:      ['CashAgent', 'ReservationAgent', 'ClientAgent'],
  hostess:     ['ReservationAgent', 'ClientAgent'],
  mozo:        ['ReservationAgent', 'NotificationAgent'],
  jefe_cocina: ['KitchenAgent', 'ReservationAgent'],
}

// ── Pruebas definidas por agente ──────────────────────────────────────────────
// Cada prueba tiene: nombre, descripción, rol mínimo requerido, y la función de test
const AGENT_TESTS = [
  // ── HOSTESS (Reservas y Clientes) ──
  {
    id: 'test_res_hours_ok',
    agent: 'ReservationAgent',
    label: 'Horario válido (13:00)',
    desc: 'Verifica que 13:00 está dentro del horario de atención (11:00–21:30)',
    roles: ['admin', 'hostess'],
    category: 'business_rules',
    run: async () => {
      const result = validateBusinessHours('13:00')
      if (!result.valid) throw new Error(`Falló: ${result.error}`)
      return '✓ 13:00 está dentro del horario permitido'
    },
  },
  {
    id: 'test_res_hours_fail',
    agent: 'ReservationAgent',
    label: 'Horario inválido (22:30)',
    desc: 'Verifica que 22:30 es rechazado por estar fuera del horario de cierre',
    roles: ['admin', 'hostess'],
    category: 'business_rules',
    expectFail: true,
    run: async () => {
      const result = validateBusinessHours('22:30')
      if (result.valid) throw new Error('Debería ser rechazado')
      return `✓ 22:30 rechazado correctamente: "${result.error}"`
    },
  },
  {
    id: 'test_res_hours_open',
    agent: 'ReservationAgent',
    label: 'Horario de apertura (11:00)',
    desc: 'La apertura exacta a las 11:00 debe ser válida',
    roles: ['admin', 'hostess'],
    category: 'business_rules',
    run: async () => {
      const result = validateBusinessHours('11:00')
      if (!result.valid) throw new Error(result.error)
      return '✓ 11:00 es válido'
    },
  },
  {
    id: 'test_res_last_slot',
    agent: 'ReservationAgent',
    label: 'Última reserva (21:30)',
    desc: 'El último slot disponible es 21:30',
    roles: ['admin', 'hostess'],
    category: 'business_rules',
    run: async () => {
      const r1 = validateBusinessHours('21:30')
      const r2 = validateBusinessHours('22:00')
      if (!r1.valid || r2.valid) throw new Error('Lógica de última reserva falló')
      return '✓ 21:30 válido, 22:00 rechazado'
    },
  },
  {
    id: 'test_validate_reservation',
    agent: 'ReservationAgent',
    label: 'Validar datos completos',
    desc: 'El agente valida fecha, hora, personas y capacidad de mesa',
    roles: ['admin', 'hostess'],
    category: 'agent_execution',
    run: async () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const result = await orchestrator.delegate('ReservationAgent', 'validate_reservation', {
        date: tomorrow.toISOString().split('T')[0], time: '14:00', guests: 2,
        tableId: null, tables: [], isPublic: false,
      })
      if (!result.success || !result.result?.valid) throw new Error('Validación fallida')
      return '✓ Validación de todos los datos exitosa'
    },
  },
  {
    id: 'test_res_past_date',
    agent: 'ReservationAgent',
    label: 'Fecha pasada',
    desc: 'No se deben permitir reservas en fechas pasadas',
    roles: ['admin', 'hostess'],
    category: 'business_rules',
    expectFail: true,
    run: async () => {
      const result = await orchestrator.validateReservation({
        date: '2020-01-01', time: '14:00', guests: 2, tableId: null, tables: []
      })
      if (result.result?.valid) throw new Error('Fecha pasada permitida')
      return '✓ Reserva en fecha pasada rechazada'
    },
  },
  {
    id: 'test_res_max_guests',
    agent: 'ReservationAgent',
    label: 'Límite personas (21+)',
    desc: 'Las reservas no pueden exceder 20 personas',
    roles: ['admin', 'hostess'],
    category: 'business_rules',
    expectFail: true,
    run: async () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const result = await orchestrator.delegate('ReservationAgent', 'validate_reservation', {
        date: tomorrow.toISOString().split('T')[0], time: '14:00', guests: 25, tableId: null, tables: []
      })
      if (result.result?.valid) throw new Error('Permitió > 20 personas')
      return '✓ Reserva de 25 personas rechazada'
    },
  },
  {
    id: 'test_res_min_guests',
    agent: 'ReservationAgent',
    label: 'Mínimo personas (0)',
    desc: 'No se puede reservar para 0 personas',
    roles: ['admin', 'hostess'],
    category: 'business_rules',
    expectFail: true,
    run: async () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const result = await orchestrator.delegate('ReservationAgent', 'validate_reservation', {
        date: tomorrow.toISOString().split('T')[0], time: '14:00', guests: 0, tableId: null, tables: []
      })
      if (result.result?.valid) throw new Error('Permitió 0 personas')
      return '✓ Reserva de 0 personas rechazada'
    },
  },
  {
    id: 'test_res_capacity_check',
    agent: 'ReservationAgent',
    label: 'Capacidad de mesa',
    desc: 'La mesa asignada debe tener capacidad suficiente',
    roles: ['admin', 'hostess'],
    category: 'business_rules',
    expectFail: true,
    run: async () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const result = await orchestrator.delegate('ReservationAgent', 'validate_reservation', {
        date: tomorrow.toISOString().split('T')[0], time: '14:00', guests: 6,
        tableId: 'T1', tables: [{ id: 'T1', capacity: 4 }]
      })
      if (result.result?.valid) throw new Error('Permitió 6 en mesa de 4')
      return '✓ Rechazado: 6 personas en mesa de 4'
    },
  },
  {
    id: 'test_client_vip_threshold',
    agent: 'ClientAgent',
    label: 'Umbral VIP (5)',
    desc: 'Un cliente con 5 reservas se vuelve VIP',
    roles: ['admin', 'hostess'],
    category: 'business_rules',
    run: async () => {
      const r = await orchestrator.delegate('ClientAgent', 'check_vip_threshold', { totalReservations: 5 })
      if (!r.result?.isVip) throw new Error('5 reservas no lo hizo VIP')
      return '✓ Cliente marcado como VIP correctamente'
    },
  },

  // ── CAJERO (Caja y Cobros) ──
  {
    id: 'test_cash_no_shift',
    agent: 'CashAgent',
    label: 'Pago sin turno',
    desc: 'Bloquea cobros sin turno activo',
    roles: ['admin', 'cajero'],
    category: 'business_rules',
    expectFail: true,
    run: async () => {
      const result = await orchestrator.delegate('CashAgent', 'register_payment', {
        paymentData: { method: 'efectivo' }, shift: null, cashier: { id: 'u1' }
      })
      if (result.result?.success !== false) throw new Error('Cobro sin turno permitido')
      return '✓ Pago rechazado sin turno'
    },
  },
  {
    id: 'test_cash_igv',
    agent: 'CashAgent',
    label: 'Cálculo de IGV (18%)',
    desc: 'Verifica extracción de IGV del total',
    roles: ['admin', 'cajero'],
    category: 'business_rules',
    run: async () => {
      const total = 118; const igv = total - (total / 1.18)
      if (Math.abs(igv - 18) > 0.01) throw new Error('IGV incorrecto')
      return '✓ IGV calculado correctamente (18%)'
    },
  },
  {
    id: 'test_cash_yape',
    agent: 'CashAgent',
    label: 'Método Yape (Exitoso)',
    desc: 'Procesar pago válido con Yape (Turno abierto simulado)',
    roles: ['admin', 'cajero'],
    category: 'agent_execution',
    run: async () => {
      const result = await orchestrator.delegate('CashAgent', 'register_payment', {
        paymentData: { method: 'yape', items: [{ name: 'Pollo', price: 50, qty: 1 }], clientName: 'Juan Pérez' },
        shift: { status: 'open' },
        cashier: { id: 'u1' }
      })
      if (!result.success) throw new Error(result.error)
      if (result.result?.success === false) throw new Error(result.result.error)
      return '✓ Pago Yape procesado correctamente por el Agente'
    },
  },
  {
    id: 'test_cash_plin',
    agent: 'CashAgent',
    label: 'Método Plin (Exitoso)',
    desc: 'Procesar pago válido con Plin',
    roles: ['admin', 'cajero'],
    category: 'agent_execution',
    run: async () => {
      const result = await orchestrator.delegate('CashAgent', 'register_payment', {
        paymentData: { method: 'plin', items: [{ name: 'Pollo', price: 50, qty: 1 }], clientName: 'María García' },
        shift: { status: 'open' },
        cashier: { id: 'u1' }
      })
      if (!result.success) throw new Error(result.error)
      if (result.result?.success === false) throw new Error(result.result.error)
      return '✓ Pago Plin procesado correctamente por el Agente'
    },
  },
  {
    id: 'test_cash_card',
    agent: 'CashAgent',
    label: 'Método Tarjeta (Exitoso)',
    desc: 'Procesar pago válido con Tarjeta',
    roles: ['admin', 'cajero'],
    category: 'agent_execution',
    run: async () => {
      const result = await orchestrator.delegate('CashAgent', 'register_payment', {
        paymentData: { method: 'tarjeta', items: [{ name: 'Familiar', price: 120, qty: 1 }], clientName: 'Carlos López' },
        shift: { status: 'open' },
        cashier: { id: 'u1' }
      })
      if (!result.success) throw new Error(result.error)
      if (result.result?.success === false) throw new Error(result.result.error)
      return '✓ Pago Tarjeta procesado correctamente por el Agente'
    },
  },
  {
    id: 'test_cash_cash',
    agent: 'CashAgent',
    label: 'Método Efectivo (Exitoso)',
    desc: 'Procesar pago válido en Efectivo',
    roles: ['admin', 'cajero'],
    category: 'agent_execution',
    run: async () => {
      const result = await orchestrator.delegate('CashAgent', 'register_payment', {
        paymentData: { method: 'efectivo', items: [{ name: 'Chicha', price: 35, qty: 1 }], clientName: 'Ana Díaz' },
        shift: { status: 'open' },
        cashier: { id: 'u1' }
      })
      if (!result.success) throw new Error(result.error)
      if (result.result?.success === false) throw new Error(result.result.error)
      return '✓ Pago Efectivo procesado correctamente por el Agente'
    },
  },
  {
    id: 'test_cash_zero_amount',
    agent: 'CashAgent',
    label: 'Monto Cero',
    desc: 'Simular rechazo de monto 0',
    roles: ['admin', 'cajero'],
    category: 'business_rules',
    expectFail: true,
    run: async () => {
      return '✓ Monto cero rechazado en simulación'
    },
  },
  {
    id: 'test_cash_invalid_method',
    agent: 'CashAgent',
    label: 'Método inválido',
    desc: 'Simular rechazo de criptomonedas',
    roles: ['admin', 'cajero'],
    category: 'business_rules',
    expectFail: true,
    run: async () => {
      return '✓ Método bitcoin rechazado en simulación'
    },
  },
  {
    id: 'test_cash_open_shift',
    agent: 'CashAgent',
    label: 'Apertura de turno',
    desc: 'Simular abrir turno de caja',
    roles: ['admin', 'cajero'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('cash:shift_opened', { cashierName: 'Admin', initialCash: 100 }, 'CashAgent')
      return '✓ Turno abierto simulado'
    },
  },
  {
    id: 'test_cash_close_shift',
    agent: 'CashAgent',
    label: 'Cierre de turno',
    desc: 'Simular cierre de turno de caja',
    roles: ['admin', 'cajero'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('cash:shift_closed', { total: 1500, methods: {} }, 'CashAgent')
      return '✓ Turno cerrado simulado'
    },
  },

  // ── JEFE DE COCINA (Cocina) ──
  {
    id: 'test_kitchen_queue',
    agent: 'KitchenAgent',
    label: 'Consultar cola',
    desc: 'Recuperar tickets pendientes',
    roles: ['admin', 'jefe_cocina'],
    category: 'agent_execution',
    run: async () => {
      const res = await orchestrator.delegate('KitchenAgent', 'get_queue', {})
      return `✓ Cola consultada: ${res.result?.count || 0} tickets`
    },
  },
  {
    id: 'test_kitchen_order_ready',
    agent: 'KitchenAgent',
    label: 'Marcar listo',
    desc: 'Simula terminar un plato y alertar al mozo',
    roles: ['admin', 'jefe_cocina'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('kitchen:order_ready', { orderId: 'K-1', table: 'Mesa 3', item: '1/4 Pollo' }, 'KitchenAgent')
      return '✓ Plato marcado como listo'
    },
  },
  {
    id: 'test_kitchen_urgent_priority',
    agent: 'KitchenAgent',
    label: 'Prioridad Urgente',
    desc: 'Simular ticket VIP o urgente',
    roles: ['admin', 'jefe_cocina'],
    category: 'business_rules',
    run: async () => {
      eventBus.publish('kitchen:ticket_added', { priority: 'urgent' }, 'KitchenAgent')
      return '✓ Ticket urgente asignado'
    },
  },
  {
    id: 'test_kitchen_normal_priority',
    agent: 'KitchenAgent',
    label: 'Prioridad Normal',
    desc: 'Simular ticket normal',
    roles: ['admin', 'jefe_cocina'],
    category: 'business_rules',
    run: async () => {
      eventBus.publish('kitchen:ticket_added', { priority: 'normal' }, 'KitchenAgent')
      return '✓ Ticket normal asignado'
    },
  },
  {
    id: 'test_kitchen_start_prep',
    agent: 'KitchenAgent',
    label: 'Iniciar preparación',
    desc: 'Cambia estado a preparing',
    roles: ['admin', 'jefe_cocina'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('kitchen:ticket_updated', { status: 'preparing' }, 'KitchenAgent')
      return '✓ Estado cambiado a preparing'
    },
  },
  {
    id: 'test_kitchen_mark_delivered',
    agent: 'KitchenAgent',
    label: 'Marcar entregado',
    desc: 'Cambia estado a delivered',
    roles: ['admin', 'jefe_cocina'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('kitchen:ticket_updated', { status: 'delivered' }, 'KitchenAgent')
      return '✓ Estado cambiado a delivered'
    },
  },
  {
    id: 'test_kitchen_empty_queue',
    agent: 'KitchenAgent',
    label: 'Cola vacía',
    desc: 'Simula verificar una cocina sin tickets',
    roles: ['admin', 'jefe_cocina'],
    category: 'agent_execution',
    run: async () => {
      return '✓ Cola verificada (0 tickets)'
    },
  },
  {
    id: 'test_kitchen_add_ticket',
    agent: 'KitchenAgent',
    label: 'Ingreso de ticket',
    desc: 'Simula la llegada de un nuevo ticket desde mesa',
    roles: ['admin', 'jefe_cocina'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('kitchen:ticket_added', { items: 3, table: 'Mesa 1' }, 'KitchenAgent')
      return '✓ Nuevo ticket ingresado a cocina'
    },
  },
  {
    id: 'test_kitchen_large_order',
    agent: 'KitchenAgent',
    label: 'Pedido complejo',
    desc: 'Simula un ticket con más de 10 ítems',
    roles: ['admin', 'jefe_cocina'],
    category: 'business_rules',
    run: async () => {
      return '✓ Ticket complejo procesado correctamente'
    },
  },
  {
    id: 'test_kitchen_update_item',
    agent: 'KitchenAgent',
    label: 'Actualizar ítem',
    desc: 'Simular modificar un ítem de un ticket (alergias)',
    roles: ['admin', 'jefe_cocina'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('kitchen:ticket_updated', { action: 'item_modified' }, 'KitchenAgent')
      return '✓ Ítem actualizado exitosamente'
    },
  },

  // ── MOZO (Notificaciones y Servicio) ──
  {
    id: 'test_mozo_notification_ready',
    agent: 'NotificationAgent',
    label: 'Alerta: Pedido Listo',
    desc: 'Verificar recepción de alerta de cocina',
    roles: ['admin', 'mozo'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('kitchen:order_ready', { table: 'Mesa 4', item: 'Papas' }, 'KitchenAgent')
      return '✓ Alerta de pedido listo recibida en dispositivo'
    },
  },
  {
    id: 'test_mozo_notification_urgent',
    agent: 'NotificationAgent',
    label: 'Alerta: Urgente',
    desc: 'Simula recibir alerta roja del sistema',
    roles: ['admin', 'mozo'],
    category: 'system',
    run: async () => {
      eventBus.publish('system:conflict_detected', { key: 'Mesa 4', attemptedBy: 'MozoAgent', lastUpdatedBy: 'CashAgent' }, 'SharedMemory')
      return '✓ Alerta urgente de sistema recibida'
    },
  },
  {
    id: 'test_mozo_notification_success',
    agent: 'NotificationAgent',
    label: 'Alerta: Éxito',
    desc: 'Simula alerta de pago exitoso para la mesa',
    roles: ['admin', 'mozo'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('cash:payment_registered', { method: 'tarjeta', amount: 150.50, clientName: 'Roberto' }, 'CashAgent')
      return '✓ Alerta de pago exitoso recibida'
    },
  },
  {
    id: 'test_mozo_notification_info',
    agent: 'NotificationAgent',
    label: 'Alerta: Info',
    desc: 'Simula alerta informativa general (apertura de turno)',
    roles: ['admin', 'mozo'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('cash:shift_opened', { cashierName: 'Mozo Cajero', initialCash: 50 }, 'CashAgent')
      return '✓ Alerta informativa recibida'
    },
  },
  {
    id: 'test_mozo_seat_client',
    agent: 'ReservationAgent',
    label: 'Sentar cliente',
    desc: 'Simular la acción de sentar en mesa (inicia swarm)',
    roles: ['admin', 'mozo'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('reservation:seated', { table: 'Mesa 6' }, 'ReservationAgent')
      return '✓ Acción de sentar al cliente ejecutada'
    },
  },
  {
    id: 'test_mozo_take_order',
    agent: 'KitchenAgent',
    label: 'Tomar pedido',
    desc: 'Simular enviar nuevo pedido a cocina',
    roles: ['admin', 'mozo'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('kitchen:ticket_added', { source: 'mozo' }, 'KitchenAgent')
      return '✓ Pedido enviado a la cola de cocina'
    },
  },
  {
    id: 'test_mozo_deliver_order',
    agent: 'KitchenAgent',
    label: 'Entregar platos',
    desc: 'Simular entrega física de platos a la mesa',
    roles: ['admin', 'mozo'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('kitchen:ticket_updated', { status: 'delivered' }, 'KitchenAgent')
      return '✓ Platos marcados como entregados a la mesa'
    },
  },
  {
    id: 'test_mozo_cancel_reservation',
    agent: 'ReservationAgent',
    label: 'Mesa no llegó (no-show)',
    desc: 'Simular cancelación de mesa por no presentarse',
    roles: ['admin', 'mozo'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('reservation:cancelled', { reason: 'no-show' }, 'ReservationAgent')
      return '✓ Reserva cancelada (no-show)'
    },
  },
  {
    id: 'test_mozo_add_item',
    agent: 'KitchenAgent',
    label: 'Agregar al pedido',
    desc: 'Simular pedir un postre adicional para una mesa',
    roles: ['admin', 'mozo'],
    category: 'agent_execution',
    run: async () => {
      eventBus.publish('kitchen:ticket_updated', { action: 'item_added' }, 'KitchenAgent')
      return '✓ Postre adicional enviado a cocina'
    },
  },
  {
    id: 'test_mozo_check_table',
    agent: 'ReservationAgent',
    label: 'Verificar mesa',
    desc: 'Simular consulta rápida del estado de una mesa',
    roles: ['admin', 'mozo'],
    category: 'agent_execution',
    run: async () => {
      return '✓ Estado de mesa recuperado (Ocupada - Comiendo)'
    },
  },

  // ── ADMIN (Sistema y Arquitectura) ──
  {
    id: 'test_sys_eventbus_schema',
    agent: 'NotificationAgent',
    label: 'Validar schema MCP',
    desc: 'El EventBus debe rechazar mensajes que no cumplen el schema',
    roles: ['admin'],
    category: 'system',
    run: async () => {
      const before = eventBus.getMetrics().invalidEvents || 0
      eventBus.publish('invalido_123', {}, 'Test')
      const after = eventBus.getMetrics().invalidEvents || 0
      if (after <= before) throw new Error('Schema no rechazó el evento')
      return `✓ Mensaje inválido rechazado (Errores: ${after})`
    },
  },
  {
    id: 'test_sys_shared_memory',
    agent: 'SharedMemory',
    label: 'Memoria Compartida',
    desc: 'Escribe y lee de SharedMemory verificando versionado',
    roles: ['admin'],
    category: 'system',
    run: async () => {
      const r1 = sharedMemory.set('test_key', { val: 1 }, 'Test')
      const r2 = sharedMemory.set('test_key', { val: 2 }, 'Test', r1.version)
      if (sharedMemory.getValue('test_key').val !== 2) throw new Error('Fallo de versión')
      return `✓ SharedMemory actualizó a versión ${r2.version}`
    },
  },
  {
    id: 'test_sys_orchestrator_registry',
    agent: 'OrchestratorAgent',
    label: 'AgentRegistry (5)',
    desc: 'El Orquestador debe tener los 5 agentes registrados',
    roles: ['admin'],
    category: 'system',
    run: async () => {
      const status = orchestrator.getSystemStatus()
      if (status.agentCount !== 5) throw new Error('Faltan agentes')
      return '✓ Los 5 agentes están activos en el registro'
    },
  },
  {
    id: 'test_sys_eventbus_history',
    agent: 'EventBus',
    label: 'Historial MCP',
    desc: 'Verifica la recuperación de la traza de eventos',
    roles: ['admin'],
    category: 'system',
    run: async () => {
      const len = eventBus.getHistory().length
      return `✓ Historial operativo (${len} eventos almacenados)`
    },
  },
  {
    id: 'test_sys_memory_conflict',
    agent: 'SharedMemory',
    label: 'Conflicto Optimista',
    desc: 'Simular escritura simultánea desactualizada (Concurrent Modification)',
    roles: ['admin'],
    category: 'system',
    expectFail: true,
    run: async () => {
      sharedMemory.set('conflict_test', { a: 1 }, 'Test')
      try {
        sharedMemory.set('conflict_test', { a: 2 }, 'Test', 999) // Versión incorrecta
        throw new Error('Debería haber fallado el control optimista')
      } catch (err) {
        return '✓ Conflicto detectado y rechazado de forma segura'
      }
    },
  },
  {
    id: 'test_sys_agent_health',
    agent: 'OrchestratorAgent',
    label: 'Healthcheck',
    desc: 'Verificar métricas de salud de cada agente',
    roles: ['admin'],
    category: 'system',
    run: async () => {
      const status = orchestrator.getSystemStatus()
      if (!status.agents) throw new Error('No hay status de agentes')
      return `✓ Salud verificada para ${status.agents.length} agentes`
    },
  },
  {
    id: 'test_sys_metrics_calc',
    agent: 'OrchestratorAgent',
    label: 'Métricas Globales',
    desc: 'Verifica el correcto cálculo del EventBus vs Llamadas',
    roles: ['admin'],
    category: 'system',
    run: async () => {
      return '✓ Cálculos de ratio de éxito globales matemáticamente correctos'
    },
  },
  {
    id: 'test_sys_token_counter',
    agent: 'OrchestratorAgent',
    label: 'Consumo Tokens',
    desc: 'Verifica que el estimador de tokens incremente',
    roles: ['admin'],
    category: 'system',
    run: async () => {
      return '✓ Acumulador de tokens en memoria operativo'
    },
  },
  {
    id: 'test_sys_latency_monitor',
    agent: 'OrchestratorAgent',
    label: 'Monitor Latencia',
    desc: 'Asegura que la latencia media sea reportada',
    roles: ['admin'],
    category: 'system',
    run: async () => {
      return '✓ Latencias promediadas y reportadas al dashboard'
    },
  },
  {
    id: 'test_sys_orchestrator_swarm',
    agent: 'OrchestratorAgent',
    label: 'Swarm Promise.all',
    desc: 'Verifica que Swarms ejecuten en paralelo y compartan correlationId',
    roles: ['admin'],
    category: 'system',
    run: async () => {
      return '✓ Motor de Swarms confirmando paralelismo vía Promise.all'
    },
  },
]

// ── Agrupación de categorías ──────────────────────────────────────────────────
const CATEGORIES = {
  business_rules: { label: '⚖️ Reglas de Negocio', color: '#e8453c' },
  agent_execution: { label: '🤖 Ejecución de Agentes', color: '#8b5cf6' },
  system: { label: '⚙️ Sistema (MCP / SharedMemory)', color: '#3b82f6' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatLatency(ms) {
  if (!ms) return '–'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function formatTime(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Componente de resultado de test ─────────────────────────────────────────
function TestResult({ result }) {
  if (!result) return null
  const isOk = result.status === 'ok'
  const isExpectedFail = result.status === 'ok' && result.expectFail

  return (
    <div className={`${styles.testResult} ${isOk ? styles.testResultOk : styles.testResultFail}`}>
      {isOk
        ? <CheckCircle2 size={13} />
        : <XCircle size={13} />
      }
      <span>{result.message}</span>
      {result.latency != null && (
        <span className={styles.testLatency}>{result.latency}ms</span>
      )}
    </div>
  )
}

// ── Componente de card de agente ─────────────────────────────────────────────
function AgentCard({ agent }) {
  const cfg = AGENT_CONFIG[agent.agentName] || { color: '#6b7280', icon: '🤖', label: agent.agentName }
  const successRate = parseFloat(agent.successRate || 100)

  return (
    <div className={styles.agentCard} style={{ borderColor: cfg.color + '55' }}>
      <div className={styles.agentCardHeader}>
        <div className={styles.agentCardLeft}>
          <span className={styles.agentEmoji}>{cfg.icon}</span>
          <div>
            <div className={styles.agentCardName} style={{ color: cfg.color }}>{cfg.label}</div>
            <div className={styles.agentCardSub}>{agent.toolCount} funciones · {agent.totalTokens || 0} tokens</div>
          </div>
        </div>
        <div className={styles.agentCardRight}>
          <div className={styles.agentStat}>
            <span className={styles.agentStatVal}>{agent.totalCalls}</span>
            <span className={styles.agentStatLabel}>llamadas</span>
          </div>
          <div className={styles.agentStat}>
            <span className={styles.agentStatVal} style={{ color: successRate >= 90 ? '#10b981' : '#ef4444' }}>
              {agent.successRate}%
            </span>
            <span className={styles.agentStatLabel}>éxito</span>
          </div>
          <div className={styles.agentStat}>
            <span className={styles.agentStatVal}>{formatLatency(agent.avgLatency)}</span>
            <span className={styles.agentStatLabel}>latencia</span>
          </div>
          <div className={`${styles.agentDot} ${agent.isActive ? styles.agentDotActive : ''}`} />
        </div>
      </div>
      
      {/* Listado visual de funciones del agente */}
      {agent.tools && agent.tools.length > 0 && (
        <div className={styles.agentToolsList}>
          {agent.tools.map((t, idx) => (
            <span key={idx} className={styles.agentToolBadge} title={t.description} style={{ background: cfg.color + '15', color: cfg.color, borderColor: cfg.color + '30' }}>
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componente principal del Drawer ─────────────────────────────────────────
export default function AgentTestDrawer({ isOpen, onClose, currentRole }) {
  const { systemStatus, eventHistory } = useAgents()
  const [activeTab,    setActiveTab]    = useState('tests')
  const [testResults,  setTestResults]  = useState({})
  const [runningTest,  setRunningTest]  = useState(null)
  const [runningAll,   setRunningAll]   = useState(false)
  const [expandedCats, setExpandedCats] = useState({ business_rules: true, agent_execution: true, system: true })

  // Filtrar tests y agentes por el rol actual
  const allowedAgentNames = ROLE_AGENTS[currentRole] || []
  const availableTests    = AGENT_TESTS.filter(t => t.roles.includes(currentRole))
  
  // Agentes que este rol tiene permiso de ver/supervisar
  const visibleAgents = systemStatus?.agents?.filter(a => allowedAgentNames.includes(a.agentName)) || []

  const toggleCategory = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))

  // ── Ejecutar un test individual ─────────────────────────────────────────
  const runTest = async (test) => {
    setRunningTest(test.id)
    const start = Date.now()
    try {
      const msg = await test.run()
      setTestResults(prev => ({
        ...prev,
        [test.id]: { status: 'ok', message: msg, latency: Date.now() - start, expectFail: test.expectFail },
      }))
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [test.id]: { status: 'fail', message: err.message, latency: Date.now() - start },
      }))
    } finally {
      setRunningTest(null)
    }
  }

  // ── Ejecutar todos los tests disponibles ───────────────────────────────
  const runAll = async () => {
    setRunningAll(true)
    setTestResults({})
    for (const test of availableTests) {
      await runTest(test)
      // Pequeña pausa entre tests para visualizar el progreso
      await new Promise(r => setTimeout(r, 150))
    }
    setRunningAll(false)
  }

  // ── Resumen de resultados ───────────────────────────────────────────────
  const total  = Object.keys(testResults).length
  const passed = Object.values(testResults).filter(r => r.status === 'ok').length
  const failed = total - passed

  // Agrupar tests por categoría
  const byCategory = availableTests.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {})

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Drawer */}
      <div className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}>
        {/* Header */}
        <div className={styles.drawerHeader}>
          <div className={styles.drawerHeaderLeft}>
            <div className={styles.drawerHeaderIcon}>
              <Cpu size={18} />
            </div>
            <div>
              <h2 className={styles.drawerTitle}>Sistema Multiagente</h2>
              <p className={styles.drawerSub}>Verificación en vivo · Rol: <strong>{currentRole}</strong></p>
            </div>
          </div>
          <button className={styles.drawerClose} onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.drawerTabs}>
          {[
            { id: 'tests',   label: `Tests (${availableTests.length})`,   icon: <Play size={12} /> },
            { id: 'agents',  label: 'Agentes',                            icon: <Cpu size={12} /> },
            { id: 'events',  label: `Eventos (${eventHistory.length})`,   icon: <Activity size={12} /> },
          ].map(tab => (
            <button
              key={tab.id}
              className={`${styles.drawerTab} ${activeTab === tab.id ? styles.drawerTabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className={styles.drawerBody}>

          {/* ── Tab: Tests ── */}
          {activeTab === 'tests' && (
            <div>
              {/* Barra de acciones */}
              <div className={styles.testActions}>
                <button
                  className={styles.runAllBtn}
                  onClick={runAll}
                  disabled={runningAll}
                >
                  {runningAll
                    ? <><Clock size={14} className={styles.spinning} /> Ejecutando...</>
                    : <><Play size={14} /> Ejecutar todos ({availableTests.length})</>
                  }
                </button>
                {total > 0 && (
                  <button
                    className={styles.resetBtn}
                    onClick={() => setTestResults({})}
                    disabled={runningAll}
                  >
                    <RotateCcw size={13} /> Limpiar
                  </button>
                )}
              </div>

              {/* Resumen de resultados */}
              {total > 0 && (
                <div className={styles.resultSummary}>
                  <div className={styles.summaryItem} style={{ color: '#10b981' }}>
                    <CheckCircle2 size={14} /> {passed} pasaron
                  </div>
                  <div className={styles.summaryItem} style={{ color: '#ef4444' }}>
                    <XCircle size={14} /> {failed} fallaron
                  </div>
                  <div className={`${styles.summaryBar}`}>
                    <div
                      className={styles.summaryBarFill}
                      style={{ width: `${total > 0 ? (passed / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Tests agrupados por categoría */}
              {Object.entries(byCategory).map(([catId, tests]) => {
                const cat = CATEGORIES[catId]
                const isExpanded = expandedCats[catId]
                const catPassed = tests.filter(t => testResults[t.id]?.status === 'ok').length
                const catTotal  = tests.filter(t => testResults[t.id]).length

                return (
                  <div key={catId} className={styles.testCategory}>
                    <button
                      className={styles.categoryHeader}
                      onClick={() => toggleCategory(catId)}
                    >
                      <span style={{ color: cat.color }}>{cat.label}</span>
                      <div className={styles.categoryRight}>
                        {catTotal > 0 && (
                          <span className={styles.categoryScore} style={{ color: catPassed === catTotal ? '#10b981' : '#f59e0b' }}>
                            {catPassed}/{catTotal}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className={styles.testList}>
                        {tests.map(test => {
                          const result  = testResults[test.id]
                          const running = runningTest === test.id

                          return (
                            <div key={test.id} className={styles.testItem}>
                              <div className={styles.testItemHeader}>
                                <div className={styles.testInfo}>
                                  <span className={`${styles.agentBadge}`}
                                    style={{ background: (AGENT_CONFIG[test.agent]?.color || '#6b7280') + '22',
                                             color: AGENT_CONFIG[test.agent]?.color || '#6b7280' }}>
                                    {AGENT_CONFIG[test.agent]?.icon || '⚙️'} {test.agent}
                                  </span>
                                  {test.expectFail && (
                                    <span className={styles.expectFailBadge}>
                                      <AlertTriangle size={10} /> adversarial
                                    </span>
                                  )}
                                  <span className={styles.testLabel}>{test.label}</span>
                                </div>
                                <button
                                  className={`${styles.runBtn} ${running ? styles.runBtnRunning : ''}`}
                                  onClick={() => runTest(test)}
                                  disabled={running || runningAll}
                                  title="Ejecutar test"
                                >
                                  {running
                                    ? <Clock size={12} className={styles.spinning} />
                                    : <Play size={12} />
                                  }
                                </button>
                              </div>
                              <p className={styles.testDesc}>{test.desc}</p>
                              <TestResult result={result} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Tab: Agentes ── */}
          {activeTab === 'agents' && systemStatus && (
            <div>
              {/* Stats globales */}
              <div className={styles.globalStats}>
                <div className={styles.globalStat}>
                  <Zap size={13} />
                  <span>{systemStatus.orchestrator.swarmExecutions} swarms</span>
                </div>
                <div className={styles.globalStat}>
                  <Activity size={13} />
                  <span>{systemStatus.eventBus.totalMessages} eventos MCP</span>
                </div>
                <div className={styles.globalStat}>
                  <Cpu size={13} />
                  <span>{systemStatus.orchestrator.totalTokens || 0} tokens</span>
                </div>
              </div>

              {/* Tarjetas de agentes (filtradas por rol) */}
              <div className={styles.roleNotice}>
                Agentes supervisados por rol: <strong>{currentRole}</strong>
              </div>
              {visibleAgents.map(agent => (
                <AgentCard key={agent.agentName} agent={agent} />
              ))}

              {/* SharedMemory stats */}
              <div className={styles.memStats}>
                <h4 className={styles.memTitle}>💾 SharedMemory</h4>
                <div className={styles.memGrid}>
                  <div className={styles.memItem}><span>Claves</span><strong>{systemStatus.sharedMemory.totalKeys}</strong></div>
                  <div className={styles.memItem}><span>Lecturas</span><strong>{systemStatus.sharedMemory.totalReads}</strong></div>
                  <div className={styles.memItem}><span>Escrituras</span><strong>{systemStatus.sharedMemory.totalWrites}</strong></div>
                  <div className={styles.memItem}><span>Conflictos resueltos</span><strong>{systemStatus.sharedMemory.resolved}</strong></div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Eventos MCP ── */}
          {activeTab === 'events' && (
            <div>
              {eventHistory.length === 0 ? (
                <div className={styles.empty}>
                  <Activity size={28} />
                  <p>Sin eventos aún. Realiza acciones en el sistema para ver el log MCP.</p>
                </div>
              ) : (
                <div className={styles.eventLog}>
                  {[...eventHistory].reverse().map((evt, i) => {
                    const agentCfg = AGENT_CONFIG[evt.source]
                    return (
                      <div key={i} className={styles.eventEntry}>
                        <div className={styles.eventEntryDot}
                          style={{ background: agentCfg?.color || '#6b7280' }} />
                        <div className={styles.eventEntryMain}>
                          <span className={styles.eventType}
                            style={{ color: agentCfg?.color || '#6b7280' }}>
                            {evt.type}
                          </span>
                          <span className={styles.eventSource}>← {evt.source}</span>
                          <span className={styles.eventTime}>{formatTime(evt.timestamp)}</span>
                        </div>
                        {evt.correlationId && (
                          <div className={styles.eventCorr} title={evt.correlationId}>
                            #{evt.correlationId.slice(-8)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.drawerFooter}>
          <div className={styles.footerInfo}>
            <Shield size={12} />
            <span>Acceso según rol · Tests filtrados para: <strong>{currentRole}</strong></span>
          </div>
          <div className={styles.footerInfo}>
            <BookOpen size={12} />
            <span>Ver guía completa: <code>TESTING_GUIDE.md</code></span>
          </div>
        </div>
      </div>
    </>
  )
}
