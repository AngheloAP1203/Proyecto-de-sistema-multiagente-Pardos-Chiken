/**
 * src/features/admin/AdminPromptPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de Asistente IA — Consultas por Prompt (solo admin/cajero/hostess)
 *
 * Permite al usuario escribir preguntas en lenguaje natural.
 * El PromptInterpreter clasifica la intención, valida permisos y
 * retorna datos reales del sistema formateados como texto o gráfica.
 *
 * Las acciones destructivas ("borra todos los datos") son bloqueadas
 * permanentemente por el guardrail del PromptInterpreter, sin excepción.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Send, ShieldAlert, ShieldCheck, BarChart2, PieChart, List, FileText, Cpu, Loader2, Trash2, Info } from 'lucide-react'
import { useAuth }         from '../../context/AuthContext'
import { useAgents }       from '../../context/AgentContext'
import { useCash }         from '../../context/CashContext'
import { useReservations } from '../../context/ReservationContext'
import { useClients }      from '../../context/ClientContext'
import { promptInterpreter } from '../../agents/core/PromptInterpreter'
import styles from './AdminPromptPage.module.css'

// ── Sugerencias de prompts por rol ────────────────────────────────────────────
const PROMPT_SUGGESTIONS = {
  admin: [
    'Dame un resumen de las ventas de hoy',
    'Elaborame una gráfica de las ventas de hoy',
    'Ventas por método de pago',
    'Cuántas reservas hay hoy',
    'Gráfica de reservas por estado',
    'Lista de clientes VIP',
    'Cómo están funcionando los agentes',
    'Dame un resumen ejecutivo del día',
  ],
  cajero: [
    'Dame un resumen de las ventas de hoy',
    'Gráfica de ventas por hora',
    'Ventas por método de pago',
    'Resumen de clientes',
  ],
  hostess: [
    'Cuántas reservas hay hoy',
    'Estado de las reservas',
    'Gráfica de reservas por estado',
    'Resumen de clientes',
  ],
}

// ── Colores de los estados de intención ──────────────────────────────────────
const INTENT_COLORS = {
  'read.sales.summary':       '#e8622a',
  'read.sales.chart':         '#f97316',
  'read.sales.by_method':     '#fb923c',
  'read.reservations.today':  '#3b82f6',
  'read.reservations.chart':  '#60a5fa',
  'read.clients.vip':         '#8b5cf6',
  'read.clients.summary':     '#a78bfa',
  'read.system.status':       '#10b981',
  'read.general.summary':     '#0f172a',
  'BLOCKED.destructive':      '#ef4444',
  'BLOCKED.unauthorized':     '#f59e0b',
  'unknown':                  '#6b7280',
}

// ── Componente de gráfica de barras (SVG inline) ──────────────────────────────
function BarChartInline({ config }) {
  if (!config || !config.values?.length) return null

  const max       = Math.max(...config.values, 1)
  const barCount  = config.values.length
  const svgW      = Math.max(400, barCount * 48)
  const svgH      = 180
  const barW      = Math.max(28, Math.min(44, (svgW - 60) / barCount - 6))
  const padLeft   = 44
  const padBottom = 36

  return (
    <div className={styles.chartWrap}>
      <p className={styles.chartTitle}>{config.title}</p>
      <div className={styles.chartScroll}>
        <svg width={svgW} height={svgH} className={styles.chartSvg}>
          {/* Guías horizontales */}
          {[0.25, 0.5, 0.75, 1].map(frac => {
            const y = svgH - padBottom - frac * (svgH - padBottom - 12)
            return (
              <g key={frac}>
                <line x1={padLeft} y1={y} x2={svgW - 8} y2={y} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 2" />
                <text x={padLeft - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">
                  {config.yLabel?.includes('S/.') ? `S/.${((max * frac)).toFixed(0)}` : Math.round(max * frac)}
                </text>
              </g>
            )
          })}

          {/* Barras */}
          {config.values.map((val, i) => {
            const x    = padLeft + i * ((svgW - padLeft - 8) / barCount) + 3
            const barH = (val / max) * (svgH - padBottom - 16)
            const y    = svgH - padBottom - barH

            return (
              <g key={i}>
                <rect
                  x={x} y={y} width={barW} height={barH}
                  fill={config.color || '#e8622a'}
                  rx={3}
                  opacity={0.85}
                />
                {val > 0 && (
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#475569" fontWeight="600">
                    {config.yLabel?.includes('S/.') ? `${val.toFixed(0)}` : val}
                  </text>
                )}
                <text
                  x={x + barW / 2} y={svgH - padBottom + 14}
                  textAnchor="middle" fontSize={9} fill="#64748b"
                  transform={barCount > 8 ? `rotate(-40, ${x + barW / 2}, ${svgH - padBottom + 14})` : undefined}
                >
                  {config.labels[i]}
                </text>
              </g>
            )
          })}

          {/* Eje X */}
          <line x1={padLeft} y1={svgH - padBottom} x2={svgW - 8} y2={svgH - padBottom} stroke="#cbd5e1" strokeWidth={1} />
          {/* Eje Y */}
          <line x1={padLeft} y1={10} x2={padLeft} y2={svgH - padBottom} stroke="#cbd5e1" strokeWidth={1} />
        </svg>
      </div>
    </div>
  )
}

