/**
 * src/agents/SecurityAuditorAgent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * MÓDULO 3 — Auditor de Seguridad y Lógica de Procesos (Self-Consistency).
 *
 * Genera N auditorías independientes del mismo proceso (temperature alta) y luego
 * consolida en un informe final que solo conserva las vulnerabilidades repetidas
 * (≥ 3 de 5), eliminando falsos positivos.
 *
 * No usa contexto React: es análisis puro sobre la definición del proceso.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AgentBase } from './core/AgentBase.js'
import { complete } from './core/llmClient.js'
import { PROMPT_AUDITOR } from './prompts.js'

const N_AUDITORIAS = 5
const UMBRAL_CONSISTENCIA = 3 // aparecer en ≥3 de 5

export class SecurityAuditorAgent extends AgentBase {
  constructor() {
    super(
      'SecurityAuditorAgent',
      `Eres un auditor senior de ciberseguridad y lógica de procesos para Pardos Chicken.
       Usas Self-Consistency: generas varias auditorías independientes y consolidas solo
       las vulnerabilidades que aparecen de forma consistente. Analizas inyección de prompt,
       fuga de datos (incl. la API key) y manipulación lógica.`,
      ['audit_process']
    )
    this._registerTools()
  }

  _registerTools() {
    this.registerTool(
      'audit_process',
      'Audita un proceso con Self-Consistency (N auditorías + consolidación de hallazgos)',
      this._auditProcess
    )
  }

  /**
   * _auditProcess — Punto de entrada (M3).
   * @param {{ nombreProceso: string, definicion: string }} params
   */
  async _auditProcess({ nombreProceso = 'Proceso sin nombre', definicion = '' }) {
    if (!definicion || !definicion.trim()) {
      return { success: false, error: 'Falta la definición del proceso a auditar' }
    }

    const prompt = `Proceso a auditar: ${nombreProceso}\n\nDefinición / lógica del proceso:\n${definicion}`

    try {
      // 1. Generar N auditorías independientes EN PARALELO (temperature alta = diversidad)
      const auditorias = await Promise.all(
        Array.from({ length: N_AUDITORIAS }, () =>
          complete({ system: PROMPT_AUDITOR, prompt, temperature: 0.9 })
        )
      )

      // 2. Consolidar: pedir un informe final que solo conserve lo consistente (≥3/5)
      const informeFinal = await this._consolidar(nombreProceso, auditorias)

      return {
        success: true,
        result: informeFinal,
        auditoriasGeneradas: auditorias.length,
        umbral: `${UMBRAL_CONSISTENCIA}/${N_AUDITORIAS}`,
      }
    } catch (err) {
      this.log('error', 'Fallo la auditoría', err.message)
      return { success: false, error: `Error del LLM en la auditoría: ${err.message}` }
    }
  }

  /**
   * _consolidar — 6.ª llamada que recibe las N auditorías y devuelve el informe consistente.
   */
  async _consolidar(nombreProceso, auditorias) {
    const bloque = auditorias
      .map((a, i) => `--- AUDITORÍA ${i + 1} ---\n${a}`)
      .join('\n\n')

    const systemConsolida = `Eres el auditor jefe. Recibes ${auditorias.length} auditorías independientes
del mismo proceso. Devuelve UN ÚNICO informe final en Markdown que incluya SOLO las vulnerabilidades
que aparezcan de forma consistente en al menos ${UMBRAL_CONSISTENCIA} de las ${auditorias.length} auditorías.
Descarta los hallazgos aislados (falsos positivos). Mantén el formato:
# INFORME DE AUDITORÍA CONSOLIDADO — ${nombreProceso}
## Vulnerabilidades consistentes (≥${UMBRAL_CONSISTENCIA}/${auditorias.length})
(para cada una: **Riesgo**, **Descripción**, **Probabilidad**)
## Recomendaciones de mitigación`

    return complete({
      system: systemConsolida,
      prompt: bloque,
      temperature: 0.2,
    })
  }
}

export const securityAuditorAgent = new SecurityAuditorAgent()
export default securityAuditorAgent
