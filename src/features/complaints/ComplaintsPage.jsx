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
  ShieldAlert, ShieldCheck, CheckCircle2, Activity, Zap
} from 'lucide-react'
import { useComplaints } from '../../context/ComplaintContext'
import { useAgents } from '../../context/AgentContext'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { llmMode } from '../../agents/core/llmClient'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import emailjs from '@emailjs/browser'
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
  const [estadoFilter, setEstadoFilter] = useState('Todas')
  const sedes = useMemo(
    () => ['Todas', ...Array.from(new Set(complaints.map(c => c.sede).filter(Boolean)))],
    [complaints]
  )
  const displayed = complaints.filter(c => 
    (sedeFilter === 'Todas' || c.sede === sedeFilter) &&
    (estadoFilter === 'Todas' || (estadoFilter === 'Resueltas' ? c.estado === 'resuelta' : c.estado !== 'resuelta'))
  )

  const [resolvingIds, setResolvingIds] = useState({})
  const [pendingResolution, setPendingResolution] = useState(null)
  const { updateComplaint } = useComplaints()

  const handleAutoResolve = async (c) => {
    setResolvingIds(prev => ({ ...prev, [c.id]: true }))
    try {
      const prompt = `Actúa como analista de atención al cliente de Pardos Chicken. Usa el modelo L.E.A.R.N. (Listen, Empathize, Apologize, Resolve, Notify) para resolver esta queja del cliente ${c.cliente}: "${c.mensaje}". 
      Instrucciones estrictas:
      1. Sé empático, profesional y resolutivo.
      2. NO ofrezcas descuentos monetarios ni cupones a menos que la queja sea un problema grave o de salubridad. 
      3. Prioriza disculpas genuinas, explicaciones operativas y compromisos de capacitación al personal o revisión de procesos.
      4. Tu respuesta debe ser el correo exacto que se le enviará al cliente (formato markdown, claro y directo).`
      const res = await askLeaderQuery(prompt)
      if (res.success) {
        // En lugar de window.confirm, abrimos el modal
        setPendingResolution({ complaint: c, result: res.result })
      } else {
        toast.error('No se pudo generar solución')
      }
    } catch (err) {
      toast.error('Error al resolver: ' + err.message)
    } finally {
      setResolvingIds(prev => ({ ...prev, [c.id]: false }))
    }
  }

  const confirmResolution = async () => {
    if (!pendingResolution) return
    const { complaint: c, result } = pendingResolution
    setPendingResolution(null) // cerramos el modal
    
    // Mostramos un toast loading manual (opcional, o podemos re-activar resolvingIds)
    const tId = toast.loading('Aplicando solución y enviando correo...')

    try {
      await updateComplaint(c.id, {
        estado: 'resuelta',
        resolution: { respuesta_cliente: result }
      })
      
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

      if (serviceId && templateId && publicKey) {
        try {
          await emailjs.send(serviceId, templateId, {
            to_email: c.email || 'cliente@test.com', 
            message: result
          }, publicKey)
          toast.success(`Queja de ${c.cliente} resuelta. Correo real enviado.`, { id: tId })
        } catch (err) {
          console.error('Error enviando correo con EmailJS:', err)
          toast.error('La queja se resolvió, pero falló el envío del correo.', { id: tId })
        }
      } else {
        toast.success(`Queja de ${c.cliente} resuelta. (Simulado)`, { id: tId })
      }
    } catch (err) {
      toast.error('Error al aplicar solución: ' + err.message, { id: tId })
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
                value={estadoFilter}
                onChange={e => setEstadoFilter(e.target.value)}
              >
                <option value="Todas">Todos los estados</option>
                <option value="Pendientes">Pendientes</option>
                <option value="Resueltas">Resueltas</option>
              </select>
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
                    {c.estado !== 'resuelta' && (
                      <button 
                        className={styles.resolveBtn} 
                        onClick={() => handleAutoResolve(c)} 
                        title="Auto-Resolver con IA"
                        disabled={resolvingIds[c.id]}
                        style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: '0.75em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Zap size={12} /> {resolvingIds[c.id] ? 'Resolviendo...' : 'Auto-Resolver'}
                      </button>
                    )}
                    {canDelete && (
                      <button className={styles.del} onClick={() => deleteComplaint(c.id)} title="Eliminar">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className={styles.cliente}>{c.cliente} · <span>{c.canal}</span></p>
                  <p className={styles.mensaje}>{c.mensaje}</p>
                  {c.estado === 'resuelta' && c.resolution?.respuesta_cliente && (
                    <div style={{ marginTop: 8, padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: '0.85em', borderLeft: '3px solid var(--color-success)' }}>
                      <strong>Solución de IA:</strong> <ReactMarkdown>{c.resolution.respuesta_cliente}</ReactMarkdown>
                    </div>
                  )}
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
                  {m.role === 'user' ? m.text : <ReactMarkdown>{m.text}</ReactMarkdown>}
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

      {/* MODAL DE RESOLUCIÓN IA */}
      {pendingResolution && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <Sparkles size={20} />
              Solución Propuesta por la IA
            </div>
            <div className={styles.modalBody}>
              <ReactMarkdown>{pendingResolution.result}</ReactMarkdown>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.btnCancel} 
                onClick={() => setPendingResolution(null)}
              >
                Cancelar
              </button>
              <button 
                className={styles.btnApprove} 
                onClick={confirmResolution}
              >
                <Send size={16} />
                Aprobar y Enviar Correo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
