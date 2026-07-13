/**
 * src/features/claim/ClaimPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página PÚBLICA de Reclamos con Recompensa (M6). Sin login.
 *
 * Cuestionario guiado en 3 pasos:
 *   1. Identidad — DNI + N° de mesa (verificación anti-fraude).
 *   2. Preguntas cerradas (tipo test) — anclan la severidad de forma determinista.
 *   3. Pregunta abierta — "¿algo más?" (opcional).
 *
 * Al enviar: verificación anti-fraude (determinista) → si es legítimo, asigna
 * recompensa por severidad y GUARDA la queja en Supabase (aparece en /quejas).
 * Acceso: PÚBLICO en /reclamo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UtensilsCrossed, ArrowLeft, Fingerprint, Hash, Gift, ShieldCheck,
  ShieldAlert, Loader2, Ticket, Star, ChevronRight, ChevronLeft, CheckCircle2,
} from 'lucide-react'
import { useReservations } from '../../context/ReservationContext'
import { useCash } from '../../context/CashContext'
import { useKitchen } from '../../context/KitchenContext'
import { useClients } from '../../context/ClientContext'
import { useComplaints } from '../../context/ComplaintContext'
import { rewardAgent } from '../../agents/RewardAgent'
import { intentoPermitido } from '../../domain/security/rateGuard'
import { PREGUNTAS, PREGUNTA_ABIERTA, analizarRespuestas, respuestasATexto } from '../../domain/complaints/questionnaire'
import { PROMOTIONS } from '../../data/seeds/promotionsSeed'
import { RESOLUTION_POLICIES } from '../../data/seeds/resolutionPoliciesSeed'
import styles from './ClaimPage.module.css'

const soloDigitos = (s) => String(s || '').replace(/\D/g, '')
const HOY = () => new Date().toISOString().split('T')[0]

export default function ClaimPage() {
  const { reservations } = useReservations()
  const { payments }     = useCash()
  const { tickets }      = useKitchen()
  const { findByDni }    = useClients()
  const { addComplaint } = useComplaints()

  const [step, setStep]         = useState(1)        // 1..3 | 'result'
  const [dni,  setDni]          = useState('')
  const [mesa, setMesa]         = useState('')
  const [respuestas, setResp]   = useState({})       // { problema, area, satisfaccion, volveria, comentario }
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)   // resultado de rewardAgent.evaluar

  const setR = (id, valor) => setResp(prev => ({ ...prev, [id]: valor }))

  // Las reservas del contexto usan client_id; la lógica pura espera clientId.
  const datosVerificacion = () => ({
    reservations: reservations.map(r => ({ ...r, clientId: r.client_id })),
    payments, kitchenTickets: tickets,
    policies: RESOLUTION_POLICIES, promotions: PROMOTIONS,
  })

  const paso1Valido = soloDigitos(dni).length >= 6 && mesa.trim() !== ''
  const paso2Valido = respuestas.problema && respuestas.satisfaccion

  const enviar = async () => {
    if (enviando) return

    // Throttle anti fuerza-bruta (F-04): frena probar muchos pares DNI+mesa.
    const limite = intentoPermitido('reclamo.verify', { max: 6, windowMs: 300_000 })
    if (!limite.ok) {
      setResultado({ elegible: false, bloqueado: true,
        mensaje: `Recibimos varios intentos seguidos. Por seguridad, espera ${limite.esperaSeg} segundos antes de volver a intentar.` })
      setStep('result')
      return
    }

    setEnviando(true)
    try {
      const { severidad, puntos_criticos } = analizarRespuestas(respuestas)
      const mensaje = respuestasATexto(respuestas)

      const reclamo = {
        tableId: mesa.trim(),
        dni,
        mensaje,
        puntos_criticos,
        prioridad: severidad,
        fecha: HOY(),
      }

      // Verificación anti-fraude + recompensa (determinista; el LLM solo redacta).
      const res = await rewardAgent.evaluar(reclamo, datosVerificacion())

      // Si es legítimo, GUARDA la queja en Supabase (aparece en el panel /quejas).
      if (res.elegible) {
        const clientId = res.clientId || findByDni(dni)?.id
        if (clientId) {
          try {
            await addComplaint({
              clientId,
              reservationId: res.reservationId,
              fecha: HOY(),
              canal: 'Web',
              estado: 'nueva',
              prioridad: severidad,
              mensaje,
              puntos_criticos,
              sentimiento: 'negativo',
              razonamiento: 'Cuestionario guiado del cliente (preguntas cerradas + abierta)',
              respuesta_cliente: res.mensaje,
              respuestas,
            })
          } catch (err) { console.warn('No se pudo guardar la queja:', err) }
        }
      }

      setResultado(res)
      setStep('result')
    } finally {
      setEnviando(false)
    }
  }

  const reiniciar = () => {
    setStep(1); setDni(''); setMesa(''); setResp({}); setResultado(null)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/login" className={styles.back}><ArrowLeft size={16} /> Volver</Link>

        <header className={styles.head}>
          <div className={styles.logo}><UtensilsCrossed size={22} /></div>
          <div>
            <h1 className={styles.title}>Reclamos con recompensa</h1>
            <p className={styles.subtitle}>Responde unas preguntas rápidas. Si tu reclamo es válido, te compensamos.</p>
          </div>
        </header>

        {/* Barra de progreso (pasos 1–3) */}
        {step !== 'result' && (
          <div className={styles.steps}>
            {[1, 2, 3].map(n => (
              <div key={n} className={`${styles.stepDot} ${step >= n ? styles.stepActive : ''}`}>
                <span>{n}</span>
                <em>{n === 1 ? 'Identidad' : n === 2 ? 'Preguntas' : 'Comentario'}</em>
              </div>
            ))}
          </div>
        )}

        {/* ── Paso 1: Identidad ── */}
        {step === 1 && (
          <div className={styles.stepBody}>
            <div className={styles.verifRow}>
              <div className={styles.field}>
                <label><Fingerprint size={13} /> Tu DNI</label>
                <input value={dni} onChange={e => setDni(e.target.value)}
                  inputMode="numeric" placeholder="78765432" maxLength={12} />
              </div>
              <div className={styles.field}>
                <label><Hash size={13} /> N° de mesa</label>
                <input value={mesa} onChange={e => setMesa(e.target.value)}
                  placeholder="Ej. T03 o 3" />
              </div>
            </div>
            <p className={styles.hint}>
              <ShieldCheck size={12} /> Verificamos que el reclamo corresponda a quien consumió en esa mesa. Es por tu seguridad.
            </p>
            <div className={styles.navRow}>
              <span />
              <button className={styles.btnNext} disabled={!paso1Valido} onClick={() => setStep(2)}>
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 2: Preguntas cerradas ── */}
        {step === 2 && (
          <div className={styles.stepBody}>
            {PREGUNTAS.map(p => (
              <div key={p.id} className={styles.question}>
                <p className={styles.qTitle}>{p.titulo}</p>

                {p.tipo === 'opcion' && (
                  <div className={styles.options}>
                    {p.opciones.map(o => (
                      <button
                        key={o.valor}
                        type="button"
                        className={`${styles.option} ${respuestas[p.id] === o.valor ? styles.optionSel : ''}`}
                        onClick={() => setR(p.id, o.valor)}
                      >
                        {respuestas[p.id] === o.valor && <CheckCircle2 size={14} />}
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}

                {p.tipo === 'rating' && (
                  <div className={styles.rating}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        className={`${styles.star} ${Number(respuestas[p.id]) >= n ? styles.starOn : ''}`}
                        onClick={() => setR(p.id, n)}
                        aria-label={`${n} estrellas`}
                      >
                        <Star size={26} fill={Number(respuestas[p.id]) >= n ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={() => setStep(1)}>
                <ChevronLeft size={16} /> Atrás
              </button>
              <button className={styles.btnNext} disabled={!paso2Valido} onClick={() => setStep(3)}>
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 3: Pregunta abierta ── */}
        {step === 3 && (
          <div className={styles.stepBody}>
            <div className={styles.question}>
              <p className={styles.qTitle}>{PREGUNTA_ABIERTA.titulo}</p>
              <textarea
                className={styles.openText}
                value={respuestas.comentario || ''}
                onChange={e => setR('comentario', e.target.value)}
                placeholder={PREGUNTA_ABIERTA.placeholder}
                rows={4}
              />
            </div>
            <p className={styles.hint}>
              <ShieldCheck size={12} /> Al enviar, verificamos tu consumo y, si corresponde, te asignamos una recompensa.
            </p>
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={() => setStep(2)} disabled={enviando}>
                <ChevronLeft size={16} /> Atrás
              </button>
              <button className={styles.btnSubmit} onClick={enviar} disabled={enviando}>
                {enviando ? <><Loader2 size={16} className={styles.spin} /> Verificando…</> : <>Enviar reclamo <ChevronRight size={16} /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── Resultado ── */}
        {step === 'result' && resultado && (
          <div className={styles.stepBody}>
            <Resultado res={resultado} />
            <div className={styles.navRow}>
              <span />
              <button className={styles.btnNext} onClick={reiniciar}>Enviar otro reclamo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pantalla de resultado: recompensa o rechazo ───────────────────────────────
function Resultado({ res }) {
  if (res.elegible) {
    return (
      <div className={`${styles.result} ${styles.resultOk}`}>
        <div className={`${styles.resultIcon} ${styles.iconReward}`}><Gift size={22} /></div>
        <p className={styles.resultText}>{res.mensaje}</p>
        {res.recompensa && (
          <div className={styles.coupon}>
            <div className={styles.couponLeft}><Ticket size={18} /></div>
            <div className={styles.couponBody}>
              <p className={styles.couponName}>{res.recompensa.nombre}</p>
              {res.recompensa.condiciones && <p className={styles.couponCond}>{res.recompensa.condiciones}</p>}
              {res.recompensa.vigencia_dias && (
                <p className={styles.couponVig}>Válido por {res.recompensa.vigencia_dias} días</p>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`${styles.result} ${styles.resultReject}`}>
      <div className={`${styles.resultIcon} ${styles.iconReject}`}><ShieldAlert size={22} /></div>
      <p className={styles.resultText}>{res.mensaje}</p>
      {!res.bloqueado && (
        <span className={styles.rejectTag}>
          {/* No mostramos el veredicto exacto: distinguir "sin consumo" de
              "identidad no coincide" permitiría enumerar quién comió (F-04). */}
          <ShieldAlert size={11} /> Reclamo no verificado
        </span>
      )}
    </div>
  )
}
