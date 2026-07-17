import React from 'react'
import { Network, Cpu, Database, LayoutTemplate, Bot } from 'lucide-react'
import Mermaid from '../../components/ui/Mermaid'
import styles from './ArchitecturePage.module.css'

const ARCHITECTURE_CHART = `
%%{init: { 'theme': 'base', 'themeVariables': { 'fontSize': '15px', 'lineColor': '#666', 'primaryColor': '#fff' } }}%%
graph LR
    classDef frontend fill:#2980b9,stroke:#1a5276,stroke-width:2px,color:#fff,font-weight:bold
    classDef supervisor fill:#6c3483,stroke:#4a235a,stroke-width:2px,color:#fff,font-weight:bold
    classDef agentCore fill:#8e44ad,stroke:#6c3483,stroke-width:2px,color:#fff,font-weight:bold
    classDef agentQueja fill:#c0392b,stroke:#922b21,stroke-width:2px,color:#fff,font-weight:bold
    classDef agentAlmacen fill:#1a7a4a,stroke:#0e5233,stroke-width:2px,color:#fff,font-weight:bold
    classDef agentNotif fill:#1a6fa8,stroke:#0e4775,stroke-width:2px,color:#fff,font-weight:bold
    classDef db fill:#e67e22,stroke:#ca6f1e,stroke-width:2px,color:#fff,font-weight:bold
    classDef llm fill:#d35400,stroke:#a04000,stroke-width:2px,color:#fff,font-weight:bold
    classDef user fill:#e8453c,stroke:#c0392b,stroke-width:2px,color:#fff,font-weight:bold
    classDef guard fill:#566573,stroke:#2c3e50,stroke-width:2px,color:#fff,font-weight:bold

    User(["👤 Líder /\nAdministrador"]):::user

    subgraph FE ["🖥️  Capa de Presentación — React + Vite"]
        Dash["📊 Dashboard\n+ Analíticas + ROI"]:::frontend
        Mods["📦 Módulos de Negocio\n(Caja · Reservas · Cocina\nClientes · Almacén · Quejas)"]:::frontend
        Auth["🔐 Autenticación\n(AuthContext + Guards)"]:::frontend
    end

    subgraph BUS ["📡  EventBus — Comunicación asíncrona"]
        EB{{"⚡ EventBus\n(Observer pattern)"}}:::guard
    end

    subgraph MA ["🤖  Motor Multiagente — LangGraph  (Supervisor + Handoffs)"]
        ASS["🧠 AssistantAgent\nSupervisor ReAct"]:::supervisor
        PI["🔎 PromptInterpreter\nGuardrail · Fallback Nivel-2"]:::guard
        NUM["✅ Verificador Cifras\nnumberGuard.js"]:::guard
        KA["👨‍🍳 KitchenAgent\nPlato estrella · Kanban"]:::agentCore
        CA["💰 CashAgent\nVentas · Turno · Ticket"]:::agentCore
        RA["📅 ReservationAgent\nAprobación · Capacidad"]:::agentCore
        CLA["👥 ClientAgent\nCRM · VIP automático"]:::agentCore
        KA -. "Handoff horizontal\n(% ventas del día)" .-> CA
    end

    subgraph QA ["📋  Subsistema de Quejas (Cadena M1→M4→M6)"]
        M1["📩 ComplaintAgent\nM1 — Triaje Chain-of-Thought"]:::agentQueja
        M2["📈 LeaderAnalystAgent\nM2 — ReAct + Function Calling"]:::agentQueja
        M3["🔒 SecurityAuditorAgent\nM3 — Auditoría Self-Consistency"]:::agentQueja
        M4["🛠️ ResolutionAgent\nM4 — RAG + Cupones"]:::agentQueja
        M6["🎁 RewardAgent\nM6 — Anti-fraude + Recompensa"]:::agentQueja
        M1 --> M4
        M4 --> M6
    end

    subgraph INV ["🏭  Subsistema de Almacén (Swarm)"]
        IA["📦 InventoryAgent\nM7 — BOM · Reabastecimiento"]:::agentAlmacen
        FA["📉 ForecastAgent\nPredicción demanda dinámica"]:::agentAlmacen
        SW["🐝 SwarmPurchasingAgents\nEnjambre ReAct: Líder + Analistas"]:::agentAlmacen
        FA --> IA
        IA --> SW
    end

    subgraph NOTIF ["🔔  Notificaciones (Observer)"]
        NA["🔔 NotificationAgent\nAlertas por prioridad semafórica"]:::agentNotif
    end

    subgraph Datos ["🗄️  Datos y Servicios Externos"]
        SB[("🐘 Supabase\nPostgreSQL")]:::db
        LLM[("⚡ LLM\nGroq Llama 3.3\n/ Google Gemini")]:::llm
    end

    User --> Dash
    Dash --> Auth
    Dash --> Mods
    Dash --> ASS

    ASS --> PI
    ASS --> NUM
    ASS --> KA
    ASS --> CA
    ASS --> RA
    ASS --> CLA

    Mods --> M1
    Mods --> M2
    Mods --> M3
    Mods --> IA
    Mods --> NA

    EB --> NA

    KA --> EB
    RA --> EB
    CA --> EB

    Mods --> SB
    Auth --> SB
    CLA --> SB
    IA --> SB
    FA --> SB

    ASS --> LLM
    M1 --> LLM
    M2 --> LLM
    M3 --> LLM
    M4 --> LLM
    M6 --> LLM
    SW --> LLM
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
            <h3><LayoutTemplate size={18} style={{color:'#2980b9'}}/> Capa de Presentación</h3>
            <p>Frontend en React + Vite con Context API. Gestiona autenticación, estado global (Caja, Reservas, Cocina, Clientes) y enrutamiento protegido por rol.</p>
          </div>
          <div className={styles.legendItem}>
            <h3><Bot size={18} style={{color:'#6c3483'}}/> Motor Multiagente (LangGraph)</h3>
            <p>El <strong>AssistantAgent</strong> actúa como supervisor ReAct. Incluye guardrail destructivo (<em>PromptInterpreter</em>), verificador de cifras y handoffs horizontales entre KitchenAgent y CashAgent.</p>
          </div>
          <div className={styles.legendItem}>
            <h3><span style={{color:'#c0392b'}}>📋</span> Subsistema de Quejas (M1→M4→M6)</h3>
            <p>Cadena de 5 agentes: <strong>ComplaintAgent</strong> (triaje Chain-of-Thought) → <strong>ResolutionAgent</strong> (RAG + cupones) → <strong>RewardAgent</strong> (anti-fraude). Más <strong>LeaderAnalyst</strong> y <strong>SecurityAuditor</strong> para análisis y auditoría.</p>
          </div>
          <div className={styles.legendItem}>
            <h3><span style={{color:'#1a7a4a'}}>🏭</span> Subsistema de Almacén (Swarm)</h3>
            <p><strong>ForecastAgent</strong> predice demanda → <strong>InventoryAgent</strong> (BOM + reabastecimiento) → <strong>SwarmPurchasingAgents</strong> ejecuta compras con un enjambre ReAct de Líder + Analistas.</p>
          </div>
          <div className={styles.legendItem}>
            <h3><Cpu size={18} style={{color:'#1a6fa8'}}/> EventBus + NotificationAgent</h3>
            <p>Patrón Observer asíncrono. KitchenAgent, ReservationAgent y CashAgent publican eventos. <strong>NotificationAgent</strong> los consume y genera alertas con prioridad semafórica (🔴🟡🟢).</p>
          </div>
          <div className={styles.legendItem}>
            <h3><Database size={18} style={{color:'#e67e22'}}/> Datos y Modelos LLM</h3>
            <p>Persistencia en <strong>Supabase</strong> (PostgreSQL). Llamadas a <strong>Groq Llama 3.3</strong> (modo rápido, free tier con caché) y <strong>Google Gemini</strong> como fallback para generación de texto.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
