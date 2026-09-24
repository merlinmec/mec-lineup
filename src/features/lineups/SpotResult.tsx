import { Eye, Maximize2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import type { Ability, Spot } from '../../db/types'
import type { Point } from '../../lib/geometry'
import { AnnotatedImage } from '../../ui/annotated'
import { Lightbox } from '../../ui/Lightbox'
import { PreviewCard } from './LineupPreview'

/** Hover no ícone do ponto: mostra como o efeito fica em jogo. */
export function SpotResultPreview({ spot, ability, at }: { spot: Spot; ability: Ability; at: Point }) {
  if (!spot.resultImage) return null
  return (
    <PreviewCard at={at} color={ability.color} width={340} heightEstimate={260}>
      <AnnotatedImage image={spot.resultImage} marks={spot.resultMarks} pulse className="w-full" />
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <Eye size={14} style={{ color: ability.color }} />
        <p className="font-display min-w-0 flex-1 truncate text-lg font-semibold leading-tight">{spot.name}</p>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Como fica em jogo</span>
      </div>
    </PreviewCard>
  )
}

/**
 * Com o ponto selecionado, o print do resultado fica fixo no canto do mapa:
 * dá pra comparar com o jogo enquanto escolhe a posição de lançamento.
 */
export function ResultDock({ spot, ability }: { spot: Spot; ability: Ability }) {
  const [open, setOpen] = useState(false)
  if (!spot.resultImage) return null
  return (
    <>
      <motion.button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className="group absolute bottom-4 left-4 z-40 w-64 overflow-hidden rounded-xl border border-line-2 bg-panel/95 text-left shadow-[0_20px_50px_-12px_rgba(0,0,0,.85)] backdrop-blur-md"
        style={{ borderTopColor: ability.color }}
        title="Ampliar"
      >
        <AnnotatedImage image={spot.resultImage} marks={spot.resultMarks} className="w-full" />
        <span className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted">
          <Eye size={12} style={{ color: ability.color }} />
          Como fica em jogo
          <Maximize2 size={12} className="ml-auto opacity-60 transition-opacity group-hover:opacity-100" />
        </span>
      </motion.button>
      <Lightbox image={open ? spot.resultImage : undefined} marks={spot.resultMarks} alt={`${spot.name}: como fica em jogo`} onClose={() => setOpen(false)} />
    </>
  )
}
