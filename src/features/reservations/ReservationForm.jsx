/**
 * src/features/reservations/ReservationForm.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Formulario de creación / edición de reservas.
 * Se puede usar dentro de un Modal o de forma independiente.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react'
import { Search, UserPlus, Plus, Trash2 } from 'lucide-react'
import { useClients } from '../../context/ClientContext'
import { useReservations } from '../../context/ReservationContext'
import { useAuth } from '../../context/AuthContext'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { MENU_ITEMS } from '../../domain/kitchen/menu'
// Importar las reglas de negocio del agente de reservas
import { validateBusinessHours } from '../../agents/ReservationAgent.js'
import toast from 'react-hot-toast'
import styles from './ReservationForm.module.css'


// Horarios disponibles para reservas internas (staff).
// Horario de atención: 11:00 AM – 10:00 PM. Última reserva a las 21:30.
const TIME_SLOTS = [
  '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
  '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30',
  '19:00','19:30','20:00','20:30','21:00','21:30',
]

const today = new Date().toISOString().split('T')[0]

const EMPTY_FORM = {
  clientId:    '',
  clientName:  '',
  clientPhone: '',
  clientEmail: '',
  date:        today,
  time:        '13:00',
  guests:      2,
  tableId:     '',
  occasion:    '',

  notes:       '',
  items:       [],
}

export default function ReservationForm({ initialData, onSubmit, onCancel }) {
  const { user } = useAuth()
  const { findByPhone, addClient } = useClients()
  const { tables } = useReservations()
  
  const isCreating = !initialData
  const canAddItems = user?.role === 'admin' 
    || user?.role === 'mozo'
    || ((user?.role === 'cajero' || user?.role === 'hostess') && isCreating)

  const [form,         setForm]      = useState(initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM)
  const [errors,       setErrors]    = useState({})
  const [phoneQuery,   setPhone]     = useState(initialData?.clientPhone || '')
  const [clientFound,  setFound]     = useState(!!initialData?.clientId)
  const [isSubmitting, setSubmit]    = useState(false)

  const [activeCategory, setActiveCategory] = useState('Todas')
  const [menuQuery,      setMenuQuery]      = useState('')

  const categories = [...new Set(MENU_ITEMS.map(m => m.category))]
  const orderTotal = (form.items || []).reduce((s, i) => s + (i.price * i.qty), 0)

  // Buscar cliente al escribir teléfono
  useEffect(() => {
    if (phoneQuery.length >= 9) {
      const client = findByPhone(phoneQuery)
      if (client) {
        setForm(f => ({
          ...f,
          clientId:    client.id,
          clientName:  client.name,
          clientPhone: client.phone,
          clientEmail: client.email || '',
        }))
        setFound(true)
        toast.success(`Cliente encontrado: ${client.name}`, { duration: 2000 })
      } else {
        setFound(false)
        setForm(f => ({ ...f, clientId: '', clientPhone: phoneQuery }))
      }
    }
  }, [phoneQuery, findByPhone])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: name === 'guests' ? Number(value) : value }))
    if (errors[name]) setErrors(e => ({ ...e, [name]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.clientName.trim()) e.clientName = 'Nombre del cliente requerido'
    if (!form.clientPhone.trim()) e.clientPhone = 'Teléfono requerido'
    if (!form.date) e.date = 'Fecha requerida'
    if (!form.time) e.time = 'Hora requerida'
    else {
      // Validar que la hora esté dentro del horario de atención (regla de negocio)
      const timeCheck = validateBusinessHours(form.time)
      if (!timeCheck.valid) e.time = timeCheck.error
    }
    if (!form.guests || form.guests < 1) e.guests = 'Mínimo 1 persona'
    if (form.guests > 20) e.guests = 'Máximo 20 personas por reserva'
    if (!form.tableId) e.tableId = 'Selecciona una mesa'
    // Validar capacidad de mesa
    if (form.tableId && availableTables.length > 0) {
      const mesa = availableTables.find(t => t.id === form.tableId)
      // Si la mesa seleccionada no está en availableTables, es porque la capacidad no alcanza
      if (!mesa) e.tableId = `La mesa seleccionada no tiene capacidad para ${form.guests} personas. Elige otra mesa.`
    }
    return e
  }

  const addOrderItem = (menuItem) => {
    setForm(prev => {
      const existingItems = prev.items || []
      const exists = existingItems.find(i => i.menuId === menuItem.id)
      if (exists) {
        return { ...prev, items: existingItems.map(i => i.menuId === menuItem.id ? { ...i, qty: i.qty + 1 } : i) }
      }
      return { ...prev, items: [...existingItems, { menuId: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1 }] }
    })
  }

  const updateQty = (menuId, delta) => {
    setForm(prev => ({
      ...prev,
      items: (prev.items || []).map(i => i.menuId === menuId ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    }))
  }

  const removeOrderItem = (menuId) => {
    setForm(prev => ({
      ...prev,
      items: (prev.items || []).filter(i => i.menuId !== menuId)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmit(true)
    await new Promise(r => setTimeout(r, 500))

    let clientId = form.clientId
    if (!clientId) {
      const newClient = addClient({
        name:  form.clientName,
        phone: form.clientPhone,
        email: form.clientEmail,
      })
      clientId = newClient.id
      toast.success('Nuevo cliente registrado automáticamente')
    }

    // Preserve items array correctly
    onSubmit({ ...form, clientId, items: form.items || [] })
    setSubmit(false)
    toast.success(initialData ? 'Reserva actualizada' : 'Reserva creada correctamente')
  }

  const availableTables = tables.filter(t => t.capacity >= form.guests)

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Datos del cliente</h3>

        <div className={styles.phoneSearch}>
          <Input
            label="Teléfono del cliente"
            id="res-phone"
            name="clientPhone"
            type="tel"
            placeholder="Ej: 987654321"
            value={phoneQuery}
            onChange={e => setPhone(e.target.value)}
            icon={<Search size={15} />}
            hint="Ingresa el teléfono para buscar cliente existente"
            required
            error={errors.clientPhone}
          />
          {clientFound && (
            <span className={styles.clientFoundBadge}>✓ Cliente encontrado</span>
          )}
          {phoneQuery.length >= 9 && !clientFound && (
            <span className={styles.newClientBadge}>
              <UserPlus size={12} /> Nuevo cliente — se registrará automáticamente
            </span>
          )}
        </div>

        <div className={styles.row2}>
          <Input
            label="Nombre completo"
            id="res-name"
            name="clientName"
            placeholder="Nombre del cliente"
            value={form.clientName}
            onChange={handleChange}
            error={errors.clientName}
            required
            disabled={clientFound}
          />
          <Input
            label="Correo (opcional)"
            id="res-email"
            name="clientEmail"
            type="email"
            placeholder="email@ejemplo.com"
            value={form.clientEmail}
            onChange={handleChange}
            disabled={clientFound}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Datos de la reserva</h3>

        <div className={styles.row3}>
          <Input
            label="Fecha"
            id="res-date"
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            error={errors.date}
            required
            min={today}
          />
          <Select
            label="Hora"
            id="res-time"
            name="time"
            value={form.time}
            onChange={handleChange}
            error={errors.time}
            required
          >
            {TIME_SLOTS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Input
            label="N° personas"
            id="res-guests"
            name="guests"
            type="number"
            min={1}
            max={20}
            value={form.guests}
            onChange={handleChange}
            error={errors.guests}
            required
          />
        </div>

        <div className={styles.row2}>
          <Select
            label="Mesa"
            id="res-table"
            name="tableId"
            value={form.tableId}
            onChange={handleChange}
            error={errors.tableId}
            required
          >
            <option value="">Seleccionar mesa...</option>
            {availableTables.map(t => (
              <option key={t.id} value={t.id}>
                Mesa {t.number} — {t.zone} (cap. {t.capacity})
              </option>
            ))}
          </Select>

          <Select
            label="Motivo (Opcional)"
            id="res-occasion"
            name="occasion"
            value={form.occasion || ''}
            onChange={handleChange}
          >
            <option value="">Ninguno</option>
            <option value="Cumpleaños">Cumpleaños 🎂</option>
            <option value="Aniversario">Aniversario 🥂</option>
            <option value="Negocios">Negocios 💼</option>
            <option value="Cita">Cita ❤️</option>
            <option value="Familiar">Familiar 👨‍👩‍👧</option>
            <option value="Otro">Otro especial...</option>
          </Select>
        </div>

        <Textarea
          label="Notas adicionales"
          id="res-notes"
          name="notes"
          placeholder="Preferencias, alergias, solicitudes especiales..."
          value={form.notes}
          onChange={handleChange}
        />
      </div>

      {/* Agregar Pedido (Opcional) */}
      {canAddItems && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Añadir Platos al Pedido (Opcional)</h3>
          <div className={styles.menuSection}>
            <div className={styles.menuAndOrder}>
              <div style={{display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                <div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
                  <Input
                    placeholder="Buscar plato..."
                    value={menuQuery}
                    onChange={e => setMenuQuery(e.target.value)}
                    icon={<Search size={14} />}
                  />
                  <Select value={activeCategory} onChange={e => setActiveCategory(e.target.value)}>
                    <option value="Todas">Todas las categorías</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className={styles.menuCategories}>
                  {categories.filter(c => activeCategory === 'Todas' || activeCategory === c).map(cat => {
                    const itemsOfCat = MENU_ITEMS.filter(m => m.category === cat && (!menuQuery || m.name.toLowerCase().includes(menuQuery.toLowerCase())))
                    if (itemsOfCat.length === 0) return null
                    return (
                      <div key={cat} className={styles.menuCat}>
                        <h4 className={styles.catTitle}>{cat}</h4>
                        {itemsOfCat.map(item => (
                          <button key={item.id} type="button"
                            className={styles.menuItemBtn}
                            onClick={() => addOrderItem(item)}>
                            <div className={styles.menuItemInfo}>
                              <span className={styles.menuItemName}>{item.name}</span>
                              <span className={styles.menuItemPrice}>S/ {item.price.toFixed(2)}</span>
                            </div>
                            <div className={styles.menuItemAdd}>
                              <Plus size={12} strokeWidth={3}/> Agregar
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className={styles.orderSide}>
                <p className={styles.menuTitle}>Pre-pedido de reserva</p>
                {!(form.items && form.items.length > 0) ? (
                  <div className={styles.orderEmpty}>Agrega platos del menú para armar el pedido</div>
                ) : (
                  <div className={styles.orderList}>
                    {form.items.map(item => (
                      <div key={item.menuId} className={styles.orderRow}>
                        <span className={styles.orderName}>{item.name}</span>
                        <div className={styles.orderQtyCtrl}>
                          <button type="button" onClick={() => updateQty(item.menuId, -1)}>−</button>
                          <span>{item.qty}</span>
                          <button type="button" onClick={() => updateQty(item.menuId, +1)}>+</button>
                        </div>
                        <span className={styles.orderPrice}>S/ {(item.price * item.qty).toFixed(2)}</span>
                        <button type="button" className={styles.removeBtn} onClick={() => removeOrderItem(item.menuId)}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '2px dashed var(--color-border-light)', display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '15px' }}>
                      <span>TOTAL</span>
                      <span>S/ {orderTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.formActions}>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {initialData ? 'Guardar cambios' : 'Crear reserva'}
        </Button>
      </div>
    </form>
  )
}
