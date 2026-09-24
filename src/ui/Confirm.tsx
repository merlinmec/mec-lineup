import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' (padrão) pra exclusões; 'primary' quando confirmar é a ação segura. */
  tone?: 'danger' | 'primary'
}

/** true = confirmou, false = clicou em cancelar, null = fechou sem escolher (Esc, X, fora). */
type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean | null>

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(null))

/** `await confirm({...})` no lugar do window.confirm, que trava a aba e é feio. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean | null) => void>(undefined)

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o)
    return new Promise((resolve) => (resolver.current = resolve))
  }, [])

  const close = (value: boolean | null) => {
    resolver.current?.(value)
    setOpts(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => close(null)}
        title={opts?.title ?? ''}
        maxWidth={448}
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              {opts?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button variant={opts?.tone ?? 'danger'} onClick={() => close(true)} autoFocus>
              {opts?.confirmLabel ?? 'Excluir'}
            </Button>
          </>
        }
      >
        <div className="text-sm leading-relaxed text-muted">{opts?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
