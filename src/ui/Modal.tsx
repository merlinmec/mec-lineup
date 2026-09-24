import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  /** Largura máxima em px. Via style porque max-w-* conflitantes no className não se sobrepõem de forma previsível. */
  maxWidth?: number
}

export function Modal({ open, onClose, title, children, footer, className, maxWidth = 512 }: Props) {
  useEffect(() => {
    if (!open) return
    // captura + stopImmediatePropagation: o Esc fecha só o modal, não a tela por trás
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center p-6">
          <motion.div
            className="absolute inset-0 bg-[#03070a]/75 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]',
              className,
            )}
            style={{ maxWidth }}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-panel-2 hover:text-text"
              >
                <X size={18} />
              </button>
            </header>
            <div className="overflow-y-auto px-5 py-5">{children}</div>
            {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
