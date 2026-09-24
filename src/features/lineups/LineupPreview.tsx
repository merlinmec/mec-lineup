import { Crosshair, Footprints, ImageOff, MapPin, MousePointerClick } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import type { Lineup } from '../../db/types'
import type { Point } from '../../lib/geometry'
import { AnnotatedImage, ZoomLens } from '../../ui/annotated'
import { Img } from '../../ui/Img'
import { useStage } from './Stage'
import { SideBadge } from './SideBadge'

const CARD_W = 360
const CARD_H_EST = 380
const GAP = 28

/** Card flutuante ao lado de um ponto do mapa, virando pro lado com mais espaço. */
export function PreviewCard({ at, color, width = CARD_W, heightEstimate = CARD_H_EST, children }: { at: Point; color: string; width?: number; heightEstimate?: number; children: ReactNode }) {
  const { w, h, toStagePx } = useStage()
  const p = toStagePx(at)
  const toLeft = p.x > w / 2
  const left = toLeft ? p.x - GAP - width : p.x + GAP
  const top = Math.min(Math.max(8, p.y - heightEstimate / 2), Math.max(8, h - heightEstimate - 8))
  return (
    <motion.div
      className="pointer-events-none absolute z-[60] overflow-hidden rounded-xl border border-line-2 bg-panel/95 shadow-[0_24px_60px_-12px_rgba(0,0,0,.85)] backdrop-blur-md"
      style={{ left, top, width, borderTopColor: color }}
      initial={{ opacity: 0, x: toLeft ? 10 : -10, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
      transition={{ type: 'spring', stiffness: 520, damping: 36 }}
    >
      {children}
    </motion.div>
  )
}

/** Card que aparece ao passar o mouse numa posição, sem precisar clicar. */
export function LineupPreview({ lineup, color }: { lineup: Lineup; color: string }) {
  const [aspect, setAspect] = useState(16 / 9)
  const marks = lineup.aimMarks ?? []
  const first = marks[0]

  return (
    <PreviewCard at={lineup} color={color}>
      <div className="relative bg-bg-2">
        {lineup.aimImage ? (
          <AnnotatedImage image={lineup.aimImage} marks={marks} pulse alt={`Onde mirar: ${lineup.title}`} onAspect={setAspect} className="w-full" />
        ) : (
          <div className="grid aspect-video place-items-center text-center text-faint">
            <div>
              <ImageOff size={22} className="mx-auto" />
              <p className="mt-2 text-xs">Sem print de mira ainda</p>
            </div>
          </div>
        )}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-bg/85 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          <Crosshair size={11} style={{ color }} /> Mira
        </span>
      </div>
      {lineup.aimImage && first && (
        // a referência ampliada: no preview pequeno o detalhe some sem isso
        <div className="flex items-center gap-3 border-b border-line bg-bg-2/60 px-3 py-2.5">
          <ZoomLens image={lineup.aimImage} mark={first} aspect={aspect} className="w-20 shrink-0 rounded-md" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              <span className="grid size-4 place-items-center rounded-full text-[9px] text-bg" style={{ background: first.color }}>1</span>
              Referência
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-snug">{first.note || 'Alinhe com o ponto marcado'}</p>
            {marks.length > 1 && <p className="mt-1 text-[10px] text-faint">+{marks.length - 1} no detalhe</p>}
          </div>
        </div>
      )}
      {(lineup.positionImage || lineup.resultImage) && (
        <div className="grid grid-cols-2 gap-2 border-b border-line px-3 py-2.5">
          {lineup.positionImage && <Thumb image={lineup.positionImage} label="Onde eu fico" icon={<Footprints size={9} />} />}
          {lineup.resultImage && <Thumb image={lineup.resultImage} label="Onde cai" icon={<MapPin size={9} />} />}
        </div>
      )}
      <div className="px-3.5 py-3">
        <div className="flex items-center gap-2">
          <p className="font-display min-w-0 flex-1 truncate text-lg font-semibold leading-tight">{lineup.title}</p>
          <SideBadge side={lineup.side} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <MousePointerClick size={13} style={{ color }} />
          {lineup.throwType || 'Lançamento não informado'}
        </p>
        {lineup.notes && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{lineup.notes}</p>}
        <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wider text-faint">Clique para fixar e ampliar</p>
      </div>
    </PreviewCard>
  )
}

function Thumb({ image, label, icon }: { image: Blob; label: string; icon: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-line">
      <Img source={image} alt={label} className="aspect-video w-full object-cover" />
      <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-bg/85 px-1 py-px text-[9px] font-bold uppercase tracking-wider">
        {icon} {label}
      </span>
    </div>
  )
}
