/**
 * src/features/claim/ClaimPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página PÚBLICA de Reclamos con Recompensa (M6). Sin login.
 *
 * Cuestionario guiado en 3 pasos:
 *   1. Identificación — DNI + Código de reserva/boleta (verificación anti-fraude).
 *   2. Preguntas cerradas (tipo test) — anclan la severidad de forma determinista.
 *      Incluye preguntas condicionales según la categoría elegida.
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
  AlertTriangle, HelpCircle, Receipt,
} from 'lucide-react'
import { useReservations } from '../../context/ReservationContext'
import { useCash } from '../../context/CashContext'
import { useKitchen } from '../../context/KitchenContext'
import { useClients } from '../../context/ClientContext'
import { useComplaints } from '../../context/ComplaintContext'
import { rewardAgent } from '../../agents/RewardAgent'
import { intentoPermitido } from '../../domain/security/rateGuard'
import { PREGUNTAS, PREGUNTA_ABIERTA, preguntasVisibles, analizarRespuestas, respuestasATexto } from '../../domain/complaints/questionnaire'
import { PROMOTIONS } from '../../data/seeds/promotionsSeed'
import { RESOLUTION_POLICIES } from '../../data/seeds/resolutionPoliciesSeed'
import styles from './ClaimPage.module.css'

const soloDigitos = (s) => String(s || '').replace(/\D/g, '')

export default function ClaimPage() {
  const { reservations } = useReservations()
  const { payments }     = useCash()
  const { tickets }      = useKitchen()
  const { findByDni }    = useClients()
  const { addComplaint, complaints } = useComplaints()

  const [step, setStep]         = useState(1)
  const [dni,  setDni]          = useState('')
  const [codigo, setCodigo]     = useState('')
  const [respuestas, setResp]   = useState({})
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [showHelp, setShowHelp] = useState(false)

  const setR = (id, valor) => setResp(prev => ({ ...prev, [id]: valor }))

  const datosVerificacion = () => ({
    reservations: reservations.map(r => ({ ...r, clientId: r.client_id })),
    payments, kitchenTickets: tickets,
    complaints: (complaints || []).map(c => ({ reservationId: c.reservation_id || c.reservationId })),
    policies: RESOLUTION_POLICIES, promotions: PROMOTIONS,
  })

  const paso1Valido = soloDigitos(dni).length >= 6 && codigo.trim().length >= 6
  const visibles = preguntasVisibles(respuestas)
  const paso2Valido = respuestas.categoria && respuestas.satisfaccion && respuestas.impacto

  const enviar = async () => {
    if (enviando) return
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
      const reclamo = { codigo: codigo.trim(), dni, mensaje, puntos_criticos, prioridad: severidad }
      const res = await rewardAgent.evaluar(reclamo, datosVerificacion())

      if (res.elegible) {
        const clientId = res.clientId || findByDni(dni)?.id
        if (clientId) {
          try {
            await addComplaint({
              clientId, reservationId: res.reservationId,
              fecha: new Date().toISOString().split('T')[0],
              canal: 'Web', estado: 'nueva', prioridad: severidad,
              mensaje, puntos_criticos, sentimiento: 'negativo',
              razonamiento: 'Cuestionario guiado del cliente',
              respuesta_cliente: res.mensaje, respuestas,
            })
          } catch (err) { console.warn('No se pudo guardar la queja:', err) }
        }
      }
      setResultado(res)
      setStep('result')
    } finally { setEnviando(false) }
  }

  const reiniciar = () => { setStep(1); setDni(''); setCodigo(''); setResp({}); setResultado(null) }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/login" className={styles.back}><ArrowLeft size={16} /> Volver al inicio</Link>

        <header className={styles.head}>
          <div className={styles.logo}><UtensilsCrossed size={22} /></div>
          <div>
            <h1 className={styles.title}>¿Tuviste un problema?</h1>
            <p className={styles.subtitle}>Cuéntanos qué pasó y te compensamos. Solo toma 2 minutos.</p>
          </div>
        </header>

        {/* Barra de progreso */}
        {step !== 'result' && (
          <div className={styles.steps}>
            {[1, 2, 3].map(n => (
              <div key={n} className={`${styles.stepDot} ${step >= n ? styles.stepActive : ''}`}>
                <span>{n}</span>
                <em>{n === 1 ? 'Identifícate' : n === 2 ? 'Cuéntanos' : 'Detalle'}</em>
              </div>
            ))}
          </div>
        )}

        {/* ── Paso 1: Identificación ── */}
        {step === 1 && (
          <div className={styles.stepBody}>
            <div className={styles.verifRow}>
              <div className={styles.field}>
                <label><Fingerprint size={13} /> Tu DNI</label>
                <input value={dni} onChange={e => setDni(e.target.value)}
                  inputMode="numeric" placeholder="Ej. 78765432" maxLength={12} />
              </div>
              <div className={styles.field}>
                <label><Receipt size={13} /> Código de tu visita</label>
                <input value={codigo} onChange={e => setCodigo(e.target.value)}
                  placeholder="Copia el código de tu boleta" />
              </div>
            </div>

            {/* Ayuda expandible */}
            <button className={styles.helpToggle} onClick={() => setShowHelp(!showHelp)} type="button">
              <HelpCircle size={14} />
              {showHelp ? 'Ocultar ayuda' : '¿Dónde encuentro mi código?'}
            </button>

            {showHelp && (
              <div className={styles.helpBox}>
                <p>📄 <strong>En tu boleta impresa:</strong> Aparece al final como un código corto de 6 letras/números (ejemplo: <code>A3F91B</code>).</p>
                <p>📱 <strong>En tu tarjeta de reserva:</strong> Lo encuentras debajo de tu nombre, junto al icono <code>#</code>.</p>
                <p>💡 <strong>¿No lo tienes?</strong> Pide al personal de caja que te lo proporcione. Ellos pueden verlo en el sistema.</p>
              </div>
            )}

            <div className={styles.infoBox}>
              <ShieldCheck size={14} />
              <p>Verificamos tu identidad para protegerte. Solo el titular de la reserva puede presentar un reclamo. <strong>Un reclamo por visita.</strong></p>
            </div>

            <div className={styles.navRow}>
              <span />
              <button className={styles.btnNext} disabled={!paso1Valido} onClick={() => setStep(2)}>
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 2: Preguntas cerradas (dinámicas) ── */}
        {step === 2 && (
          <div className={styles.stepBody}>
            {visibles.map(p => (
              <div key={p.id} className={styles.question}>
                <p className={styles.qTitle}>{p.titulo}</p>
                {p.subtitulo && <p className={styles.qSubtitle}>{p.subtitulo}</p>}

                {p.tipo === 'opcion' && (
                  <div className={styles.options}>
                    {p.opciones.map(o => (
                      <button key={o.valor} type="button"
                        className={`${styles.option} ${respuestas[p.id] === o.valor ? styles.optionSel : ''}`}
                        onClick={() => setR(p.id, o.valor)}>
                        {respuestas[p.id] === o.valor && <CheckCircle2 size={14} />}
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}

                {p.tipo === 'rating' && (
                  <div className={styles.rating}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button"
                        className={`${styles.star} ${Number(respuestas[p.id]) >= n ? styles.starOn : ''}`}
                        onClick={() => setR(p.id, n)} aria-label={`${n} estrellas`}>
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
              <textarea className={styles.openText}
                value={respuestas.comentario || ''}
                onChange={e => setR('comentario', e.target.value)}
                placeholder={PREGUNTA_ABIERTA.placeholder} rows={4} />
            </div>
            <div className={styles.infoBox}>
              <ShieldCheck size={14} />
              <p>Al enviar, verificamos tu consumo y, si corresponde, te asignamos una recompensa de inmediato.</p>
            </div>
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

// ── Pantalla de resultado ─────────────────────────────────────────────────────
function Resultado({ res }) {
  if (res.elegible) {
    return (
      <div className={`${styles.result} ${styles.resultOk}`}>
        <div className={`${styles.resultIcon} ${styles.iconReward}`}><Gift size={22} /></div>
        <h3 className={styles.resultTitle}>¡Tu reclamo fue aceptado!</h3>
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
      <h3 className={styles.resultTitle}>No pudimos verificar tu reclamo</h3>
      <p className={styles.resultText}>{res.mensaje}</p>
      {!res.bloqueado && (
        <div className={styles.rejectHelp}>
          <p>💡 <strong>¿Necesitas ayuda?</strong></p>
          <ul>
            <li>Verifica que tu DNI y código sean correctos.</li>
            <li>Si no tienes el código, pídelo al personal de caja.</li>
            <li>También puedes acercarte directamente al mostrador.</li>
          </ul>
        </div>
      )}
    </div>
  )
}
