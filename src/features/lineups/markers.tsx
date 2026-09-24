import { motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Ability, ImageSource, Shape } from '../../db/types'
import { toScreen, type Point } from '../../lib/geometry'
import { bandPolygon, conePolygon, type FullGeometry, type ShapeSpec } from '../../lib/shapes'
import { cn } from '../../ui/cn'
import { Img } from '../../ui/Img'
import { useStage } from './Stage'

const pct = (n: number) => `${n * 100}%`

interface ShellProps {
  point: Point
  /** De onde o marcador surge (posições saem de dentro do ponto onde cai). */
  from?: Point
  draggable: boolean
  z?: number
  delay?: number
  onClick: () => void
  onDragEnd: (p: Point) => void
  onDrag?: (p: Point | null) => void
  onHover?: (hovering: boolean) => void
  label: string
  children: ReactNode
}

/**
 * Posicionamento, animação de entrada, clique x arraste e contra-escala do
 * zoom (o marcador mantém o tamanho na tela enquanto o mapa amplia).
 */
function MarkerShell({ point, from, draggable, z = 1, delay = 0, onClick, onDragEnd, onDrag, onHover, label, children }: ShellProps) {
  const { scale, rotation, toImagePoint } = useStage()
  const [dragPoint, setDragPoint] = useState<Point | null>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const onDragRef = useRef(onDrag)
  onDragRef.current = onDrag

  // Depois de soltar, segura a posição arrastada até o banco devolver o valor
  // novo; sem isso o marcador pisca de volta pro lugar antigo por um frame.
  useEffect(() => {
    if (drag.current) return
    setDragPoint(null)
    onDragRef.current?.(null)
  }, [point.x, point.y])
  const shown = toScreen(dragPoint ?? point, rotation)
  const start = from ? toScreen(from, rotation) : shown

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={label}
      // tamanho zero: a área de clique é só o desenho (filho centralizado), sem
      // uma caixa invisível deslocada meio tamanho pra baixo/direita
      className={cn('absolute size-0 outline-none', draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer')}
      style={{ zIndex: dragPoint ? 50 : z }}
      initial={{ left: pct(start.x), top: pct(start.y), opacity: 0 }}
      animate={{ left: pct(shown.x), top: pct(shown.y), opacity: 1 }}
      exit={{ left: pct(start.x), top: pct(start.y), opacity: 0, transition: { duration: 0.18 } }}
      transition={dragPoint ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30, delay }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, y: e.clientY, moved: false }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || !draggable) return
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 3) return
        d.moved = true
        const p = toImagePoint(e.clientX, e.clientY)
        setDragPoint(p)
        onDrag?.(p)
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        const d = drag.current
        drag.current = null
        if (d?.moved && dragPoint) onDragEnd(dragPoint)
        else if (d) onClick()
      }}
      onPointerCancel={() => {
        drag.current = null
        setDragPoint(null)
        onDrag?.(null)
      }}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      onFocus={() => onHover?.(true)}
      onBlur={() => onHover?.(false)}
    >
      <div
        className="w-max"
        style={{ transform: `translate(-50%, -50%) scale(${1 / scale})`, transition: 'transform 180ms cubic-bezier(.25,1,.5,1)' }}
      >
        {children}
      </div>
    </motion.div>
  )
}

interface SpotMarkerProps {
  point: Point
  ability: Ability
  name: string
  state: 'normal' | 'selecionado' | 'apagado' | 'destacado'
  draggable: boolean
  delay: number
  onClick: () => void
  onMove: (p: Point) => void
  onDrag: (p: Point | null) => void
  onHover?: (h: boolean) => void
}

