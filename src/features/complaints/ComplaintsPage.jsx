/**
 * src/features/complaints/ComplaintsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo de Quejas con IA — Bandeja del líder.
 *
 *   · Bandeja: lista de quejas triadas con filtro por sede y badges de prioridad.
 *   · Nueva queja (M1): pega el mensaje del cliente → triaje con IA (CoT + JSON).
 *   · Analista del líder (M2): pregunta en lenguaje natural → ReAct/function calling.
 *   · Auditor de seguridad (M3): audita el proceso de triaje (Self-Consistency).
 *
 * Acceso: Administrador, Cajero, Hostess
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from 'react'
import {
  Send, Sparkles, Shield, AlertTriangle, Filter, Trash2, Bot, MessageSquare,
  ShieldAlert, ShieldCheck, CheckCircle2, Activity,
} from 'lucide-react'
import { useComplaints } from '../../context/ComplaintContext'
import { useAgents } from '../../context/AgentContext'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { llmMode } from '../../agents/core/llmClient'
import toast from 'react-hot-toast'
import ResolutionPanel from './ResolutionPanel'
import styles from './ComplaintsPage.module.css'

const PRIORIDAD_CLASS = {
  'Crítica': styles.pCritica,
  'Alta':    styles.pAlta,
  'Media':   styles.pMedia,
  'Baja':    styles.pBaja,
}

// Auditoría (M3) movida a SecurityPage.jsx

export default function ComplaintsPage() {
  const { complaints, totalComplaints, criticasCount, deleteComplaint } = useComplaints()
  const { triageComplaint, askLeaderQuery } = useAgents()
  const { hasPermission } = useAuth()
  const canDelete = hasPermission('canDeleteClients')

  // ── Filtro de bandeja ──
  const [sedeFilter, setSedeFilter] = useState('Todas')
  const sedes = useMemo(
    () => ['Todas', ...Array.from(new Set(complaints.map(c => c.sede).filter(Boolean)))],
    [complaints]
  )
  const displayed = complaints.filter(c => sedeFilter === 'Todas' || c.sede === sedeFilter)

  // ── M1: Nueva queja ──
  const [mensaje, setMensaje] = useState('')
  const [cliente, setCliente] = useState('')
  const [triaging, setTriaging] = useState(false)
  const [lastTriage, setLastTriage] = useState(null)

  const handleTriage = async (e) => {
    e.preventDefault()
    if (!mensaje.trim()) { toast.error('Escribe el mensaje del cliente'); return }
    setTriaging(true)
    setLastTriage(null)
    try {
      const res = await triageComplaint({ mensaje, cliente, canal: 'WhatsApp' })
      if (res.success) {
        setLastTriage(res.result)
        setMensaje(''); setCliente('')
        toast.success(res.escalated ? '🚨 Queja CRÍTICA escalada al líder' : 'Queja registrada por IA')
      } else {
        toast.error(res.error || 'No se pudo analizar la queja')
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`)
    } finally {
      setTriaging(false)
    }
  }

  // ── M2: Analista del líder ──
  const [pregunta, setPregunta] = useState('')
  const [chat, setChat] = useState([])
  const [asking, setAsking] = useState(false)

  const handleAsk = async (e) => {
    e.preventDefault()
    if (!pregunta.trim()) return
    const q = pregunta
    setChat(prev => [...prev, { role: 'user', text: q }])
    setPregunta('')
    setAsking(true)
    try {
      const res = await askLeaderQuery(q)
      setChat(prev => [...prev, {
        role: 'ia',
        text: res.success ? res.result : `⚠️ ${res.error || 'Sin respuesta'}`,
      }])
    } catch (err) {
      setChat(prev => [...prev, { role: 'ia', text: `⚠️ Error: ${err.message}` }])
    } finally {
      setAsking(false)
    }
  }



  const sugerencias = [
    '¿Cuáles son las quejas frecuentes en San Borja?',
    'Resumen de quejas de Miraflores',
    '¿Qué quejas tiene el cliente María?',
  ]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Quejas con IA</h1>
          <p className={styles.subtitle}>
            {totalComplaints} quejas · {criticasCount} críticas
          </p>
        </div>
        <span className={`${styles.llmBadge} ${llmMode === 'gemini' ? styles.llmOn : styles.llmMock}`}>
          <Sparkles size={13} />
          {llmMode === 'gemini' ? 'Gemini 2.5 Flash' : llmMode === 'proxy' ? 'Gemini (proxy)' : 'Modo local (sin API key)'}
        </span>
      </div>

      <div className={styles.layout}>
        {/* ── Columna izquierda: bandeja ── */}
        <section className={styles.inbox}>
          <div className={styles.inboxBar}>
            <span className={styles.inboxTitle}><MessageSquare size={16} /> Bandeja</span>
            <div className={styles.filterWrap}>
              <Filter size={14} />
              <select
                className={styles.select}
                value={sedeFilter}
                onChange={e => setSedeFilter(e.target.value)}
              >
                {sedes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {displayed.length === 0 ? (
            <div className={styles.empty}>
              <MessageSquare size={40} />
              <p>No hay quejas para esta sede.</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {displayed.map(c => (
                <li key={c.id} className={styles.item}>
                  <div className={styles.itemTop}>
                    <span className={`${styles.badge} ${PRIORIDAD_CLASS[c.prioridad] || ''}`}>
                      {c.prioridad}
                    </span>
                    <span className={styles.sede}>{c.sede}</span>
                    <span className={styles.estado} data-estado={c.estado}>{c.estado}</span>
                    {canDelete && (
                      <button className={styles.del} onClick={() => deleteComplaint(c.id)} title="Eliminar">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className={styles.cliente}>{c.cliente} · <span>{c.canal}</span></p>
                  <p className={styles.mensaje}>{c.mensaje}</p>
                  <div className={styles.puntos}>
                    {(c.puntos_criticos || []).map((p, i) => (
                      <span key={i} className={styles.punto}>{p}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Columna derecha: IA ── */}
        <aside className={styles.side}>
          {/* M4 — Resoluciones activas */}
          <ResolutionPanel />
          {/* M1 — Nueva queja */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}><Sparkles size={15} /> Nueva queja (triaje IA)</h3>
            <form onSubmit={handleTriage} className={styles.form}>
              <input
                className={styles.input}
                placeholder="Cliente (opcional)"
                value={cliente}
                onChange={e => setCliente(e.target.value)}
              />
              <textarea
                className={styles.textarea}
                placeholder="Pega aquí el mensaje del cliente…"
                rows={4}
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
              />
              <Button type="submit" variant="primary" icon={<Sparkles size={15} />} isLoading={triaging} fullWidth>
                {triaging ? 'Analizando…' : 'Analizar con IA'}
              </Button>
            </form>

            {lastTriage && (
              <div className={styles.result}>
                <div className={styles.resultRow}>
                  <span className={`${styles.badge} ${PRIORIDAD_CLASS[lastTriage.prioridad] || ''}`}>
                    {lastTriage.prioridad}
                  </span>
                  <span className={styles.sede}>{lastTriage.sede}</span>
                  <span className={styles.sentBadge}>Sentimiento: {lastTriage.sentimiento}</span>
                </div>
                <p className={styles.reason}><strong>Razonamiento:</strong> {lastTriage.razonamiento}</p>
                <div className={styles.puntos}>
                  {(lastTriage.puntos_criticos || []).map((p, i) => (
                    <span key={i} className={styles.punto}>{p}</span>
                  ))}
                </div>
                <p className={styles.respuesta}>💬 {lastTriage.respuesta_cliente}</p>
              </div>
            )}
          </div>

          {/* M2 — Analista del líder */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}><Bot size={15} /> Analista del líder</h3>
            <div className={styles.chat}>
              {chat.length === 0 && (
                <div className={styles.suggest}>
                  {sugerencias.map((s, i) => (
                    <button key={i} className={styles.chip} onClick={() => setPregunta(s)}>{s}</button>
                  ))}
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={m.role === 'user' ? styles.msgUser : styles.msgIa}>
                  {m.text}
                </div>
              ))}
              {asking && <div className={styles.msgIa}>Consultando…</div>}
            </div>
            <form onSubmit={handleAsk} className={styles.chatForm}>
              <input
                className={styles.input}
                placeholder="Pregunta sobre las quejas…"
                value={pregunta}
                onChange={e => setPregunta(e.target.value)}
              />
              <Button type="submit" variant="primary" icon={<Send size={14} />} isLoading={asking}>
                Enviar
              </Button>
            </form>
          </div>


        </aside>
      </div>
    </div>
  )
}
