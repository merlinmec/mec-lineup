import { motion } from 'motion/react'
import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Mark } from '../db/types'
import { useImageUrl } from '../lib/images'
import { arrowHead, lensCrop } from '../lib/marks'
import { cn } from './cn'

interface LayerProps {
  marks: Mark[]
  aspect: number
  /** Pulso chamando atenção pra referência (preview/detalhe). */
  pulse?: boolean
  /** Mostra o número de cada marcação (liga com a lista de notas). */
  numbered?: boolean
  labelScale?: number
  selectedId?: string
  onMarkPointerDown?: (e: ReactPointerEvent, mark: Mark) => void
  children?: ReactNode
}

/**
 * SVG por cima do print. viewBox com largura 100 e altura proporcional,
 * assim círculo continua redondo e o traço tem espessura fixa na tela.
 */
export function MarksLayer({ marks, aspect, pulse, numbered = true, labelScale = 1, selectedId, onMarkPointerDown, children }: LayerProps) {
  const H = 100 / aspect
  return (
    <svg className="absolute inset-0 size-full overflow-visible" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
      {marks.map((m, i) => {
        const selected = m.id === selectedId
        const interactive = !!onMarkPointerDown
        const down = interactive ? (e: ReactPointerEvent) => onMarkPointerDown!(e, m) : undefined
        const labelR = 2.4 * labelScale
        if (m.kind === 'circulo') {
          const cx = m.x * 100
          const cy = m.y * H
          const r = (m.r ?? 0.03) * 100
          const lx = cx + r * 0.72
          const ly = cy - r * 0.72
          return (
            <g key={m.id} onPointerDown={down} className={interactive ? 'cursor-move' : undefined}>
              {pulse && (
                <motion.circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={m.color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  initial={{ r, opacity: 0.9 }}
                  animate={{ r: r * 1.7, opacity: 0 }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: i * 0.3 }}
                />
              )}
              <circle cx={cx} cy={cy} r={r} fill={interactive ? 'transparent' : 'none'} stroke="#000" strokeOpacity={0.55} strokeWidth={5} vectorEffect="non-scaling-stroke" />
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={m.color} strokeWidth={selected ? 3.5 : 2.5} vectorEffect="non-scaling-stroke" strokeDasharray={selected ? '6 4' : undefined} />
              {numbered && <Label x={lx} y={ly} r={labelR} color={m.color} n={i + 1} />}
            </g>
          )
        }
        const x1 = m.x * 100
        const y1 = m.y * H
        const x2 = (m.x2 ?? m.x) * 100
        const y2 = (m.y2 ?? m.y) * H
        const [a, b] = arrowHead(x1, y1, x2, y2)
        const d = `M${x1},${y1} L${x2},${y2} M${a.x},${a.y} L${x2},${y2} L${b.x},${b.y}`
        return (
          <g key={m.id} onPointerDown={down} className={interactive ? 'cursor-move' : undefined}>
            {interactive && <path d={d} stroke="transparent" strokeWidth={16} vectorEffect="non-scaling-stroke" fill="none" />}
            <path d={d} stroke="#000" strokeOpacity={0.55} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" fill="none" />
            <path d={d} stroke={m.color} strokeWidth={selected ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" fill="none" />
            {pulse && (
              <motion.circle
                cx={x2}
                cy={y2}
                fill="none"
                stroke={m.color}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                initial={{ r: 0.5, opacity: 0.9 }}
                animate={{ r: 4, opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: i * 0.3 }}
              />
            )}
            {numbered && <Label x={x1} y={y1} r={labelR} color={m.color} n={i + 1} />}
          </g>
        )
      })}
      {children}
    </svg>
  )
}

function Label({ x, y, r, color, n }: { x: number; y: number; r: number; color: string; n: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={r} fill={color} stroke="#000" strokeOpacity={0.6} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <text x={x} y={y} fontSize={r * 1.25} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#0a1016" fontFamily="Poppins, sans-serif">
        {n}
      </text>
    </g>
  )
}

interface AnnotatedProps {
  image: Blob | undefined
  marks?: Mark[]
  pulse?: boolean
  numbered?: boolean
  className?: string
  alt?: string
  onAspect?: (aspect: number) => void
}

/** Print com as marcações desenhadas por cima, na proporção real da imagem. */
export function AnnotatedImage({ image, marks = [], pulse, numbered, className, alt = '', onAspect }: AnnotatedProps) {
  const src = useImageUrl(image)
  const [aspect, setAspect] = useState(16 / 9)
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={cn('relative', className)} style={{ aspectRatio: aspect }}>
      {src && (
        <img
          src={src}
          alt={alt}
          draggable={false}
          decoding="async"
          className={cn('absolute inset-0 size-full transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
          onLoad={(e) => {
            const a = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight
            setAspect(a)
            setLoaded(true)
            onAspect?.(a)
          }}
        />
      )}
      {loaded && marks.length > 0 && <MarksLayer marks={marks} aspect={aspect} pulse={pulse} numbered={numbered} />}
    </div>
  )
}

/** Recorte ampliado em volta de uma marcação: a fresta de 3 px vira visível. */
export function ZoomLens({ image, mark, aspect, className }: { image: Blob; mark: Mark; aspect: number; className?: string }) {
  const src = useImageUrl(image)
  const crop = lensCrop(mark, aspect)
  return (
    <div className={cn('relative aspect-square overflow-hidden bg-black', className)}>
      {src && (
        <div className="absolute" style={{ width: `${crop.width}%`, height: `${crop.height}%`, left: `${crop.left}%`, top: `${crop.top}%` }}>
          <img src={src} alt="" draggable={false} className="absolute inset-0 size-full" />
          <MarksLayer marks={[mark]} aspect={aspect} numbered={false} />
        </div>
      )}
      <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold tabular-nums text-white/80">
        {crop.zoom.toFixed(crop.zoom < 10 ? 1 : 0)}×
      </span>
    </div>
  )
}
