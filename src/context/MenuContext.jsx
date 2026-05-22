/**
 * src/context/MenuContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global del Menú del restaurante.
 * Permite al Líder (admin) agregar, editar y eliminar platos del menú.
 * Los platos se persisten en localStorage con los datos de kitchen/menu.js
 * como semilla inicial.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { MENU_ITEMS as SEED_MENU } from '../domain/kitchen/menu'
import { readJSON, writeJSON } from '../data/storage/localStorage'
import toast from 'react-hot-toast'

const MenuContext = createContext(null)

export function MenuProvider({ children }) {
  const [menuItems, setMenuItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Cargar menú desde localStorage (semilla inicial si no hay nada guardado)
  useEffect(() => {
    const saved = readJSON('pardos_menu', null)
    setMenuItems(saved || SEED_MENU)
    setIsLoading(false)
  }, [])

  // Persistir cambios
  useEffect(() => {
    if (!isLoading) writeJSON('pardos_menu', menuItems)
  }, [menuItems, isLoading])

  const generateId = () => `M${Date.now().toString().slice(-6)}`

  const addMenuItem = useCallback((data) => {
    const newItem = { ...data, id: generateId() }
    setMenuItems(prev => [...prev, newItem])
    toast.success(`Plato "${data.name}" agregado al menú`)
    return newItem
  }, [])

  const updateMenuItem = useCallback((id, updates) => {
    setMenuItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item))
    toast.success('Plato actualizado')
  }, [])

  const deleteMenuItem = useCallback((id) => {
    setMenuItems(prev => prev.filter(item => item.id !== id))
    toast.success('Plato eliminado del menú')
  }, [])

  // Categorías únicas derivadas
  const categories = [...new Set(menuItems.map(m => m.category))].sort()

  const value = {
    menuItems,
    categories,
    isLoading,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
  }

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>
}

export function useMenu() {
  const ctx = useContext(MenuContext)
  if (!ctx) throw new Error('useMenu debe usarse dentro de <MenuProvider>')
  return ctx
}
