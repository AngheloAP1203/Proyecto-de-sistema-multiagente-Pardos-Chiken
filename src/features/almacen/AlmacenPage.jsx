/**
 * src/features/almacen/AlmacenPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Asistente del Líder de Almacén (M7) — panel por botones, sin depender del LLM.
 *
 * Todo es REAL y derivado de datos de Supabase:
 *   · Stock inicial del día  → tabla `supplies`
 *   · Consumo del día        → pagos COBRADOS (payments) explotados por receta
 *   · Stock disponible       → inicial − consumo (pollo redondeado a piezas enteras)
 *   · Qué comprar            → proyección de la fecha objetivo vs. stock disponible
 *
 * No usa LangChain ni llamadas al modelo: todo el cálculo es determinista, así
 * que el panel nunca "se cae" por un módulo de IA que no cargó.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Package, ShoppingCart, RefreshCw, AlertTriangle, FileDown, Phone, TrendingDown, CheckCircle2, Zap, MessageCircle } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useCash } from '../../context/CashContext'
import { loadInventoryData } from '../../data/api/inventoryApi'
import { planificarCompras, calcularConsumoDia, aplicarStockVivo } from '../../domain/inventory/purchasePlanner'

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hoyISO = () => iso(new Date())
const mananaISO = () => { const d = new Date(); d.setDate(d.getDate() + 1); return iso(d) }

// ── Paleta (teal = identidad del almacén) ──
const C = {
  teal: '#0d9488', tealSoft: '#ccfbf1', tealDark: '#0f766e',
  red: '#dc2626', redSoft: '#fef2f2', amber: '#b45309', amberSoft: '#fff7ed',
  green: '#16a34a', ink: '#0f172a', slate: '#64748b', line: '#e2e8f0', card: '#ffffff',
}

export default function AlmacenPage() {
  const { payments } = useCash()
  const [inv, setInv] = useState(null)
  const [vista, setVista] = useState('stock')
  const [fechaObjetivo, setFechaObjetivo] = useState(mananaISO())
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    setInv(await loadInventoryData())
    setCargando(false)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  // Ventas reales derivadas de los cobros.
  const ventas = useMemo(() => {
    const out = []
    for (const p of payments || []) {
      for (const it of p.items || []) {
        const menuId = it.menuId || it.itemId
        if (menuId) out.push({ fecha: p.date, menuId, qty: Number(it.qty) || 0 })
      }
    }
    return out
  }, [payments])

  const { stockVivo, plan } = useMemo(() => {
    if (!inv) return { stockVivo: [], plan: null }
    const ventasHoy = ventas.filter(v => v.fecha === hoyISO())
    const consumo = calcularConsumoDia(ventasHoy, inv.recipes, inv.supplies)
    const vivo = aplicarStockVivo(inv.supplies, consumo)
    const p = planificarCompras({
      historico: ventas, fechaObjetivo, recetas: inv.recipes, supplies: vivo, suppliers: inv.suppliers,
    })
    return { stockVivo: vivo, plan: p }
  }, [inv, ventas, fechaObjetivo])

  const bajos = stockVivo.filter(s => s.bajo_minimo)
  const conConsumo = stockVivo.filter(s => s.consumido_hoy > 0).length

  // AUTOMATIZACIÓN VISIBLE: el sistema ya agrupó la orden por proveedor y dejó
  // el mensaje de WhatsApp listo para enviar. El líder solo aprueba y envía.
  const accionesAuto = useMemo(() => {
    if (!plan) return []
    const grupos = {}
    for (const i of plan.orden_compra) {
      const prov = i.proveedor
      if (!prov) continue
      const key = prov.proveedorId || prov.proveedor
      if (!grupos[key]) grupos[key] = { proveedor: prov.proveedor, contacto: prov.contacto, items: [], total: 0 }
      grupos[key].items.push(i)
      grupos[key].total += i.costo_estimado || 0
    }
    return Object.values(grupos).map(g => {
      const tel = (g.contacto?.telefono || g.contacto?.whatsapp || '').replace(/\D/g, '')
      const telE164 = tel ? (tel.startsWith('51') ? tel : `51${tel}`) : null
      const lineas = g.items.map(i => `• ${i.insumo}: ${i.comprar} ${i.unidad}`).join('\n')
      const texto = `Hola ${g.proveedor}, desde Pardos Chicken Miraflores queremos hacer un pedido para ${plan.fecha_objetivo}:\n${lineas}\n\nTotal aprox: S/ ${g.total.toFixed(2)}. Gracias.`
      return {
        ...g,
        total: Math.round(g.total * 100) / 100,
        waLink: telE164 ? `https://wa.me/${telE164}?text=${encodeURIComponent(texto)}` : null,
      }
    })
  }, [plan])

  const descargarPDF = () => {
    if (!plan) return
    const doc = new jsPDF()
    doc.setFontSize(18); doc.setTextColor(13, 148, 136)
    doc.text('Plan de Compras — Pardos Chicken', 14, 20)
    doc.setFontSize(11); doc.setTextColor(90)
    doc.text(`Para: ${plan.fecha_objetivo}`, 14, 28)
    if (plan.fecha_especial) doc.text(`Campana: ${plan.fecha_especial.nombre} (x${plan.factor_demanda})`, 14, 34)
    autoTable(doc, {
      startY: plan.fecha_especial ? 40 : 34,
      head: [['Insumo', 'Comprar', 'Proveedor', 'Contacto', 'Costo S/']],
      body: plan.orden_compra.map(i => [
        i.insumo, `${i.comprar} ${i.unidad}`, i.proveedor?.proveedor || 'Sin proveedor',
        i.proveedor?.contacto?.telefono || i.proveedor?.contacto?.whatsapp || '-',
        i.costo_estimado != null ? i.costo_estimado.toFixed(2) : '—',
      ]),
      theme: 'grid', headStyles: { fillColor: [13, 148, 136] }, styles: { fontSize: 9 },
    })
    const y = doc.lastAutoTable?.finalY || 40
    doc.setFontSize(12); doc.setTextColor(0)
    doc.text(`Total estimado: S/ ${plan.total_estimado.toFixed(2)}`, 14, y + 10)
    doc.save(`orden_compra_${plan.fecha_objetivo}.pdf`)
  }

  // ── estilos ──
  const wrap = { padding: 24, maxWidth: 1120, margin: '0 auto' }
  const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,.04)' }
  const btn = (activo) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10,
    border: `1px solid ${activo ? C.teal : C.line}`, background: activo ? C.teal : C.card,
    color: activo ? '#fff' : '#334155', fontWeight: 600, cursor: 'pointer', fontSize: 14, transition: 'all .15s',
  })
  const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.03em', color: C.slate, borderBottom: `2px solid ${C.line}`, whiteSpace: 'nowrap' }
  const td = { padding: '10px 12px', fontSize: 14, borderBottom: `1px solid #f1f5f9` }
  const badge = (bg, fg) => ({ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, display: 'inline-block' })

  // ── OCR ──
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setOcrLoading(true)
    setOcrResult(null)

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const { visionAgent } = await import('../../agents/VisionAgent')
      const res = await visionAgent._processInvoiceImage({ imageUrl: ev.target.result })
      setOcrResult(res)
      setOcrLoading(false)
      if (res.success) {
        cargar() // Recargar stock después de insertar
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div style={wrap}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{ background: C.tealSoft, padding: 12, borderRadius: 14, display: 'flex' }}>
          <Package size={28} color={C.teal} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 23, color: C.ink }}>Asistente de Almacén</h1>
          <p style={{ margin: '2px 0 0', color: C.slate, fontSize: 14 }}>
            Stock en vivo y compras — se actualiza solo con cada cobro. No necesitas registrar nada a mano.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 18 }}>
        <div style={card}>
          <p style={{ margin: 0, color: C.slate, fontSize: 13 }}>Insumos en catálogo</p>
          <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: C.ink }}>{stockVivo.length}</p>
        </div>
        <div style={{ ...card, borderColor: bajos.length ? '#fca5a5' : C.line, background: bajos.length ? C.redSoft : C.card }}>
          <p style={{ margin: 0, color: C.slate, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} color={bajos.length ? C.red : C.slate} /> Bajo el mínimo
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: bajos.length ? C.red : C.ink }}>{bajos.length}</p>
        </div>
        <div style={card}>
          <p style={{ margin: 0, color: C.slate, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingDown size={14} color={C.amber} /> Consumidos hoy
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: C.ink }}>{conConsumo}</p>
        </div>
        <div style={{ ...card, background: C.tealSoft, borderColor: '#99f6e4' }}>
          <p style={{ margin: 0, color: C.tealDark, fontSize: 13 }}>Compra sugerida</p>
          <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: C.tealDark }}>S/ {plan ? plan.total_estimado.toFixed(2) : '—'}</p>
        </div>
      </div>

      {/* ── SECCIÓN DE INGRESO OCR ── */}
      <div style={{ ...card, background: '#f8fafc', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Zap size={16} color={C.teal} /> <strong style={{ color: C.ink }}>Ingreso Automático (OCR)</strong>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: C.slate }}>
          Sube la foto de la guía de remisión o factura del proveedor. El sistema leerá los insumos y cantidades para actualizar el stock solo.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input type="file" accept="image/*" onChange={handleFileUpload} style={{ fontSize: 13 }} />
          {ocrLoading && <span style={{ color: C.teal, fontSize: 13, fontWeight: 'bold' }}>Procesando imagen con IA local (esto puede tardar unos segundos)...</span>}
        </div>
        {ocrResult && (
          <div style={{ marginTop: 12, padding: 10, background: ocrResult.success ? '#dcfce7' : '#fee2e2', borderRadius: 8, fontSize: 13 }}>
            <strong>{ocrResult.success ? '✅ OCR Exitoso: ' : '❌ Error: '}</strong> {ocrResult.message}
            {ocrResult.success && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {ocrResult.items.map((it, i) => <li key={i}>{it.cantidad} {it.unidad} de {it.nombre}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── ACCIÓN AUTOMÁTICA (se genera sola tras los cobros) ── */}
      {!cargando && bajos.length > 0 && accionesAuto.length > 0 && (
        <div style={{ ...card, border: '1px solid #99f6e4', background: 'linear-gradient(180deg,#f0fdfa,#ffffff)', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ background: C.teal, borderRadius: 8, padding: 5, display: 'flex' }}><Zap size={16} color="#fff" /></div>
            <strong style={{ fontSize: 15, color: C.tealDark }}>Acción automática del sistema</strong>
          </div>
          <p style={{ margin: '0 0 14px', color: C.slate, fontSize: 13.5, lineHeight: 1.5 }}>
            A partir de los cobros de hoy, el sistema detectó solo el bajo stock, calculó cuánto reponer,
            eligió el proveedor más barato y <strong>dejó el pedido listo</strong>. Solo revisa y envía:
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {accionesAuto.map((g, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                flexWrap: 'wrap', border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 14px', background: '#fff' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: C.ink, fontSize: 14 }}>{g.proveedor}</p>
                  <p style={{ margin: '2px 0 0', color: C.slate, fontSize: 13 }}>
                    {g.items.map(i => `${i.comprar} ${i.unidad} ${i.insumo}`).join(' · ')}
                  </p>
                </div>
                {g.waLink
                  ? <a href={g.waLink} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#25D366', color: '#fff',
                        padding: '9px 14px', borderRadius: 9, fontWeight: 700, fontSize: 13.5, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      <MessageCircle size={16} /> Enviar pedido por WhatsApp
                    </a>
                  : <span style={{ color: C.slate, fontSize: 13 }}>Sin WhatsApp registrado</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botones */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btn(vista === 'stock')} onClick={() => setVista('stock')}>
          <Package size={16} /> Ver stock actual
        </button>
        <button style={btn(vista === 'compras')} onClick={() => setVista('compras')}>
          <ShoppingCart size={16} /> ¿Qué debo comprar?
        </button>
        <button style={btn(false)} onClick={cargar}>
          <RefreshCw size={16} /> Actualizar
        </button>
        {vista === 'compras' && (
          <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.slate }}>
            Comprar para:
            <input type="date" value={fechaObjetivo} min={hoyISO()} onChange={e => setFechaObjetivo(e.target.value || mananaISO())}
              style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 14 }} />
          </label>
        )}
      </div>

      {cargando && <div style={{ ...card, color: C.slate }}>Cargando datos del almacén…</div>}

      {/* ── STOCK ── */}
      {!cargando && vista === 'stock' && (
        <div style={card}>
          {bajos.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.redSoft, color: '#b91c1c', padding: '12px 14px', borderRadius: 10, marginBottom: 14, fontSize: 14, fontWeight: 500 }}>
              <AlertTriangle size={18} /> {bajos.length} insumo(s) por debajo del mínimo: <strong>{bajos.map(b => b.nombre).join(', ')}</strong>. Revisa "¿Qué debo comprar?".
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', color: C.green, padding: '12px 14px', borderRadius: 10, marginBottom: 14, fontSize: 14 }}>
              <CheckCircle2 size={18} /> Todo el stock está por encima del mínimo.
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Insumo</th><th style={th}>Inicial</th><th style={th}>Consumido hoy</th>
                <th style={th}>Disponible</th><th style={th}>Mínimo</th><th style={th}>Estado</th>
              </tr></thead>
              <tbody>
                {stockVivo.map(s => (
                  <tr key={s.id} style={{ background: s.bajo_minimo ? C.amberSoft : 'transparent' }}>
                    <td style={{ ...td, fontWeight: 500, color: C.ink }}>{s.nombre}</td>
                    <td style={{ ...td, color: C.slate }}>{s.stock_inicial} {s.unidad}</td>
                    <td style={{ ...td, color: s.consumido_hoy > 0 ? C.amber : '#cbd5e1', fontWeight: s.consumido_hoy > 0 ? 600 : 400 }}>
                      {s.consumido_hoy > 0 ? `− ${s.consumido_hoy}` : '—'}
                    </td>
                    <td style={{ ...td, fontWeight: 800, color: C.ink }}>{s.stock_actual} {s.unidad}</td>
                    <td style={{ ...td, color: C.slate }}>{s.stock_minimo}</td>
                    <td style={td}>
                      {s.bajo_minimo
                        ? <span style={badge('#fee2e2', C.red)}>Reponer</span>
                        : <span style={badge('#dcfce7', C.green)}>OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── COMPRAS ── */}
      {!cargando && vista === 'compras' && plan && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.ink }}>Orden de compra para {plan.fecha_objetivo}</p>
              <p style={{ margin: '3px 0 0', color: C.slate, fontSize: 13 }}>
                {plan.fecha_especial ? <span style={{ color: C.teal, fontWeight: 600 }}>{plan.fecha_especial.nombre} · demanda ×{plan.factor_demanda} · </span> : ''}
                {plan.base_proyeccion}
              </p>
            </div>
            <button style={{ ...btn(false), borderColor: C.teal, color: C.teal }} onClick={descargarPDF} disabled={!plan.orden_compra.length}>
              <FileDown size={16} /> Descargar PDF
            </button>
          </div>

          {plan.orden_compra.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.green, fontSize: 15 }}>
              <CheckCircle2 size={18} /> El stock alcanza para {plan.fecha_objetivo}. No hay que comprar nada.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={th}>Insumo</th><th style={th}>Comprar</th><th style={th}>Proveedor</th>
                    <th style={th}>Contacto</th><th style={th}>Costo est.</th>
                  </tr></thead>
                  <tbody>
                    {plan.orden_compra.map(i => (
                      <tr key={i.supplyId}>
                        <td style={{ ...td, fontWeight: 500, color: C.ink }}>{i.insumo}</td>
                        <td style={{ ...td, fontWeight: 800, color: C.tealDark }}>{i.comprar} {i.unidad}</td>
                        <td style={td}>{i.proveedor?.proveedor || <span style={{ color: C.red }}>Sin proveedor</span>}</td>
                        <td style={td}>
                          {(i.proveedor?.contacto?.telefono || i.proveedor?.contacto?.whatsapp)
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.ink }}>
                                <Phone size={13} color={C.teal} /> {i.proveedor.contacto.telefono || i.proveedor.contacto.whatsapp}
                              </span>
                            : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ ...td, color: C.ink }}>{i.costo_estimado != null ? `S/ ${i.costo_estimado.toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr>
                    <td style={{ ...td, fontWeight: 700, color: C.ink }} colSpan={4}>Total estimado</td>
                    <td style={{ ...td, fontWeight: 800, color: C.tealDark }}>S/ {plan.total_estimado.toFixed(2)}</td>
                  </tr></tfoot>
                </table>
              </div>
              <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
                Precios referenciales de proveedores; confírmalos con tu lista negociada. El plan se calcula contra el
                stock disponible (ya descontado por los cobros de hoy) y elige el proveedor más barato registrado.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
