import type { Rotation } from '../db/types'

/**
 * Pontos são salvos em coordenadas normalizadas (0..1) da imagem original do
 * minimapa. Só a imagem gira; os marcadores são posicionados na tela já
 * rotacionados, assim os ícones nunca aparecem de lado.
 */
export interface Point {
  x: number
  y: number
}

/** Converte ponto da imagem para a tela, igual ao `rotate()` do CSS (horário). */
export function toScreen({ x, y }: Point, rotation: Rotation): Point {
  switch (rotation) {
    case 90:
      return { x: 1 - y, y: x }
    case 180:
      return { x: 1 - x, y: 1 - y }
    case 270:
      return { x: y, y: 1 - x }
    default:
      return { x, y }
  }
}

export function fromScreen({ x, y }: Point, rotation: Rotation): Point {
  switch (rotation) {
    case 90:
      return { x: y, y: 1 - x }
    case 180:
      return { x: 1 - x, y: 1 - y }
    case 270:
      return { x: 1 - y, y: x }
    default:
      return { x, y }
  }
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * O palco é a área retangular inteira (w × h); o minimapa é um quadrado de
 * lado `size` = menor dimensão, desenhado com translate(tx, ty) scale(scale).
 */
export interface View {
  scale: number
  tx: number
  ty: number
}

export interface Viewport {
  w: number
  h: number
  size: number
}

export const MIN_SCALE = 1
export const MAX_SCALE = 6

/** `pad` é a margem do mapa inteiro (1x); ampliado, ele pode encostar nas bordas. */
export const viewport = (w: number, h: number, pad = 0): Viewport => ({ w, h, size: Math.max(0, Math.min(w, h) - pad * 2) })

/** Mapa inteiro visível e centralizado. */
export const fitView = ({ w, h, size }: Viewport): View => ({ scale: 1, tx: (w - size) / 2, ty: (h - size) / 2 })

/**
 * Por eixo: se o mapa ampliado é maior que o palco, não deixa sobrar borda
 * vazia; se é menor, centraliza. Assim o zoom usa toda a área disponível.
 */
export function clampView(view: View, vp: Viewport): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale))
  const full = vp.size * scale
  const axis = (t: number, space: number) => (full <= space ? (space - full) / 2 : Math.min(0, Math.max(space - full, t)))
  return { scale, tx: axis(view.tx, vp.w), ty: axis(view.ty, vp.h) }
}

/** Zoom mantendo fixo o ponto sob o cursor (px, py relativos ao palco). */
export function zoomAt(view: View, factor: number, px: number, py: number, vp: Viewport): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor))
  const ratio = scale / view.scale
  return clampView({ scale, tx: px - (px - view.tx) * ratio, ty: py - (py - view.ty) * ratio }, vp)
}
