/**
 * src/App.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente raíz de la aplicación Pardos Chicken — Sistema Multiagente.
 * Define la estructura de rutas con React Router v6 y envuelve
 * la app con los providers globales de estado.
 *
 * ARQUITECTURA MULTIAGENTE (Topología Estrella):
 *   El AgentProvider es el puente entre los contexts de React y el
 *   sistema de agentes. Necesita acceso a las funciones de los contexts
 *   para inyectarlas en cada agente. Por eso se implementa como un
 *   componente interno que ya tiene acceso a los contexts montados.
 *
 * Estructura de rutas:
 *   /login          → Inicio de sesión (público)
 *   /reservar       → Página pública de solicitud de reserva
 *   /dashboard      → Dashboard principal (admin, cajero, hostess)
 *   /analiticas     → Gráficos de ingresos y personas (solo admin)
 *   /reservas       → Gestión de reservas en tiempo real (todos los roles)
 *   /mesas          → Mapa de mesas (admin, hostess, mozo)
 *   /clientes       → Gestión de clientes (admin, cajero, hostess)
 *   /caja           → Módulo de cobros y turno (cajero, admin)
 *   /cocina         → Panel Kanban de pedidos (jefe_cocina, admin)
 *   /historial      → Historial de reservas (admin, cajero)
 *   /reportes       → Reportes y métricas (admin, cajero)
 *   /configuracion  → Configuración del sistema (solo admin)
 *   /no-autorizado  → Página de acceso denegado
 *   *               → Página 404
 *
 * Proveedores (de afuera hacia adentro):
 *   BrowserRouter → AuthProvider → ReservationProvider → ClientProvider
 *                → CashProvider → MenuProvider → KitchenProvider
 *                → AgentBridge (conecta contexts con agentes) → Routes
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'

// Providers de estado global
import { AuthProvider }        from './context/AuthContext'
import { ReservationProvider } from './context/ReservationContext'
import { ClientProvider }      from './context/ClientContext'
import { CashProvider }        from './context/CashContext'
import { KitchenProvider }     from './context/KitchenContext'
import { MenuProvider }        from './context/MenuContext'

// Sistema multiagente — conecta los contexts con el Orquestador
import { AgentProvider }       from './context/AgentContext'

// Hooks de los contexts (para el AgentBridge)
import { useReservations }     from './context/ReservationContext'
import { useKitchen }          from './context/KitchenContext'
import { useCash }             from './context/CashContext'
import { useClients }          from './context/ClientContext'

// Route guards
import { ProtectedRoute, PublicOnlyRoute } from './components/auth/ProtectedRoute'

// Layout principal
import AppLayout from './components/layout/AppLayout'

// Páginas
import LoginPage    from './features/auth/LoginPage'
import BookingPage  from './features/booking/BookingPage'
import DashboardPage    from './features/dashboard/DashboardPage'
import AnalyticsPage    from './features/analytics/AnalyticsPage'
import ReservationsPage from './features/reservations/ReservationsPage'
import TablesPage       from './features/tables/TablesPage'
import ClientsPage      from './features/clients/ClientsPage'
import CashPage         from './features/cash/CashPage'
import KitchenPage      from './features/kitchen/KitchenPage'
import HistoryPage      from './features/history/HistoryPage'
import ReportsPage      from './features/reports/ReportsPage'
import SettingsPage     from './features/settings/SettingsPage'
import NotFoundPage     from './pages/NotFoundPage'

// ── Página de acceso denegado ─────────────────────────────────────────────────
function UnauthorizedPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--color-cream)', padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '24px', boxShadow: '0 16px 48px rgba(59,26,26,0.2)',
        padding: '48px 40px', textAlign: 'center', maxWidth: '420px', width: '100%',
        animation: 'fadeIn 0.5s ease both',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔒</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#3b1a1a', marginBottom: '12px' }}>
          Acceso denegado
        </h1>
        <p style={{ fontSize: '14px', color: '#9b6b6b', marginBottom: '28px', lineHeight: 1.6 }}>
          No tienes permisos para acceder a esta sección.
          Contacta al administrador si crees que es un error.
        </p>
        <Link to="/dashboard" style={{
          display: 'inline-block', padding: '10px 24px', background: '#e8453c',
          color: '#fff', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
          textDecoration: 'none',
        }}>
          ← Volver al inicio
        </Link>
      </div>
    </div>
  )
}

/**
 * AgentBridge — Componente interno que ya tiene acceso a los contexts montados.
 * Su única función es leer los contexts y pasarlos como props al AgentProvider,
 * permitiendo que el sistema multiagente opere sobre el estado real de la app.
 *
 * Se llama "Bridge" porque es el puente entre el mundo de React Contexts
 * y el mundo de los Agentes JavaScript.
 */
