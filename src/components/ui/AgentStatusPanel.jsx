/**
 * src/components/ui/AgentStatusPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de monitoreo en tiempo real del sistema multiagente Pardos Chicken.
 *
 * Este componente es la PRUEBA VISUAL del funcionamiento del sistema.
 * Muestra en tiempo real (polling cada 2s desde AgentContext):
 *
 *   📊 Tab Agentes:
 *     - Estado activo/inactivo de cada agente con indicador animado
 *     - Métricas cuantitativas: llamadas totales, tasa de éxito (%), latencia (ms), tokens
 *     - Barra de éxito con color semafórico (verde ≥90%, rojo <90%)
 *     - Indicador "🌀 SWARM ACTIVO" cuando hay agentes ejecutándose en paralelo
 *
 *   📡 Tab Eventos (MCP):
 *     - Historial de mensajes del EventBus con schema JSON validado
 *     - Cada mensaje muestra: tipo, source, correlationId, timestamp
 *     - Colores diferenciados por dominio (reservas=rojo, cocina=ámbar, caja=verde...)
 *
 *   🗺️ Tab Topología:
 *     - Diagrama visual de la arquitectura estrella (Hub-and-Spoke)
 *     - Lista de los 3 Swarms disponibles con descripción de paralelismo
 *     - Métricas de la SharedMemory (conflictos detectados y resueltos)
 *
 *   🔔 Tab Alertas:
 *     - Notificaciones generadas por el NotificationAgent
 *     - Prioridades: urgente (rojo), importante (ámbar), success (verde), info (azul)
 *
 * Patrones usados:
 *   - React Context Consumer (useAgents)
 *   - CSS Modules para estilos encapsulados
 *   - Polling vía setInterval en AgentContext (sin estado local de datos)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import {
  Activity, Cpu, Zap, MessageSquare, BarChart2,
  RefreshCw, ChevronDown, ChevronUp, GitBranch,
  CheckCircle, AlertTriangle, Clock, Database,
} from 'lucide-react'
import { useAgents } from '../../context/AgentContext'
import styles from './AgentStatusPanel.module.css'

// ── Configuración visual por agente ──────────────────────────────────────────
// Cada agente tiene un color de marca, ícono y descripción de rol para la UI
const AGENT_CONFIG = {
  ReservationAgent:   { bg: '#e8453c18', border: '#e8453c', icon: '📅', role: 'Ciclo de vida reservas' },
  KitchenAgent:       { bg: '#f59e0b18', border: '#f59e0b', icon: '🍳', role: 'Flujo de pedidos cocina' },
  CashAgent:          { bg: '#10b98118', border: '#10b981', icon: '💳', role: 'Cobros · IGV · Turnos' },
  ClientAgent:        { bg: '#8b5cf618', border: '#8b5cf6', icon: '👤', role: 'Perfiles · VIP · CRM' },
  NotificationAgent:  { bg: '#3b82f618', border: '#3b82f6', icon: '🔔', role: 'Alertas reactivas' },
}

// ── Colores por dominio de evento para el historial MCP ──────────────────────
// Los eventos del EventBus tienen prefijos que indican su dominio
const EVENT_COLOR_MAP = {
  'reservation:': '#e8453c',  // Dominio de reservas — rojo Pardos
  'kitchen:':     '#f59e0b',  // Dominio de cocina — ámbar
  'cash:':        '#10b981',  // Dominio de caja — verde
  'client:':      '#8b5cf6',  // Dominio de clientes — violeta
  'system:':      '#6b7280',  // Eventos de sistema — gris
}

/**
 * getEventColor — Determina el color de un evento según su prefijo de dominio.
 * @param {string} type - Tipo de evento (ej: "reservation:created")
 * @returns {string} Color hexadecimal
 */
function getEventColor(type) {
  for (const [prefix, color] of Object.entries(EVENT_COLOR_MAP)) {
    if (type?.startsWith(prefix)) return color
  }
  return '#6b7280'
}

/**
 * formatLatency — Convierte milisegundos en texto legible para humanos.
 * @param {number} ms - Latencia en milisegundos
 * @returns {string} Texto formateado (ej: "45ms" o "1.2s")
 */