/** Ícone da habilidade: onde cai, ou o centro/meio da forma. */
export function SpotMarker({ point, ability, name, state, draggable, delay, onClick, onMove, onDrag, onHover }: SpotMarkerProps) {
  const selected = state === 'selecionado'
  return (
    <MarkerShell
      point={point}
      draggable={draggable}
      z={selected ? 20 : 10}
      delay={delay}
      onClick={onClick}
      onDragEnd={onMove}
      onDrag={onDrag}
      onHover={onHover}
      label={`${name} (${ability.name})`}
    >
      <div
        className={cn(
          'group relative transition-[opacity,scale] duration-300',
          state === 'apagado' && 'scale-75 opacity-35 hover:opacity-100',
          state === 'destacado' && 'scale-110',
          selected && 'scale-[1.2]',
        )}
      >
        {selected && (
          <motion.span
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: ability.color }}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2.1, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <div
          className="relative grid size-[34px] place-items-center rounded-full border-2 bg-[#081016]/90 transition-shadow duration-200 group-hover:shadow-[0_0_0_4px_rgba(255,255,255,.12)]"
          style={{ borderColor: ability.color, boxShadow: `0 0 18px -2px ${ability.color}88` }}
        >
          <Img source={ability.icon} alt="" className="size-[20px] object-contain" fallback={<span className="size-2.5 rounded-full" style={{ background: ability.color }} />} />
        </div>
        <span
          className={cn(
            'pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-[#081016]/90 px-1.5 py-0.5 text-[11px] font-semibold transition-opacity duration-150',
            selected || state === 'destacado' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          {name}
        </span>
      </div>
    </MarkerShell>
  )
}

interface LineupMarkerProps {
  point: Point
  from: Point
  color: string
  icon: ImageSource
  label: string
  active: boolean
  /** Do outro lado do filtro (só aparece assim no modo edição). */
  dimmed?: boolean
  /** Edição: posição sem o print do pixel, que é obrigatório. */
  missingAim?: boolean
  draggable: boolean
  delay: number
  onClick: () => void
  onMove: (p: Point) => void
  onDrag: (p: Point | null) => void
  onHover: (h: boolean) => void
}

/** Onde o jogador precisa estar. Ícone padrão: cabeça da Viper. */
export function LineupMarker({ point, from, color, icon, label, active, dimmed, missingAim, draggable, delay, onClick, onMove, onDrag, onHover }: LineupMarkerProps) {
  return (
    <MarkerShell
      point={point}
      from={from}
      draggable={draggable}
      z={active ? 40 : 30}
      delay={delay}
      onClick={onClick}
      onDragEnd={onMove}
      onDrag={onDrag}
      onHover={onHover}
      label={label}
    >
      <div
        className={cn(
          'relative size-[38px] overflow-hidden rounded-full border-2 bg-panel transition-[scale,box-shadow,opacity,filter] duration-200 hover:scale-[1.18]',
          active && 'scale-[1.18]',
          dimmed && !active && 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0',
        )}
        style={{
          borderColor: color,
          boxShadow: active ? `0 0 0 4px ${color}40, 0 6px 20px -4px #000` : '0 6px 16px -6px #000',
        }}
      >
        <Img source={icon} alt="" className="size-full object-cover" />
      </div>
      {missingAim && (
        <span
          title="Falta o print do pixel"
          className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border-2 border-bg bg-[#ffb547] text-[9px] font-black text-bg"
        >
          !
        </span>
      )}
    </MarkerShell>
  )
}

/** Linhas tracejadas ligando cada posição ao ponto onde a habilidade cai. */
export function LineupLinks({ spot, lineups, color, activeId }: { spot: Point; lineups: { id: string; x: number; y: number }[]; color: string; activeId?: string }) {
  const { rotation } = useStage()
  const s = toScreen(spot, rotation)
  return (
    <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 1 1" preserveAspectRatio="none">
      {lineups.map((l, i) => {
        const p = toScreen(l, rotation)
        const active = l.id === activeId
        return (
          <motion.line
            key={l.id}
            x1={p.x}
            y1={p.y}
            x2={s.x}
            y2={s.y}
            stroke={color}
            strokeWidth={active ? 2.5 : 1.5}
            strokeDasharray={active ? undefined : '6 5'}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ opacity: 0 }}
            animate={{ opacity: active ? 0.95 : 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: active ? 0 : 0.1 + i * 0.03 }}
          />
        )
      })}
    </svg>
  )
}

/** Alça branca pra ajustar a forma no modo edição (ponta da linha, raio, alcance do cone). */
export function ShapeHandle({ point, label, onDrag, onDragEnd }: { point: Point; label: string; onDrag: (p: Point | null) => void; onDragEnd: (p: Point) => void }) {
  return (
    <MarkerShell point={point} draggable z={45} onClick={() => {}} onDrag={onDrag} onDragEnd={onDragEnd} label={label}>
      <div className="size-3.5 rounded-full border-2 border-bg bg-white shadow-[0_0_0_3px_rgba(255,255,255,.25),0_2px_8px_rgba(0,0,0,.6)] transition-transform hover:scale-125" />
    </MarkerShell>
  )
}

interface SpotShapeProps {
  shape: Shape
  spec: ShapeSpec
  g: FullGeometry
  color: string
  state: 'normal' | 'selecionado' | 'apagado' | 'destacado'
  onClick: () => void
}

/**
 * O efeito desenhado no minimapa no tamanho real do jogo: a zona do molotov
 * em volta do ponto, a parede e o feixe como linhas, as ults como área ou faixa.
 */
export function SpotShape({ shape, spec, g, color, state, onClick }: SpotShapeProps) {
  const { rotation } = useStage()
  if (shape === 'ponto' && !spec.zone) return null
  const a = toScreen({ x: g.x, y: g.y }, rotation)
  const b = toScreen({ x: g.x2, y: g.y2 }, rotation)
  const selected = state === 'selecionado'
  const opacity = state === 'apagado' ? 0.28 : 1
  const fill = selected || state === 'destacado' ? 0.26 : 0.16
  const common = {
    style: { pointerEvents: 'visiblePainted' as const, cursor: 'pointer' },
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onPointerUp: (e: React.PointerEvent) => {
      e.stopPropagation()
      onClick()
    },
  }

  // zona do ponto: só contexto, não captura clique (o ícone é que seleciona)
  if (shape === 'ponto') {
    return (
      <motion.svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 1 1" preserveAspectRatio="none" initial={{ opacity: 0 }} animate={{ opacity }} exit={{ opacity: 0 }}>
        <circle cx={a.x} cy={a.y} r={spec.zone} fill={color} fillOpacity={selected ? 0.2 : 0.1} stroke={color} strokeOpacity={0.55} strokeWidth={1.2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </motion.svg>
    )
  }

  return (
    <motion.svg
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      {shape === 'linha' && (
        <g {...common}>
          {/* largura real (acompanha o zoom) + núcleo fino sempre visível */}
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeOpacity={selected ? 0.35 : 0.25} strokeWidth={spec.width} strokeLinecap="round" />
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={selected ? 3.5 : 2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      )}
      {shape === 'faixa' && (
        <g {...common}>
          <polygon
            points={bandPolygon(a, b, spec.width)
              .map((p) => `${p.x},${p.y}`)
              .join(' ')}
            fill={color}
            fillOpacity={fill}
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* seta no eixo: a onda avança nessa direção */}
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        </g>
      )}
      {shape === 'area' && (
        <g {...common}>
          <circle cx={a.x} cy={a.y} r={g.r} fill={color} fillOpacity={fill} stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <circle cx={a.x} cy={a.y} r={g.r * 0.72} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        </g>
      )}
      {shape === 'cone' && (
        <polygon
          {...common}
          points={conePolygon(a, b, g.angle)
            .map((p) => `${p.x},${p.y}`)
            .join(' ')}
          fill={color}
          fillOpacity={fill}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </motion.svg>
  )
}
