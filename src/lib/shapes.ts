import type { Shape, Spot } from '../db/types'
import { clamp01, type Point } from './geometry'

export const SHAPE_LABEL: Record<Shape, string> = { ponto: 'Ponto', linha: 'Linha', area: 'Área', cone: 'Cone' }
export const SHAPE_HINT: Record<Shape, string> = {
  ponto: 'Onde cai (orbe, veneno, flecha)',
  linha: 'De X até Y (parede, ult do Sova)',
  area: 'Círculo com raio (ults de área)',
  cone: 'Direção e abertura (ult da Fade)',
}

/** Tamanhos iniciais, em fração do minimapa; o usuário ajusta pelas alças. */
const DEFAULT_LENGTH = { linha: 0.1, cone: 0.16 }
const DEFAULT_RADIUS = 0.07
export const DEFAULT_ANGLE = 70

export type Geometry = Pick<Spot, 'x' | 'y' | 'x2' | 'y2' | 'r' | 'angle'>
export type FullGeometry = Required<Geometry>

/** Completa o que falta pra forma (ex: ponto antigo que virou linha ao trocar a forma). */
export function withDefaults(g: Geometry, shape: Shape): FullGeometry {
  const len = shape === 'cone' ? DEFAULT_LENGTH.cone : DEFAULT_LENGTH.linha
  // termina pra dentro do mapa: se não couber à direita, vai pra esquerda
  const x2 = g.x2 ?? (g.x + len <= 1 ? g.x + len : g.x - len)
  return {
    x: g.x,
    y: g.y,
    x2: clamp01(x2),
    y2: g.y2 ?? g.y,
    r: g.r ?? DEFAULT_RADIUS,
    angle: g.angle ?? DEFAULT_ANGLE,
  }
}

/** Onde fica o ícone da habilidade: meio da linha; nas outras, o ponto principal. */
export function iconAnchor(g: FullGeometry, shape: Shape): Point {
  return shape === 'linha' ? { x: (g.x + g.x2) / 2, y: (g.y + g.y2) / 2 } : { x: g.x, y: g.y }
}

/** Move a forma inteira (arrastar o ícone). */
export function translate(g: FullGeometry, dx: number, dy: number): FullGeometry {
  return { ...g, x: g.x + dx, y: g.y + dy, x2: g.x2 + dx, y2: g.y2 + dy }
}

/** Campos que interessam salvar pra cada forma. */
export function geometryFor(g: FullGeometry, shape: Shape): Geometry {
  switch (shape) {
    case 'linha':
      return { x: g.x, y: g.y, x2: g.x2, y2: g.y2 }
    case 'area':
      return { x: g.x, y: g.y, r: g.r }
    case 'cone':
      return { x: g.x, y: g.y, x2: g.x2, y2: g.y2, angle: g.angle }
    default:
      return { x: g.x, y: g.y }
  }
}

/** Polígono do cone (vértice + arco), em coordenadas de tela já rotacionadas. */
export function conePolygon(apex: Point, end: Point, angleDeg: number, segments = 18): Point[] {
  const len = Math.hypot(end.x - apex.x, end.y - apex.y)
  const dir = Math.atan2(end.y - apex.y, end.x - apex.x)
  const half = (angleDeg * Math.PI) / 360
  const arc = Array.from({ length: segments + 1 }, (_, i) => {
    const a = dir - half + (2 * half * i) / segments
    return { x: apex.x + Math.cos(a) * len, y: apex.y + Math.sin(a) * len }
  })
  return [apex, ...arc]
}
