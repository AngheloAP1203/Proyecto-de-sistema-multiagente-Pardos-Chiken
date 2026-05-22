/**
 * src/features/booking/BookingPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página PÚBLICA de solicitud de reserva para clientes externos.
 * Accesible en /reservar sin necesidad de iniciar sesión.
 *
 * El cliente completa sus datos y el formulario crea una reserva
 * en estado REQUESTED. El personal (admin/hostess/cajero) la revisa
 * desde el panel de Reservas y la aprueba o rechaza.
 *
 * Flujo:
 *   1. Cliente llena: nombre, teléfono, fecha, hora, n° personas, ocasión, notas
 *   2. Sistema valida disponibilidad básica (fecha futura)
 *   3. Se guarda con status='requested'
 *   4. Se muestra pantalla de confirmación con N° de solicitud
 *
 * Acceso: PÚBLICO (sin autenticación)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UtensilsCrossed, Calendar, Clock, Users, Phone, User,
  MessageSquare, CheckCircle2, ArrowLeft, Star, MapPin,
} from 'lucide-react'
import { useReservations } from '../../context/ReservationContext'
import styles from './BookingPage.module.css'

// ── Ocasiones disponibles ─────────────────────────────────────────────────────
const OCCASIONS = [
  { value: '',            label: 'Sin ocasión especial' },
  { value: 'Cumpleaños',  label: '🎂 Cumpleaños' },
  { value: 'Aniversario', label: '💑 Aniversario' },
  { value: 'Reunión',     label: '💼 Reunión de negocios' },
  { value: 'Graduación',  label: '🎓 Graduación' },
  { value: 'Familiar',    label: '👨‍👩‍👧 Reunión familiar' },
  { value: 'Otro',        label: '✨ Otro' },
]

// ── Horarios disponibles ─────────────────────────────────────────────────────
// Horario de atención: 11:00 AM – 10:00 PM. Última reserva a las 21:30
// para garantizar al menos 30 min de servicio antes del cierre a las 22:00.
const TIME_SLOTS = [
  '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
  '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30',
  '19:00','19:30','20:00','20:30','21:00','21:30',
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

// ── Componente Input local ────────────────────────────────────────────────────
function Field({ label, error, children, required }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}{required && <span className={styles.req}>*</span>}</label>
      {children}
      {error && <p className={styles.fieldError}>{error}</p>}
    </div>
  )
}

export default function BookingPage() {
  const { requestReservation } = useReservations()
  const [form,    setForm]    = useState(INITIAL_FORM)
  const [errors,  setErrors]  = useState({})
  const [step,    setStep]    = useState('form')  // 'form' | 'confirmed'
  const [booking, setBooking] = useState(null)

  // Fecha mínima: mañana (reservas online con 1 día de anticipación)
  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  // Fecha máxima: 90 días en el futuro (no se aceptan reservas con más de 3 meses)
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 90)
  const maxDateStr = maxDate.toISOString().split('T')[0]

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(e => ({ ...e, [name]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.clientName.trim())  e.clientName  = 'Tu nombre es requerido'
    if (!form.clientPhone.trim()) e.clientPhone = 'Tu teléfono es requerido'
    else if (!/^\d{9,12}$/.test(form.clientPhone.replace(/\s/g,'')))
      e.clientPhone = 'Ingresa un teléfono válido (9-12 dígitos)'
    if (!form.date)   e.date   = 'Selecciona una fecha'
    if (!form.time)   e.time   = 'Selecciona un horario'
    if (Number(form.guests) < 1 || Number(form.guests) > 30)
      e.guests = 'Entre 1 y 30 personas'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const reservation = requestReservation({
      clientName:  form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      clientEmail: form.clientEmail.trim(),
      date:        form.date,
      time:        form.time,
      guests:      Number(form.guests),
      occasion:    form.occasion,
      notes:       form.notes.trim(),
      tableId:     null, // asignada al aprobar
      source:      'public',
    })

    setBooking(reservation)
    setStep('confirmed')
  }

  // ── Pantalla de confirmación ──────────────────────────────────────────────
  if (step === 'confirmed') {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.confirmed}>
            <div className={styles.confirmedIcon}>
              <CheckCircle2 size={56} />
            </div>
            <h2 className={styles.confirmedTitle}>¡Solicitud enviada!</h2>
            <p className={styles.confirmedSub}>
              Tu solicitud de reserva fue recibida correctamente.
              Nuestro equipo la revisará pronto y te contactará para confirmar.
            </p>
            <div className={styles.confirmedBox}>
              <div className={styles.confirmedRow}>
                <span>N° de solicitud</span>
                <strong>{booking?.id}</strong>
              </div>
              <div className={styles.confirmedRow}>
                <span>Nombre</span>
                <strong>{booking?.clientName}</strong>
              </div>
              <div className={styles.confirmedRow}>
                <span>Fecha</span>
                <strong>{booking?.date} · {booking?.time}</strong>
              </div>
              <div className={styles.confirmedRow}>
                <span>Personas</span>
                <strong>{booking?.guests}</strong>
              </div>
              {booking?.occasion && (
                <div className={styles.confirmedRow}>
                  <span>Ocasión</span>
                  <strong>{booking.occasion}</strong>
                </div>
              )}
            </div>
            <p className={styles.confirmedNote}>
              📞 Te contactaremos al <strong>{booking?.clientPhone}</strong> para confirmar tu reserva.
              El tiempo de respuesta es de máximo <strong>2 horas</strong>.
            </p>
            <div className={styles.confirmedActions}>
              <button className={styles.btnNew} onClick={() => { setStep('form'); setForm(INITIAL_FORM) }}>
                Hacer otra solicitud
              </button>
              <Link to="/login" className={styles.btnLogin}>
                Ingresar al sistema
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario ────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Sidebar de información */}
      <aside className={styles.aside}>
        <div className={styles.asideLogo}>
          <UtensilsCrossed size={36} />
        </div>
        <h1 className={styles.asideBrand}>Pardos Chicken</h1>
        <p className={styles.asideTag}>El mejor pollo a la brasa del Perú</p>

        <div className={styles.asideInfo}>
          <div className={styles.infoItem}>
            <MapPin size={15} />
            <span>Av. La Mar 456, Miraflores, Lima</span>
          </div>
          <div className={styles.infoItem}>
            <Clock size={15} />
            {/* Horario real de atención: 11 AM – 10 PM */}
            <span>Lun–Dom: 11:00 AM – 10:00 PM</span>
          </div>
          <div className={styles.infoItem}>
            <Phone size={15} />
            <span>(01) 444 - 4400</span>
          </div>
        </div>

        <div className={styles.asideFeats}>
          {['Menú premiado', 'Ambiente familiar', 'Zona VIP disponible', 'Terraza con vista'].map(f => (
            <div key={f} className={styles.feat}>
              <Star size={12} /> {f}
            </div>
          ))}
        </div>

        <Link to="/login" className={styles.staffLink}>
          <ArrowLeft size={13} /> Acceso del personal
        </Link>

        <div className={styles.asideDecor1} />
        <div className={styles.asideDecor2} />
      </aside>

      {/* Formulario principal */}
      <main className={styles.main}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Solicitar una reserva</h2>
            <p className={styles.formSub}>
              Completa el formulario y nuestro equipo confirmará tu reserva en breve.
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {/* Datos personales */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <User size={15} /> Tus datos
              </h3>
              <div className={styles.grid2}>
                <Field label="Nombre completo" error={errors.clientName} required>
                  <div className={styles.inputWrap}>
                    <User size={15} className={styles.inputIcon} />
                    <input className={`${styles.input} ${errors.clientName ? styles.inputError : ''}`}
                      type="text" name="clientName" id="booking-name"
                      placeholder="Tu nombre completo"
                      value={form.clientName} onChange={handleChange} />
                  </div>
                </Field>
                <Field label="Teléfono" error={errors.clientPhone} required>
                  <div className={styles.inputWrap}>
                    <Phone size={15} className={styles.inputIcon} />
                    <input className={`${styles.input} ${errors.clientPhone ? styles.inputError : ''}`}
                      type="tel" name="clientPhone" id="booking-phone"
                      placeholder="987 654 321"
                      value={form.clientPhone} onChange={handleChange} />
                  </div>
                </Field>
              </div>
              <Field label="Correo electrónico (opcional)">
                <div className={styles.inputWrap}>
                  <MessageSquare size={15} className={styles.inputIcon} />
                  <input className={styles.input}
                    type="email" name="clientEmail" id="booking-email"
                    placeholder="tu@email.com"
                    value={form.clientEmail} onChange={handleChange} />
                </div>
              </Field>
            </div>

            {/* Datos de la reserva */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <Calendar size={15} /> Detalles de la reserva
              </h3>
              <div className={styles.grid2}>
                <Field label="Fecha" error={errors.date} required>
                  <div className={styles.inputWrap}>
                    <Calendar size={15} className={styles.inputIcon} />
                    <input className={`${styles.input} ${errors.date ? styles.inputError : ''}`}
                      type="date" name="date" id="booking-date"
                      min={minDateStr}
                      max={maxDateStr}
                      value={form.date} onChange={handleChange} />
                  </div>
                </Field>
                <Field label="N° de personas" error={errors.guests} required>
                  <div className={styles.inputWrap}>
                    <Users size={15} className={styles.inputIcon} />
                    <input className={`${styles.input} ${errors.guests ? styles.inputError : ''}`}
                      type="number" name="guests" id="booking-guests"
                      min={1} max={30} placeholder="2"
                      value={form.guests} onChange={handleChange} />
                  </div>
                </Field>
              </div>

              {/* Horarios */}
              <Field label="Horario preferido" error={errors.time} required>
                <div className={styles.timeGrid}>
                  {TIME_SLOTS.map(t => (
                    <button key={t} type="button"
                      className={`${styles.timeBtn} ${form.time === t ? styles.timeBtnSel : ''}`}
                      onClick={() => { setForm(f => ({ ...f, time: t })); if (errors.time) setErrors(e => ({ ...e, time: '' })) }}>
                      <Clock size={11} /> {t}
                    </button>
                  ))}
                </div>
                {errors.time && <p className={styles.fieldError}>{errors.time}</p>}
              </Field>

              {/* Ocasión */}
              <Field label="Ocasión especial">
                <div className={styles.occasionGrid}>
                  {OCCASIONS.map(o => (
                    <button key={o.value} type="button"
                      className={`${styles.occBtn} ${form.occasion === o.value ? styles.occBtnSel : ''}`}
                      onClick={() => setForm(f => ({ ...f, occasion: o.value }))}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Notas */}
              <Field label="Notas adicionales">
                <textarea className={`${styles.input} ${styles.textarea}`}
                  name="notes" id="booking-notes"
                  placeholder="Alergias, preferencias de mesa, solicitudes especiales..."
                  value={form.notes} onChange={handleChange} rows={3} />
              </Field>
            </div>

            <button type="submit" className={styles.submitBtn} id="btn-solicitar-reserva">
              <CheckCircle2 size={18} />
              Enviar solicitud de reserva
            </button>

            <p className={styles.disclaimer}>
              Al enviar la solicitud, aceptas que nuestro equipo te contacte para confirmar los detalles.
              La reserva no estará garantizada hasta recibir confirmación.
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}
