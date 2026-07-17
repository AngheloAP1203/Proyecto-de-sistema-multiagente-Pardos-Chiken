import React from 'react'
import { Network, Cpu, Database, LayoutTemplate, Bot } from 'lucide-react'
import Mermaid from '../../components/ui/Mermaid'
import styles from './ArchitecturePage.module.css'

const ARCHITECTURE_CHART = `
%%{init: { 'theme': 'base', 'themeVariables': { 'fontSize': '16px', 'nodeBorder': '2px', 'lineColor': '#555' } }}%%
graph LR
    classDef frontend   fill:#3498db,stroke:#1a6fa8,stroke-width:2px,color:#fff,font-weight:bold
    classDef business   fill:#27ae60,stroke:#1a8048,stroke-width:2px,color:#fff,font-weight:bold
    classDef ai         fill:#8e44ad,stroke:#6c3483,stroke-width:2px,color:#fff,font-weight:bold
    classDef data       fill:#e67e22,stroke:#ca6f1e,stroke-width:2px,color:#fff,font-weight:bold
    classDef db         fill:#f39c12,stroke:#d68910,stroke-width:2px,color:#fff,font-weight:bold
    classDef user       fill:#e8453c,stroke:#c0392b,stroke-width:2px,color:#fff,font-weight:bold

    User(["👤 Administrador\n/ Líder"]):::user

    subgraph FE ["🖥️ Frontend  —  React + Vite"]
        Dashboard["📊 Dashboard"]:::frontend
        Modulos["📦 Módulos\n(Caja, Reservas,\nCocina, ROI…)"]:::frontend
        Auth["🔐 Autenticación"]:::frontend
    end

    subgraph MA ["🤖 Motor Multiagente  —  LangGraph"]
        Asistente["🧠 AssistantAgent\n(Supervisor)"]:::ai
        PI["🔎 PromptInterpreter\n(Guardrail + Fallback)"]:::ai
        KA["👨‍🍳 KitchenAgent"]:::ai
        CA["💰 CashAgent"]:::ai
        RA["📅 ReservationAgent"]:::ai
        VER["✅ Verificador\nde Cifras"]:::ai
        KA -. "Handoff horizontal\n(participación ventas)" .-> CA
    end

    subgraph ESpec ["📋 Agentes Especializados"]
        M1["📩 ComplaintAgent\nM1 — Triaje IA"]:::ai
        M2["📈 LeaderAnalyst\nM2 — ReAct"]:::ai
        M3["🔒 SecurityAuditor\nM3 — Auditoría"]:::ai
    end

    subgraph Datos ["🗄️ Datos y Modelos"]
        Supabase[("🐘 Supabase\nPostgreSQL")]:::db
        LLM[("⚡ LLM\nGroq / Gemini")]:::data
    end

    User --> Dashboard
    Dashboard --> Auth
    Dashboard --> Modulos
    Dashboard --> Asistente
    Asistente --> PI
    Asistente --> KA
    Asistente --> CA
    Asistente --> RA
    Asistente --> VER
    Dashboard --> M1
    Dashboard --> M2
    Dashboard --> M3
    Modulos --> Supabase
    Auth --> Supabase
    Asistente --> LLM
    M1 --> LLM
    M2 --> LLM
    M3 --> LLM
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