function formatLatency(ms) {
  if (!ms && ms !== 0) return '–'
  if (ms === 0) return '< 1ms'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * formatTime — Convierte un timestamp ISO a hora legible en zona horaria peruana.
 * @param {string} iso - Timestamp ISO (ej: "2026-05-22T18:30:00.000Z")
 * @returns {string} Hora formateada (ej: "13:30:45")
 */
function formatTime(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

/**
 * MetricBadge — Badge de métrica individual con valor resaltado.
 * Usado para mostrar swarms, tokens y mensajes en el header del panel.
 */
function MetricBadge({ icon: Icon, label, value, color }) {
  return (
    <div className={styles.metricBadge} style={{ borderColor: color + '44', background: color + '11' }}>
      {Icon && <Icon size={11} color={color} />}
      <span style={{ color }} className={styles.metricBadgeValue}>{value}</span>
      <span className={styles.metricBadgeLabel}>{label}</span>
    </div>
  )
}

/**
 * AgentCard — Tarjeta de estado de un agente individual.
 * Muestra:
 *   - Punto de estado (verde pulsante si activo, gris si inactivo)
 *   - Nombre del agente, rol y número de tools registradas
 *   - Métricas cuantitativas: llamadas, tasa de éxito, latencia, tokens
 *   - Barra de progreso de éxito con color semafórico
 *
 * @param {Object} agent - Métricas del agente obtenidas de agent.getMetrics()
 */
function AgentCard({ agent }) {
  const cfg = AGENT_CONFIG[agent.agentName] || { bg: '#f3f4f6', border: '#9ca3af', icon: '🤖', role: 'Agente' }
  const successRate = parseFloat(agent.successRate || 100)
  const isGood = successRate >= 90  // Umbral: >= 90% = excelente

  return (
    <div
      className={`${styles.agentCard} ${agent.isActive ? styles.agentCardActive : ''}`}
      style={{ background: cfg.bg, borderColor: agent.isActive ? cfg.border : cfg.border + '66' }}
    >
      {/* Indicador de estado: punto pulsante si activo, estático si inactivo */}
      <div className={`${styles.agentDot} ${agent.isActive ? styles.agentDotActive : ''}`} />

      {/* Encabezado de la tarjeta */}
      <div className={styles.agentHeader}>
        <div className={styles.agentIcon}>{cfg.icon}</div>
        <div className={styles.agentInfo}>
          <div className={styles.agentName}>{agent.agentName}</div>
          <div className={styles.agentRole}>{cfg.role}</div>
          <div className={styles.agentMeta}>
            {agent.toolCount} tools · {agent.historyEntries} msgs history
          </div>
        </div>
      </div>

      {/* Métricas cuantitativas */}
      <div className={styles.agentMetrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Llamadas</span>
          <span className={styles.metricValue}>{agent.totalCalls}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Éxito</span>
          <span
            className={styles.metricValue}
            style={{ color: isGood ? '#10b981' : '#ef4444', fontWeight: 700 }}
          >
            {agent.successRate}%
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Latencia</span>
          <span className={styles.metricValue}>{formatLatency(agent.avgLatency)}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Tokens</span>
          <span className={styles.metricValue} style={{ color: '#8b5cf6' }}>
            {agent.totalTokens || 0}
          </span>
        </div>
      </div>

      {/* Barra de éxito con color semafórico */}
      <div className={styles.successBar} title={`Tasa de éxito: ${agent.successRate}%`}>
        <div
          className={styles.successBarFill}
          style={{
            width: `${successRate}%`,
            background: isGood
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : 'linear-gradient(90deg, #ef4444, #f87171)',
          }}
        />
      </div>
      <div className={styles.successBarLabel}>
        <span style={{ color: isGood ? '#10b981' : '#ef4444' }}>
          {isGood ? '✓ Óptimo' : '⚠ Degradado'}
        </span>
        <span>{successRate}%</span>
      </div>
    </div>
  )
}

/**
 * EventRow — Fila de evento del historial MCP.
 * Muestra tipo de evento (con color de dominio), agente origen, correlationId y timestamp.
 *
 * El correlationId es clave: permite verificar que dos eventos del mismo Swarm
 * comparten el mismo ID (ej: reservation:approved + client:created tienen el mismo
 * correlationId en un Swarm de aprobación).
 *
 * @param {Object} event - Mensaje del EventBus
 */
function EventRow({ event }) {
  const [expanded, setExpanded] = useState(false)
  const color = getEventColor(event.type)

  return (
    <div className={styles.eventRow} onClick={() => setExpanded(v => !v)}>
      {/* Punto de color de dominio */}
      <span className={styles.eventDot} style={{ background: color }} />

      <div className={styles.eventContent}>
        {/* Tipo de evento con color de dominio */}
        <span className={styles.eventType} style={{ color }}>{event.type}</span>
        {/* Agente que publicó el evento */}
        <span className={styles.eventSource}>← {event.source}</span>
        {/* correlationId truncado (importante para verificar paralelismo) */}
        {event.correlationId && (
          <span className={styles.eventCorrelation} title={`CorrelationID: ${event.correlationId}`}>
            #{event.correlationId.slice(-6)}
          </span>
        )}
      </div>

      <span className={styles.eventTime}>{formatTime(event.timestamp)}</span>

      {/* Payload expandible (para ver los datos del mensaje MCP) */}
      {expanded && event.payload && (
        <div className={styles.eventPayload}>
          <pre>{JSON.stringify(event.payload, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

/**
 * TopologyDiagram — Diagrama visual de la arquitectura estrella.
 * La topología ESTRELLA coloca al Orquestador como HUB central que conecta
 * todos los subagentes. Ningún subagente se comunica directamente con otro:
 * toda comunicación pasa por el hub o por el EventBus.
 */
function TopologyDiagram({ orchestratorMetrics }) {
  const agents = [
    { name: 'ReservationAgent', icon: '📅', color: '#e8453c' },
    { name: 'KitchenAgent',     icon: '🍳', color: '#f59e0b' },
    { name: 'CashAgent',        icon: '💳', color: '#10b981' },
    { name: 'ClientAgent',      icon: '👤', color: '#8b5cf6' },
    { name: 'NotificationAgent',icon: '🔔', color: '#3b82f6' },
  ]

  return (
    <div className={styles.topology}>
      {/* Hub central */}
      <div className={styles.topoHub}>
        <div className={styles.topoHubInner}>
          <span className={styles.topoHubIcon}>🌟</span>
          <span className={styles.topoHubLabel}>Orchestrator</span>
          <span className={styles.topoHubSub}>HUB Central</span>
        </div>
        {/* Líneas hacia los subagentes */}
        <div className={styles.topoSpokes}>
          {agents.map(a => (
            <div key={a.name} className={styles.topoSpoke}>
              <div className={styles.topoLine} style={{ background: `linear-gradient(90deg, ${a.color}88, ${a.color})` }} />
              <div className={styles.topoAgent} style={{ borderColor: a.color, background: a.color + '18' }}>
                <span>{a.icon}</span>
                <span style={{ color: a.color, fontSize: '10px', fontWeight: 600 }}>
                  {a.name.replace('Agent', '')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Descripción de la topología */}
      <p className={styles.topologyLabel}>
        <strong>Topología Estrella</strong> (Hub-and-Spoke) — Todos los mensajes
        pasan por el OrchestratorAgent. La comunicación lateral se hace vía EventBus (MCP).
      </p>

      {/* Swarms disponibles */}
      <div className={styles.swarmInfo}>
        <h4 className={styles.swarmTitle}>
          <Zap size={13} /> Swarms (ejecución paralela — Promise.all)
        </h4>
        <div className={styles.swarmList}>
          <div className={styles.swarmItem}>
            <span className={styles.swarmDot} style={{ background: '#e8453c' }} />
            <div>
              <strong>approve_reservation</strong>
              <span>ReservationAgent + ClientAgent en paralelo al aprobar</span>
            </div>
          </div>
          <div className={styles.swarmItem}>
            <span className={styles.swarmDot} style={{ background: '#f59e0b' }} />
            <div>
              <strong>seat_with_kitchen</strong>
              <span>ReservationAgent + KitchenAgent en paralelo al sentar</span>
            </div>
          </div>
          <div className={styles.swarmItem}>
            <span className={styles.swarmDot} style={{ background: '#10b981' }} />
            <div>
              <strong>register_payment</strong>
              <span>CashAgent + ReservationAgent en paralelo al cobrar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * GlobalMetricsBar — Barra de métricas cuantitativas globales del sistema.
 * Muestra los KPIs más importantes que el evaluador necesita ver:
 *   - Total de mensajes MCP procesados
 *   - Tasa de éxito del EventBus
 *   - Swarms ejecutados (flujos paralelos)
 *   - Total de tokens consumidos (estimación heurística)
 *   - Conflictos de SharedMemory detectados y resueltos
 *
 * @param {Object} props
 * @param {Object} props.orchestrator - Métricas del orquestador
 * @param {Object} props.eventBus - Métricas del EventBus
 * @param {Object} props.sharedMemory - Métricas de la SharedMemory
 */
function GlobalMetricsBar({ orchestrator, eventBus, sharedMemory }) {
  const metrics = [
    {
      label: 'Msgs MCP',
      value: eventBus?.totalMessages || 0,
      icon: MessageSquare,
      color: '#3b82f6',
      title: 'Total de mensajes publicados en el EventBus con schema JSON validado',
    },
    {
      label: 'Éxito Bus',
      value: `${eventBus?.successRate || '100.0'}%`,
      icon: CheckCircle,
      color: '#10b981',
      title: 'Porcentaje de mensajes que pasaron la validación MCP sin errores',
    },
    {
      label: 'Swarms',
      value: orchestrator?.swarmExecutions || 0,
      icon: Zap,
      color: '#f59e0b',
      title: 'Número de flujos paralelos ejecutados con Promise.all()',
    },
    {
      label: 'Paralelas',
      value: orchestrator?.parallelTasksTotal || 0,
      icon: RefreshCw,
      color: '#8b5cf6',
      title: 'Total de tareas ejecutadas en paralelo dentro de todos los Swarms',
    },
    {
      label: 'Tokens',
      value: orchestrator?.totalTokens || 0,
      icon: Cpu,
      color: '#e8453c',
      title: 'Estimación de tokens consumidos (1 token ≈ 4 caracteres)',
    },
    {
      label: 'Conflictos',
      value: `${sharedMemory?.conflicts || 0}/${sharedMemory?.resolved || 0}`,
      icon: AlertTriangle,
      color: sharedMemory?.conflicts > 0 ? '#f59e0b' : '#10b981',
      title: 'Conflictos detectados en SharedMemory / Conflictos resueltos automáticamente',
    },
  ]

  return (
    <div className={styles.globalMetrics}>
      {metrics.map(m => (
        <div key={m.label} className={styles.globalMetricItem} title={m.title}>
          <m.icon size={14} style={{ color: m.color }} />
          <span className={styles.globalMetricValue} style={{ color: m.color }}>{m.value}</span>
          <span className={styles.globalMetricLabel}>{m.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

/**
 * AgentStatusPanel — Panel principal de monitoreo del sistema multiagente.
 *
 * Se monta en el Dashboard y se actualiza automáticamente cada 2 segundos
 * gracias al polling que hace AgentContext con setInterval.
 *
 * Tabs disponibles:
 *   - 'agents':        Estado y métricas de cada agente
 *   - 'events':        Historial del EventBus (mensajes MCP)
 *   - 'topology':      Diagrama de arquitectura + Swarms
 *   - 'notifications': Alertas generadas por el NotificationAgent
 */
export default function AgentStatusPanel() {
  // Obtener datos del sistema desde el AgentContext
  const { systemStatus, eventHistory, notifications } = useAgents()

  // Tab activo: 'agents' | 'events' | 'topology' | 'notifications'
  const [activeTab, setActiveTab] = useState('agents')

  // Controlar si el panel está expandido o colapsado
  const [expanded, setExpanded] = useState(true)

  // Si aún no hay datos (primer render), no mostrar nada
  if (!systemStatus) return null

  const { orchestrator, agents, eventBus: busMeta, sharedMemory: memMeta } = systemStatus

  // Detectar si hay algún swarm activo (algún agente procesando en este momento)
  const activeCount = agents.filter(a => a.isActive).length
  const hasActiveSwarm = activeCount >= 2  // Un swarm implica ≥ 2 agentes activos en paralelo

  return (
    <div className={styles.panel}>
      {/* ── Header colapsable ── */}
      <div
        className={`${styles.header} ${hasActiveSwarm ? styles.headerSwarmActive : ''}`}
        onClick={() => setExpanded(v => !v)}
        role="button"
        aria-expanded={expanded}
        title="Clic para expandir/colapsar el panel"
      >
        <div className={styles.headerLeft}>
          <Cpu size={16} className={styles.headerIcon} />
          <span className={styles.headerTitle}>Sistema Multiagente</span>

          {/* Badge de agentes activos */}
          <span className={styles.headerBadge}>
            {activeCount > 0
              ? `${activeCount} activo(s)`
              : `${agents.length} agentes registrados`}
          </span>

          {/* Indicador de SWARM ACTIVO — aparece cuando ≥ 2 agentes actúan en paralelo */}
          {hasActiveSwarm && (
            <span className={styles.swarmActiveBadge}>
              <Zap size={10} />
              🌀 SWARM ACTIVO ({activeCount} agentes en paralelo)
            </span>
          )}

          {/* Badge de swarms ejecutados */}
          {orchestrator.swarmExecutions > 0 && !hasActiveSwarm && (
            <span className={styles.swarmBadge}>
              <Zap size={10} />
              {orchestrator.swarmExecutions} swarms ejecutados
            </span>
          )}
        </div>

        <div className={styles.headerRight}>
          <span className={styles.successBadge}>
            {busMeta.successRate}% éxito · {busMeta.totalMessages} msgs
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* ── Contenido expandible ── */}
      {expanded && (
        <>
          {/* Barra de métricas globales — visible en todos los tabs */}
          <GlobalMetricsBar
            orchestrator={orchestrator}
            eventBus={busMeta}
            sharedMemory={memMeta}
          />

          {/* ── Navegación de tabs ── */}
          <div className={styles.tabs}>
            {[
              {
                id: 'agents',
                label: `Agentes (${agents.length})`,
                icon: <Cpu size={12} />,
                badge: activeCount > 0 ? activeCount : null,
              },
              {
                id: 'events',
                label: `Eventos MCP (${eventHistory.length})`,
                icon: <Activity size={12} />,
              },
              {
                id: 'topology',
                label: 'Topología',
                icon: <GitBranch size={12} />,
              },
              {
                id: 'notifications',
                label: `Alertas (${notifications.length})`,
                icon: <MessageSquare size={12} />,
                badge: notifications.filter(n => !n.read).length || null,
              },
            ].map(tab => (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id) }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className={styles.tabBadge}>{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Contenido del tab activo ── */}
          <div className={styles.body}>

            {/* ── Tab: Agentes ── */}
            {activeTab === 'agents' && (
              <div>
                {/* Resumen del orquestador */}
                <div className={styles.orchHeader}>
                  <div className={styles.orchBadge}>
                    <Database size={12} />
                    <span>OrchestratorAgent · Topología Estrella</span>
                  </div>
                  <div className={styles.orchStats}>
                    <div className={styles.orchStat}>
                      <Clock size={11} />
                      <span>Uptime: {orchestrator.uptime}s</span>
                    </div>
                    <div className={styles.orchStat}>
                      <Zap size={11} />
                      <span>{orchestrator.swarmExecutions} swarms · {orchestrator.parallelTasksTotal} tareas paralelas</span>
                    </div>
                    <div className={styles.orchStat}>
                      <Cpu size={11} />
                      <span>{orchestrator.totalTokens || 0} tokens consumidos</span>
                    </div>
                    <div className={styles.orchStat}>
                      <RefreshCw size={11} />
                      <span>Conflictos resueltos: {memMeta.resolved}/{memMeta.conflicts}</span>
                    </div>
                  </div>
                </div>

                {/* Grid de tarjetas de agentes */}
                <div className={styles.agentGrid}>
                  {agents.map(agent => (
                    <AgentCard key={agent.agentName} agent={agent} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Tab: Eventos MCP ── */}
            {activeTab === 'events' && (
              <div className={styles.eventList}>
                {eventHistory.length === 0 ? (
                  <div className={styles.empty}>
                    <Activity size={28} />
                    <p>No hay eventos registrados aún.</p>
                    <p className={styles.emptyHint}>
                      Realiza una acción (crear reserva, cobrar, sentar cliente)
                      para ver el historial de mensajes MCP del EventBus.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className={styles.eventListHint}>
                      💡 Haz clic en un evento para ver su payload JSON completo.
                      Los eventos con el mismo <code>correlationId</code> pertenecen al mismo flujo (Swarm).
                    </div>
                    {[...eventHistory].reverse().map((event, i) => (
                      <EventRow key={`${event.messageId ?? i}`} event={event} />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── Tab: Topología ── */}
            {activeTab === 'topology' && (
              <TopologyDiagram orchestratorMetrics={orchestrator} />
            )}

            {/* ── Tab: Notificaciones ── */}
            {activeTab === 'notifications' && (
              <div className={styles.eventList}>
                {notifications.length === 0 ? (
                  <div className={styles.empty}>
                    <MessageSquare size={28} />
                    <p>Sin alertas del sistema por ahora.</p>
                    <p className={styles.emptyHint}>
                      El NotificationAgent generará alertas aquí cuando ocurran
                      eventos relevantes (nuevas solicitudes, pedidos listos, conflictos).
                    </p>
                  </div>
                ) : (
                  notifications.map((n, i) => (
                    <div
                      key={`${n.id ?? i}`}
                      className={`${styles.notifRow} ${styles[`notif_${n.priority}`]}`}
                    >
                      <div className={styles.notifTitle}>{n.title}</div>
                      <div className={styles.notifMsg}>{n.message}</div>
                      <div className={styles.notifTime}>{formatTime(n.timestamp)}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
