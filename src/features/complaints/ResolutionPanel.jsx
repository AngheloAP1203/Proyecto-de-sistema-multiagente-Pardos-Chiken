/**
 * src/features/complaints/ResolutionPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel interactivo de resolución de quejas (M4).
 *
 * Muestra notificaciones con 3 botones de acción y, cuando el mesero elige
 * "Propón una respuesta", despliega la propuesta RAG con detalles de
 * promoción/cupón si aplica.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Lightbulb, Loader2 } from 'lucide-react'
import { useAgents } from '../../context/AgentContext'
import { useResolutions } from '../../context/ResolutionContext'
import styles from './ResolutionPanel.module.css'

export default function ResolutionPanel() {
  const { resolveComplaintAction, proposeResponse, handleDirectResolution, cancelResolution } = useAgents()
  const { resolutions, pendingCount } = useResolutions()
  const [loadingAction, setLoadingAction] = useState(null)
  const [proposals, setProposals] = useState({})

  const activeResolutions = resolutions.filter(r => r.status === 'pendiente' || r.status === 'aceptada')

  const handleAction = async (resolution, actionType) => {
    const key = `${resolution.id}-${actionType}`
    setLoadingAction(key)
    try {
      if (actionType === 'handle_direct') {
        await handleDirectResolution({ resolutionId: resolution.id })
      } else if (actionType === 'propose_response') {
        const res = await proposeResponse({ resolutionId: resolution.id })
        if (res?.success) {
          setProposals(prev => ({ ...prev, [resolution.id]: res.result }))
        }
      } else if (actionType === 'cancel_resolution') {
        await cancelResolution({ resolutionId: resolution.id })
      }
    } catch (err) {
      console.error('[ResolutionPanel]', err)
    } finally {
      setLoadingAction(null)
    }
  }

  if (activeResolutions.length === 0 && pendingCount === 0) return null

  return (
    <div className={styles.panel}>
      <h3 className={styles.panelTitle}>
        <AlertTriangle size={15} />
        Resoluciones activas ({activeResolutions.length})
      </h3>

      {activeResolutions.length === 0 && (
        <p className={styles.empty}>No hay resoluciones pendientes.</p>
      )}

      {activeResolutions.map(r => (
        <div key={r.id} className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>🚨</span>
            <div>
              <p className={styles.cardTitle}>
                {r.tableId ? `MESA ${r.tableId}` : 'SIN MESA'}
              </p>
              <p className={styles.cardSub}>
                {r.problema} · {r.guestName}
                {r.clientePago ? ' · Ya pagó' : ' · En mesa'}
              </p>
            </div>
            <span className={`${styles.statusBadge} ${styles[`status_${r.status}`]}`}>
              {r.status}
            </span>
          </div>

          {r.status === 'pendiente' && !proposals[r.id] && (
            <div className={styles.actions}>
              <button
                className={`${styles.actionBtn} ${styles.actionDirect}`}
                disabled={!!loadingAction}
                onClick={() => handleAction(r, 'handle_direct')}
              >
                {loadingAction === `${r.id}-handle_direct`
                  ? <><Loader2 size={14} className={styles.spin} /> Procesando…</>
                  : <><CheckCircle size={14} /> Me encargaré directamente</>
                }
              </button>
              <button
                className={`${styles.actionBtn} ${styles.actionPropose}`}
                disabled={!!loadingAction}
                onClick={() => handleAction(r, 'propose_response')}
              >
                {loadingAction === `${r.id}-propose_response`
                  ? <><Loader2 size={14} className={styles.spin} /> Consultando IA…</>
                  : <><Lightbulb size={14} /> Propón una respuesta</>
                }
              </button>
              <button
                className={`${styles.actionBtn} ${styles.actionCancel}`}
                disabled={!!loadingAction}
                onClick={() => handleAction(r, 'cancel_resolution')}
              >
                {loadingAction === `${r.id}-cancel_resolution`
                  ? <><Loader2 size={14} className={styles.spin} /> Cancelando…</>
                  : <><XCircle size={14} /> Esa mesa no está registrada, cancela</>
                }
              </button>
            </div>
          )}

          {r.accionElegida === 'encargo_directo' && (
            <div className={styles.resolved}>
              <CheckCircle size={16} />
              <span>El mesero se encargará directamente.</span>
            </div>
          )}

          {proposals[r.id] && (
            <div className={styles.proposal}>
              <div className={styles.proposalHeader}>
                <Lightbulb size={16} />
                <span>Propuesta del sistema</span>
              </div>
              <p className={styles.proposalText}>{proposals[r.id].propuesta}</p>

              {proposals[r.id].promocion && (
                <div className={styles.promo}>
                  <p className={styles.promoName}>
                    🎫 {proposals[r.id].promocion.nombre}
                  </p>
                  <p className={styles.promoCode}>
                    Código: <strong>{proposals[r.id].promocion.codigo}</strong>
                  </p>
                  {proposals[r.id].promocion.condiciones && (
                    <p className={styles.promoConditions}>
                      {proposals[r.id].promocion.condiciones}
                    </p>
                  )}
                </div>
              )}

              {proposals[r.id].similares && (
                <details className={styles.similarDetail}>
                  <summary>Quejas similares (contexto RAG)</summary>
                  <pre className={styles.similarText}>{proposals[r.id].similares}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
