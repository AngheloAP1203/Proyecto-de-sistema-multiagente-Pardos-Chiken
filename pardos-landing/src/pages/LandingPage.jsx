import { Link } from 'react-router-dom'
import {
  Star, MapPin, Phone, Clock, ChevronRight, Users,
  Award, Heart, Flame, UtensilsCrossed, Camera,
  Share2, Mail,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import styles from './LandingPage.module.css'

/* ── Platos destacados ─────────────────────────────────────────────────────── */
const DISHES = [
  {
    emoji: '🍗',
    name: '1/4 de Pollo a la Brasa',
    desc: 'Jugoso y dorado, marinado 24h en nuestra receta secreta.',
    price: 'S/ 22',
    tag: 'Más pedido',
  },
  {
    emoji: '🍽️',
    name: 'Combo Familiar',
    desc: 'Pollo entero + papas + ensalada + 3 bebidas. Ideal para 4.',
    price: 'S/ 89',
    tag: 'Familiar',
  },
  {
    emoji: '🔥',
    name: 'Ají de Gallina Pardos',
    desc: 'Receta tradicional con ají amarillo y nueces. Cremoso y delicioso.',
    price: 'S/ 28',
    tag: 'Chef recomienda',
  },
  {
    emoji: '🥗',
    name: 'Causa Limeña Especial',
    desc: 'Con relleno de pollo a la brasa, crema de ají amarillo y aceituna.',
    price: 'S/ 24',
    tag: 'Entrada',
  },
]

/* ── Ambientes ─────────────────────────────────────────────────────────────── */
const ZONES = [
  { icon: '🏛️', name: 'Salón Principal', desc: 'Amplio y climatizado, ideal para familias y grupos.',     seats: '120 personas' },
  { icon: '🌿', name: 'Terraza',          desc: 'Al aire libre con vista al jardín. Perfecto para almorzar.', seats: '60 personas' },
  { icon: '👑', name: 'Zona VIP',         desc: 'Privacidad y atención preferencial. Ideal para eventos.',  seats: '30 personas' },
]

/* ── Stats ─────────────────────────────────────────────────────────────────── */
const STATS = [
  { icon: <Award size={24} />, value: '30+ años', label: 'de tradición' },
  { icon: <Users size={24} />,  value: '1M+ clientes', label: 'satisfechos' },
  { icon: <Star size={24} />,   value: '4.8 / 5',      label: 'valoración' },
  { icon: <Heart size={24} />,  value: '50+ locales',   label: 'en el Perú' },
]

/* ── Reviews ─────────────────────────────────────────────────────────────────*/
const REVIEWS = [
  { name: 'María G.', stars: 5, text: '¡El mejor pollo a la brasa de Lima! La atención fue increíble y llegamos a tiempo gracias a la reserva online.' },
  { name: 'Roberto S.', stars: 5, text: 'Reservamos para aniversario y nos sorprendieron con un detalle especial. Ambiente precioso, muy recomendado.' },
  { name: 'Patricia F.', stars: 5, text: 'El formulario de reserva fue súper fácil. En 5 minutos teníamos mesa confirmada para 6 personas.' },
]

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <Navbar />

      {/* ═══════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════ */}
      <section id="inicio" className={styles.hero}>
        {/* Background layers */}
        <div className={styles.heroBg}>
          <img src="/hero-food.png" alt="" className={styles.heroBgImg} />
          <div className={styles.heroBgOverlay} />
        </div>

        {/* Floating decor */}
        <div className={styles.heroDecor1} />
        <div className={styles.heroDecor2} />

        <div className={styles.heroContent}>
          <div className={`${styles.heroBadge} animate-fadeUp`}>
            <Flame size={14} />
            <span>Pollo a la Brasa desde 1994</span>
          </div>

          <h1 className={`${styles.heroTitle} animate-fadeUp animate-delay-1`}>
            Sabor peruano<br />
            <em>que enamora</em>
          </h1>

          <p className={`${styles.heroSub} animate-fadeUp animate-delay-2`}>
            Reserva tu mesa en minutos y disfruta del pollo a la brasa<br />
            más premiado del Perú con tu familia o amigos.
          </p>

          <div className={`${styles.heroActions} animate-fadeUp animate-delay-3`}>
            <Link to="/reservar" className={styles.heroCta}>
              Reservar mi mesa
              <ChevronRight size={18} />
            </Link>
            <a href="#menu" className={styles.heroSecondary}>
              Ver menú
            </a>
          </div>

          {/* Info chips */}
          <div className={`${styles.heroChips} animate-fadeUp animate-delay-4`}>
            <div className={styles.chip}>
              <Clock size={13} />
              <span>Lun–Dom · 12:00–22:30</span>
            </div>
            <div className={styles.chip}>
              <MapPin size={13} />
              <span>Miraflores, Lima</span>
            </div>
            <div className={styles.chip}>
              <Phone size={13} />
              <span>(01) 444-4400</span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className={styles.scrollIndicator}>
          <div className={styles.scrollDot} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          STATS BAR
      ═══════════════════════════════════════════════════ */}
      <section className={styles.statsBar}>
        <div className={styles.statsInner}>
          {STATS.map((s, i) => (
            <div key={i} className={styles.statItem}>
              <div className={styles.statIcon}>{s.icon}</div>
              <div>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          ABOUT
      ═══════════════════════════════════════════════════ */}
      <section id="nosotros" className={styles.about}>
        <div className={styles.container}>
          <div className={styles.aboutGrid}>
            <div className={styles.aboutLeft}>
              <div className={styles.sectionTag}>
                <Heart size={13} />
                <span>Nuestra historia</span>
              </div>
              <h2 className={styles.sectionTitle}>
                Más de 30 años<br />haciendo historia
              </h2>
              <p className={styles.aboutText}>
                Pardos Chicken nació en Lima en 1994 con una misión simple: llevar el mejor
                pollo a la brasa del Perú a cada mesa familiar. Con nuestra receta secreta
                marinada durante 24 horas y horneada en brasas de leña, cada bocado es
                una experiencia única.
              </p>
              <p className={styles.aboutText}>
                Hoy contamos con más de 50 restaurantes en todo el Perú y el reconocimiento
                de millones de clientes que confían en nosotros para sus momentos especiales.
              </p>
              <div className={styles.aboutFeats}>
                {['Receta original de 1994', 'Marinado 24 horas', 'Brasas de leña natural', 'Ingredientes frescos diarios'].map(f => (
                  <div key={f} className={styles.aboutFeat}>
                    <div className={styles.aboutFeatDot} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.aboutRight}>
              <div className={styles.aboutImageCard}>
                <img src="/hero-food.png" alt="Pollo a la brasa Pardos" className={styles.aboutImg} />
                <div className={styles.aboutImageBadge}>
                  <Star size={16} fill="currentColor" />
                  <span>Premio al mejor sabor 2023</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          MENU HIGHLIGHTS
      ═══════════════════════════════════════════════════ */}
      <section id="menu" className={styles.menuSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTag}>
              <UtensilsCrossed size={13} />
              <span>Lo mejor de nuestra carta</span>
            </div>
            <h2 className={styles.sectionTitle}>Platos que enamoran</h2>
            <p className={styles.sectionSub}>
              Cada plato está preparado con ingredientes frescos y la pasión<br />
              que nos caracteriza desde hace más de 30 años.
            </p>
          </div>

          <div className={styles.dishGrid}>
            {DISHES.map((d, i) => (
              <div key={i} className={styles.dishCard}>
                <div className={styles.dishTag}>{d.tag}</div>
                <div className={styles.dishEmoji}>{d.emoji}</div>
                <h3 className={styles.dishName}>{d.name}</h3>
                <p className={styles.dishDesc}>{d.desc}</p>
                <div className={styles.dishPrice}>{d.price}</div>
              </div>
            ))}
          </div>

          <div className={styles.menuCta}>
            <Link to="/reservar" className={styles.menuCtaBtn}>
              Reservar y disfrutar
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          AMBIENTES
      ═══════════════════════════════════════════════════ */}
      <section id="ambiente" className={styles.zonesSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTag}>
              <MapPin size={13} />
              <span>Elige tu espacio</span>
            </div>
            <h2 className={styles.sectionTitle}>Ambientes para cada ocasión</h2>
          </div>

          <div className={styles.zonesGrid}>
            {ZONES.map((z, i) => (
              <div key={i} className={styles.zoneCard}>
                <div className={styles.zoneIcon}>{z.icon}</div>
                <h3 className={styles.zoneName}>{z.name}</h3>
                <p className={styles.zoneDesc}>{z.desc}</p>
                <div className={styles.zoneSeats}>
                  <Users size={13} />
                  <span>{z.seats}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          REVIEWS
      ═══════════════════════════════════════════════════ */}
      <section className={styles.reviewsSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTag}>
              <Star size={13} />
              <span>Lo que dicen nuestros clientes</span>
            </div>
            <h2 className={styles.sectionTitle}>Miles de familias felices</h2>
          </div>
          <div className={styles.reviewsGrid}>
            {REVIEWS.map((r, i) => (
              <div key={i} className={styles.reviewCard}>
                <div className={styles.reviewStars}>
                  {Array.from({ length: r.stars }, (_, j) => (
                    <Star key={j} size={14} fill="var(--brand-gold)" color="var(--brand-gold)" />
                  ))}
                </div>
                <p className={styles.reviewText}>"{r.text}"</p>
                <div className={styles.reviewAuthor}>— {r.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          CTA BANNER
      ═══════════════════════════════════════════════════ */}
      <section className={styles.ctaBanner}>
        <div className={styles.ctaBannerDecor1} />
        <div className={styles.ctaBannerDecor2} />
        <div className={styles.container}>
          <div className={styles.ctaBannerContent}>
            <h2 className={styles.ctaBannerTitle}>
              ¿Listo para vivir la experiencia Pardos?
            </h2>
            <p className={styles.ctaBannerSub}>
              Reserva en minutos. Confirmamos en menos de 2 horas.
            </p>
            <Link to="/reservar" className={styles.ctaBannerBtn}>
              Reservar mi mesa ahora
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════ */}
      <footer id="contacto" className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>
                <UtensilsCrossed size={18} />
                <span>Pardos Chicken</span>
              </div>
              <p className={styles.footerTagline}>
                El sabor del Perú en cada mesa desde 1994.
              </p>
              <div className={styles.footerSocials}>
                <a href="#" className={styles.socialBtn} aria-label="Instagram"><Camera size={16} /></a>
                <a href="#" className={styles.socialBtn} aria-label="Facebook"><Share2 size={16} /></a>
                <a href="#" className={styles.socialBtn} aria-label="Email"><Mail size={16} /></a>
              </div>
            </div>

            <div className={styles.footerCol}>
              <h4 className={styles.footerColTitle}>Visítanos</h4>
              <div className={styles.footerInfo}>
                <MapPin size={14} />
                <span>Av. La Mar 456, Miraflores</span>
              </div>
              <div className={styles.footerInfo}>
                <Clock size={14} />
                <span>Lun–Dom: 12:00 – 22:30</span>
              </div>
              <div className={styles.footerInfo}>
                <Phone size={14} />
                <span>(01) 444 - 4400</span>
              </div>
            </div>

            <div className={styles.footerCol}>
              <h4 className={styles.footerColTitle}>Reservas</h4>
              <Link to="/reservar" className={styles.footerLink}>Reservar mesa online</Link>
              <a href="#menu" className={styles.footerLink}>Ver menú completo</a>
              <a href="#ambiente" className={styles.footerLink}>Nuestros ambientes</a>
              <a href="#nosotros" className={styles.footerLink}>Sobre nosotros</a>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p>© {new Date().getFullYear()} Pardos Chicken. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