function AgentBridge({ children }) {
  // Acceder a los contexts ya montados en el árbol superior
  const reservationCtx = useReservations()
  const kitchenCtx     = useKitchen()
  const cashCtx        = useCash()
  const clientCtx      = useClients()

  // Empaquetar las acciones de cada context y pasarlas al AgentProvider
  return (
    <AgentProvider
      reservationActions={{
        addReservation:      reservationCtx.addReservation,
        updateReservation:   reservationCtx.updateReservation,
        cancelReservation:   reservationCtx.cancelReservation,
        completeReservation: reservationCtx.completeReservation,
        seatReservation:     reservationCtx.seatReservation,
        approveReservation:  reservationCtx.approveReservation,
        rejectReservation:   reservationCtx.rejectReservation,
        requestReservation:  reservationCtx.requestReservation,
      }}
      kitchenActions={{
        addTicket:           kitchenCtx.addTicket,
        updateTicketStatus:  kitchenCtx.updateTicketStatus,
        updateTicket:        kitchenCtx.updateTicket,
        advanceItem:         kitchenCtx.advanceItem,
      }}
      cashActions={{
        addPayment:  cashCtx.addPayment,
        openShift:   cashCtx.openShift,
        closeShift:  cashCtx.closeShift,
      }}
      clientActions={{
        addClient:   clientCtx.addClient,
        updateClient: clientCtx.updateClient,
        findByPhone:  clientCtx.findByPhone,
      }}
    >
      {children}
    </AgentProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ReservationProvider>
          <ClientProvider>
            <CashProvider>
              <MenuProvider>
                <KitchenProvider>
                  {/* AgentBridge conecta los contexts con el sistema multiagente */}
                  <AgentBridge>
                    <Routes>
                      {/* ── Ruta raíz → login ── */}
                      <Route path="/" element={<Navigate to="/login" replace />} />

                      {/* ── Página pública de reservas (sin login) ── */}
                      <Route path="/reservar" element={<BookingPage />} />

                      {/* ── Rutas públicas (solo accesibles sin sesión) ── */}
                      <Route element={<PublicOnlyRoute />}>
                        <Route path="/login" element={<LoginPage />} />
                      </Route>

                      {/* ── Rutas protegidas (requieren autenticación) ── */}
                      <Route element={<ProtectedRoute />}>
                        <Route element={<AppLayout />}>
                          {/* Redirigir raíz al login */}
                          <Route index element={<Navigate to="/login" replace />} />

                          {/* Dashboard (admin, cajero, hostess) */}
                          <Route path="/dashboard"  element={<DashboardPage />} />

                          {/* Analíticas — solo admin */}
                          <Route element={<ProtectedRoute requiredPermission="canViewIncomesChart" />}>
                            <Route path="/analiticas" element={<AnalyticsPage />} />
                          </Route>

                          {/* Reservas (todos los roles autenticados) */}
                          <Route path="/reservas"   element={<ReservationsPage />} />

                          {/* Mesas */}
                          <Route path="/mesas"      element={<TablesPage />} />

                          {/* Clientes */}
                          <Route path="/clientes"   element={<ClientsPage />} />

                          {/* Caja — cajero y admin */}
                          <Route element={<ProtectedRoute requiredPermission="canManageCash" />}>
                            <Route path="/caja"     element={<CashPage />} />
                          </Route>

                          {/* Cocina — jefe_cocina y admin */}
                          <Route element={<ProtectedRoute requiredPermission="canManageKitchenOrders" />}>
                            <Route path="/cocina"   element={<KitchenPage />} />
                          </Route>

                          {/* Historial */}
                          <Route path="/historial"   element={<HistoryPage />} />

                          {/* Reportes */}
                          <Route path="/reportes"    element={<ReportsPage />} />

                          {/* Configuración — solo admin */}
                          <Route element={<ProtectedRoute requiredPermission="canConfigureSystem" />}>
                            <Route path="/configuracion" element={<SettingsPage />} />
                          </Route>
                        </Route>
                      </Route>

                      {/* ── Páginas de error ── */}
                      <Route path="/no-autorizado" element={<UnauthorizedPage />} />
                      <Route path="*"              element={<NotFoundPage />} />
                    </Routes>
                  </AgentBridge>
                </KitchenProvider>
              </MenuProvider>
            </CashProvider>
          </ClientProvider>
        </ReservationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
