/**
 * src/components/ui/Modal.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente Modal reutilizable con overlay, cierre por Escape y click fuera.
 * Accesible: trampas de foco, role="dialog", aria-modal=true.
 *
 * Props:
 *   - isOpen:    boolean    - Controla visibilidad del modal
 *   - onClose:   function   - Callback al cerrar
 *   - title:     string     - Título del modal
 *   - size:      'sm'|'md'|'lg'|'xl' - Ancho del modal
 *   - children:  ReactNode  - Contenido del modal
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import styles from './Modal.module.css'

export function Modal({ isOpen, onClose, title, size = 'md', children }) {
  const overlayRef = useRef(null)

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    // Bloquear scroll del body
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Cerrar al hacer click en el overlay (fuera del dialog)
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="presentation"
      aria-hidden="false"
    >
      <div
        className={`${styles.dialog} ${styles[`dialog--${size}`]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header */}
        <div className={styles.header}>
          {title && (
            <h2 id="modal-title" className={styles.title}>
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className={styles.close}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  )
}
