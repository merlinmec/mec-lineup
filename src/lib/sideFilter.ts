import { useEffect, useState } from 'react'
import type { Side } from '../db/types'

export type SideFilter = 'todos' | 'ataque' | 'defesa'

/** Posição "ambos" serve pros dois lados, então aparece em qualquer filtro. */
export const matchesSide = (side: Side, filter: SideFilter) => filter === 'todos' || side === 'ambos' || side === filter

/** Lado padrão de uma posição nova: o do filtro ativo. */
export const sideForNew = (filter: SideFilter): Side => (filter === 'todos' ? 'ambos' : filter)

export interface SideCount {
  total: number
  match: number
}

/** Conta, por ponto, quantas posições existem e quantas passam no filtro. */
export function countBySpot(pairs: [string, Side][], filter: SideFilter) {
  const out = new Map<string, SideCount>()
  for (const [spotId, side] of pairs) {
    const c = out.get(spotId) ?? { total: 0, match: 0 }
    c.total++
    if (matchesSide(side, filter)) c.match++
    out.set(spotId, c)
  }
  return out
}

/**
 * Ponto aparece se tem posição do lado escolhido. Ponto ainda sem posição
 * nenhuma também aparece: não dá pra saber de que lado ele é.
 */
export const spotVisible = (c: SideCount | undefined) => !c || c.total === 0 || c.match > 0

const KEY = 'mec-lineup:lado'

/** Filtro lembrado entre mapas: você escolhe o lado uma vez por partida. */
export function useSideFilter() {
  const [filter, setFilter] = useState<SideFilter>(() => {
    try {
      const v = localStorage.getItem(KEY)
      return v === 'ataque' || v === 'defesa' ? v : 'todos'
    } catch {
      return 'todos'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(KEY, filter)
    } catch {
      /* armazenamento bloqueado: só não lembra */
    }
  }, [filter])
  return [filter, setFilter] as const
}
