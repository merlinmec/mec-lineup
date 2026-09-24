import type { Mark } from '../db/types'

/** Cores que se destacam em cenário do Valorant (amarelo é o padrão). */
export const MARK_COLORS = ['#ffe14d', '#ff4d8d', '#4dd2ff', '#ffffff']

export const newMark = (kind: Mark['kind'], x: number, y: number, color: string): Mark => ({
  id: crypto.randomUUID(),
  kind,
  x,
  y,
  ...(kind === 'circulo' ? { r: 0.03 } : { x2: x, y2: y }),
  color,
  note: '',
})

/** Onde está a referência: centro do círculo ou ponta da seta. */
export function focusPoint(m: Mark) {
  return m.kind === 'seta' ? { x: m.x2 ?? m.x, y: m.y2 ?? m.y } : { x: m.x, y: m.y }
}

export interface Crop {
  /** Largura/altura da imagem inteira, em % do quadro da lupa. */
  width: number
  height: number
  /** Deslocamento da imagem dentro do quadro, em % do quadro. */
  left: number
  top: number
  /** Quanto a lupa amplia em relação à imagem inteira. */
  zoom: number
}

/**
 * Recorte quadrado em volta da referência pra lupa. `aspect` = largura/altura
 * do print. O lado do recorte acompanha o tamanho do círculo, com limites pra
 * não ficar nem pixelado demais nem sem ampliar nada.
 */
export function lensCrop(m: Mark, aspect: number): Crop {
  const { x, y } = focusPoint(m)
  const half = Math.min(0.25, Math.max(0.035, m.kind === 'circulo' ? (m.r ?? 0.03) * 1.8 : 0.06))
  const halfH = half * aspect // mesmo tamanho em px, medido em unidades de altura
  return {
    width: 100 / (2 * half),
    height: 100 / (2 * halfH),
    left: (-(x - half) / (2 * half)) * 100,
    top: (-(y - halfH) / (2 * halfH)) * 100,
    zoom: 1 / (2 * half),
  }
}

/** Duas pernas da ponta da seta, no sistema do SVG (largura 100). */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, size = 3.2) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const spread = (28 * Math.PI) / 180
  return [angle + Math.PI - spread, angle + Math.PI + spread].map((a) => ({ x: x2 + Math.cos(a) * size, y: y2 + Math.sin(a) * size }))
}
