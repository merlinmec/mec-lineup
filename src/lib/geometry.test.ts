import { describe, expect, it } from 'vitest'
import type { Rotation } from '../db/types'
import { clampView, fitView, fromScreen, toScreen, viewport, zoomAt } from './geometry'

describe('rotação do minimapa', () => {
  const rotations: Rotation[] = [0, 90, 180, 270]

  it.each(rotations)('fromScreen desfaz toScreen em %i°', (r) => {
    const p = { x: 0.2, y: 0.7 }
    const back = fromScreen(toScreen(p, r), r)
    expect(back.x).toBeCloseTo(p.x)
    expect(back.y).toBeCloseTo(p.y)
  })

  it('90° leva o canto superior esquerdo pro superior direito, como o CSS', () => {
    expect(toScreen({ x: 0, y: 0 }, 90)).toEqual({ x: 1, y: 0 })
  })
})

describe('zoom e pan', () => {
  // palco largo: 1000 × 400, mapa quadrado de 400 centralizado (tx = 300)
  const vp = viewport(1000, 400)

  it('começa com o mapa inteiro centralizado', () => {
    expect(fitView(vp)).toEqual({ scale: 1, tx: 300, ty: 0 })
  })

  it('mantém fixo o ponto sob o cursor', () => {
    const v = zoomAt(fitView(vp), 1.5, 500, 200, vp)
    expect(v.scale).toBe(1.5)
    // mapa (600px) ainda cabe na largura: continua centralizado no eixo x
    expect(v.tx).toBe(200)
    // na altura já passou do palco: o ponto sob o cursor fica fixo
    expect((200 - v.ty) / v.scale).toBeCloseTo(200)
  })

  it('ampliado, ocupa o palco inteiro sem borda vazia', () => {
    const v = clampView({ scale: 4, tx: 50, ty: -5000 }, vp)
    // mapa com 1600px: tx entre 1000-1600 e 0; ty entre 400-1600 e 0
    expect(v).toEqual({ scale: 4, tx: 0, ty: -1200 })
  })

  it('não diminui abaixo de 1x', () => {
    expect(zoomAt(fitView(vp), 0.5, 0, 0, vp)).toEqual(fitView(vp))
  })
})
