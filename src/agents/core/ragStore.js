/**
 * src/agents/core/ragStore.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Vector store de quejas históricas para RAG (Retrieval-Augmented Generation).
 *
 * Usa GoogleGenerativeAIEmbeddings (embedding-001) + MemoryVectorStore.
 * Persistencia en localStorage para evitar re-embeder al recargar.
 * Fallback: búsqueda por keywords si no hay API key (modo mock).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { llmMode } from './llmClient.js'

const STORAGE_KEY = 'pardos_rag_vectors'
const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {}
const API_KEY = ENV.VITE_GEMINI_API_KEY || ''

let _store = null
let _initialized = false
let _initPromise = null

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

function complaintToText(c) {
  return [
    c.mensaje || '',
    c.puntos_criticos?.join(', ') || '',
    c.sede || '',
    c.prioridad || '',
    c.sentimiento || '',
  ].filter(Boolean).join(' — ')
}

function complaintMetadata(c) {
  return {
    id: c.id,
    sede: c.sede || 'No especificada',
    prioridad: c.prioridad || 'Media',
    puntos_criticos: c.puntos_criticos || [],
    estado: c.estado || 'nueva',
    fecha: c.fecha || '',
  }
}

// ── Inicialización (lazy, solo cuando se necesite) ──────────────────────────
async function initStore(complaints = []) {
  if (_initPromise) return _initPromise
  _initPromise = _doInit(complaints)
  return _initPromise
}

async function _doInit(complaints) {
  if (_initialized && _store) return _store

  if (llmMode === 'mock' || !API_KEY) {
    _initialized = true
    console.log('[ragStore] Modo MOCK — búsqueda por keywords (sin embeddings)')
    return null
  }

  try {
    const { GoogleGenerativeAIEmbeddings } = await import('@langchain/google-genai')

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: API_KEY,
      model: 'text-embedding-004',
    })

    const docs = complaints.map((c) => ({
      pageContent: complaintToText(c),
      metadata: complaintMetadata(c),
    }))

    _store = { embeddings, docs: [], vectors: [] }

    for (const doc of docs) {
      const vec = await embeddings.embedQuery(doc.pageContent)
      _store.docs.push(doc)
      _store.vectors.push(vec)
    }

    _initialized = true
    console.log(`[ragStore] Inicializado con ${docs.length} quejas embedidas`)
    return _store
  } catch (e) {
    console.warn('[ragStore] Error al inicializar embeddings, usando fallback keyword:', e.message)
    _initialized = true
    return null
  }
}

// ── API pública ─────────────────────────────────────────────────────────────

export async function addComplaint(complaint) {
  if (!complaint?.mensaje) return
  const store = await initStore()
  if (!store) return

  try {
    const doc = { pageContent: complaintToText(complaint), metadata: complaintMetadata(complaint) }
    const vec = await store.embeddings.embedQuery(doc.pageContent)
    store.docs.push(doc)
    store.vectors.push(vec)
  } catch (e) {
    console.warn('[ragStore] Error al agregar queja al store:', e.message)
  }
}

export async function retrieveSimilar(query, k = 5) {
  const store = await initStore()
  if (!store) return mockRetrieve(query, k)

  try {
    if (store.docs.length === 0) return []
    const queryVec = await store.embeddings.embedQuery(query)
    const scored = store.docs.map((doc, i) => ({
      doc,
      score: cosineSimilarity(queryVec, store.vectors[i]),
    }))
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, k).map((s) => ({
      texto: s.doc.pageContent,
      score: s.score,
      ...s.doc.metadata,
    }))
  } catch (e) {
    console.warn('[ragStore] Error en búsqueda semántica, usando fallback:', e.message)
    return mockRetrieve(query, k)
  }
}

export async function initWithComplaints(complaints) {
  await initStore(complaints)
}

export function isReady() {
  return _initialized
}

// ── Fallback: búsqueda por keywords (modo mock) ────────────────────────────

let _mockComplaints = []

export function setMockComplaints(complaints) {
  _mockComplaints = complaints || []
}

function mockRetrieve(query, k = 5) {
  const q = (query || '').toLowerCase()
  const words = q.split(/\s+/).filter((w) => w.length > 2)

  const scored = _mockComplaints.map((c) => {
    const text = complaintToText(c).toLowerCase()
    let score = 0
    for (const w of words) {
      if (text.includes(w)) score++
    }
    return { complaint: c, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => ({
      texto: complaintToText(s.complaint),
      ...complaintMetadata(s.complaint),
    }))
}

export default {
  addComplaint,
  retrieveSimilar,
  initWithComplaints,
  isReady,
  setMockComplaints,
}
