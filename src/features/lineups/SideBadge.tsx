import type { Side } from '../../db/types'
import { cn } from '../../ui/cn'

export const SIDE_LABEL: Record<Side, string> = { ataque: 'Ataque', defesa: 'Defesa', ambos: 'Ambos' }

export function SideBadge({ side }: { side: Side }) {
  if (side === 'ambos') return null
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        side === 'ataque' ? 'bg-danger/15 text-[#ff7a85]' : 'bg-accent/15 text-accent',
      )}
    >
      {SIDE_LABEL[side]}
    </span>
  )
}
