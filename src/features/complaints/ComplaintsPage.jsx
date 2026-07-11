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

// ── Auditoría (M3): parser del informe Markdown → estructura para tarjetas ─────

/** Normaliza un nivel de riesgo/probabilidad a una de tres severidades. */
function nivelSeveridad(texto = '') {
  const t = texto.toLowerCase()
  if (/(alt|cr[ií]tic|grave|sever)/.test(t)) return 'alto'
  if (/(medi|moder)/.test(t)) return 'medio'
  if (/(baj|leve|menor)/.test(t)) return 'bajo'
  return 'medio'
}

const limpiar = (s = '') => s.replace(/\*+/g, '').replace(/^[-•]\s*/, '').replace(/\s+/g, ' ').trim()

// Marcador de campo tolerante: acepta viñetas (-, *, •), negrita (**), y mayús/minús.
const RE_CAMPO = /[-*•]?\s*\*{0,2}\s*(riesgo|impacto|descripci[oó]n|probabilidad)\s*\*{0,2}\s*:/gi

/**
 * extraerCampos — Del texto de UNA vulnerabilidad, saca riesgo/descripción/probabilidad
 * sin importar si el modelo usó `**Riesgo**:`, `* Riesgo:` o `- Riesgo:`. Corta el
 * valor de cada campo hasta el inicio del siguiente marcador.
 */
function extraerCampos(bloque) {
  const marcas = [...bloque.matchAll(RE_CAMPO)]
  const out = { riesgo: '', descripcion: '', probabilidad: '' }
  if (marcas.length === 0) return { ...out, nombreExtra: '' }

  // Todo lo anterior al primer marcador pertenece al nombre.
  const nombreExtra = bloque.slice(0, marcas[0].index)

  marcas.forEach((m, i) => {
    const desde = m.index + m[0].length
    const hasta = i + 1 < marcas.length ? marcas[i + 1].index : bloque.length
    const clave = m[1].toLowerCase()
    const valor = limpiar(bloque.slice(desde, hasta))
    if (clave.startsWith('riesgo') || clave.startsWith('impacto')) out.riesgo = valor
    else if (clave.startsWith('descrip')) out.descripcion = valor
    else if (clave.startsWith('probab')) out.probabilidad = valor
  })
  return { ...out, nombreExtra }
}

/**
 * parseInforme — Convierte el informe del auditor en
 * { titulo, vulnerabilidades[], recomendaciones[] }. Agnóstico al formato exacto:
 * separa por secciones (##), agrupa cada vulnerabilidad por su línea numerada y
 * extrae los campos con marcadores tolerantes.
 */
function parseInforme(texto = '') {
  const lineas = texto.split('\n')
  let titulo = 'Informe de auditoría'
  const recomendaciones = []
  const bloques = []           // [{ nombre, cuerpo }]
  let seccion = null           // 'vuln' | 'reco'
  let actual = null

  const cerrar = () => { if (actual) { bloques.push(actual); actual = null } }

  for (const raw of lineas) {
    const l = raw.trim()
    if (!l) continue

    if (/^#\s/.test(l)) {
      titulo = l.replace(/^#+\s*/, '').replace(/INFORME DE AUDITOR[IÍ]A\s*(CONSOLIDADO)?\s*[—-]?\s*/i, '').trim() || titulo
      continue
    }
    if (/^##\s/.test(l)) { cerrar(); seccion = /recomend|mitigac/i.test(l) ? 'reco' : 'vuln'; continue }

    if (seccion === 'reco') {
      if (/^[-*•]?\s*\d*[.)]?\s*\S/.test(l)) recomendaciones.push(limpiar(l.replace(/^[-*•]?\s*\d+[.)]\s*/, '')))
      continue
    }

    // Nueva vulnerabilidad: línea numerada "1." o "2)"
    const num = l.match(/^\d+[.)]\s*(.*)$/)
    if (num) { cerrar(); actual = { nombre: limpiar(num[1].replace(/:\s*$/, '')), cuerpo: '' } }
    else if (actual) { actual.cuerpo += ' ' + l }
    else { actual = { nombre: '', cuerpo: l } }   // por si no viene numerado
  }
  cerrar()

  const vulnerabilidades = bloques.map(b => {
    const texto = `${b.nombre} ${b.cuerpo}`.trim()
    const { riesgo, descripcion, probabilidad, nombreExtra } = extraerCampos(texto)
    // El nombre es lo que queda antes del primer campo; si el bloque traía nombre en la
    // línea numerada, ese gana.
    const nombre = limpiar(b.nombre || nombreExtra).replace(/:\s*$/, '')
    return {
      nombre,
      riesgo,
      descripcion: descripcion || (riesgo || probabilidad ? '' : limpiar(b.cuerpo)),
      probabilidad,
    }
  }).filter(v => v.nombre || v.descripcion)

  return { titulo, vulnerabilidades, recomendaciones }
}

