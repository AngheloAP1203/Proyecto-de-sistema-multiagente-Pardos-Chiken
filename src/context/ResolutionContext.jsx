/**
 * src/context/ResolutionContext.jsx
 * Estado React para resoluciones activas, políticas y promociones.
 */

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { RESOLUTION_POLICIES } from '../data/seeds/resolutionPoliciesSeed.js'
import { PROMOTIONS } from '../data/seeds/promotionsSeed.js'

const ResolutionContext = createContext(null)
const STORAGE_KEY = 'pardos_resolutions'

export function ResolutionProvider({ children }) {
  const [resolutions, setResolutions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [policies] = useState(RESOLUTION_POLICIES)
  const [promotions] = useState(PROMOTIONS)
  const resolutionsRef = useRef(resolutions)

  useEffect(() => {
    resolutionsRef.current = resolutions
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(resolutions)) } catch {}
  }, [resolutions])

  const addResolution = useCallback((resolution) => {
    const r = {
      ...resolution,
      id: resolution.id || `R${Date.now().toString().slice(-6)}`,
      timestamp: resolution.timestamp || new Date().toISOString(),
      status: resolution.status || 'pendiente',
    }
    setResolutions((prev) => [r, ...prev])
    return r
  }, [])

  const updateResolution = useCallback((id, updates) => {
    setResolutions((prev) =>
      prev.map((r) => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)
    )
  }, [])

  const getResolution = useCallback((id) => {
    return resolutionsRef.current.find((r) => r.id === id) || null
  }, [])

  const getResolutions = useCallback(() => resolutionsRef.current, [])

  const getActiveResolutions = useCallback(() => {
    return resolutionsRef.current.filter((r) => r.status === 'pendiente' || r.status === 'aceptada')
  }, [])

  const findPolicy = useCallback((problema) => {
    const p = (problema || '').toLowerCase()
    return policies.find((pol) =>
      pol.palabras_clave?.some((kw) => p.includes(kw)) || p.includes(pol.problema)
    ) || null
  }, [policies])

  const findPromotion = useCallback((promoId) => {
    return promotions.find((p) => p.id === promoId && p.activa) || null
  }, [promotions])

  const generateVoucherCode = useCallback((complaintId, promoId) => {
    return `VALE-${complaintId}-${promoId}-${Date.now().toString(36).toUpperCase()}`
  }, [])

  const value = {
    resolutions,
    policies,
    promotions,
    addResolution,
    updateResolution,
    getResolution,
    getResolutions,
    getActiveResolutions,
    findPolicy,
    findPromotion,
    generateVoucherCode,
    totalResolutions: resolutions.length,
    pendingCount: resolutions.filter((r) => r.status === 'pendiente').length,
  }

  return (
    <ResolutionContext.Provider value={value}>
      {children}
    </ResolutionContext.Provider>
  )
}

export function useResolutions() {
  const ctx = useContext(ResolutionContext)
  if (!ctx) throw new Error('useResolutions debe usarse dentro de ResolutionProvider')
  return ctx
}

export default ResolutionContext
