import { ImagePlus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ImageSource } from '../db/types'
import { compressImage } from '../lib/images'
import { cn } from './cn'
import { Img } from './Img'

interface Props {
  label: string
  hint?: string
  value: ImageSource | Blob | undefined
  onChange: (blob: Blob | undefined) => void
  /** Mostra "restaurar padrão" quando existe uma URL padrão por baixo do Blob. */
  onReset?: () => void
  aspect?: string
  fit?: 'cover' | 'contain'
  maxSize?: number
  /** Troca o <Img> padrão (ex: print com marcações desenhadas por cima). */
  renderImage?: () => ReactNode
  /** Ação extra no rodapé do campo (ex: "Marcar referência"). */
  footer?: ReactNode
}

/**
 * Aceita clique, arrastar-e-soltar e Ctrl+V com o mouse em cima. O Ctrl+V é
 * o caminho mais rápido pra prints: Win+Shift+S no jogo e cola direto aqui.
 */
export function ImageDrop({ label, hint, value, onChange, onReset, aspect = '16/9', fit = 'cover', maxSize, renderImage, footer }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const hasImage = value instanceof Blob ? true : !!(value?.blob || value?.url)
  const canReset = !!onReset && !(value instanceof Blob) && !!value?.blob

  const hovered = useRef(false)
  const zone = useRef<HTMLDivElement>(null)

  const accept = async (file: Blob | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    setBusy(true)
    try {
      onChange(await compressImage(file, maxSize))
    } finally {
      setBusy(false)
    }
  }
  const acceptRef = useRef(accept)
  acceptRef.current = accept

  // Listener global: colar com o mouse em cima funciona sem precisar clicar antes.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!hovered.current && document.activeElement !== zone.current) return
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      if (!item) return
      e.preventDefault()
      acceptRef.current(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  return (
    <div>
      <span className="label">{label}</span>
      <div
        ref={zone}
        tabIndex={0}
        role="button"
        aria-label={`${label}: clique, arraste ou cole uma imagem`}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onMouseEnter={() => (hovered.current = true)}
        onMouseLeave={() => (hovered.current = false)}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          accept(e.dataTransfer.files[0])
        }}
        style={{ aspectRatio: aspect }}
        className={cn(
          'group relative w-full cursor-pointer overflow-hidden rounded-xl border border-dashed transition-[border-color,background] duration-150',
          dragging ? 'border-accent bg-accent/10' : 'border-line-2 bg-bg-2 hover:border-accent/60 focus:border-accent',
          'outline-none',
        )}
      >
        {hasImage && renderImage && <div className="absolute inset-0 grid place-items-center bg-black/40">{renderImage()}</div>}
        {hasImage && !renderImage && (
          <Img
            source={value}
            alt=""
            className={cn('absolute inset-0 size-full', fit === 'cover' ? 'object-cover' : 'object-contain p-3')}
          />
        )}
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center transition-opacity duration-150',
            hasImage ? 'bg-bg/70 opacity-0 group-hover:opacity-100 group-focus:opacity-100' : 'opacity-100',
          )}
        >
          <ImagePlus size={20} className={busy ? 'animate-pulse text-accent' : 'text-muted'} />
          <span className="text-xs font-medium text-text">{busy ? 'Processando…' : hasImage ? 'Trocar imagem' : 'Adicionar imagem'}</span>
          <span className="text-[11px] text-faint">{hint ?? 'Clique, arraste ou Ctrl+V'}</span>
        </div>
        {(hasImage || canReset) && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
            {canReset && (
              <button
                type="button"
                aria-label="Restaurar padrão"
                title="Restaurar padrão"
                onClick={(e) => {
                  e.stopPropagation()
                  onReset!()
                }}
                className="grid size-7 place-items-center rounded-md bg-bg/90 text-muted hover:text-text"
              >
                <RotateCcw size={14} />
              </button>
            )}
            {hasImage && !onReset && (
              <button
                type="button"
                aria-label="Remover imagem"
                title="Remover imagem"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(undefined)
                }}
                className="grid size-7 place-items-center rounded-md bg-bg/90 text-muted hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            accept(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {footer}
    </div>
  )
}
