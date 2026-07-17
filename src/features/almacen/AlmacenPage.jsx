/**
 * src/features/almacen/AlmacenPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Asistente del Líder de Almacén (M7) — panel por botones, no chatbot.
 *
 * Todo es REAL y derivado de datos de Supabase:
 *   · Stock inicial del día  → tabla `supplies`
 *   · Consumo del día        → pagos COBRADOS (payments) explotados por receta
 *   · Stock disponible       → inicial − consumo (pollo redondeado a piezas enteras)
 *   · Qué comprar            → proyección de mañana vs. stock disponible
 *
 * El líder no registra nada a mano: abre la página y ve cuánto queda y qué pedir.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Package, ShoppingCart, RefreshCw, AlertTriangle, FileDown, Phone } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useCash } from '../../context/CashContext'
import { loadInventoryData } from '../../data/api/inventoryApi'
import { planificarCompras, calcularConsumoDia, aplicarStockVivo } from '../../domain/inventory/purchasePlanner'

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const mananaISO = () => {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AlmacenPage() {
  const { payments } = useCash()
  const [inv, setInv] = useState(null)          // { supplies, recipes, suppliers }
  const [vista, setVista] = useState('stock')   // 'stock' | 'compras'
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const data = await loadInventoryData()
    setInv(data)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Ventas reales derivadas de los cobros (payments de Supabase).
  const ventas = useMemo(() => {
    const out = []
    for (const p of payments || []) {
      for (const it of p.items || []) {
        const menuId = it.menuId || it.itemId
        if (!menuId) continue
        out.push({ fecha: p.date, menuId, qty: Number(it.qty) || 0 })
      }
    }
    return out
  }, [payments])

  const { stockVivo, consumoHoy, plan } = useMemo(() => {
    if (!inv) return { stockVivo: [], consumoHoy: {}, plan: null }
    const hoy = hoyISO()
    const ventasHoy = ventas.filter(v => v.fecha === hoy)
    const consumo = calcularConsumoDia(ventasHoy, inv.recipes, inv.supplies)
    const vivo = aplicarStockVivo(inv.supplies, consumo)
    // "Qué comprar mañana": proyección vs. stock DISPONIBLE (ya descontado).
    const p = planificarCompras({
      historico: ventas,
      fechaObjetivo: mananaISO(),
      recetas: inv.recipes,
      supplies: vivo,
      suppliers: inv.suppliers,
    })
    return { stockVivo: vivo, consumoHoy: consumo, plan: p }
  }, [inv, ventas])

  const bajos = stockVivo.filter(s => s.bajo_minimo)

  const descargarPDF = () => {
    if (!plan) return
    const doc = new jsPDF()
    doc.setFontSize(18); doc.setTextColor(232, 69, 60)
    doc.text('Plan de Compras — Pardos Chicken', 14, 20)
    doc.setFontSize(11); doc.setTextColor(90)
    doc.text(`Para: ${plan.fecha_objetivo}`, 14, 28)
    if (plan.fecha_especial) doc.text(`Campaña: ${plan.fecha_especial.nombre} (x${plan.factor_demanda})`, 14, 34)
    autoTable(doc, {
      startY: plan.fecha_especial ? 40 : 34,
      head: [['Insumo', 'Comprar', 'Proveedor', 'Contacto', 'Costo S/']],
      body: plan.orden_compra.map(i => [
        i.insumo, `${i.comprar} ${i.unidad}`,
        i.proveedor?.proveedor || 'Sin proveedor',
        i.proveedor?.contacto?.telefono || i.proveedor?.contacto?.whatsapp || '-',
        i.costo_estimado != null ? i.costo_estimado.toFixed(2) : '—',
      ]),
      theme: 'grid', headStyles: { fillColor: [232, 69, 60] }, styles: { fontSize: 9 },
    })
    const y = doc.lastAutoTable?.finalY || 40
    doc.setFontSize(12); doc.setTextColor(0)
    doc.text(`Total estimado: S/ ${plan.total_estimado.toFixed(2)}`, 14, y + 10)
    doc.save(`orden_compra_${plan.fecha_objetivo}.pdf`)
  }

  const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }
  const btn = (activo) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10,
    border: '1px solid ' + (activo ? '#0d9488' : '#e2e8f0'), background: activo ? '#0d9488' : '#fff',
    color: activo ? '#fff' : '#334155', fontWeight: 600, cursor: 'pointer', fontSize: 14,
  })
  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#64748b', borderBottom: '2px solid #e2e8f0' }
  const td = { padding: '8px 10px', fontSize: 14, borderBottom: '1px solid #f1f5f9' }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{ background: '#ccfbf1', padding: 10, borderRadius: 12, display: 'flex' }}>
          <Package size={26} color="#0d9488" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>Asistente de Almacén</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            Stock en vivo y plan de compras — derivado de los cobros reales del día
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, margin: '16px 0' }}>
        <div style={card}>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Insumos en catálogo</p>
          <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 700 }}>{stockVivo.length}</p>
        </div>
        <div style={{ ...card, borderColor: bajos.length ? '#fca5a5' : '#e2e8f0' }}>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Bajo el mínimo</p>
          <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 700, color: bajos.length ? '#dc2626' : '#0f172a' }}>{bajos.length}</p>
        </div>
        <div style={card}>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Orden sugerida (mañana)</p>
          <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 700 }}>S/ {plan ? plan.total_estimado.toFixed(2) : '—'}</p>
        </div>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button style={btn(vista === 'stock')} onClick={() => setVista('stock')}>
          <Package size={16} /> Ver stock actual
        </button>
        <button style={btn(vista === 'compras')} onClick={() => setVista('compras')}>
          <ShoppingCart size={16} /> ¿Qué debo comprar?
        </button>
        <button style={btn(false)} onClick={cargar}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {cargando && <p style={{ color: '#64748b' }}>Cargando datos del almacén…</p>}

      {/* Vista STOCK */}
      {!cargando && vista === 'stock' && (
        <div style={card}>
          {bajos.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', color: '#b91c1c',
              padding: '10px 12px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
              <AlertTriangle size={16} /> {bajos.length} insumo(s) por debajo del mínimo — revisa el plan de compras.
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Insumo</th><th style={th}>Inicial hoy</th><th style={th}>Consumido</th>
                <th style={th}>Disponible</th><th style={th}>Mínimo</th><th style={th}>Estado</th>
              </tr></thead>
              <tbody>
                {stockVivo.map(s => (
                  <tr key={s.id} style={{ background: s.bajo_minimo ? '#fff7ed' : 'transparent' }}>
                    <td style={td}>{s.nombre}</td>
                    <td style={td}>{s.stock_inicial} {s.unidad}</td>
                    <td style={{ ...td, color: s.consumido_hoy > 0 ? '#b45309' : '#94a3b8' }}>
                      {s.consumido_hoy > 0 ? `−${s.consumido_hoy}` : '0'}
                    </td>
                    <td style={{ ...td, fontWeight: 700 }}>{s.stock_actual} {s.unidad}</td>
                    <td style={td}>{s.stock_minimo}</td>
                    <td style={td}>
                      {s.bajo_minimo
                        ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Reponer</span>
                        : <span style={{ color: '#16a34a' }}>OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vista COMPRAS */}
      {!cargando && vista === 'compras' && plan && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Orden de compra para {plan.fecha_objetivo}</p>
              <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 13 }}>
                {plan.fecha_especial ? `${plan.fecha_especial.nombre} · demanda x${plan.factor_demanda} · ` : ''}
                base: {plan.base_proyeccion}
              </p>
            </div>
            <button style={btn(false)} onClick={descargarPDF} disabled={!plan.orden_compra.length}>
              <FileDown size={16} /> Descargar PDF
            </button>
          </div>

          {plan.orden_compra.length === 0 ? (
            <p style={{ color: '#16a34a' }}>El stock alcanza para mañana. No hay que comprar nada.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Insumo</th><th style={th}>Comprar</th><th style={th}>Proveedor</th>
                  <th style={th}>Contacto</th><th style={th}>Costo est.</th>
                </tr></thead>
                <tbody>
                  {plan.orden_compra.map(i => (
                    <tr key={i.supplyId}>
                      <td style={td}>{i.insumo}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{i.comprar} {i.unidad}</td>
                      <td style={td}>{i.proveedor?.proveedor || <span style={{ color: '#dc2626' }}>Sin proveedor</span>}</td>
                      <td style={td}>
                        {i.proveedor?.contacto?.telefono || i.proveedor?.contacto?.whatsapp
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Phone size={13} /> {i.proveedor.contacto.telefono || i.proveedor.contacto.whatsapp}
                            </span>
                          : '—'}
                      </td>
                      <td style={td}>{i.costo_estimado != null ? `S/ ${i.costo_estimado.toFixed(2)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr>
                  <td style={{ ...td, fontWeight: 700 }} colSpan={4}>Total estimado</td>
                  <td style={{ ...td, fontWeight: 700 }}>S/ {plan.total_estimado.toFixed(2)}</td>
                </tr></tfoot>
              </table>
            </div>
          )}
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 12 }}>
            Precios referenciales de proveedores; confirmar con la lista negociada. El plan se calcula
            contra el stock disponible (ya descontado por los cobros de hoy).
          </p>
        </div>
      )}
    </div>
  )
}
