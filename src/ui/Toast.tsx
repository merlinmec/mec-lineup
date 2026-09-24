import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Kind = 'ok' | 'erro'
interface ToastItem {
  id: number
  kind: Kind
  text: string
}

const ToastContext = createContext<(text: string, kind?: Kind) => void>(() => {})

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((text: string, kind: Kind = 'ok') => {
    const id = ++seq
    setItems((prev) => [...prev, { id, kind, text }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2">
          <AnimatePresence>
            {items.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-panel-2/95 px-4 py-2.5 text-sm shadow-2xl backdrop-blur"
                role="status"
              >
                {t.kind === 'ok' ? (
                  <CheckCircle2 size={16} className="text-accent" />
                ) : (
                  <AlertTriangle size={16} className="text-danger" />
                )}
                {t.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
