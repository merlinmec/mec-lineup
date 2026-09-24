import { describe, expect, it } from 'vitest'
import { bandPolygon, conePolygon, constrainEnd, geometryFor, iconAnchor, shapeSpec, translate, withDefaults } from './shapes'

// Haven: xMultiplier 0.000075 → 0.0075 do minimapa por metro
const SCALE = 0.0075
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

describe('tamanho real das habilidades', () => {
  it('converte metros pela escala do mapa', () => {
    const s = shapeSpec('faixa', { length: 40, width: 20, fixed: true }, SCALE)
    expect(s.length).toBeCloseTo(0.3)
    expect(s.width).toBeCloseTo(0.15)
  })

  it('ponto com raio cadastrado ganha zona de efeito; sem raio, não', () => {
    expect(shapeSpec('ponto', { radius: 4.5 }, SCALE).zone).toBeCloseTo(0.03375)
    expect(shapeSpec('ponto', undefined, SCALE).zone).toBe(0)
  })

  it('ult do Sova: feixe sempre com 66 m, só a direção muda', () => {
    const spec = shapeSpec('linha', { length: 66, width: 3.52, fixed: true }, SCALE)
    const start = { x: 0.2, y: 0.5 }
    const end = constrainEnd(start, { x: 0.25, y: 0.55 }, 'linha', spec) // mouse bem perto
    expect(dist(start, end)).toBeCloseTo(66 * SCALE)
    expect(end.x - start.x).toBeCloseTo(end.y - start.y) // manteve a direção (45°)
  })

  it('parede da Viper: até 60 m, pode ser mais curta', () => {
    const spec = shapeSpec('linha', { length: 60, width: 2 }, SCALE)
    const start = { x: 0.1, y: 0.1 }
    expect(dist(start, constrainEnd(start, { x: 0.2, y: 0.1 }, 'linha', spec))).toBeCloseTo(0.1)
    expect(dist(start, constrainEnd(start, { x: 0.9, y: 0.1 }, 'linha', spec))).toBeCloseTo(60 * SCALE)
  })

  it('área fixa ignora raio antigo salvo e usa o real', () => {
    const spec = shapeSpec('area', { radius: 9, fixed: true }, SCALE)
    expect(withDefaults({ x: 0.5, y: 0.5, r: 0.2 }, 'area', spec).r).toBeCloseTo(9 * SCALE)
  })

  it('linha nova aponta pro lado com mais espaço', () => {
    const spec = shapeSpec('linha', { length: 20 }, SCALE)
    expect(withDefaults({ x: 0.9, y: 0.5 }, 'linha', spec).x2).toBeLessThan(0.9)
    expect(withDefaults({ x: 0.1, y: 0.5 }, 'linha', spec).x2).toBeGreaterThan(0.1)
  })
})

describe('formas', () => {
  const spec = shapeSpec('linha', { length: 60 }, SCALE)

  it('ícone da linha fica no meio; nas outras, na origem', () => {
    const g = withDefaults({ x: 0.2, y: 0.2, x2: 0.4, y2: 0.2 }, 'linha', spec)
    expect(iconAnchor(g, 'linha').x).toBeCloseTo(0.3)
    expect(iconAnchor(g, 'faixa')).toEqual({ x: 0.2, y: 0.2 })
  })

  it('arrastar move as duas pontas juntas', () => {
    const g = translate(withDefaults({ x: 0.2, y: 0.2, x2: 0.4, y2: 0.2 }, 'linha', spec), 0.1, 0.05)
    expect([g.x, g.y, g.x2, g.y2].map((n) => +n.toFixed(3))).toEqual([0.3, 0.25, 0.5, 0.25])
  })

  it('salva só os campos da forma', () => {
    const full = withDefaults({ x: 0.5, y: 0.5 }, 'area', shapeSpec('area', { radius: 9 }, SCALE))
    expect(Object.keys(geometryFor(full, 'area')).sort()).toEqual(['r', 'x', 'y'])
    expect(Object.keys(geometryFor(full, 'faixa')).sort()).toEqual(['x', 'x2', 'y', 'y2'])
  })

  it('faixa: retângulo com a largura centrada no eixo', () => {
    const [a, b, c, d] = bandPolygon({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.4)
    expect([a.y, b.y, c.y, d.y]).toEqual([0.2, 0.2, -0.2, -0.2])
    expect([a.x, b.x]).toEqual([0, 1])
  })

  it('cone abre simétrico em volta da direção, com o alcance certo', () => {
    const pts = conePolygon({ x: 0, y: 0 }, { x: 1, y: 0 }, 90, 2)
    expect(pts).toHaveLength(4)
    expect(pts[1].y).toBeCloseTo(-pts[3].y)
    for (const p of pts.slice(1)) expect(Math.hypot(p.x, p.y)).toBeCloseTo(1)
  })
})
