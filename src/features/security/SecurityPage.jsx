import { useState, useMemo } from 'react'
import {
  Shield, AlertTriangle, ShieldAlert, ShieldCheck, CheckCircle2, Activity,
} from 'lucide-react'
import { useAgents } from '../../context/AgentContext'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'
import styles from './SecurityPage.module.css'

/** Normaliza un nivel de riesgo/probabilidad a una de tres severidades. */
function nivelSeveridad(texto = '') {
  const t = texto.toLowerCase()
  if (/(alt|cr[ií]tic|grave|sever)/.test(t)) return 'alto'
  if (/(medi|moder)/.test(t)) return 'medio'
  if (/(baj|leve|menor)/.test(t)) return 'bajo'
  return 'medio'
}

const limpiar = (s = '') => s.replace(/\*+/g, '').replace(/^[-•]\s*/, '').replace(/\s+/g, ' ').trim()

const RE_CAMPO = /[-*•]?\s*\*{0,2}\s*(riesgo|impacto|descripci[oó]n|probabilidad)\s*\*{0,2}\s*:/gi

function extraerCampos(bloque) {
  const marcas = [...bloque.matchAll(RE_CAMPO)]
  const out = { riesgo: '', descripcion: '', probabilidad: '' }
  if (marcas.length === 0) return { ...out, nombreExtra: '' }

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

function parseInforme(texto = '') {
  const lineas = texto.split('\n')
  let titulo = 'Informe de auditoría'
  const recomendaciones = []
  const bloques = []
  let seccion = null
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
    const num = l.match(/^\d+[.)]\s*(.*)$/)
    if (num) { cerrar(); actual = { nombre: limpiar(num[1].replace(/:\s*$/, '')), cuerpo: '' } }
    else if (actual) { actual.cuerpo += ' ' + l }
    else { actual = { nombre: '', cuerpo: l } }
  }
  cerrar()

  const vulnerabilidades = bloques.map(b => {
    const texto = `${b.nombre} ${b.cuerpo}`.trim()
    const { riesgo, descripcion, probabilidad, nombreExtra } = extraerCampos(texto)
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

function AuditReport({ texto }) {
  const { titulo, vulnerabilidades, recomendaciones } = useMemo(() => parseInforme(texto), [texto])

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

const PREDEFINED_PROCESSES = [
  {
    id: 'triaje',
    label: 'Triaje de quejas con IA (ComplaintAgent)',
    processName: 'Triaje de quejas con IA',
    definition: `Proceso de triaje de quejas (ComplaintAgent.triage_complaint):
1. Se recibe el mensaje de texto del cliente (WhatsApp/web) sin sanitizar.
2. El mensaje se concatena al system prompt PROMPT_RECEPCION y se envía a Gemini con responseMimeType JSON.
3. La respuesta JSON (razonamiento, sentimiento, prioridad, sede, puntos_criticos, respuesta_cliente) se
   guarda en ComplaintContext + SharedMemory y se publica complaint:created.
4. Si prioridad === "Crítica" se publica complaint:escalated y el NotificationAgent alerta al líder.
La API key de Gemini se lee de import.meta.env.VITE_GEMINI_API_KEY (expuesta en el bundle en modo directo).`
  },
  {
    id: 'asistente',
    label: 'Asistente Chatbot (PromptInterpreter)',
    processName: 'Asistente Chatbot',
    definition: `Proceso del Asistente (PromptInterpreter):
1. El usuario interactúa por medio de un input de texto.
2. El input se inyecta directamente al LLM (Groq/Gemini).
3. Se proporcionan tools (herramientas) al LLM con acceso a memoria compartida.
4. Las respuestas del LLM pueden ejecutar acciones en el sistema sin intervención humana.
5. Los datos sensibles podrían estar expuestos en el historial de chat.`
  },
  {
    id: 'custom',
    label: 'Personalizado...',
    processName: 'Proceso Personalizado',
    definition: ''
  }
]

export default function SecurityPage() {
  const { auditProcess } = useAgents()
  
  const [selectedProcess, setSelectedProcess] = useState(PREDEFINED_PROCESSES[0].id)
  const [customName, setCustomName] = useState('')
  const [customDef, setCustomDef] = useState('')
  
  const [auditing, setAuditing] = useState(false)
  const [informe, setInforme] = useState('')

  const activeProcess = PREDEFINED_PROCESSES.find(p => p.id === selectedProcess)

  const handleAudit = async () => {
    const processName = selectedProcess === 'custom' ? customName : activeProcess.processName
    const definition = selectedProcess === 'custom' ? customDef : activeProcess.definition

    if (!processName || !definition) {
      toast.error('Nombre del proceso y definición son requeridos.')
      return
    }

    setAuditing(true)
    setInforme('')
    
    try {
      const res = await auditProcess({
        nombreProceso: processName,
        definicion: definition,
      })
      setInforme(res.success ? res.result : `⚠️ ${res.error || 'Sin informe'}`)
      if (res.success) toast.success('Auditoría completada')
    } catch (err) {
      setInforme(`⚠️ Error: ${err.message}`)
    } finally {
      setAuditing(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Seguridad IA</h1>
        <p className={styles.subtitle}>
          Auditoría de vulnerabilidades y seguridad de los modelos del sistema multiagente.
        </p>
      </div>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}><Shield size={18} /> Auditor de seguridad de Modelos</h3>
        <p className={styles.hint}>
          Selecciona un proceso del sistema para ejecutar una auditoría profunda de seguridad utilizando la técnica de Self-Consistency (5 auditorías independientes + consolidación de resultados).
        </p>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>Proceso a auditar</label>
          <select 
            className={styles.select}
            value={selectedProcess} 
            onChange={e => {
              setSelectedProcess(e.target.value)
              setInforme('')
            }}
          >
            {PREDEFINED_PROCESSES.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        {selectedProcess === 'custom' && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.label}>Nombre del proceso</label>
              <input 
                type="text"
                className={styles.select}
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Ej. Sistema de pagos automatizado"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Definición del proceso</label>
              <textarea 
                className={styles.textarea}
                value={customDef}
                onChange={e => setCustomDef(e.target.value)}
                placeholder="Describe cómo funciona el proceso, los flujos de datos y la integración del LLM..."
              />
            </div>
          </>
        )}

        <Button 
          variant="primary" 
          icon={<AlertTriangle size={16} />} 
          isLoading={auditing} 
          onClick={handleAudit} 
          disabled={selectedProcess === 'custom' && (!customName || !customDef)}
        >
          {auditing ? 'Auditando...' : 'Auditar proceso'}
        </Button>
      </div>

      {informe && (
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}><ShieldCheck size={18} /> Informe de Auditoría</h3>
          <AuditReport texto={informe} />
        </div>
      )}
    </div>
  )
}
