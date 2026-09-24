import { useState, type ImgHTMLAttributes } from 'react'
import type { ImageSource } from '../db/types'
import { useImageUrl } from '../lib/images'
import { cn } from './cn'

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  source: ImageSource | Blob | undefined
  fallback?: React.ReactNode
  /** Maior lado da versão em cache de imagens remotas. */
  maxSize?: number
}

/** Imagem que aparece com fade só depois de carregada, sem "pulo" visual. */
export function Img({ source, fallback = null, maxSize, className, onLoad, ...rest }: Props) {
  const src = useImageUrl(source, maxSize)
  const [loadedSrc, setLoadedSrc] = useState<string>()
  const hasSource = source instanceof Blob || !!source?.blob || !!source?.url
  if (!hasSource) return <>{fallback}</>
  if (!src) return null
  return (
    <img
      src={src}
      draggable={false}
      decoding="async"
      onLoad={(e) => {
        setLoadedSrc(src)
        onLoad?.(e)
      }}
      className={cn('transition-opacity duration-500', loadedSrc === src ? 'opacity-100' : 'opacity-0', className)}
      {...rest}
    />
  )
}
