/**
 * src/context/AuthContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de autenticación.
 * Provee el estado del usuario autenticado, su rol y las funciones de
 * login / logout usando Supabase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../domain/supabase'
import { MOCK_USERS, DEMO_LOGINS } from '../data/seeds/usersSeed'
import { ROLE_PERMISSIONS } from '../domain/auth/permissions'
import { auditLogger } from '../agents/core/auditLogger'
import toast from 'react-hot-toast'
export { MOCK_USERS, ROLE_PERMISSIONS }

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }
    return data
  }

  // Restaurar sesión desde Supabase al montar
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        if (profile) setUser(profile)
      }
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        if (profile) setUser(profile)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * login — Autentica un usuario con email + contraseña en Supabase.
   */
  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      // Fallback de conveniencia para la demo: si el usuario no fue creado en Supabase Auth,
      // permitimos el login local usando las credenciales hardcodeadas.
      const mockLogin = DEMO_LOGINS.find(u => u.email === email.trim().toLowerCase() && u.password === password)
      const mockProfile = MOCK_USERS.find(u => u.email === email.trim().toLowerCase())
      
      if (mockLogin && mockProfile) {
        console.warn(`[AuthContext] Fallback a login local para ${email} (no existe en Supabase Auth)`)
        setUser(mockProfile)
        
        auditLogger.record({
          actor: `${mockProfile.name} (${mockProfile.role})`,
          tipoActor: 'usuario',
          accion: 'auth.login.fallback',
          nivel: 'warn',
          detalle: { email: mockProfile.email }
        })

        toast.success(`Bienvenido, ${mockProfile.name} (Modo Demo)`)
        return { success: true, message: `Bienvenido, ${mockProfile.name}` }
      }

      toast.error('Correo o contraseña incorrectos.')
      return { success: false, message: 'Correo o contraseña incorrectos.' }
    }

    const profile = await fetchProfile(data.user.id)
    if (!profile) {
      toast.error('Error al cargar perfil.')
      return { success: false, message: 'Error al cargar perfil.' }
    }

    setUser(profile)
    
    auditLogger.record({
      actor: `${profile.name} (${profile.role})`,
      tipoActor: 'usuario',
      accion: 'auth.login',
      nivel: 'info',
      detalle: { email: profile.email }
    })

    toast.success(`Bienvenido, ${profile.name}`)
    return { success: true, message: `Bienvenido, ${profile.name}` }
  }, [])

  /** logout — Cierra la sesión en Supabase. */
  const logout = useCallback(async () => {
    if (user) {
      auditLogger.record({
        actor: `${user.name} (${user.role})`,
        tipoActor: 'usuario',
        accion: 'auth.logout',
        nivel: 'info'
      })
    }
    await supabase.auth.signOut()
    setUser(null)
    toast.success('Sesión cerrada correctamente')
  }, [user])

  /**
   * hasPermission — Verifica si el usuario actual tiene un permiso específico.
   */
  const hasPermission = useCallback(
    (permission) => {
      if (!user) return false
      return ROLE_PERMISSIONS[user.role]?.[permission] === true
    },
    [user]
  )

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    permissions: user ? ROLE_PERMISSIONS[user.role] : null,
    login,
    logout,
    hasPermission,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