// ── Componente de gráfica de pastel (SVG inline) ──────────────────────────────
function PieChartInline({ config }) {
  if (!config || !config.values?.length) return null

  const total  = config.values.reduce((s, v) => s + v, 0)
  const colors = config.colors || ['#e8622a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
  const cx = 80, cy = 80, r = 68

  let cumulativeAngle = -Math.PI / 2
  const slices = config.values.map((val, i) => {
    const angle     = (val / total) * 2 * Math.PI
    const startAngle = cumulativeAngle
    cumulativeAngle += angle

    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(cumulativeAngle)
    const y2 = cy + r * Math.sin(cumulativeAngle)
    const largeArc = angle > Math.PI ? 1 : 0

    const midAngle = startAngle + angle / 2
    const lx = cx + (r * 0.65) * Math.cos(midAngle)
    const ly = cy + (r * 0.65) * Math.sin(midAngle)

    return { x1, y1, x2, y2, largeArc, color: colors[i % colors.length], lx, ly, pct: ((val / total) * 100).toFixed(0), val }
  })

  return (
    <div className={styles.chartWrap}>
      <p className={styles.chartTitle}>{config.title}</p>
      <div className={styles.pieRow}>
        <svg width={160} height={160}>
          {slices.map((s, i) => (
            <g key={i}>
              <path
                d={`M ${cx} ${cy} L ${s.x1} ${s.y1} A ${r} ${r} 0 ${s.largeArc} 1 ${s.x2} ${s.y2} Z`}
                fill={s.color} stroke="#fff" strokeWidth={2}
              />
              {parseFloat(s.pct) >= 8 && (
                <text x={s.lx} y={s.ly + 4} textAnchor="middle" fontSize={10} fill="#fff" fontWeight="700">
                  {s.pct}%
                </text>
              )}
            </g>
          ))}
        </svg>
        <div className={styles.pieLegend}>
          {config.labels.map((label, i) => (
            <div key={i} className={styles.pieLegendItem}>
              <span className={styles.pieLegendDot} style={{ background: colors[i % colors.length] }} />
              <span className={styles.pieLegendLabel}>{label}</span>
              <span className={styles.pieLegendVal}>S/. {config.values[i]?.toFixed(2) || '0.00'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Componente de un mensaje del chat ─────────────────────────────────────────
function ChatMessage({ msg }) {
  const intentColor = INTENT_COLORS[msg.result?.intent] || '#6b7280'

  if (msg.role === 'user') {
    return (
      <div className={styles.msgUser}>
        <div className={styles.msgUserBubble}>{msg.content}</div>
      </div>
    )
  }

  const result = msg.result
  if (!result) return null

  // ── Respuesta bloqueada ────────────────────────────────────────────────────
  if (result.blocked) {
    return (
      <div className={styles.msgAgent}>
        <div className={styles.msgAgentIcon} style={{ background: '#fee2e2', color: '#ef4444' }}>
          <ShieldAlert size={16} />
        </div>
        <div className={`${styles.msgAgentBubble} ${styles.msgBlocked}`}>
          <div className={styles.msgBlockedHeader}>
            <ShieldAlert size={14} />
            {result.intent === 'BLOCKED.destructive' ? 'Acción bloqueada por seguridad' : 'Sin permiso'}
          </div>
          <p className={styles.msgBlockedText}>{result.reason}</p>
          <div className={styles.msgMeta}>
            <span>Intent detectado: <code>{result.intent}</code></span>
            <span>{result.latency}ms</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Respuesta desconocida ─────────────────────────────────────────────────
  if (result.intent === 'unknown') {
    return (
      <div className={styles.msgAgent}>
        <div className={styles.msgAgentIcon} style={{ background: '#f1f5f9', color: '#64748b' }}>
          <Bot size={16} />
        </div>
        <div className={styles.msgAgentBubble}>
          <MarkdownText text={result.summary} />
          <div className={styles.msgMeta}>
            <span>No reconocida</span>
            <span>{result.latency}ms</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Respuesta exitosa ──────────────────────────────────────────────────────
  return (
    <div className={styles.msgAgent}>
      <div className={styles.msgAgentIcon} style={{ background: intentColor + '20', color: intentColor }}>
        <ShieldCheck size={16} />
      </div>
      <div className={styles.msgAgentBubble}>
        {/* Badge de intención + agentes */}
        <div className={styles.msgIntentRow}>
          <span className={styles.msgIntentBadge} style={{ background: intentColor + '18', color: intentColor, borderColor: intentColor + '30' }}>
            {result.description}
          </span>
          {result.agentsUsed?.map(a => (
            <span key={a} className={styles.msgAgentBadge}>
              <Cpu size={10} /> {a}
            </span>
          ))}
          <span className={styles.msgConfidence} title="Confianza de clasificación">
            {result.confidence}% confianza
          </span>
        </div>

        {/* Gráfica de barras */}
        {result.type === 'bar_chart' && result.chartConfig && (
          <BarChartInline config={result.chartConfig} />
        )}

        {/* Gráfica de pastel */}
        {result.type === 'pie_chart' && result.chartConfig && (
          <PieChartInline config={result.chartConfig} />
        )}

        {/* Lista de clientes VIP */}
        {result.type === 'list' && Array.isArray(result.data) && result.data.length > 0 && (
          <div className={styles.vipList}>
            {result.data.map((c, i) => (
              <div key={i} className={styles.vipItem}>
                <span className={styles.vipAvatar}>{c.name?.[0] || '?'}</span>
                <div>
                  <p className={styles.vipName}>{c.name} <span className={styles.vipTag}>VIP</span></p>
                  <p className={styles.vipSub}>{c.phone} · {c.completedReservations || 0} reservas completadas</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Texto de resumen (markdown simplificado) */}
        <MarkdownText text={result.summary} />

        {/* Meta */}
        <div className={styles.msgMeta}>
          <span>Intent: <code>{result.intent}</code></span>
          <span>{result.latency}ms</span>
        </div>
      </div>
    </div>
  )
}

// Renderer de markdown básico (negritas con **)
function MarkdownText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div className={styles.markdownText}>
      {lines.map((line, i) => {
        const parts = line.split(/\*\*(.*?)\*\*/g)
        return (
          <p key={i} className={line.startsWith('•') ? styles.mdBullet : styles.mdLine}>
            {parts.map((part, j) =>
              j % 2 === 1 ? <strong key={j}>{part}</strong> : part
            )}
          </p>
        )
      })}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminPromptPage() {
  const { user }            = useAuth()
  const { systemStatus }    = useAgents()
  const { payments }        = useCash()
  const { reservations }    = useReservations()
  const { clients }         = useClients()

  const [messages,   setMessages]   = useState([])
  const [input,      setInput]      = useState('')
  const [isLoading,  setIsLoading]  = useState(false)
  const [showInfo,   setShowInfo]   = useState(true)

  const bottomRef   = useRef(null)
  const inputRef    = useRef(null)
  const role        = user?.role || 'admin'
  const suggestions = PROMPT_SUGGESTIONS[role] || PROMPT_SUGGESTIONS.admin

  // Scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(async (promptText) => {
    const text = (promptText || input).trim()
    if (!text || isLoading) return

    setInput('')
    setShowInfo(false)
    setIsLoading(true)

    // Agregar mensaje del usuario
    setMessages(prev => [...prev, { role: 'user', content: text, id: Date.now() }])

    // Construir contexto con los datos reales del sistema
    const contextData = {
      payments:     payments     || [],
      reservations: reservations || [],
      clients:      clients      || [],
      systemStatus: systemStatus || null,
    }

    // Interpretar prompt (el guardrail actúa aquí)
    const result = await promptInterpreter.interpret(text, role, contextData)

    // Agregar respuesta del agente
    setMessages(prev => [...prev, {
      role:   'agent',
      result,
      id:     Date.now() + 1,
    }])

    setIsLoading(false)
    inputRef.current?.focus()
  }, [input, isLoading, role, payments, reservations, clients, systemStatus])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const clearChat = () => {
    setMessages([])
    setShowInfo(true)
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Bot size={22} />
          </div>
          <div>
            <h1 className={styles.headerTitle}>Asistente IA</h1>
            <p className={styles.headerSub}>Consultas en lenguaje natural · Acceso controlado por rol</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.roleBadge}>{role}</span>
          {messages.length > 0 && (
            <button className={styles.clearBtn} onClick={clearChat} title="Limpiar conversación">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Área de mensajes */}
      <div className={styles.chatArea}>

        {/* Panel informativo inicial */}
        {showInfo && (
          <div className={styles.infoPanel}>
            <div className={styles.infoPanelIcon}><Bot size={28} /></div>
            <h2 className={styles.infoPanelTitle}>Asistente de consultas IA</h2>
            <p className={styles.infoPanelDesc}>
              Puedo responder preguntas sobre las operaciones del restaurante usando datos en tiempo real.
              Todas las consultas pasan por un sistema de permisos — las acciones destructivas están
              permanentemente bloqueadas.
            </p>

            <div className={styles.infoSections}>
              {/* Permitido */}
              <div className={styles.infoSection}>
                <div className={styles.infoSectionTitle} style={{ color: '#16a34a' }}>
                  <ShieldCheck size={14} /> Consultas permitidas para tu rol
                </div>
                {promptInterpreter.getAvailableIntents(role).map(({ intent, description }) => (
                  <div key={intent} className={styles.infoAllowed}>
                    <span className={styles.infoAllowedDot} />
                    {description}
                  </div>
                ))}
              </div>
              {/* Bloqueado */}
              <div className={styles.infoSection}>
                <div className={styles.infoSectionTitle} style={{ color: '#dc2626' }}>
                  <ShieldAlert size={14} /> Siempre bloqueado (todos los roles)
                </div>
                <div className={styles.infoBlocked}>Borrar, eliminar o resetear datos</div>
                <div className={styles.infoBlocked}>Modificar contraseñas o roles</div>
                <div className={styles.infoBlocked}>Sentencias SQL / inyección de código</div>
                <div className={styles.infoBlocked}>Apagar o deshabilitar el sistema</div>
              </div>
            </div>
          </div>
        )}

        {/* Mensajes del chat */}
        {messages.map(msg => (
          <ChatMessage key={msg.id} msg={msg} />
        ))}

        {/* Indicador de carga */}
        {isLoading && (
          <div className={styles.msgAgent}>
            <div className={styles.msgAgentIcon} style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <Loader2 size={16} className={styles.spin} />
            </div>
            <div className={`${styles.msgAgentBubble} ${styles.loadingBubble}`}>
              <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Sugerencias de prompts */}
      {messages.length === 0 && (
        <div className={styles.suggestions}>
          {suggestions.map((s, i) => (
            <button key={i} className={styles.suggestionBtn} onClick={() => handleSubmit(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input de prompt */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Escribe tu consulta... ej. "Dame un resumen de las ventas de hoy"'
          rows={2}
          disabled={isLoading}
        />
        <button
          className={styles.sendBtn}
          onClick={() => handleSubmit()}
          disabled={!input.trim() || isLoading}
          title="Enviar (Enter)"
        >
          {isLoading ? <Loader2 size={18} className={styles.spin} /> : <Send size={18} />}
        </button>
      </div>

      {/* Footer de seguridad */}
      <div className={styles.securityFooter}>
        <ShieldCheck size={12} />
        Sistema de control de permisos activo · Rol: <strong>{role}</strong> ·
        Acciones destructivas bloqueadas permanentemente · PromptInterpreter v1.0
      </div>
    </div>
  )
}
