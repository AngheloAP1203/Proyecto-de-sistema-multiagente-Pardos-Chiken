/**
 * ReservaPage — Página de solicitud de reserva para clientes
 * ─────────────────────────────────────────────────────────────────────────────
 * La reserva se guarda en localStorage['pardos_reservations'] con status
 * 'requested', que es el mismo formato que espera la app de empleados PARDOS.
 *
 * El empleado ve la solicitud en su panel de Reservas y la aprueba/rechaza.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UtensilsCrossed, Calendar, Clock, Users, Phone, User,
  MessageSquare, CheckCircle2, Star, MapPin, ChevronRight,
  Mail, ArrowLeft, Loader2,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import { submitReservation } from '../lib/reservationStore'
import styles from './ReservaPage.module.css'

/* ── Ocasiones ── */
const OCCASIONS = [
  { value: '',            icon: '✨', label: 'Sin ocasión' },
  { value: 'Cumpleaños',  icon: '🎂', label: 'Cumpleaños' },
  { value: 'Aniversario', icon: '💑', label: 'Aniversario' },
  { value: 'Reunión',     icon: '💼', label: 'Reunión' },
  { value: 'Graduación',  icon: '🎓', label: 'Graduación' },
  { value: 'Familiar',    icon: '👨‍👩‍👧', label: 'Familiar' },
  { value: 'Otro',        icon: '🎉', label: 'Otro' },
]

/* ── Horarios ── */
const TIME_SLOTS = [
  { period: 'Almuerzo', slots: ['12:00','12:30','13:00','13:30','14:00','14:30'] },
  { period: 'Cena',     slots: ['19:00','19:30','20:00','20:30','21:00','21:30'] },
]

const INITIAL_FORM = {
  clientName:  '',
  clientPhone: '',
  clientEmail: '',
  date:        '',
  time:        '',
  guests:      2,
  occasion:    '',
  notes:       '',
}

/* ── Field wrapper ── */
function Field({ label, error, children, required }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.req}>*</span>}
      </label>
      {children}
      {error && <p className={styles.fieldError}>{error}</p>}
    </div>
  )
}

