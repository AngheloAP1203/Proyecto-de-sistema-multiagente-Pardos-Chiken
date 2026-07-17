import React from 'react'
import { Network, Cpu, Database, LayoutTemplate, Bot } from 'lucide-react'
import Mermaid from '../../components/ui/Mermaid'
import styles from './ArchitecturePage.module.css'

const ARCHITECTURE_CHART = `
graph TD
    classDef frontend fill:#3498db,stroke:#2980b9,stroke-width:2px,color:#fff
    classDef logic fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#fff
    classDef data fill:#f1c40f,stroke:#f39c12,stroke-width:2px,color:#333
    classDef ai fill:#9b59b6,stroke:#8e44ad,stroke-width:2px,color:#fff
    classDef default fill:#fff,stroke:#ccc,stroke-width:1px

    User([👤 Usuario / Administrador]) --> Front

    subgraph "Capa de Presentación (React / Vite)"
        Front[Frontend Dashboard]:::frontend
    end

    subgraph "Módulos de Negocio"
        Front --> Auth[Autenticación]:::logic
        Front --> ROI[Módulo de ROI]:::logic
        Front --> Res[Módulo de Reservas]:::logic
        Front --> Cash[Módulo de Caja]:::logic
        Front --> Kitchen[Módulo de Cocina]:::logic
    end

    subgraph "Orquestación Multiagente (LangGraph)"
        Front --> AgentSystem{Assistant Agent}:::ai
        AgentSystem --> PI[PromptInterpreter]:::ai
        AgentSystem --> Supervisor[Supervisor LangGraph]:::ai
        Supervisor --> KA[KitchenAgent]:::ai
        Supervisor --> CA[CashAgent]:::ai
        Supervisor --> RA[ReservationAgent]:::ai
        Supervisor --> VA[Verificador Cifras]:::ai
        
        CA -. "Handoff Horizontal" .-> KA
    end

    subgraph "Agentes Especializados (Prompts)"
        Front --> Triaje[ComplaintAgent M1]:::ai
        Front --> Leader[LeaderAnalystAgent M2]:::ai
        Front --> Auditor[SecurityAuditorAgent M3]:::ai
    end

    subgraph "Capa de Datos y Modelos"
        Auth --> Supabase[(Supabase DB)]:::data
        Res --> Supabase
        Cash --> Supabase
        Kitchen --> Supabase

        Triaje --> LLM((LLM Groq/Gemini)):::data
        Leader --> LLM
        Auditor --> LLM
        Supervisor --> LLM
    end
`

export default function ArchitecturePage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <Network size={26} className={styles.titleIcon} /> Arquitectura del Sistema
        </h1>
        <p className={styles.subtitle}>
          Visualización de la topología y conexión entre los agentes de IA, módulos de negocio y datos.
        </p>
      </div>

      <div className={styles.card}>
        <div className={styles.diagramContainer}>
          <Mermaid chart={ARCHITECTURE_CHART} id="architecture-diagram" />
        </div>

        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <h3><LayoutTemplate size={18} style={{color: '#3498db'}}/> Capa de Presentación</h3>
            <p>El frontend construido con React y Vite. Centraliza la experiencia del usuario y maneja el estado global mediante Context API (Auth, Cash, Reservas, etc.).</p>
          </div>
          <div className={styles.legendItem}>
            <h3><Cpu size={18} style={{color: '#2ecc71'}}/> Módulos de Negocio</h3>
            <p>Lógica pura de negocio que interactúa con la base de datos sin depender de IA. Aquí residen operaciones como registrar ventas o modificar reservas.</p>
          </div>
          <div className={styles.legendItem}>
            <h3><Bot size={18} style={{color: '#9b59b6'}}/> Orquestación Multiagente</h3>
            <p>El núcleo inteligente. El <strong>AssistantAgent</strong> usa <em>LangGraph</em> para coordinar herramientas. Incluye handoffs (saltos entre agentes, ej. Cash a Kitchen) y un verificador estricto de cifras reales.</p>
          </div>
          <div className={styles.legendItem}>
            <h3><Database size={18} style={{color: '#f39c12'}}/> Capa de Datos y Modelos</h3>
            <p>Almacenamiento persistente en Supabase (PostgreSQL) y llamadas a los modelos de lenguaje (LLM de Groq con Llama o Google Gemini) para la toma de decisiones.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
