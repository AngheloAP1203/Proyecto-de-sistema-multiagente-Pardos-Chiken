/**
 * src/features/auth/LoginPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de inicio de sesión del sistema Pardos Chicken.
 * Presenta el formulario de login con validación y manejo de errores.
 * Al autenticarse correctamente, el sistema redirige según el rol del usuario.
 *
 * Usuarios de prueba disponibles (ver AuthContext.jsx):
 *   - admin@pardos.com   / admin123   → Administrador
 *   - cajero@pardos.com  / cajero123  → Cajero/a
 *   - mozo@pardos.com    / mozo123    → Mozo/a
 *   - hostess@pardos.com / hostess123 → Hostess
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, UtensilsCrossed, CalendarPlus, MessageSquareWarning } from 'lucide-react'
import { useAuth, MOCK_USERS, ROLE_PERMISSIONS } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import toast from 'react-hot-toast'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.email.trim())         errs.email    = 'El correo es requerido'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Correo inválido'
    if (!form.password)             errs.password = 'La contraseña es requerida'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setIsLoading(true)
    // Simular latencia de red
    await new Promise(r => setTimeout(r, 800))
    const result = login(form.email, form.password)
    setIsLoading(false)

    if (result.success) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
      setErrors({ password: result.message })
    }
  }

  // Acceso rápido para demos
  const quickLogin = (user) => {
    setForm({ email: user.email, password: user.password })
  }

  return (
    <div className={styles.page}>
      {/* Lado izquierdo — ilustración + branding */}
      <div className={styles.aside}>
        <div className={styles.asideBrand}>
          <div className={styles.logo}>
            <UtensilsCrossed size={40} />
          </div>
          <h1 className={styles.brandName}>Pardos Chicken</h1>
          <p className={styles.brandTagline}>Sistema de Gestión de Reservas</p>
        </div>

        <div className={styles.asideInfo}>
          <h2 className={styles.asideTitle}>Gestiona tus reservas<br />de forma inteligente</h2>
          <ul className={styles.featureList}>
            {[
              'Reservas en tiempo real',
              'Gestión de clientes VIP',
              'Control por roles y permisos',
              'Historial y reportes',
            ].map(f => (
              <li key={f} className={styles.featureItem}>
                <span className={styles.featureDot} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Decoración */}
        <div className={styles.asideDecor1} aria-hidden="true" />
        <div className={styles.asideDecor2} aria-hidden="true" />
      </div>

      {/* Lado derecho — formulario */}
      <div className={styles.main}>
        <div className={styles.formCard}>
          {/* Header del card */}
          <div className={styles.formHeader}>
            <div className={styles.logoSmall}><UtensilsCrossed size={24} /></div>
            <div>
              <h2 className={styles.formTitle}>Iniciar sesión</h2>
              <p className={styles.formSubtitle}>Ingresa tus credenciales para continuar</p>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <Input
              label="Correo electrónico"
              name="email"
              type="email"
              id="login-email"
              placeholder="tu@pardos.com"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              icon={<Mail size={16} />}
              required
              autoComplete="email"
              autoFocus
            />

            <div className={styles.passwordField}>
              <Input
                label="Contraseña"
                name="password"
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
                icon={<Lock size={16} />}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.togglePass}
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
            >
              {isLoading ? 'Ingresando...' : 'Ingresar al sistema'}
            </Button>
          </form>

          {/* Acceso rápido para demo */}
          <div className={styles.quickAccess}>
            <p className={styles.quickLabel}>Acceso rápido (demo)</p>
            <div className={styles.quickGrid}>
              {MOCK_USERS.map(u => (
                <button
                  key={u.id}
                  className={styles.quickBtn}
                  onClick={() => quickLogin(u)}
                  type="button"
                  style={{ '--role-color': ROLE_PERMISSIONS[u.role].color }}
                >
                  <span className={styles.quickAvatar}>{u.avatar}</span>
                  <span className={styles.quickInfo}>
                    <span className={styles.quickName}>{u.name.split(' ')[0]}</span>
                    <span className={styles.quickRole}>{ROLE_PERMISSIONS[u.role].label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* CTA para clientes */}
          <div className={styles.bookingCta}>
            <p className={styles.bookingCtaText}>¿Eres cliente y quieres hacer una reserva?</p>
            <Link to="/reservar" className={styles.bookingCtaBtn}>
              <CalendarPlus size={14} /> Solicitar reserva online
            </Link>
            <Link to="/reclamo" className={styles.bookingCtaBtn} style={{ marginTop: 8 }}>
              <MessageSquareWarning size={14} /> ¿Tuviste un problema? Reclama aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
