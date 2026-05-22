/**
 * src/context/AuthContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de autenticación.
 * Provee el estado del usuario autenticado, su rol y las funciones de
 * login / logout a toda la aplicación mediante React Context API.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { MOCK_USERS } from '../data/seeds/usersSeed'
import { ROLE_PERMISSIONS } from '../domain/auth/permissions'
import { readJSON, writeJSON, remove } from '../data/storage/localStorage'
import toast from 'react-hot-toast'
export { MOCK_USERS, ROLE_PERMISSIONS }

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restaurar sesión desde localStorage al montar
  useEffect(() => {
    const savedUser = readJSON('pardos_user', null)
    if (savedUser) {
      setUser(savedUser)
    } else {
      remove('pardos_user')
    }
    setIsLoading(false)
  }, [])

  /**
   * login — Autentica un usuario con email + contraseña.
   */
  const login = useCallback((email, password) => {
    const found = MOCK_USERS.find(
      u => u.email === email.trim().toLowerCase() && u.password === password
    )
    if (!found) {
      toast.error('Correo o contraseña incorrectos.')
      return { success: false, message: 'Correo o contraseña incorrectos.' }
    }
    const { password: _pw, ...safeUser } = found
    setUser(safeUser)
    writeJSON('pardos_user', safeUser)
    toast.success(`Bienvenido, ${safeUser.name}`)
    return { success: true, message: `Bienvenido, ${safeUser.name}` }
  }, [])

  /** logout — Cierra la sesión y limpia el storage. */
  const logout = useCallback(() => {
    setUser(null)
    remove('pardos_user')
    toast.success('Sesión cerrada correctamente')
  }, [])

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
