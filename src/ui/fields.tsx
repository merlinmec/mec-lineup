import { useEffect, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

/**
 * Campo com estado local que grava com debounce. Ligar o input direto no
 * useLiveQuery faz o cursor pular, porque o valor volta do banco atrasado.
 */
function useCommitted(value: string, onCommit: (v: string) => void, delay = 350) {
  const [local, setLocal] = useState(value)
  const focused = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<string | null>(null)
  const commit = useRef(onCommit)
  commit.current = onCommit

  const flush = () => {
    clearTimeout(timer.current)
    if (pending.current !== null) commit.current(pending.current)
    pending.current = null
  }

  useEffect(() => {
    if (!focused.current) setLocal(value)
  }, [value])

  // trocar de marcador desmonta o editor: grava o que ainda estava no debounce
  useEffect(() => flush, [])

  return {
    value: local,
    onChange: (v: string) => {
      setLocal(v)
      pending.current = v
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false
      flush()
    },
  }
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onCommit: (v: string) => void
}

export function CommitInput({ value, onCommit, ...rest }: InputProps) {
  const f = useCommitted(value, onCommit)
  return <input className="field" {...rest} value={f.value} onChange={(e) => f.onChange(e.target.value)} onFocus={f.onFocus} onBlur={f.onBlur} />
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onCommit: (v: string) => void
}

export function CommitTextarea({ value, onCommit, ...rest }: TextareaProps) {
  const f = useCommitted(value, onCommit)
  return (
    <textarea
      className="field resize-none"
      {...rest}
      value={f.value}
      onChange={(e) => f.onChange(e.target.value)}
      onFocus={f.onFocus}
      onBlur={f.onBlur}
    />
  )
}
