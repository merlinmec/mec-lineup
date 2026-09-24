import type { AbilitySize, Shape, Spot } from '../db/types'
import { clamp01, type Point } from './geometry'

export const SHAPE_LABEL: Record<Shape, string> = { ponto: 'Ponto', linha: 'Linha', area: 'Área', faixa: 'Faixa', cone: 'Cone' }
export const SHAPE_HINT: Record<Shape, string> = {
  ponto: 'Onde cai, com a zona de efeito (orbe, veneno, molotov)',
  linha: 'Linha a partir de você (parede da Viper, ult do Sova)',
  area: 'Círculo com raio (ults da Viper, do Brimstone, do KAY/O)',
  faixa: 'Retângulo que avança à frente (ult da Fade)',
  cone: 'Leque com abertura (ex: ult do Breach)',
}

const m = (n: number) => `${n.toLocaleString('pt-BR')} m`

/** Explica, no painel do ponto, como ajustar a forma e qual o tamanho real dela. */
export function shapeHelp(shape: Shape, size: AbilitySize | undefined): string {
  switch (shape) {
    case 'ponto':
      return size?.radius
        ? `Arraste o ícone pra ajustar. O círculo tracejado é a zona de efeito real (raio de ${m(size.radius)}).`
        : 'Arraste o ícone pra ajustar.'
    case 'area':
      return size?.fixed && size.radius
        ? `Arraste o ícone pra posicionar. O raio é o do jogo (${m(size.radius)}) e não muda.`
        : 'Arraste o ícone pra mover e a alça branca pra ajustar o raio.'
    case 'linha':
      return size?.fixed && size.length
        ? `Arraste o ícone pra mover e a alça pra girar. No jogo ela sempre tem ${m(size.length)}.`
        : `Arraste o ícone pra mover e as alças pras pontas${size?.length ? ` (no máximo ${m(size.length)})` : ''}.`
    case 'faixa':
      return `A origem é onde você está; arraste a alça pra apontar a direção${size?.length && size.width ? `. No jogo: ${m(size.length)} × ${m(size.width)}` : ''}.`
    case 'cone':
      return 'Arraste o ícone pra mover e a alça pra direção e o alcance.'
  }
}

/** Escala média dos mapas oficiais, pra mapas sem escala conhecida. */
export const DEFAULT_SCALE = 0.0074
export const DEFAULT_ANGLE = 70

/** Sem medida cadastrada: tamanhos razoáveis em metros. */
const FALLBACK = { length: 14, width: 3, radius: 9, cone: 20 }

/** Medidas da habilidade já convertidas pra fração do minimapa. */
export interface ShapeSpec {
  length: number
  width: number
  radius: number
  /** Raio da zona de efeito de um ponto (0 = sem zona). */
  zone: number
  fixed: boolean
}

export function shapeSpec(shape: Shape, size: AbilitySize | undefined, scale = DEFAULT_SCALE): ShapeSpec {
  const len = size?.length ?? (shape === 'cone' ? FALLBACK.cone : FALLBACK.length)
  return {
    length: len * scale,
    width: (size?.width ?? FALLBACK.width) * scale,
    radius: (size?.radius ?? FALLBACK.radius) * scale,
    zone: shape === 'ponto' && size?.radius ? size.radius * scale : 0,
    fixed: !!size?.fixed,
  }
}

export type Geometry = Pick<Spot, 'x' | 'y' | 'x2' | 'y2' | 'r' | 'angle'>
export type FullGeometry = Required<Geometry>

/** Fim da linha/faixa respeitando o tamanho real: fixo (só gira) ou com máximo. */
export function constrainEnd(start: Point, target: Point, shape: Shape, spec: ShapeSpec): Point {
  if (shape !== 'linha' && shape !== 'faixa' && shape !== 'cone') return target
  const dx = target.x - start.x
  const dy = target.y - start.y
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-6) return { x: start.x + spec.length, y: start.y }
  const len = spec.fixed ? spec.length : Math.min(dist, spec.length)
  return { x: start.x + (dx / dist) * len, y: start.y + (dy / dist) * len }
}

/**
 * Completa a geometria pra forma: linha/faixa ganham fim no tamanho real
 * (apontando pro lado com mais espaço), área usa o raio real se for fixo.
 */
export function withDefaults(g: Geometry, shape: Shape, spec: ShapeSpec): FullGeometry {
  const toRight = g.x <= 0.5
  const guess = { x: g.x + (toRight ? spec.length : -spec.length), y: g.y }
  const end = g.x2 !== undefined && g.y2 !== undefined ? { x: g.x2, y: g.y2 } : guess
  const fixedEnd = constrainEnd({ x: g.x, y: g.y }, end, shape, spec)
  return {
    x: g.x,
    y: g.y,
    x2: shape === 'ponto' || shape === 'area' ? clamp01(end.x) : fixedEnd.x,
    y2: shape === 'ponto' || shape === 'area' ? clamp01(end.y) : fixedEnd.y,
    r: spec.fixed || g.r === undefined ? spec.radius : g.r,
    angle: g.angle ?? DEFAULT_ANGLE,
  }
}

/** Onde fica o ícone: meio da linha; nas outras formas, o ponto de origem. */
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
    case 'faixa':
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

/** Retângulo da faixa: sai da origem até o fim, com a largura centrada no eixo. */
export function bandPolygon(start: Point, end: Point, width: number): Point[] {
  const len = Math.hypot(end.x - start.x, end.y - start.y) || 1
  const nx = (-(end.y - start.y) / len) * (width / 2)
  const ny = ((end.x - start.x) / len) * (width / 2)
  return [
    { x: start.x + nx, y: start.y + ny },
    { x: end.x + nx, y: end.y + ny },
    { x: end.x - nx, y: end.y - ny },
    { x: start.x - nx, y: start.y - ny },
  ]
}
