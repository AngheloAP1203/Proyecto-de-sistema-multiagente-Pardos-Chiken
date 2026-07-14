/**
 * src/context/ResolutionContext.jsx
 * Estado React para resoluciones activas, políticas y promociones.
 */

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { RESOLUTION_POLICIES } from '../data/seeds/resolutionPoliciesSeed.js'
import { PROMOTIONS } from '../data/seeds/promotionsSeed.js'

import { supabase } from '../domain/supabase'

const ResolutionContext = createContext(null)

export function ResolutionProvider({ children }) {
  const [resolutions, setResolutions] = useState([])
  const [policies] = useState(RESOLUTION_POLICIES)
  const [promotions] = useState(PROMOTIONS)
  const resolutionsRef = useRef(resolutions)

  useEffect(() => {
    resolutionsRef.current = resolutions
  }, [resolutions])

  // Cargar resoluciones desde Supabase
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('resolutions').select('*')
      if (!error && data) {
        setResolutions(data.map(d => ({
          ...d.metadata,
          id: d.id,
          status: d.status,
          timestamp: d.timestamp,
        })))
      }
    }
    load()
  }, [])

  const saveToDb = async (res) => {
    const { id, status, timestamp, ...metadata } = res
    await supabase.from('resolutions').upsert({
      id, status, timestamp, metadata
    })
  }

  const addResolution = useCallback((resolution) => {
    const r = {
      ...resolution,
      id: resolution.id || `R${Date.now().toString().slice(-6)}`,
      timestamp: resolution.timestamp || new Date().toISOString(),
      status: resolution.status || 'pendiente',
    }
    setResolutions((prev) => [r, ...prev])
    saveToDb(r)
    return r
  }, [])

  const updateResolution = useCallback((id, updates) => {
    setResolutions((prev) => {
      const mapped = prev.map((r) => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)
      const updated = mapped.find(r => r.id === id)
      if (updated) saveToDb(updated)
      return mapped
    })
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
