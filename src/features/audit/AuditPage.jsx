/**
 * src/features/audit/AuditPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Auditoría — visor de logs del sistema multiagente (solo admin).
 *
 * Muestra en vivo lo que registra el AuditLogger: decisiones de agentes
 * (bloqueos del guardrail, rechazos de fraude, degradaciones, recompensas) y
 * la actividad del EventBus. Permite filtrar, exportar y limpiar.
 *
 * Es la verificación local de los logs — complementa a LangSmith (que traza las
 * llamadas al LLM en el servidor). Aquí no se necesita cuenta externa.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ScrollText, Download, Trash2, Filter, AlertTriangle, Info, XCircle, Radio,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { auditLogger } from '../../agents/core/auditLogger'
import styles from './AuditPage.module.css'

const NIVEL_META = {
  info:  { icon: Info,          cls: 'nInfo',  label: 'Info' },
  warn:  { icon: AlertTriangle, cls: 'nWarn',  label: 'Alerta' },
  error: { icon: XCircle,       cls: 'nError', label: 'Error' },
}

export default function AuditPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState(() => auditLogger.getEntries({ limit: 200 }))
  const [fNivel,  setFNivel]  = useState('')
  const [fAgente, setFAgente] = useState('')

  // Suscripción en vivo: cada nueva entrada refresca la tabla.
  useEffect(() => {
    const unsub = auditLogger.subscribe(() => setEntries(auditLogger.getEntries({ limit: 200 })))
    return unsub
  }, [])

  const agentes = useMemo(
    () => [...new Set(entries.map(e => e.agente))].sort(),
    [entries],
  )

  const visibles = entries.filter(e =>
    (!fNivel || e.nivel === fNivel) && (!fAgente || e.agente === fAgente))

  const stats = auditLogger.stats()

  const exportar = () => {
    const blob = new Blob([auditLogger.exportarJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `pardos-audit-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const limpiar = () => { auditLogger.limpiar(); setEntries([]) }

  // La auditoría es solo para el líder (admin).
  if (user?.role !== 'admin') return <Navigate to="/no-autorizado" replace />

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <div className={styles.icon}><ScrollText size={20} /></div>
          <div>
            <h1 className={styles.title}>Auditoría del sistema</h1>
            <p className={styles.subtitle}>
              <Radio size={11} className={styles.live} /> Registro en vivo de las decisiones de los agentes ·
              LangSmith traza las llamadas al LLM en el servidor
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={exportar} disabled={!entries.length}>
            <Download size={14} /> Exportar
          </button>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={limpiar} disabled={!entries.length}>
            <Trash2 size={14} /> Limpiar
          </button>
        </div>
      </header>

      {/* Resumen */}
      <div className={styles.statRow}>
        <div className={styles.stat}><span className={styles.statNum}>{stats.total}</span> eventos</div>
        <div className={`${styles.stat} ${styles.sInfo}`}><span className={styles.statNum}>{stats.porNivel.info}</span> info</div>
        <div className={`${styles.stat} ${styles.sWarn}`}><span className={styles.statNum}>{stats.porNivel.warn}</span> alertas</div>
        <div className={`${styles.stat} ${styles.sError}`}><span className={styles.statNum}>{stats.porNivel.error}</span> errores</div>
      </div>

      {/* Filtros */}
      <div className={styles.filters}>
        <Filter size={14} className={styles.filterIcon} />
        <select value={fNivel} onChange={e => setFNivel(e.target.value)}>
          <option value="">Todos los niveles</option>
          <option value="info">Info</option>
          <option value="warn">Alertas</option>
          <option value="error">Errores</option>
        </select>
        <select value={fAgente} onChange={e => setFAgente(e.target.value)}>
          <option value="">Todos los agentes</option>
          {agentes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className={styles.count}>{visibles.length} visibles</span>
      </div>

      {/* Tabla */}
      <div className={styles.tableWrap}>
        {visibles.length === 0 ? (
          <div className={styles.empty}>
            <ScrollText size={30} />
            <p>Sin eventos aún. Usa el Asistente IA o el módulo de Reclamos y aparecerán aquí.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>Hora</th><th>Nivel</th><th>Agente</th><th>Acción</th><th>Resultado</th><th>Latencia</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {visibles.map((e, i) => {
                const meta = NIVEL_META[e.nivel] || NIVEL_META.info
                const NivelIcon = meta.icon
                return (
                  <tr key={i}>
                    <td className={styles.tsCell}>{new Date(e.ts).toLocaleTimeString('es-PE')}</td>
                    <td><span className={`${styles.nivel} ${styles[meta.cls]}`}><NivelIcon size={11} /> {meta.label}</span></td>
                    <td className={styles.agenteCell}>{e.agente}</td>
                    <td><code className={styles.accion}>{e.accion}</code></td>
                    <td className={styles.resCell}>{e.resultado ?? '—'}</td>
                    <td className={styles.latCell}>{e.latencia != null ? `${e.latencia}ms` : '—'}</td>
                    <td className={styles.detCell}>
                      {e.detalle ? <code>{JSON.stringify(e.detalle)}</code> : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
