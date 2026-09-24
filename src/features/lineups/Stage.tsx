import { Maximize2, Minus, Plus } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ImageSource, Rotation } from '../../db/types'
import { clamp01, clampView, fitView, fromScreen, toScreen, viewport, zoomAt, type Point, type View, type Viewport } from '../../lib/geometry'
import { cn } from '../../ui/cn'
import { IconButton } from '../../ui/Button'
import { Img } from '../../ui/Img'

interface StageApi extends Viewport {
  scale: number
  rotation: Rotation
  /** Converte posição do mouse para coordenadas normalizadas da imagem. */
  toImagePoint: (clientX: number, clientY: number) => Point
  /** Posição em px dentro do palco (já com zoom/pan), pra posicionar overlays. */
  toStagePx: (p: Point) => Point
}

const StageContext = createContext<StageApi | null>(null)

export function useStage() {
  const ctx = useContext(StageContext)
  if (!ctx) throw new Error('useStage fora de <Stage>')
  return ctx
}

interface Props {
  minimap: ImageSource
  rotation: Rotation
  tactical: boolean
  cursor?: string
  onBackgroundClick: (p: Point) => void
  /** Conteúdo que acompanha o zoom (marcadores, linhas). */
  children: ReactNode
  /** Conteúdo fixo por cima do palco (preview de hover). */
  overlay?: ReactNode
}

const DRAG_THRESHOLD = 4
const FIT_PADDING = 20
const EMPTY: Viewport = { w: 0, h: 0, size: 0 }

/**
 * O palco ocupa a área inteira. O minimapa (quadrado) começa centralizado e,
 * ao ampliar, se espalha por todo o retângulo em vez de ficar recortado.
 */
export function Stage({ minimap, rotation, tactical, cursor, onBackgroundClick, children, overlay }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [vp, setVp] = useState<Viewport>(EMPTY)
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 })
  const [panning, setPanning] = useState(false)
  const viewRef = useRef(view)
  viewRef.current = view
  const vpRef = useRef(vp)
  vpRef.current = vp
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null)

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      const next = viewport(Math.floor(entry.contentRect.width), Math.floor(entry.contentRect.height), FIT_PADDING)
      setVp(next)
      // com zoom 1x o clamp já recentraliza; ampliado, só evita borda vazia
      setView((v) => clampView(v, next))
    })
    ro.observe(box.current!)
    return () => ro.disconnect()
  }, [])

  const zoomBy = useCallback((factor: number, px?: number, py?: number) => {
    const current = vpRef.current
    setView((v) => zoomAt(v, factor, px ?? current.w / 2, py ?? current.h / 2, current))
  }, [])

  const reset = useCallback(() => setView(fitView(vpRef.current)), [])

  // wheel precisa ser listener nativo não-passivo pra poder bloquear o scroll da página
  useEffect(() => {
    const el = box.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomBy(Math.exp(-e.deltaY * 0.0016), e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      if (e.key === '+' || e.key === '=') zoomBy(1.4)
      else if (e.key === '-') zoomBy(1 / 1.4)
      else if (e.key === '0') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomBy, reset])

  const toImagePoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = box.current!.getBoundingClientRect()
      const { scale, tx, ty } = viewRef.current
      const full = vpRef.current.size * scale
      return fromScreen({ x: clamp01((clientX - rect.left - tx) / full), y: clamp01((clientY - rect.top - ty) / full) }, rotation)
    },
    [rotation],
  )

  const api = useMemo<StageApi>(
    () => ({
      ...vp,
      scale: view.scale,
      rotation,
      toImagePoint,
      toStagePx: (p) => {
        const s = toScreen(p, rotation)
        return { x: s.x * vp.size * view.scale + view.tx, y: s.y * vp.size * view.scale + view.ty }
      },
    }),
    [vp, view, rotation, toImagePoint],
  )

  const zoomed = view.scale > 1.001

  return (
    <StageContext.Provider value={api}>
      <div
        ref={box}
        className={cn('relative size-full touch-none select-none overflow-hidden', panning ? 'cursor-grabbing' : cursor)}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.button !== 1) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.x
          const dy = e.clientY - d.y
          if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
          d.moved = true
          setPanning(true)
          setView((v) => clampView({ scale: v.scale, tx: d.tx + dx, ty: d.ty + dy }, vp))
        }}
        onPointerUp={(e) => {
          const d = drag.current
          drag.current = null
          setPanning(false)
          if (d && !d.moved && e.button === 0) onBackgroundClick(toImagePoint(e.clientX, e.clientY))
        }}
        onPointerCancel={() => {
          drag.current = null
          setPanning(false)
        }}
        onDoubleClick={reset}
      >
        {vp.size > 0 && (
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: vp.size,
              height: vp.size,
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
              transition: panning ? 'none' : 'transform 220ms cubic-bezier(.25,1,.5,1)',
            }}
          >
            <Img
              source={minimap}
              maxSize={2048}
              alt=""
              className={cn('absolute inset-0 size-full object-contain', tactical && 'minimap-tatico')}
              style={{ rotate: `${rotation}deg` }}
            />
            {children}
          </div>
        )}
        {overlay}

        <div className="absolute bottom-4 right-4 flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <IconButton label="Aproximar (+)" tooltipSide="left" onClick={() => zoomBy(1.4)}>
            <Plus size={16} />
          </IconButton>
          <IconButton label="Afastar (−)" tooltipSide="left" onClick={() => zoomBy(1 / 1.4)}>
            <Minus size={16} />
          </IconButton>
          <IconButton label="Mapa inteiro (0)" tooltipSide="left" onClick={reset} active={zoomed}>
            <Maximize2 size={14} />
          </IconButton>
        </div>
      </div>
    </StageContext.Provider>
  )
}

export function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}
