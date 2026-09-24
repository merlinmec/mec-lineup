import { describe, expect, it } from 'vitest'
import type { Mark } from '../db/types'
import { arrowHead, focusPoint, lensCrop } from './marks'

const circle = (x: number, y: number, r: number): Mark => ({ id: 'c', kind: 'circulo', x, y, r, color: '#fff', note: '' })

describe('lupa', () => {
  it('centraliza a referência no quadro da lupa', () => {
    const aspect = 16 / 9
    const m = circle(0.3, 0.6, 0.02)
    const c = lensCrop(m, aspect)
    // centro da referência dentro do quadro = offset + posição * tamanho da imagem
    expect(c.left + 0.3 * c.width).toBeCloseTo(50)
    expect(c.top + 0.6 * c.height).toBeCloseTo(50)
  })

  it('recorte é quadrado em pixels, mesmo com print 16:9', () => {
    const aspect = 16 / 9
    const c = lensCrop(circle(0.5, 0.5, 0.05), aspect)
    // largura da imagem em px / altura da imagem em px deve continuar 16:9
    expect(c.width / c.height).toBeCloseTo(aspect)
  })

  it('círculo minúsculo não gera zoom infinito', () => {
    expect(lensCrop(circle(0.5, 0.5, 0.001), 1).zoom).toBeLessThanOrEqual(1 / 0.07 + 1e-9)
  })

  it('seta foca na ponta, não na cauda', () => {
    const arrow: Mark = { id: 'a', kind: 'seta', x: 0.1, y: 0.1, x2: 0.7, y2: 0.4, color: '#fff', note: '' }
    expect(focusPoint(arrow)).toEqual({ x: 0.7, y: 0.4 })
  })
})

describe('ponta da seta', () => {
  it('pernas ficam atrás da ponta, uma de cada lado', () => {
    const [a, b] = arrowHead(0, 0, 10, 0)
    expect(a.x).toBeLessThan(10)
    expect(b.x).toBeLessThan(10)
    expect(Math.sign(a.y)).toBe(-Math.sign(b.y))
  })
})
