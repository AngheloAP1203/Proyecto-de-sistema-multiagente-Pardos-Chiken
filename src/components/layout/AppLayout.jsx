/**
 * src/components/layout/AppLayout.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Layout principal de la aplicación (cuando el usuario está autenticado).
 * Contiene:
 *   - Sidebar de navegación con menú filtrado por rol
 *   - Header superior con info del usuario y botón de logout
 *   - Área principal de contenido (Outlet de React Router)
 *
 * Menú de navegación por rol:
 *   - admin:       Dashboard, Analíticas, Reservas, Mesas, Clientes, Caja, Cocina, Historial, Reportes, Config
 *   - cajero:      Dashboard, Reservas, Clientes, Caja, Historial, Reportes
 *   - hostess:     Dashboard, Reservas, Mesas, Clientes
 *   - mozo:        Reservas, Mesas
 *   - jefe_cocina: Cocina, Reservas (solo lectura)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, CalendarCheck, Users, Clock, ChartBar,
  Settings, LogOut, Menu, X, UtensilsCrossed, ChevronRight,
  TableProperties, CreditCard, ChefHat, TrendingUp, Cpu,
} from 'lucide-react'
import { useAuth, ROLE_PERMISSIONS } from '../../context/AuthContext'
import { useAgents } from '../../context/AgentContext'
// Drawer de pruebas del sistema multiagente
import AgentTestDrawer from '../ui/AgentTestDrawer'
import toast from 'react-hot-toast'
import styles from './AppLayout.module.css'

// ── Definición del menú de navegación ────────────────────────────────────────
const NAV_ITEMS = [
  {
    id: 'dashboard',
    path: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={20} />,
    roles: ['admin', 'cajero', 'hostess'],
  },
  {
    id: 'analytics',
    path: '/analiticas',
    label: 'Analíticas',
    icon: <TrendingUp size={20} />,
    roles: ['admin'],
  },
  {
    id: 'reservations',
    path: '/reservas',
    label: 'Reservas',
    icon: <CalendarCheck size={20} />,
    roles: ['admin', 'cajero', 'hostess', 'mozo', 'jefe_cocina'],
  },
  {
    id: 'tables',
    path: '/mesas',
    label: 'Mesas',
    icon: <TableProperties size={20} />,
    roles: ['admin', 'hostess', 'mozo'],
  },
  {
    id: 'clients',
    path: '/clientes',
    label: 'Clientes',
    icon: <Users size={20} />,
    roles: ['admin', 'cajero', 'hostess'],
  },
  {
    id: 'cash',
    path: '/caja',
    label: 'Caja',
    icon: <CreditCard size={20} />,
    roles: ['cajero', 'admin'],
  },
  {
    id: 'kitchen',
    path: '/cocina',
    label: 'Cocina',
    icon: <ChefHat size={20} />,
    roles: ['jefe_cocina', 'admin'],
  },
  {
    id: 'history',
    path: '/historial',
    label: 'Historial',
    icon: <Clock size={20} />,
    roles: ['admin', 'cajero'],
  },
  {
    id: 'reports',
    path: '/reportes',
    label: 'Reportes',
    icon: <ChartBar size={20} />,
    roles: ['admin', 'cajero'],
  },
  {
    id: 'settings',
    path: '/configuracion',
    label: 'Configuración',
    icon: <Settings size={20} />,
    roles: ['admin'],
  },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const { systemStatus }  = useAgents()
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [agentDrawerOpen, setAgentDrawer] = useState(false)

  const handleLogout = () => {
    logout()
    toast.success('Sesión cerrada correctamente')
  }

  // Filtrar menú según el rol del usuario
  const allowedNav = NAV_ITEMS.filter(item => item.roles.includes(user?.role))
  const roleInfo = ROLE_PERMISSIONS[user?.role]

  // Contar agentes activos para el badge del botón flotante
  const activeAgents = systemStatus?.agents?.filter(a => a.isActive).length || 0
  const totalEvents  = systemStatus?.eventBus?.totalMessages || 0

  return (
    <div className={styles.layout}>
      {/* Overlay para mobile */}
      {sidebarOpen && (
        <div
          className={styles.overlay}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ──────────────────────────── */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        {/* Logo */}
        <div className={styles.sidebarBrand}>
          <div className={styles.brandIcon}>
            <UtensilsCrossed size={22} />
          </div>
          <div>
            <span className={styles.brandName}>Pardos</span>
            <span className={styles.brandSub}>Chicken</span>
          </div>
          <button
            className={styles.closeSidebar}
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navegación */}
        <nav className={styles.nav} aria-label="Navegación principal">
          {/* Botón especial para el Sistema Multiagente */}
          <button
            className={styles.agentSidebarBtn}
            onClick={() => setAgentDrawer(true)}
            title="Verificar Sistema Multiagente"
            aria-label="Abrir panel de agentes"
          >
            <div className={styles.agentSidebarIcon}>
              <Cpu size={18} />
              {/* Indicador de agentes activos */}
              {activeAgents > 0 && <span className={styles.agentSidebarActiveDot} />}
            </div>
            <div className={styles.agentSidebarText}>
              <span className={styles.agentSidebarTitle}>Agentes IA</span>
              <span className={styles.agentSidebarSub}>Panel de control</span>
            </div>
            {/* Badge con total de eventos MCP procesados */}
            {totalEvents > 0 && (
              <span className={styles.agentSidebarBadge}>{totalEvents > 99 ? '99+' : totalEvents}</span>
            )}
            <ChevronRight size={14} className={styles.agentSidebarChevron} />
          </button>

          <ul className={styles.navList}>
            {allowedNav.map(item => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                  <ChevronRight size={14} className={styles.navChevron} />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Info del usuario en sidebar */}
        <div className={styles.sidebarUser}>
          <div
            className={styles.userAvatar}
            style={{ background: roleInfo?.color + '33', color: roleInfo?.color }}
          >
            {user?.avatar}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name}</span>
            <span className={styles.userRole}>{roleInfo?.label}</span>
          </div>
          <button
            onClick={handleLogout}
            className={styles.logoutBtn}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ── Área principal ────────────────────── */}
      <div className={styles.mainArea}>
        {/* Header */}
        <header className={styles.header}>
          <button
            className={styles.menuBtn}
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>

          <div className={styles.headerTitle}>
            <p className={styles.headerWelcome}>Hola, {user?.name?.split(' ')[0]}</p>
            <p className={styles.headerDate}>
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.headerBadge} style={{ background: roleInfo?.color + '22', color: roleInfo?.color }}>
              {roleInfo?.label}
            </div>
            <div className={styles.headerAvatar} style={{ background: roleInfo?.color }}>
              {user?.avatar}
            </div>
          </div>
        </header>

        {/* Contenido de la página actual */}
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>

      {/* Drawer de pruebas del sistema multiagente */}
      <AgentTestDrawer
        isOpen={agentDrawerOpen}
        onClose={() => setAgentDrawer(false)}
        currentRole={user?.role || 'admin'}
      />
    </div>
  )
}