/** Tarjeta de reporte de auditoría — reemplaza el <pre> monoespaciado. */
function AuditReport({ texto }) {
  const { titulo, vulnerabilidades, recomendaciones } = useMemo(() => parseInforme(texto), [texto])

  // Si el parser no reconoció estructura, degradamos a texto legible (no <pre> crudo).
  if (vulnerabilidades.length === 0 && recomendaciones.length === 0) {
    return <div className={styles.auditFallback}>{texto}</div>
  }

  const conteo = vulnerabilidades.reduce((a, v) => { a[nivelSeveridad(v.riesgo)]++; return a }, { alto: 0, medio: 0, bajo: 0 })

  return (
    <div className={styles.audit}>
      <div className={styles.auditHead}>
        <div className={styles.auditHeadIcon}><ShieldCheck size={16} /></div>
        <div>
          <p className={styles.auditTitle}>{titulo}</p>
          <p className={styles.auditSub}>{vulnerabilidades.length} hallazgo(s) consistente(s) · Self-Consistency 5/5</p>
        </div>
      </div>

      <div className={styles.auditStats}>
        {conteo.alto  > 0 && <span className={`${styles.auditStat} ${styles.sevAlto}`}>{conteo.alto} alto</span>}
        {conteo.medio > 0 && <span className={`${styles.auditStat} ${styles.sevMedio}`}>{conteo.medio} medio</span>}
        {conteo.bajo  > 0 && <span className={`${styles.auditStat} ${styles.sevBajo}`}>{conteo.bajo} bajo</span>}
      </div>

      <div className={styles.auditList}>
        {vulnerabilidades.map((v, i) => {
          const sev = nivelSeveridad(v.riesgo)
          return (
            <div key={i} className={`${styles.vuln} ${styles['sevBorder_' + sev]}`}>
              <div className={styles.vulnTop}>
                <ShieldAlert size={14} className={styles['sevIcon_' + sev]} />
                <span className={styles.vulnName}>{v.nombre || `Hallazgo ${i + 1}`}</span>
                {v.riesgo && <span className={`${styles.vulnBadge} ${styles['sevBadge_' + sev]}`}>{v.riesgo}</span>}
              </div>
              {v.descripcion && <p className={styles.vulnDesc}>{v.descripcion}</p>}
              {v.probabilidad && (
                <p className={styles.vulnProb}><Activity size={11} /> Probabilidad: <strong>{v.probabilidad}</strong></p>
              )}
            </div>
          )
        })}
      </div>

      {recomendaciones.length > 0 && (
        <div className={styles.auditReco}>
          <p className={styles.auditRecoTitle}>Recomendaciones de mitigación</p>
          <ul className={styles.recoList}>
            {recomendaciones.map((r, i) => (
              /^.{1,40}:$/.test(r)
                ? <li key={i} className={styles.recoGroup}>{r.replace(/:$/, '')}</li>
                : <li key={i} className={styles.recoItem}><CheckCircle2 size={13} /> <span>{r}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const PROCESO_TRIAJE_DEFAULT = `Proceso de triaje de quejas (ComplaintAgent.triage_complaint):
1. Se recibe el mensaje de texto del cliente (WhatsApp/web) sin sanitizar.
2. El mensaje se concatena al system prompt PROMPT_RECEPCION y se envía a Gemini con responseMimeType JSON.
3. La respuesta JSON (razonamiento, sentimiento, prioridad, sede, puntos_criticos, respuesta_cliente) se
   guarda en ComplaintContext + SharedMemory y se publica complaint:created.
4. Si prioridad === "Crítica" se publica complaint:escalated y el NotificationAgent alerta al líder.
La API key de Gemini se lee de import.meta.env.VITE_GEMINI_API_KEY (expuesta en el bundle en modo directo).`

export default function ComplaintsPage() {
  const { complaints, totalComplaints, criticasCount, deleteComplaint } = useComplaints()
  const { triageComplaint, askLeaderQuery, auditProcess } = useAgents()
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

  // ── M3: Auditor ──
  const [auditing, setAuditing] = useState(false)
  const [informe, setInforme] = useState('')

  const handleAudit = async () => {
    setAuditing(true)
    setInforme('')
    try {
      const res = await auditProcess({
        nombreProceso: 'Triaje de quejas con IA',
        definicion: PROCESO_TRIAJE_DEFAULT,
      })
      setInforme(res.success ? res.result : `⚠️ ${res.error || 'Sin informe'}`)
      if (res.success) toast.success('Auditoría completada')
    } catch (err) {
      setInforme(`⚠️ Error: ${err.message}`)
    } finally {
      setAuditing(false)
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

          {/* M3 — Auditor */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}><Shield size={15} /> Auditor de seguridad</h3>
            <p className={styles.hint}>
              Audita el proceso de triaje con Self-Consistency (5 auditorías + consolidación).
            </p>
            <Button variant="secondary" icon={<AlertTriangle size={14} />} isLoading={auditing} onClick={handleAudit} fullWidth>
              {auditing ? 'Auditando…' : 'Auditar proceso de triaje'}
            </Button>
            {informe && <AuditReport texto={informe} />}
          </div>
        </aside>
      </div>
    </div>
  )
}
