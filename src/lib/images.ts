import { useEffect, useState } from 'react'
import { db } from '../db/db'
import type { ImageSource } from '../db/types'

/**
 * Prints do jogo em PNG 1080p passam de 3 MB. Converter pra WebP reduz ~10x
 * sem perda visível, e isso importa porque tudo fica no IndexedDB e no backup.
 */
export async function compressImage(file: Blob, maxSize = 1920, quality = 0.88): Promise<Blob> {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * ratio)
  const h = Math.round(bitmap.height * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  return out && out.size < file.size ? out : file
}

/**
 * Imagens remotas (capas, minimapas, ícones) são baixadas uma vez, reduzidas
 * e guardadas no IndexedDB. As capas originais têm 3 MB cada: decodificar 13
 * delas ao abrir o menu travava a animação.
 */
const memory = new Map<string, Promise<string>>()

function cachedUrl(url: string, maxSize: number): Promise<string> {
  const key = `${url}#${maxSize}`
  let hit = memory.get(key)
  if (!hit) {
    hit = (async () => {
      const stored = await db.imageCache.get(key)
      if (stored) return URL.createObjectURL(stored.blob)
      const res = await fetch(url)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await compressImage(await res.blob(), maxSize)
      await db.imageCache.put({ url: key, blob })
      return URL.createObjectURL(blob)
    })().catch(() => {
      memory.delete(key)
      return url // sem cache (offline, bloqueio): usa a URL original mesmo
    })
    memory.set(key, hit)
  }
  return hit
}

/**
 * URL exibível para um Blob ou ImageSource. Blob do usuário tem prioridade;
 * URL remota passa pelo cache reduzido.
 */
export function useImageUrl(source: ImageSource | Blob | undefined, maxSize = 1440): string | undefined {
  const blob = source instanceof Blob ? source : source?.blob
  const url = source instanceof Blob ? undefined : source?.url
  const [resolved, setResolved] = useState<{ key: string; src: string }>()

  useEffect(() => {
    if (blob) {
      const u = URL.createObjectURL(blob)
      setResolved({ key: u, src: u })
      return () => URL.revokeObjectURL(u)
    }
    if (!url) {
      setResolved(undefined)
      return
    }
    let alive = true
    cachedUrl(url, maxSize).then((src) => alive && setResolved({ key: url, src }))
    return () => {
      alive = false
    }
  }, [blob, url, maxSize])

  if (blob) return resolved?.src
  return url && resolved?.key === url ? resolved.src : undefined
}
