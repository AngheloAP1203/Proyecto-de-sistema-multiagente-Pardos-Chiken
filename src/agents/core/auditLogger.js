/**
 * src/agents/core/auditLogger.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agente Auditor — registro estructurado de decisiones del sistema multiagente.
 *
 * Complementa a LangSmith (que traza las LLAMADAS al LLM en el proxy) con un
 * registro de las DECISIONES de negocio de los agentes: bloqueos del guardrail,
 * rechazos de fraude, degradaciones de modelo, handoffs, recompensas. Es la capa
 * que una traza de LLM no ve, y es verificable dentro de la app sin cuenta externa.
 *
 * PRIVACIDAD: los datos sensibles (teléfonos) se redactan antes de guardar.
 * DURABILIDAD: buffer en memoria (últimas N) + persistencia en localStorage.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { eventBus, EVENT_TYPES } from './EventBus.js'

const MAX_ENTRIES = 200
const STORAGE_KEY = 'pardos_audit_log'

/** Redacta teléfonos: "987654321" → "987****21". No guardamos PII en claro. */
function redactar(valor) {
  if (valor == null) return valor
  if (typeof valor === 'string') {
    return valor.replace(/\b(\d{3})\d{2,}(\d{2})\b/g, '$1****$2')
  }
  if (Array.isArray(valor)) return valor.map(redactar)
  if (typeof valor === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(valor)) {
      out[k] = /tel|phone|celular|dni/i.test(k) ? redactar(String(v ?? '')) : redactar(v)
    }
    return out
  }
  return valor
}

class AuditLoggerClass {
  constructor() {
    this._entries = []
    this._subs = new Set()
    this._loaded = false
  }

  _load() {
    if (this._loaded) return
    this._loaded = true
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (Array.isArray(saved)) this._entries = saved.slice(-MAX_ENTRIES)
    } catch { /* localStorage puede no existir (Node/tests) */ }
  }

  _persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._entries.slice(-MAX_ENTRIES))) }
    catch { /* sin localStorage: solo memoria */ }
  }

  /**
   * record — Registra una decisión/evento de agente.
   *
   * @param {Object} e
   * @param {string} e.actor    - Quién decide/hace la acción (Nombre o ID)
   * @param {string} [e.tipoActor] - 'agente', 'usuario', 'cliente'
   * @param {string} e.accion   - Qué pasó (assistant.query, login, etc)
   * @param {string} [e.nivel]  - info | warn | error
   * @param {string} [e.resultado] - veredicto/estado (VERIFICADO, BLOCKED, degraded…)
   * @param {number} [e.latencia]
   * @param {Object} [e.detalle] - datos extra (se redactan)
   */
  record(e = {}) {
    this._load()
    const entry = {
      ts:        new Date().toISOString(),
      actor:     e.actor || e.agente || 'desconocido',
      tipoActor: e.tipoActor || 'agente',
      accion:    e.accion || 'evento',
      nivel:     e.nivel || 'info',
      resultado: e.resultado ?? null,
      latencia:  Number.isFinite(e.latencia) ? e.latencia : null,
      detalle:   e.detalle ? redactar(e.detalle) : null,
    }
    this._entries.push(entry)
    if (this._entries.length > MAX_ENTRIES) this._entries = this._entries.slice(-MAX_ENTRIES)
    this._persist()
    this._subs.forEach(fn => { try { fn(entry) } catch { /* un suscriptor no debe romper el logger */ } })
    return entry
  }

  /** Conecta el logger al EventBus: cada mensaje inter-agente queda auditado. */
  conectarEventBus() {
    if (this._conectado) return
    this._conectado = true
    for (const tipo of Object.values(EVENT_TYPES)) {
      eventBus.subscribe(tipo, (msg) => {
        const esError = tipo === EVENT_TYPES.AGENT_ERROR
        this.record({
          actor:   msg?.source || 'EventBus',
          tipoActor: 'agente',
          accion:  tipo,
          nivel:   esError ? 'error' : 'info',
          detalle: msg?.payload,
        })
      })
    }
  }

  getEntries({ actor, tipoActor, nivel, limit = 100 } = {}) {
    this._load()
    let e = this._entries
    if (actor) e = e.filter(x => x.actor === actor)
    if (tipoActor) e = e.filter(x => x.tipoActor === tipoActor)
    if (nivel)  e = e.filter(x => x.nivel === nivel)
    return e.slice(-limit).reverse()   // más recientes primero
  }

  stats() {
    this._load()
    const porActor = {}, porTipo = { agente: 0, usuario: 0, cliente: 0 }, porNivel = { info: 0, warn: 0, error: 0 }
    for (const e of this._entries) {
      porActor[e.actor] = (porActor[e.actor] || 0) + 1
      porTipo[e.tipoActor] = (porTipo[e.tipoActor] || 0) + 1
      porNivel[e.nivel] = (porNivel[e.nivel] || 0) + 1
    }
    return { total: this._entries.length, porActor, porTipo, porNivel }
  }

  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn) }

  exportarJSON() {
    this._load()
    return JSON.stringify(this._entries, null, 2)
  }

  limpiar() {
    this._entries = []
    this._persist()
    this._subs.forEach(fn => { try { fn(null) } catch { /* noop */ } })
  }
}

export const auditLogger = new AuditLoggerClass()

// Acceso desde consola para verificación rápida: window.__pardosAudit.getEntries()
if (typeof window !== 'undefined') window.__pardosAudit = auditLogger

export default auditLogger
