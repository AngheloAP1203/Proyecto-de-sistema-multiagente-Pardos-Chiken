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

import { useState, useEffect, useMemo, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ScrollText, Download, Trash2, Filter, AlertTriangle, Info, XCircle, Radio, Bot, User, Globe, ChevronDown, Search
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { auditLogger } from '../../agents/core/auditLogger'
import styles from './AuditPage.module.css'

const NIVEL_META = {
  info:  { icon: Info,          cls: 'nInfo',  label: 'Info' },
  warn:  { icon: AlertTriangle, cls: 'nWarn',  label: 'Alerta' },
  error: { icon: XCircle,       cls: 'nError', label: 'Error' },
}

const TIPO_ACTOR_META = {
  agente:  { icon: Bot,   cls: 'tAgente',  label: 'Agente IA' },
  usuario: { icon: User,  cls: 'tUsuario', label: 'Usuario (Sistema)' },
  cliente: { icon: Globe, cls: 'tCliente', label: 'Cliente (Público)' },
}

function ActorDropdown({ value, onChange, optionsPorTipo }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filterGroup = (group) => group.filter(a => (a || 'Desconocido').toLowerCase().includes(search.toLowerCase()))
  
  const gAgentes = filterGroup(optionsPorTipo.agente)
  const gUsuarios = filterGroup(optionsPorTipo.usuario)
  const gClientes = filterGroup(optionsPorTipo.cliente)

  const hasResults = gAgentes.length || gUsuarios.length || gClientes.length

  return (
    <div className={styles.actorDropdown} ref={ref}>
      <button className={styles.dropdownBtn} onClick={() => setOpen(!open)} type="button">
        <span className={styles.dropdownVal}>{value || 'Todos los actores'}</span>
        <ChevronDown size={14} className={styles.dropdownIcon} />
      </button>
      
      {open && (
        <div className={styles.dropdownMenu}>
          <div className={styles.dropdownSearch}>
            <Search size={12} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Buscar actor..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              autoFocus
            />
          </div>
          
          <div className={styles.dropdownList}>
            <button className={`${styles.dropdownItem} ${!value ? styles.activeItem : ''}`} onClick={() => { onChange(''); setOpen(false); setSearch('') }}>
              Todos los actores
            </button>

            {gAgentes.length > 0 && (
              <div className={styles.dropdownGroup}>
                <div className={styles.groupLabel}>🤖 Agentes IA</div>
                {gAgentes.map(a => (
                  <button key={a} className={`${styles.dropdownItem} ${value === a ? styles.activeItem : ''}`} onClick={() => { onChange(a); setOpen(false); setSearch('') }}>{a}</button>
                ))}
              </div>
            )}
            {gUsuarios.length > 0 && (
              <div className={styles.dropdownGroup}>
                <div className={styles.groupLabel}>👤 Usuarios (Personal)</div>
                {gUsuarios.map(a => (
                  <button key={a} className={`${styles.dropdownItem} ${value === a ? styles.activeItem : ''}`} onClick={() => { onChange(a); setOpen(false); setSearch('') }}>{a}</button>
                ))}
              </div>
            )}
            {gClientes.length > 0 && (
              <div className={styles.dropdownGroup}>
                <div className={styles.groupLabel}>🌐 Clientes Públicos</div>
                {gClientes.map(a => (
                  <button key={a} className={`${styles.dropdownItem} ${value === a ? styles.activeItem : ''}`} onClick={() => { onChange(a); setOpen(false); setSearch('') }}>{a}</button>
                ))}
              </div>
            )}

            {!hasResults && <div className={styles.noResults}>No se encontraron actores</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AuditPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState(() => auditLogger.getEntries({ limit: 200 }))
  const [fNivel,  setFNivel]  = useState('')
  const [fTipo,   setFTipo]   = useState('')
  const [fActor,  setFActor]  = useState('')

  // Suscripción en vivo: cada nueva entrada refresca la tabla.
  useEffect(() => {
    const unsub = auditLogger.subscribe(() => setEntries(auditLogger.getEntries({ limit: 200 })))
    return unsub
  }, [])

  const actoresPorTipo = useMemo(() => {
    const agrupados = { agente: new Set(), usuario: new Set(), cliente: new Set() }
    entries.forEach(e => {
      const actorName = e.actor || 'Sistema'
      if (e.tipoActor === 'usuario') agrupados.usuario.add(actorName)
      else if (e.tipoActor === 'cliente') agrupados.cliente.add(actorName)
      else agrupados.agente.add(actorName) // Agentes y logs de sistema
    })
    return {
      agente: [...agrupados.agente].sort(),
      usuario: [...agrupados.usuario].sort(),
      cliente: [...agrupados.cliente].sort(),
    }
  }, [entries])

  const visibles = entries.filter(e =>
    (!fNivel || e.nivel === fNivel) &&
    (!fTipo  || e.tipoActor === fTipo) &&
    (!fActor || e.actor === fActor)
  )

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
            <h1 className={styles.title}>Centro de Trazabilidad Total</h1>
            <p className={styles.subtitle}>
              <Radio size={11} className={styles.live} /> Registro en vivo de acciones (Agentes, Usuarios y Clientes) ·
              LangSmith traza exclusivamente llamadas al LLM
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
        <select value={fTipo} onChange={e => setFTipo(e.target.value)}>
          <option value="">Cualquier origen</option>
          <option value="agente">Agentes IA</option>
          <option value="usuario">Usuarios (Personal)</option>
          <option value="cliente">Clientes Públicos</option>
        </select>
        <ActorDropdown value={fActor} onChange={setFActor} optionsPorTipo={actoresPorTipo} />
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
              <tr><th>Hora</th><th>Nivel</th><th>Actor</th><th>Acción</th><th>Resultado</th><th>Latencia</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {visibles.map((e, i) => {
                const meta = NIVEL_META[e.nivel] || NIVEL_META.info
                const NivelIcon = meta.icon
                const metaInfo = TIPO_ACTOR_META[e.tipoActor] || TIPO_ACTOR_META.agente
                const ActorIcon = metaInfo.icon
                return (
                  <tr key={i}>
                    <td className={styles.tsCell}>{new Date(e.ts).toLocaleTimeString('es-PE')}</td>
                    <td><span className={`${styles.nivel} ${styles[meta.cls]}`}><NivelIcon size={11} /> {meta.label}</span></td>
                    <td>
                      <div className={styles.actorCell} title={metaInfo.label}>
                        <ActorIcon size={14} className={`${styles.actorIcon} ${styles[metaInfo.cls]}`} />
                        {e.actor}
                      </div>
                    </td>
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
