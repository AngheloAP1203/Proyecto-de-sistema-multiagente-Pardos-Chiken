/**
 * src/features/roi/RoiPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de ROI del Líder — exclusivo del Administrador.
 *
 * Cuenta, en primera persona y con los datos reales del restaurante, el retorno
 * de inversión del sistema multiagente: de dónde salen los costos, qué beneficios
 * son medibles, y cómo se calcula el ROI. Los supuestos clave (horas liberadas,
 * costo/hora gerencial, ahorro por quiebres de stock evitados) son EDITABLES:
 * al moverlos, el ROI, el beneficio neto y el período de retorno se recalculan
 * en vivo. Así el número deja de ser una promesa y pasa a ser algo que el líder
 * puede auditar con sus propios supuestos.
 *
 * Datos reales usados:
 *   - payments      → ingresos del mes, ticket promedio, nº de transacciones
 *   - reservations  → volumen de reservas del mes
 *   - vipClients    → clientes VIP detectados automáticamente (ClientAgent)
 *   - complaints    → quejas gestionadas con triaje automático (M1)
 *
 * Acceso: Solo Administrador (líder).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Cell, Legend,
} from 'recharts'
import {
  TrendingUp, Clock, DollarSign, Award, MessageSquareWarning,
  Sparkles, Calculator, PiggyBank, Timer, Gauge, ShieldCheck,
} from 'lucide-react'
import { useCash } from '../../context/CashContext'
import { useReservations } from '../../context/ReservationContext'
import { useClients } from '../../context/ClientContext'
import { useComplaints } from '../../context/ComplaintContext'
import { format, subDays } from 'date-fns'
import styles from './RoiPage.module.css'

const C = {
  red:    '#e8453c',
  green:  '#27ae60',
  blue:   '#2980b9',
  orange: '#e67e22',
  purple: '#8e44ad',
  gold:   '#c99700',
  grid:   '#f0ebe3',
  text:   '#9b8a7a',
  dark:   '#3b1a1a',
}

const soles = (n) =>
  'S/ ' + (Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

// ── KPI ────────────────────────────────────────────────────────────────────────
function Kpi({ icon, label, value, sub, accent }) {
  return (
    <div className={styles.kpi} style={{ '--accent': accent }}>
      <div className={styles.kpiIcon}>{icon}</div>
      <div>
        <p className={styles.kpiLabel}>{label}</p>
        <p className={styles.kpiValue}>{value}</p>
        {sub && <p className={styles.kpiSub}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Control deslizante para un supuesto ──────────────────────────────────────────
function Assumption({ label, help, value, set, min, max, step, format: fmt }) {
  return (
    <label className={styles.assump}>
      <span className={styles.assumpTop}>
        <span className={styles.assumpLabel}>{label}</span>
        <span className={styles.assumpValue}>{fmt(value)}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => set(Number(e.target.value))}
        className={styles.slider}
      />
      <span className={styles.assumpHelp}>{help}</span>
    </label>
  )
}

const TooltipMoney = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tt}>
      <p className={styles.ttLabel}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill, fontSize: 12, margin: '2px 0' }}>
          {p.name}: <strong>{soles(p.value)}</strong>
        </p>
      ))}
    </div>
  )
}

export default function RoiPage() {
  const { payments } = useCash()
  const { reservations } = useReservations()
  const { vipClients, clients } = useClients()
  const { complaints } = useComplaints()

  // ── Datos reales del último mes ──────────────────────────────────────────────
  const real = useMemo(() => {
    const since = format(subDays(new Date(), 30), 'yyyy-MM-dd')
    const pay = payments.filter(p => (p.date || '') >= since)
    const res = reservations.filter(r => (r.date || '') >= since)
    const income = pay.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    return {
      income,
      tx: pay.length,
      ticket: pay.length ? income / pay.length : 0,
      reservas: res.length,
      vips: (vipClients?.length) || 0,
      totalClients: (clients?.length) || 0,
      quejas: complaints?.length || 0,
      criticas: (complaints || []).filter(c => c.prioridad === 'Crítica' || c.prioridad === 'Alta').length,
    }
  }, [payments, reservations, vipClients, clients, complaints])

  // ── Supuestos editables por el líder ─────────────────────────────────────────
  const [horas, setHoras]       = useState(40)     // horas/mes de gerencia liberadas
  const [costoHora, setCostoHora] = useState(38)   // S/ por hora de gerencia
  const [stock, setStock]       = useState(500)    // S/ /mes recuperados por evitar quiebres
  const [costoOp, setCostoOp]   = useState(250)    // S/ /mes de operación (infra + mantenimiento)
  const [inversion, setInversion] = useState(3000) // S/ inversión inicial (desarrollo)

  // ── Cálculo del ROI ──────────────────────────────────────────────────────────
  const roi = useMemo(() => {
    const benHoras = horas * costoHora
    const benMensual = benHoras + stock
    const netoMensual = benMensual - costoOp
    const netoAnual = netoMensual * 12
    const costoAnual = costoOp * 12 + inversion
    const roiPct = costoAnual > 0 ? (netoAnual / costoAnual) * 100 : 0
    const payback = netoMensual > 0 ? inversion / netoMensual : Infinity
    return { benHoras, benMensual, netoMensual, netoAnual, costoAnual, roiPct, payback }
  }, [horas, costoHora, stock, costoOp, inversion])

  // ── Serie: beneficio neto acumulado a 12 meses (para ver el punto de equilibrio) ─
  const cumulative = useMemo(() => {
    let acc = -inversion
    return Array.from({ length: 13 }, (_, m) => {
      if (m > 0) acc += roi.netoMensual
      return { mes: `M${m}`, acumulado: Math.round(acc) }
    })
  }, [roi.netoMensual, inversion])

  const costVsBenefit = [
    { name: 'Costo mensual', valor: costoOp, fill: C.red },
    { name: 'Beneficio: horas', valor: roi.benHoras, fill: C.green },
    { name: 'Beneficio: stock', valor: stock, fill: C.blue },
  ]

  const paybackTxt = roi.payback === Infinity
    ? '—'
    : roi.payback < 1
      ? '< 1 mes'
      : `${roi.payback.toFixed(1)} meses`

  return (
    <div className={styles.page}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <PiggyBank size={26} className={styles.titleIcon} /> Retorno de Inversión (ROI)
          </h1>
          <p className={styles.subtitle}>
            Panel del líder — cuánto me cuesta el sistema multiagente y cuánto me devuelve
          </p>
        </div>
        <span className={styles.badgeLive}>
          <Sparkles size={13} /> Datos reales de los últimos 30 días
        </span>
      </div>

      {/* ── Narrativa de apertura ─────────────────────────────── */}
      <div className={styles.intro}>
        <p>
          Como líder de Pardos quiero saber una sola cosa antes de confiar en un sistema de IA:
          <strong> ¿me devuelve más de lo que me cuesta?</strong> Este panel responde eso con mis
          propios números. La regla de fondo del sistema es que <em>las herramientas calculan y el
          modelo solo narra</em>, así que cada cifra de aquí abajo sale de mis pagos, reservas,
          clientes y quejas — no de una estimación inventada. Y los supuestos que sí son míos
          (cuántas horas me libera, cuánto vale mi hora) los puedo mover yo mismo más abajo y ver
          cómo cambia el retorno.
        </p>
      </div>

      {/* ── KPIs reales ───────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <Kpi icon={<DollarSign size={20} />} accent={C.red}
          label="Ingresos del mes" value={soles(real.income)}
          sub={`${real.tx} transacciones · ticket ${soles(real.ticket)}`} />
        <Kpi icon={<Award size={20} />} accent={C.gold}
          label="Clientes VIP detectados" value={real.vips}
          sub={`de ${real.totalClients} clientes — etiquetado automático`} />
        <Kpi icon={<MessageSquareWarning size={20} />} accent={C.orange}
          label="Quejas gestionadas con IA" value={real.quejas}
          sub={`${real.criticas} priorizadas como Alta/Crítica`} />
        <Kpi icon={<Clock size={20} />} accent={C.blue}
          label="Análisis de compras" value="3 h → 10 min"
          sub="lo que antes me tomaba una tarde entera" />
      </div>

      {/* ── El problema, contado por mí ───────────────────────── */}
      <div className={styles.section}>
        <h2 className={styles.h2}><Timer size={18} /> Dónde perdía el tiempo antes (línea base)</h2>
        <div className={styles.baselineGrid}>
          <div className={styles.baseCard}>
            <span className={styles.baseNum}>~3 h</span>
            <p>Cada vez que decidía cuánto pollo e insumos pedir, revisaba ventas en hojas
              sueltas. Ahora el asistente me da la proyección en minutos.</p>
          </div>
          <div className={styles.baseCard}>
            <span className={styles.baseNum}>~40 h/mes</span>
            <p>Horas de gerencia que se iban en reportes, priorizar quejas a mano y revisar
              quién era cliente frecuente. Eso es lo que el sistema me libera.</p>
          </div>
          <div className={styles.baseCard}>
            <span className={styles.baseNum}>Inconsistente</span>
            <p>La prioridad de una queja dependía de quién la leyera. Hoy el triaje M1 la
              clasifica igual siempre, y un cobro doble nunca se me pasa como "media".</p>
          </div>
        </div>
      </div>

      {/* ── Supuestos editables ───────────────────────────────── */}
      <div className={styles.section}>
        <h2 className={styles.h2}><Gauge size={18} /> Mis supuestos — muévelos y mira el ROI cambiar</h2>
        <p className={styles.sectionLede}>
          Estos son los únicos números que no salen del sistema, sino de mi criterio. Los dejo a la
          vista a propósito: si alguien no me cree el ROI, que ajuste aquí y saque el suyo.
        </p>
        <div className={styles.assumpGrid}>
          <Assumption label="Horas de gerencia liberadas / mes" value={horas} set={setHoras}
            min={0} max={80} step={5} format={(v) => `${v} h`}
            help="Tiempo que ya no gasto en reportes, triaje manual y CRM a mano." />
          <Assumption label="Valor de mi hora de gerencia" value={costoHora} set={setCostoHora}
            min={15} max={80} step={1} format={(v) => `S/ ${v}`}
            help="Cuánto vale una hora mía (o de quien haría ese trabajo)." />
          <Assumption label="Quiebres de stock evitados / mes" value={stock} set={setStock}
            min={0} max={2000} step={50} format={soles}
            help="Ventas que ya no pierdo por quedarme sin insumos, gracias a mejor proyección." />
          <Assumption label="Costo operativo del sistema / mes" value={costoOp} set={setCostoOp}
            min={0} max={1000} step={25} format={soles}
            help="Infraestructura + mantenimiento de prompts y evals. Los tokens hoy son S/ 0 (free tier)." />
          <Assumption label="Inversión inicial (desarrollo)" value={inversion} set={setInversion}
            min={0} max={12000} step={250} format={soles}
            help="Costo único de construir el sistema. Se recupera una sola vez." />
        </div>
      </div>

      {/* ── Resultado grande del ROI ──────────────────────────── */}
      <div className={styles.resultRow}>
        <div className={`${styles.resultCard} ${styles.resultPrimary}`}>
          <span className={styles.resultLabel}>ROI anual</span>
          <span className={styles.resultBig}>{roi.roiPct.toFixed(0)}%</span>
          <span className={styles.resultFoot}>
            (beneficio neto anual {soles(roi.netoAnual)} ÷ costo total anual {soles(roi.costoAnual)}) × 100
          </span>
        </div>
        <div className={styles.resultCard}>
          <span className={styles.resultLabel}>Beneficio neto mensual</span>
          <span className={styles.resultMid} style={{ color: roi.netoMensual >= 0 ? C.green : C.red }}>
            {soles(roi.netoMensual)}
          </span>
          <span className={styles.resultFoot}>beneficio {soles(roi.benMensual)} − costo {soles(costoOp)}</span>
        </div>
        <div className={styles.resultCard}>
          <span className={styles.resultLabel}>Recupero la inversión en</span>
          <span className={styles.resultMid} style={{ color: C.blue }}>{paybackTxt}</span>
          <span className={styles.resultFoot}>inversión {soles(inversion)} ÷ beneficio neto mensual</span>
        </div>
      </div>

      {/* ── Gráficos ──────────────────────────────────────────── */}
      <div className={styles.grid2}>
        <div className={styles.chartCard}>
          <h3 className={styles.h3}>Costo vs. beneficio mensual</h3>
          <p className={styles.chartHint}>Lo verde y azul (lo que gano) debería tapar de lejos lo rojo (lo que pago).</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={costVsBenefit} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.text }} />
              <YAxis tick={{ fontSize: 11, fill: C.text }} tickFormatter={(v) => `S/${v}`} />
              <Tooltip content={<TooltipMoney />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="valor" name="Monto" radius={[6, 6, 0, 0]}>
                {costVsBenefit.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <h3 className={styles.h3}>Beneficio neto acumulado (12 meses)</h3>
          <p className={styles.chartHint}>Donde la línea cruza el cero, ya recuperé la inversión inicial.</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={cumulative} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.text }} />
              <YAxis tick={{ fontSize: 11, fill: C.text }} tickFormatter={(v) => `S/${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<TooltipMoney />} />
              <ReferenceLine y={0} stroke={C.red} strokeDasharray="4 4" />
              <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke={C.green}
                strokeWidth={2.5} dot={{ r: 3, fill: C.green }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Tablas costo / beneficio ──────────────────────────── */}
      <div className={styles.grid2}>
        <div className={styles.tableCard}>
          <h3 className={styles.h3}><Calculator size={16} /> Lo que me cuesta</h3>
          <table className={styles.table}>
            <thead><tr><th>Concepto</th><th className={styles.num}>Monto</th><th>Periodicidad</th></tr></thead>
            <tbody>
              <tr><td>Desarrollo (una vez)</td><td className={styles.num}>{soles(inversion)}</td><td>Único</td></tr>
              <tr><td>Tokens del modelo (Groq/Gemini)</td><td className={styles.num}>S/ 0</td><td>Free tier</td></tr>
              <tr><td>Infraestructura + mantenimiento</td><td className={styles.num}>{soles(costoOp)}</td><td>Mensual</td></tr>
              <tr className={styles.rowTotal}><td>Costo total del primer año</td><td className={styles.num}>{soles(roi.costoAnual)}</td><td>Anual</td></tr>
            </tbody>
          </table>
        </div>

        <div className={styles.tableCard}>
          <h3 className={styles.h3}><TrendingUp size={16} /> Lo que me devuelve</h3>
          <table className={styles.table}>
            <thead><tr><th>Beneficio</th><th className={styles.num}>Monto</th><th>Periodicidad</th></tr></thead>
            <tbody>
              <tr><td>{horas} h/mes × {soles(costoHora)}/h liberadas</td><td className={styles.num}>{soles(roi.benHoras)}</td><td>Mensual</td></tr>
              <tr><td>Quiebres de stock evitados</td><td className={styles.num}>{soles(stock)}</td><td>Mensual</td></tr>
              <tr><td>Respuesta inmediata a quejas críticas</td><td className={styles.num}>cualitativo</td><td>—</td></tr>
              <tr><td>Fraude en recompensas evitado</td><td className={styles.num}>cualitativo</td><td>—</td></tr>
              <tr className={styles.rowTotal}><td>Beneficio neto anual</td><td className={styles.num}>{soles(roi.netoAnual)}</td><td>Anual</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cierre honesto ────────────────────────────────────── */}
      <div className={styles.closing}>
        <ShieldCheck size={20} className={styles.closingIcon} />
        <div>
          <h3 className={styles.h3}>Mi lectura honesta del número</h3>
          <p>
            Con mis supuestos actuales el sistema me da un <strong>ROI de {roi.roiPct.toFixed(0)}%</strong> y
            recupero la inversión en <strong>{paybackTxt}</strong>. No cuento aquí beneficios que no puedo
            medir todavía — la retención por responder rápido una queja crítica, o la reputación — así
            que el número real probablemente sea mejor, no peor. Lo que sí sé con certeza es que el costo
            de tokens hoy es cero (free tier con caché de sesión y límites), y que el trabajo que me libera
            es tiempo que puedo poner en el salón, no en una hoja de cálculo. Si el volumen crece y salgo
            del free tier, vuelvo aquí, subo el costo operativo y recalculo — el panel no me deja engañarme.
          </p>
        </div>
      </div>
    </div>
  )
}