export default function ReservaPage() {
  const [form,     setForm]     = useState(INITIAL_FORM)
  const [errors,   setErrors]   = useState({})
  const [step,     setStep]     = useState('form')   // 'form' | 'loading' | 'confirmed'
  const [booking,  setBooking]  = useState(null)

  /* Fecha mínima: mañana */
  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.clientName.trim())  e.clientName  = 'Tu nombre es requerido'
    if (!form.clientPhone.trim()) e.clientPhone = 'Tu teléfono es requerido'
    else if (!/^\d{7,15}$/.test(form.clientPhone.replace(/[\s\-\(\)]/g, '')))
      e.clientPhone = 'Ingresa un número de teléfono válido'
    if (!form.date)  e.date  = 'Selecciona una fecha'
    if (!form.time)  e.time  = 'Selecciona un horario'
    if (Number(form.guests) < 1 || Number(form.guests) > 30)
      e.guests = 'Entre 1 y 30 personas'
    return e
  }

  // ── async: espera la respuesta real del servidor API ────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setStep('loading')

    try {
      const reservation = await submitReservation({
        clientName:  form.clientName.trim(),
        clientPhone: form.clientPhone.trim(),
        clientEmail: form.clientEmail.trim(),
        date:        form.date,
        time:        form.time,
        guests:      Number(form.guests),
        occasion:    form.occasion,
        notes:       form.notes.trim(),
      })
      setBooking(reservation)
      setStep('confirmed')
    } catch (err) {
      setStep('form')
      setErrors({ submit: 'No se pudo enviar la solicitud. Asegúrate de que el servidor esté activo e intenta de nuevo.' })
    }
  }

  /* ── Pantalla de carga ── */
  if (step === 'loading') {
    return (
      <>
        <Navbar />
        <div className={styles.loadingScreen}>
          <div className={styles.loadingCard}>
            <div className={styles.loadingSpinner}>
              <Loader2 size={40} className={styles.spinIcon} />
            </div>
            <h3 className={styles.loadingTitle}>Enviando tu solicitud…</h3>
            <p className={styles.loadingSub}>Un momento, estamos procesando tu reserva.</p>
          </div>
        </div>
      </>
    )
  }

  /* ── Pantalla de confirmación ── */
  if (step === 'confirmed') {
    return (
      <>
        <Navbar />
        <div className={styles.confirmedScreen}>
          <div className={styles.confirmedCard}>
            <div className={styles.confirmedIconWrap}>
              <CheckCircle2 size={48} />
            </div>

            <div className={styles.confirmedBadge}>
              <Star size={13} fill="currentColor" />
              <span>Solicitud enviada con éxito</span>
            </div>

            <h2 className={styles.confirmedTitle}>¡Gracias, {booking?.clientName?.split(' ')[0]}!</h2>
            <p className={styles.confirmedSub}>
              Tu solicitud fue recibida. Nuestro equipo la revisará y te contactará
              para confirmar los detalles en menos de 2 horas.
            </p>

            <div className={styles.confirmedDetails}>
              <div className={styles.confirmedRow}>
                <span className={styles.confirmedKey}>N° de solicitud</span>
                <strong className={styles.confirmedVal}>{booking?.id}</strong>
              </div>
              <div className={styles.confirmedRow}>
                <span className={styles.confirmedKey}>Fecha</span>
                <strong className={styles.confirmedVal}>{booking?.date}</strong>
              </div>
              <div className={styles.confirmedRow}>
                <span className={styles.confirmedKey}>Hora</span>
                <strong className={styles.confirmedVal}>{booking?.time}</strong>
              </div>
              <div className={styles.confirmedRow}>
                <span className={styles.confirmedKey}>Personas</span>
                <strong className={styles.confirmedVal}>{booking?.guests}</strong>
              </div>
              {booking?.occasion && (
                <div className={styles.confirmedRow}>
                  <span className={styles.confirmedKey}>Ocasión</span>
                  <strong className={styles.confirmedVal}>{booking.occasion}</strong>
                </div>
              )}
            </div>

            <p className={styles.confirmedNote}>
              📞 Te contactaremos al <strong>{booking?.clientPhone}</strong>
            </p>

            <div className={styles.confirmedActions}>
              <button className={styles.btnNew}
                onClick={() => { setStep('form'); setForm(INITIAL_FORM) }}>
                Hacer otra solicitud
              </button>
              <Link to="/" className={styles.btnHome}>
                <ArrowLeft size={15} />
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  /* ── Formulario principal ── */
  return (
    <>
      <Navbar />
      <div className={styles.page}>
        {/* ── Sidebar ── */}
        <aside className={styles.aside}>
          <div className={styles.asideContent}>
            <div className={styles.asideLogo}>
              <UtensilsCrossed size={32} />
            </div>
            <h1 className={styles.asideBrand}>Pardos Chicken</h1>
            <p className={styles.asideTag}>El mejor pollo a la brasa del Perú</p>

            <div className={styles.asideDivider} />

            <div className={styles.asideInfo}>
              <div className={styles.infoItem}>
                <div className={styles.infoIcon}><MapPin size={15} /></div>
                <span>Av. La Mar 456, Miraflores, Lima</span>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoIcon}><Clock size={15} /></div>
                <span>Lun–Dom: 12:00 – 22:30</span>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoIcon}><Phone size={15} /></div>
                <span>(01) 444 - 4400</span>
              </div>
            </div>

            <div className={styles.asideFeats}>
              {[
                { icon: '🏆', text: 'Menú premiado' },
                { icon: '👨‍👩‍👧', text: 'Ambiente familiar' },
                { icon: '👑', text: 'Zona VIP disponible' },
                { icon: '🌿', text: 'Terraza con jardín' },
              ].map(f => (
                <div key={f.text} className={styles.feat}>
                  <span className={styles.featIcon}>{f.icon}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>

            <div className={styles.asideStars}>
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={16} fill="var(--brand-gold)" color="var(--brand-gold)" />
              ))}
              <span>4.8 · Más de 1M de clientes</span>
            </div>
          </div>

          {/* Decorative elements */}
          <div className={styles.asideDecor1} />
          <div className={styles.asideDecor2} />
          <div className={styles.asideBgImg}>
            <img src="/hero-food.png" alt="" />
          </div>
        </aside>

        {/* ── Formulario ── */}
        <main className={styles.main}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <div className={styles.formHeaderTag}>
                <Calendar size={13} />
                <span>Reserva online — Respuesta en &lt;2 horas</span>
              </div>
              <h2 className={styles.formTitle}>Solicitar una mesa</h2>
              <p className={styles.formSub}>
                Completa los datos y nuestro equipo confirmará tu reserva por teléfono.
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form} noValidate>

              {/* ── Sección: Tus datos ── */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <User size={15} />
                  <span>Tus datos</span>
                </h3>

                <div className={styles.grid2}>
                  <Field label="Nombre completo" error={errors.clientName} required>
                    <div className={styles.inputWrap}>
                      <User size={14} className={styles.inputIcon} />
                      <input
                        className={`${styles.input} ${errors.clientName ? styles.inputError : ''}`}
                        type="text" name="clientName" id="nombre"
                        placeholder="Tu nombre completo"
                        value={form.clientName} onChange={handleChange}
                        autoComplete="name"
                      />
                    </div>
                  </Field>

                  <Field label="Teléfono" error={errors.clientPhone} required>
                    <div className={styles.inputWrap}>
                      <Phone size={14} className={styles.inputIcon} />
                      <input
                        className={`${styles.input} ${errors.clientPhone ? styles.inputError : ''}`}
                        type="tel" name="clientPhone" id="telefono"
                        placeholder="987 654 321"
                        value={form.clientPhone} onChange={handleChange}
                        autoComplete="tel"
                      />
                    </div>
                  </Field>
                </div>

                <Field label="Correo electrónico (opcional)">
                  <div className={styles.inputWrap}>
                    <Mail size={14} className={styles.inputIcon} />
                    <input
                      className={styles.input}
                      type="email" name="clientEmail" id="email"
                      placeholder="tu@correo.com"
                      value={form.clientEmail} onChange={handleChange}
                      autoComplete="email"
                    />
                  </div>
                </Field>
              </div>

              {/* ── Sección: Detalles de reserva ── */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <Calendar size={15} />
                  <span>Detalles de la reserva</span>
                </h3>

                <div className={styles.grid2}>
                  <Field label="Fecha" error={errors.date} required>
                    <div className={styles.inputWrap}>
                      <Calendar size={14} className={styles.inputIcon} />
                      <input
                        className={`${styles.input} ${errors.date ? styles.inputError : ''}`}
                        type="date" name="date" id="fecha"
                        min={minDateStr}
                        value={form.date} onChange={handleChange}
                      />
                    </div>
                  </Field>

                  <Field label="N° de personas" error={errors.guests} required>
                    <div className={styles.inputWrap}>
                      <Users size={14} className={styles.inputIcon} />
                      <input
                        className={`${styles.input} ${errors.guests ? styles.inputError : ''}`}
                        type="number" name="guests" id="personas"
                        min={1} max={30}
                        value={form.guests} onChange={handleChange}
                      />
                    </div>
                  </Field>
                </div>

                {/* Horarios por periodo */}
                <Field label="Horario preferido" error={errors.time} required>
                  <div className={styles.timePeriods}>
                    {TIME_SLOTS.map(period => (
                      <div key={period.period} className={styles.timePeriod}>
                        <div className={styles.timePeriodLabel}>{period.period}</div>
                        <div className={styles.timeRow}>
                          {period.slots.map(t => (
                            <button
                              key={t} type="button"
                              className={`${styles.timeBtn} ${form.time === t ? styles.timeBtnSel : ''}`}
                              onClick={() => {
                                setForm(f => ({ ...f, time: t }))
                                if (errors.time) setErrors(p => ({ ...p, time: '' }))
                              }}>
                              <Clock size={11} />{t}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {errors.time && <p className={styles.fieldError}>{errors.time}</p>}
                </Field>

                {/* Ocasión */}
                <Field label="Ocasión especial">
                  <div className={styles.occasionGrid}>
                    {OCCASIONS.map(o => (
                      <button
                        key={o.value} type="button"
                        className={`${styles.occBtn} ${form.occasion === o.value ? styles.occBtnSel : ''}`}
                        onClick={() => setForm(f => ({ ...f, occasion: o.value }))}>
                        <span className={styles.occIcon}>{o.icon}</span>
                        <span>{o.label}</span>
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Notas */}
                <Field label="Notas adicionales">
                  <div className={styles.inputWrap}>
                    <MessageSquare size={14} className={`${styles.inputIcon} ${styles.inputIconTop}`} />
                    <textarea
                      className={`${styles.input} ${styles.textarea}`}
                      name="notes" id="notas"
                      placeholder="Alergias, preferencias de mesa, solicitudes especiales..."
                      value={form.notes} onChange={handleChange}
                      rows={3}
                    />
                  </div>
                </Field>
              </div>

              {/* ── Error de conexión con el servidor ── */}
              {errors.submit && (
                <div className={styles.submitError}>
                  ⚠️ {errors.submit}
                </div>
              )}

              <button type="submit" className={styles.submitBtn} id="btn-enviar-reserva">
                <CheckCircle2 size={18} />
                <span>Enviar solicitud de reserva</span>
                <ChevronRight size={16} />
              </button>

              <p className={styles.disclaimer}>
                Al enviar tu solicitud aceptas que nuestro equipo te contacte para confirmar.
                La reserva queda pendiente hasta recibir confirmación por teléfono.
              </p>
            </form>
          </div>
        </main>
      </div>
    </>
  )
}
