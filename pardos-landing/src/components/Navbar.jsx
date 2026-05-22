import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { UtensilsCrossed, Menu, X } from 'lucide-react'
import styles from './Navbar.module.css'

const NAV_LINKS = [
  { href: '#inicio',   label: 'Inicio' },
  { href: '#nosotros', label: 'Nosotros' },
  { href: '#menu',     label: 'Menú' },
  { href: '#ambiente', label: 'Ambientes' },
  { href: '#contacto', label: 'Contacto' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)
  const location = useLocation()
  const isReserva = location.pathname === '/reservar'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link to="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <UtensilsCrossed size={20} />
          </div>
          <span className={styles.logoText}>Pardos Chicken</span>
        </Link>

        {/* Nav links — only on landing */}
        {!isReserva && (
          <nav className={`${styles.links} ${open ? styles.open : ''}`}>
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} className={styles.link}
                 onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
          </nav>
        )}

        {/* CTA */}
        <div className={styles.actions}>
          {!isReserva && (
            <Link to="/reservar" className={styles.ctaBtn}>
              Reservar Mesa
            </Link>
          )}
          {isReserva && (
            <Link to="/" className={styles.backBtn}>
              ← Volver al inicio
            </Link>
          )}
          {!isReserva && (
            <button className={styles.burger} onClick={() => setOpen(o => !o)}
                    aria-label="Menú">
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
