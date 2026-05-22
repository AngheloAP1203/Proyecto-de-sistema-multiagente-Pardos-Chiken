/**
 * src/features/settings/SettingsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de configuración del sistema (solo Administrador / Líder).
 * Incluye:
 *   - Gestión completa del menú (CRUD de platos) ← NUEVA
 *   - Usuarios del sistema y sus roles
 *   - Tabla de permisos por rol
 *   - Información del sistema
 *
 * Acceso: Solo Administrador
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { Settings, User, Shield, Plus, Edit2, Trash2, ChefHat, X, Check, Tag } from 'lucide-react'
import { MOCK_USERS, ROLE_PERMISSIONS } from '../../context/AuthContext'
import { useMenu } from '../../context/MenuContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import toast from 'react-hot-toast'
import styles from './SettingsPage.module.css'

const EMPTY_DISH = { name: '', category: '', price: '' }

const CATEGORY_OPTIONS = [
  'Aperitivos', 'Piqueos', 'Carnívoros', 'Pardos Brasa',
  'Pardos Parrillero', 'Sabor con Esquina', 'Especiales',
  'Ensaladas', 'Postres', 'Bebidas',
]

// ── Sub-componente: Gestión del Menú ─────────────────────────────────────────
function MenuManager() {
  const { menuItems, categories, addMenuItem, updateMenuItem, deleteMenuItem } = useMenu()

  const [isModalOpen, setModalOpen] = useState(false)
  const [editItem,    setEditItem]  = useState(null)
  const [form,        setForm]      = useState(EMPTY_DISH)
  const [errors,      setErrors]    = useState({})
  const [filterCat,   setFilterCat] = useState('Todas')
  const [newCategory, setNewCategory] = useState('')

  const displayed = filterCat === 'Todas'
    ? menuItems
    : menuItems.filter(m => m.category === filterCat)

  const openCreate = () => {
    setEditItem(null)
    setForm(EMPTY_DISH)
    setNewCategory('')
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({ name: item.name, category: item.category, price: String(item.price) })
    setNewCategory('')
    setErrors({})
    setModalOpen(true)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(e => ({ ...e, [name]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())       e.name     = 'Nombre requerido'
    const finalCat = form.category === '__new__' ? newCategory.trim() : form.category
    if (!finalCat)               e.category = 'Categoría requerida'
    const p = parseFloat(form.price)
    if (!form.price || isNaN(p) || p <= 0) e.price = 'Precio válido requerido'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const finalCat = form.category === '__new__' ? newCategory.trim() : form.category
    const data = { name: form.name.trim(), category: finalCat, price: parseFloat(parseFloat(form.price).toFixed(2)) }

    if (editItem) {
      updateMenuItem(editItem.id, data)
    } else {
      addMenuItem(data)
    }
    setModalOpen(false)
  }

  const handleDelete = (item) => {
    if (window.confirm(`¿Eliminar "${item.name}" del menú? Esta acción no se puede deshacer.`)) {
      deleteMenuItem(item.id)
    }
  }

  const allCategories = ['Todas', ...new Set([...CATEGORY_OPTIONS, ...categories]).values()]

  return (
    <Card
      title="Gestión del Menú"
      subtitle={`${menuItems.length} platos en el menú · ${categories.length} categorías`}
    >
      {/* Filtros + botón nuevo */}
      <div className={styles.menuToolbar}>
        <div className={styles.menuCatTabs}>
          {allCategories.map(cat => (
            <button
              key={cat}
              className={`${styles.catTab} ${filterCat === cat ? styles.catTabActive : ''}`}
              onClick={() => setFilterCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate} id="btn-nuevo-plato">
          Nuevo plato
        </Button>
      </div>

      {/* Grid de platos */}
      {displayed.length === 0 ? (
        <div className={styles.menuEmpty}>
          <ChefHat size={40} />
          <p>No hay platos en esta categoría</p>
        </div>
      ) : (
        <div className={styles.menuGrid}>
          {displayed.map(item => (
            <div key={item.id} className={styles.dishCard}>
              <div className={styles.dishIcon}>🍽️</div>
              <div className={styles.dishInfo}>
                <span className={styles.dishName}>{item.name}</span>
                <span className={styles.dishCat}>
                  <Tag size={10} />
                  {item.category}
                </span>
              </div>
              <span className={styles.dishPrice}>S/ {item.price.toFixed(2)}</span>
              <div className={styles.dishActions}>
                <button
                  className={styles.dishBtn}
                  title="Editar plato"
                  onClick={() => openEdit(item)}
                  id={`btn-edit-dish-${item.id}`}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  className={`${styles.dishBtn} ${styles.dishBtnDanger}`}
                  title="Eliminar plato"
                  onClick={() => handleDelete(item)}
                  id={`btn-del-dish-${item.id}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar plato */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Editar Plato' : 'Nuevo Plato'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className={styles.dishForm} noValidate>
          <Input
            label="Nombre del plato"
            name="name"
            id="dish-name"
            placeholder="Ej: 1/2 Pardos Brasa"
            value={form.name}
            onChange={handleChange}
            error={errors.name}
            required
          />

          <div>
            <Select
              label="Categoría"
              name="category"
              id="dish-category"
              value={form.category}
              onChange={handleChange}
              error={errors.category}
              required
            >
              <option value="">-- Seleccionar categoría --</option>
              {[...new Set([...CATEGORY_OPTIONS, ...categories])].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new__">+ Nueva categoría...</option>
            </Select>

            {form.category === '__new__' && (
              <Input
                placeholder="Nombre de la nueva categoría"
                id="dish-new-cat"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                error={errors.category}
                style={{ marginTop: 8 }}
              />
            )}
          </div>

          <Input
            label="Precio (S/)"
            name="price"
            id="dish-price"
            type="number"
            min="0"
            step="0.10"
            placeholder="0.00"
            value={form.price}
            onChange={handleChange}
            error={errors.price}
            required
          />

          <div className={styles.formActions}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" icon={<Check size={15} />}>
              {editItem ? 'Guardar cambios' : 'Agregar plato'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Configuración</h1>
        <p className={styles.subtitle}>Panel de administración del sistema — Líder del Restaurante</p>
      </div>

      {/* ── Gestión del Menú (nueva sección) */}
      <MenuManager />

      {/* Usuarios del sistema */}
      <Card title="Usuarios del sistema" subtitle="Cuentas activas y roles asignados">
        <div className={styles.userList}>
          {MOCK_USERS.map(u => {
            const role = ROLE_PERMISSIONS[u.role]
            return (
              <div key={u.id} className={styles.userRow}>
                <div className={styles.userAvatar} style={{ background: role.color + '22', color: role.color }}>
                  {u.avatar}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{u.name}</span>
                  <span className={styles.userEmail}>{u.email}</span>
                </div>
                <span className={styles.roleBadge} style={{ background: role.color + '22', color: role.color }}>
                  <Shield size={12} />
                  {role.label}
                </span>
                <span className={styles.sucursal}>{u.sucursal}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Permisos por rol */}
      <Card title="Permisos por rol" subtitle="Resumen de acceso de cada rol">
        <div className={styles.permTable}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Permiso</th>
                {Object.keys(ROLE_PERMISSIONS).map(role => (
                  <th key={role} style={{ color: ROLE_PERMISSIONS[role].color }}>
                    {ROLE_PERMISSIONS[role].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Gestionar reservas',      'canManageReservations'],
                ['Ver todas las reservas',  'canViewAllReservations'],
                ['Cancelar reservas',       'canCancelAnyReservation'],
                ['Gestionar clientes',      'canManageClients'],
                ['Gestionar mesas',         'canManageTables'],
                ['Ver reportes',            'canViewReports'],
                ['Módulo de Caja',          'canManageCash'],
                ['Panel de Cocina',         'canManageKitchenOrders'],
                ['Ver analíticas/ingresos', 'canViewIncomesChart'],
                ['Gestionar usuarios',      'canManageUsers'],
                ['Exportar datos',          'canExportData'],
                ['Configurar sistema',      'canConfigureSystem'],
              ].map(([label, key]) => (
                <tr key={key}>
                  <td className={styles.permLabel}>{label}</td>
                  {Object.keys(ROLE_PERMISSIONS).map(role => (
                    <td key={role} className={styles.permCell}>
                      {ROLE_PERMISSIONS[role][key] ? (
                        <span className={styles.permYes}>✓</span>
                      ) : (
                        <span className={styles.permNo}>✗</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Info del sistema */}
      <Card title="Información del sistema">
        <div className={styles.sysInfo}>
          <div className={styles.sysRow}>
            <span>Versión</span>
            <strong>1.0.0</strong>
          </div>
          <div className={styles.sysRow}>
            <span>Sucursal activa</span>
            <strong>Miraflores</strong>
          </div>
          <div className={styles.sysRow}>
            <span>Tecnología</span>
            <strong>React + Vite</strong>
          </div>
          <div className={styles.sysRow}>
            <span>Almacenamiento</span>
            <strong>LocalStorage (demo)</strong>
          </div>
        </div>
      </Card>
    </div>
  )
}
