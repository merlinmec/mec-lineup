import { describe, expect, it } from 'vitest'
import { countBySpot, matchesSide, sideForNew, spotVisible } from './sideFilter'

describe('filtro de ataque/defesa', () => {
  it('"ambos" aparece em qualquer lado', () => {
    expect(matchesSide('ambos', 'ataque')).toBe(true)
    expect(matchesSide('ambos', 'defesa')).toBe(true)
    expect(matchesSide('ataque', 'defesa')).toBe(false)
    expect(matchesSide('defesa', 'todos')).toBe(true)
  })

  it('conta posições por ponto e esconde ponto só do outro lado', () => {
    const counts = countBySpot(
      [
        ['a', 'ataque'],
        ['a', 'ataque'],
        ['b', 'defesa'],
        ['b', 'ambos'],
      ],
      'defesa',
    )
    expect(counts.get('a')).toEqual({ total: 2, match: 0 })
    expect(counts.get('b')).toEqual({ total: 2, match: 2 })
    expect(spotVisible(counts.get('a'))).toBe(false)
    expect(spotVisible(counts.get('b'))).toBe(true)
  })

  it('ponto sem posição continua visível', () => {
    expect(spotVisible(undefined)).toBe(true)
  })

  it('posição nova herda o lado do filtro', () => {
    expect(sideForNew('defesa')).toBe('defesa')
    expect(sideForNew('todos')).toBe('ambos')
  })
})
