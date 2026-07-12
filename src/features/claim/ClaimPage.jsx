/**
 * src/features/claim/ClaimPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página PÚBLICA de Reclamos con Recompensa (M6). Sin login.
 *
 * El cliente indica su DNI y el número de mesa, describe su problema, y el
 * Agente de Recompensas:
 *   1. Triaje del mensaje (M1) → severidad y puntos críticos.
 *   2. Verificación anti-fraude (determinista): el DNI + la mesa deben
 *      coincidir con quien realmente consumió ahí. Si no, se rechaza.
 *   3. Si es legítimo, asigna una recompensa y redacta un mensaje empático.
 *
 * Acceso: PÚBLICO. Accesible en /reclamo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { intentoPermitido } from '../../domain/security/rateGuard'
import {
  UtensilsCrossed, ArrowLeft, Fingerprint, Hash, Send, Gift, ShieldCheck,
  ShieldAlert, Bot, Loader2, Ticket,
} from 'lucide-react'
import { useReservations } from '../../context/ReservationContext'
import { useCash } from '../../context/CashContext'
import { useKitchen } from '../../context/KitchenContext'
import { useAgents } from '../../context/AgentContext'
import { rewardAgent } from '../../agents/RewardAgent'
import { PROMOTIONS } from '../../data/seeds/promotionsSeed'
import { RESOLUTION_POLICIES } from '../../data/seeds/resolutionPoliciesSeed'
import styles from './ClaimPage.module.css'

const soloDigitos = (s) => String(s || '').replace(/\D/g, '')

export default function ClaimPage() {
  const { reservations } = useReservations()
  const { payments }     = useCash()
  const { tickets }      = useKitchen()
  const { triageComplaint } = useAgents()

  const [dni,      setDni]      = useState('')
  const [mesa,     setMesa]     = useState('')
  const [mensaje,  setMensaje]  = useState('')
  const [chat,     setChat]     = useState([])   // { de:'cliente'|'agente', ... }
  const [enviando, setEnviando] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat, enviando])

  const datosVerificacion = () => ({
    reservations, payments, kitchenTickets: tickets,
    policies: RESOLUTION_POLICIES, promotions: PROMOTIONS,
  })

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const texto = mensaje.trim()
    if (!texto || enviando) return

    if (!soloDigitos(dni) || !mesa.trim()) {
      setChat(prev => [...prev, { de: 'agente', tipo: 'aviso',
        texto: 'Para poder verificar tu reclamo necesito tu DNI y el número de mesa. Complétalos arriba, por favor.' }])
      return
    }

    // Throttle anti fuerza-bruta (F-04): frena probar muchos pares DNI+mesa.
    const limite = intentoPermitido('reclamo.verify', { max: 6, windowMs: 300_000 })
    if (!limite.ok) {
      setChat(prev => [...prev, { de: 'agente', tipo: 'aviso',
        texto: `Recibimos varios intentos seguidos. Por seguridad, espera ${limite.esperaSeg} segundos antes de volver a intentar.` }])
      return
    }

    setChat(prev => [...prev, { de: 'cliente', texto }])
    setMensaje('')
    setEnviando(true)

    try {
      // 1. Triaje (M1) — clasifica severidad y puntos críticos. Registra la queja.
      let triage = null
      try {
        const t = await triageComplaint({ mensaje: texto, canal: 'Web', cliente: '' })
        if (t?.success) triage = t.result
      } catch { /* si el LLM del triaje falla, seguimos con heurística mínima */ }

      const reclamo = {
        tableId:  mesa.trim(),
        dni,
        cliente:  triage?.cliente || '',
        mensaje:  texto,
        puntos_criticos: triage?.puntos_criticos || [],
        prioridad: triage?.prioridad || 'Media',
        fecha: new Date().toISOString().split('T')[0],
      }

      // 2 + 3. Verificación anti-fraude + recompensa (M6).
      const res = await rewardAgent.evaluar(reclamo, datosVerificacion())

      setChat(prev => [...prev, {
        de: 'agente',
        tipo: res.elegible ? 'recompensa' : 'rechazo',
        veredicto: res.veredicto,
        texto: res.mensaje,
        recompensa: res.recompensa,
        cliente: res.cliente,
      }])
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/login" className={styles.back}><ArrowLeft size={16} /> Volver</Link>

        <header className={styles.head}>
          <div className={styles.logo}><UtensilsCrossed size={22} /></div>
          <div>
            <h1 className={styles.title}>Reclamos con recompensa</h1>
            <p className={styles.subtitle}>Cuéntanos qué pasó. Si tu reclamo es válido, te compensamos.</p>
          </div>
        </header>

        {/* Datos de verificación */}
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

        {/* Conversación */}
        <div className={styles.chat}>
          {chat.length === 0 && (
            <div className={styles.empty}>
              <Bot size={26} />
              <p>Escribe tu reclamo abajo. Por ejemplo: <em>"El pollo llegó frío y esperé más de una hora."</em></p>
            </div>
          )}

          {chat.map((m, i) => m.de === 'cliente'
            ? <div key={i} className={styles.msgUser}><div className={styles.bubbleUser}>{m.texto}</div></div>
            : <AgentBubble key={i} m={m} />
          )}

          {enviando && (
            <div className={styles.msgAgent}>
              <div className={styles.agentIcon}><Loader2 size={15} className={styles.spin} /></div>
              <div className={styles.bubbleAgent}><span className={styles.typing}>Verificando tu reclamo…</span></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Entrada */}
        <form className={styles.inputRow} onSubmit={handleSubmit}>
          <textarea
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
            placeholder="Describe tu problema…"
            rows={1}
          />
          <button type="submit" disabled={enviando || !mensaje.trim()} className={styles.send}>
            <Send size={17} />
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Burbuja del agente: recompensa, rechazo o aviso ───────────────────────────
function AgentBubble({ m }) {
  const esRecompensa = m.tipo === 'recompensa'
  const esRechazo    = m.tipo === 'rechazo'

  const Icon = esRecompensa ? Gift : esRechazo ? ShieldAlert : Bot
  const iconClass = esRecompensa ? styles.iconReward : esRechazo ? styles.iconReject : styles.iconNeutral

  return (
    <div className={styles.msgAgent}>
      <div className={`${styles.agentIcon} ${iconClass}`}><Icon size={15} /></div>
      <div className={styles.bubbleAgent}>
        <p className={styles.agentText}>{m.texto}</p>

        {esRecompensa && m.recompensa && (
          <div className={styles.coupon}>
            <div className={styles.couponLeft}><Ticket size={18} /></div>
            <div className={styles.couponBody}>
              <p className={styles.couponName}>{m.recompensa.nombre}</p>
              {m.recompensa.condiciones && <p className={styles.couponCond}>{m.recompensa.condiciones}</p>}
              {m.recompensa.vigencia_dias && (
                <p className={styles.couponVig}>Válido por {m.recompensa.vigencia_dias} días</p>
              )}
            </div>
          </div>
        )}

        {esRechazo && (
          <span className={styles.rejectTag}>
            {/* No mostramos el veredicto exacto: distinguir "sin consumo" de
                "identidad no coincide" permitiría enumerar quién comió (F-04). */}
            <ShieldAlert size={11} /> Reclamo no verificado
          </span>
        )}
      </div>
    </div>
  )
}
