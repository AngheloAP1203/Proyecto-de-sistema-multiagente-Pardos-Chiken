/**
 * src/features/clients/ClientsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de gestión de clientes del restaurante.
 * Permite:
 *   - Listar y buscar todos los clientes registrados
 *   - Ver perfil con historial de visitas y preferencias
 *   - Registrar nuevo cliente manualmente
 *   - Editar datos de cliente existente
 *   - Marcar/desmarcar como VIP
 *
 * Clientes se recuerdan automáticamente en futuras reservas al buscar por teléfono.
 * Acceso: Administrador, Cajero, Hostess
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { Plus, Search, Users, Star, Phone, Mail, Edit2, Crown, Trash2 } from 'lucide-react'
import { useClients } from '../../context/ClientContext'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Input, Textarea } from '../../components/ui/Input'
import toast from 'react-hot-toast'
import styles from './ClientsPage.module.css'

// Formulario vacío
const EMPTY = {
  name: '', phone: '', email: '', dni: '',
  birthday: '', preferences: '', allergies: '', notes: '',
}

export default function ClientsPage() {
  const { clients, addClient, updateClient, searchClients, deleteClient } = useClients()
  const { user, hasPermission } = useAuth()
  const canDeleteClients = hasPermission('canDeleteClients')
  const canEditClients   = hasPermission('canManageClients')

  const [query,      setQuery]   = useState('')
  const [isOpen,     setOpen]    = useState(false)
  const [editClient, setEdit]    = useState(null)
  const [form,       setForm]    = useState(EMPTY)
  const [errors,     setErrors]  = useState({})
  const [vipOnly,    setVipOnly] = useState(false)

  const displayed = (query.length >= 2 ? searchClients(query) : clients)
    .filter(c => !vipOnly || c.vip)
    .sort((a, b) => (b.totalVisits || 0) - (a.totalVisits || 0))

  const openCreate = () => {
    setEdit(null)
    setForm(EMPTY)
    setErrors({})
    setOpen(true)
  }

  const openEdit = (client) => {
    setEdit(client)
    setForm({
      name: client.name, phone: client.phone, email: client.email || '',
      dni: client.dni || '', birthday: client.birthday || '',
      preferences: client.preferences || '', allergies: client.allergies || '',
      notes: client.notes || '',
    })
    setErrors({})
    setOpen(true)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(e => ({ ...e, [name]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name  = 'Nombre requerido'
    if (!form.phone.trim()) e.phone = 'Teléfono requerido'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (editClient) {
      updateClient(editClient.id, form)
      toast.success('Cliente actualizado')
    } else {
      addClient(form)
      toast.success('Cliente registrado')
    }
    setOpen(false)
  }

  const toggleVip = (client) => {
    updateClient(client.id, { vip: !client.vip })
    toast.success(client.vip ? 'Cliente removido de VIP' : '⭐ Cliente marcado como VIP')
  }

  const handleDelete = (id) => {
    if (window.confirm('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) {
      deleteClient(id)
      toast.success('Cliente eliminado permanentemente')
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Clientes</h1>
          <p className={styles.subtitle}>{clients.length} clientes registrados</p>
        </div>
        {hasPermission('canManageClients') && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate} id="btn-nuevo-cliente">
            Nuevo Cliente
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card noPadding>
        <div className={styles.filterBar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="search"
              placeholder="Buscar por nombre, teléfono, email o DNI..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className={styles.searchInput}
              id="buscar-cliente"
            />
          </div>
          <button
            className={`${styles.vipBtn} ${vipOnly ? styles.vipActive : ''}`}
            onClick={() => setVipOnly(v => !v)}
          >
            <Crown size={14} />
            Solo VIP
          </button>
        </div>
      </Card>

      {/* Grid de clientes */}
      {displayed.length === 0 ? (
        <div className={styles.empty}>
          <Users size={48} />
          <h3>No hay clientes</h3>
          <p>No se encontraron clientes con esa búsqueda.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {displayed.map(client => (
            <div key={client.id} className={`${styles.clientCard} ${client.vip ? styles.vipCard : ''}`}>
              {/* Avatar */}
              <div className={styles.cardTop}>
                <div className={styles.avatar}>
                  {client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className={styles.clientMeta}>
                  <h3 className={styles.clientName}>
                    {client.name}
                    {client.vip && <Crown size={14} className={styles.vipIcon} />}
                  </h3>
                  <span className={styles.visits}>
                    {client.totalVisits || 0} visita{client.totalVisits !== 1 ? 's' : ''}
                  </span>
                </div>
                {canEditClients && (
                  <button
                    className={`${styles.starBtn} ${client.vip ? styles.starActive : ''}`}
                    onClick={() => toggleVip(client)}
                    title={client.vip ? 'Quitar VIP' : 'Marcar VIP'}
                  >
                    <Star size={16} />
                  </button>
                )}
              </div>

              {/* Info */}
              <div className={styles.clientInfo}>
                {client.phone && (
                  <div className={styles.infoRow}>
                    <Phone size={13} />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.email && (
                  <div className={styles.infoRow}>
                    <Mail size={13} />
                    <span>{client.email}</span>
                  </div>
                )}
                {client.preferences && (
                  <p className={styles.pref}>{client.preferences}</p>
                )}
                {client.allergies && client.allergies !== 'Ninguna' && (
                  <p className={styles.allergy}>⚠️ Alergia: {client.allergies}</p>
                )}
              </div>

              {/* Footer */}
              <div className={styles.cardFooter}>
                <span className={styles.lastVisit}>
                  Última visita: {client.lastVisit || 'Sin visitas'}
                </span>
                <div style={{display: 'flex', gap: '4px'}}>
                  {canEditClients && (
                    <button className={styles.editBtn} onClick={() => openEdit(client)} title="Editar cliente">
                      <Edit2 size={14} />
                    </button>
                  )}
                  {canDeleteClients && (
                    <button className={styles.editBtn} style={{color: 'var(--color-danger)'}} onClick={() => handleDelete(client.id)} title="Eliminar cliente">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulario */}
      <Modal isOpen={isOpen} onClose={() => setOpen(false)} title={editClient ? 'Editar Cliente' : 'Nuevo Cliente'} size="md">
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.row2}>
            <Input label="Nombre completo" name="name" id="cli-name" placeholder="Nombre del cliente"
              value={form.name} onChange={handleChange} error={errors.name} required />
            <Input label="Teléfono" name="phone" id="cli-phone" type="tel" placeholder="987654321"
              value={form.phone} onChange={handleChange} error={errors.phone} required />
          </div>
          <div className={styles.row2}>
            <Input label="Correo electrónico" name="email" id="cli-email" type="email"
              placeholder="cliente@email.com" value={form.email} onChange={handleChange} />
            <Input label="DNI" name="dni" id="cli-dni" placeholder="12345678"
              value={form.dni} onChange={handleChange} />
          </div>
          <div className={styles.row2}>
            <Input label="Fecha de cumpleaños" name="birthday" id="cli-birthday" type="date"
              value={form.birthday} onChange={handleChange} />
            <Input label="Alergias" name="allergies" id="cli-allergies" placeholder="Ej: Mariscos, Gluten"
              value={form.allergies} onChange={handleChange} />
          </div>
          <Input label="Preferencias" name="preferences" id="cli-pref"
            placeholder="Mesa favorita, preferencias de servicio..."
            value={form.preferences} onChange={handleChange} />
          <Textarea label="Notas adicionales" name="notes" id="cli-notes"
            placeholder="Información extra sobre el cliente..."
            value={form.notes} onChange={handleChange} />
          <div className={styles.formActions}>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">
              {editClient ? 'Guardar cambios' : 'Registrar cliente'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
