import { describe, expect, it } from 'vitest'
import { conePolygon, geometryFor, iconAnchor, translate, withDefaults } from './shapes'

describe('formas no minimapa', () => {
  it('ponto antigo que vira linha ganha um fim dentro do mapa', () => {
    const g = withDefaults({ x: 0.95, y: 0.5 }, 'linha')
    expect(g.x2).toBeLessThan(0.95) // não cabia à direita: foi pra esquerda
    expect(g.x2).toBeGreaterThanOrEqual(0)
    expect(g.y2).toBe(0.5)
  })

  it('respeita a geometria já salva', () => {
    const g = withDefaults({ x: 0.1, y: 0.2, x2: 0.3, y2: 0.4, r: 0.07, angle: 45 }, 'cone')
    expect(g).toEqual({ x: 0.1, y: 0.2, x2: 0.3, y2: 0.4, r: 0.07, angle: 45 })
  })

  it('ícone da linha fica no meio; na área, no centro', () => {
    const g = withDefaults({ x: 0.2, y: 0.2, x2: 0.4, y2: 0.6 }, 'linha')
    expect(iconAnchor(g, 'linha')).toEqual({ x: 0.30000000000000004, y: 0.4 })
    expect(iconAnchor(g, 'area')).toEqual({ x: 0.2, y: 0.2 })
  })

  it('arrastar move as duas pontas juntas', () => {
    const g = translate(withDefaults({ x: 0.2, y: 0.2, x2: 0.4, y2: 0.2 }, 'linha'), 0.1, 0.05)
    expect([g.x, g.y, g.x2, g.y2].map((n) => +n.toFixed(3))).toEqual([0.3, 0.25, 0.5, 0.25])
  })

  it('salva só os campos da forma', () => {
    const full = withDefaults({ x: 0.5, y: 0.5 }, 'area')
    expect(Object.keys(geometryFor(full, 'area')).sort()).toEqual(['r', 'x', 'y'])
    expect(Object.keys(geometryFor(full, 'ponto')).sort()).toEqual(['x', 'y'])
  })
})

describe('cone', () => {
  it('abre simétrico em volta da direção, com o alcance certo', () => {
    const pts = conePolygon({ x: 0, y: 0 }, { x: 1, y: 0 }, 90, 2)
    // vértice + 3 pontos do arco: -45°, 0°, +45°
    expect(pts).toHaveLength(4)
    expect(pts[2].x).toBeCloseTo(1)
    expect(pts[1].y).toBeCloseTo(-pts[3].y)
    for (const p of pts.slice(1)) expect(Math.hypot(p.x, p.y)).toBeCloseTo(1)
  })
})
