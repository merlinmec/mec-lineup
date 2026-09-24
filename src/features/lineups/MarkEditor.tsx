import { Circle, MoveUpRight, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Mark } from '../../db/types'
import { useImageUrl } from '../../lib/images'
import { MARK_COLORS, newMark } from '../../lib/marks'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { MarksLayer, ZoomLens } from '../../ui/annotated'
import { Modal } from '../../ui/Modal'
import { isTyping } from './Stage'

type Tool = Mark['kind']
type Handle = 'raio' | 'inicio' | 'fim'

interface Props {
  open: boolean
  title: string
  image: Blob | undefined
  marks: Mark[]
  /** Fechar sempre salva: marcar referência é trabalho que não pode sumir no Esc. */
  onClose: (marks: Mark[]) => void
}

const MIN_DRAG = 0.008

export function MarkEditor({ open, title, image, marks: initial, onClose }: Props) {
  const [marks, setMarks] = useState<Mark[]>(initial)
  const [selectedId, setSelectedId] = useState<string>()
  const [tool, setTool] = useState<Tool>('circulo')
  const [color, setColor] = useState(MARK_COLORS[0])
  const [aspect, setAspect] = useState(16 / 9)
  const src = useImageUrl(image)
  const svgBox = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: 'criar' | 'mover' | Handle; id: string; start: { x: number; y: number }; orig: Mark } | null>(null)

  useEffect(() => {
    if (!open) return
    setMarks(initial)
    setSelectedId(initial[0]?.id)
  }, [open])

  const selected = marks.find((m) => m.id === selectedId)
  const patch = (id: string, changes: Partial<Mark>) => setMarks((ms) => ms.map((m) => (m.id === id ? { ...m, ...changes } : m)))
  const remove = (id: string) => {
    setMarks((ms) => ms.filter((m) => m.id !== id))
    setSelectedId(undefined)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) remove(selectedId)
      else if (e.key.toLowerCase() === 'c') setTool('circulo')
      else if (e.key.toLowerCase() === 's') setTool('seta')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, selectedId])

  /** Ponto do mouse normalizado na imagem (x pela largura, y pela altura). */
  const toPoint = (e: { clientX: number; clientY: number }) => {
    const rect = svgBox.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }

  const begin = (e: ReactPointerEvent, mode: 'criar' | 'mover' | Handle, mark: Mark) => {
    e.stopPropagation()
    svgBox.current!.setPointerCapture(e.pointerId)
    drag.current = { mode, id: mark.id, start: toPoint(e), orig: mark }
    setSelectedId(mark.id)
  }

  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = toPoint(e)
    const o = d.orig
    if (d.mode === 'mover') {
      const dx = p.x - d.start.x
      const dy = p.y - d.start.y
      patch(d.id, { x: o.x + dx, y: o.y + dy, ...(o.kind === 'seta' ? { x2: (o.x2 ?? o.x) + dx, y2: (o.y2 ?? o.y) + dy } : {}) })
    } else if (d.mode === 'inicio') {
      patch(d.id, { x: p.x, y: p.y })
    } else if (o.kind === 'circulo') {
      // raio medido em largura; dy convertido de unidades de altura
      patch(d.id, { r: Math.max(0.006, Math.hypot(p.x - o.x, (p.y - o.y) / aspect)) })
    } else {
      patch(d.id, { x2: p.x, y2: p.y })
    }
  }

  const end = () => {
    const d = drag.current
    drag.current = null
    if (d?.mode !== 'criar') return
    // clique sem arrastar: círculo ganha tamanho padrão, seta sem tamanho some
    setMarks((ms) =>
      ms.flatMap((m) => {
        if (m.id !== d.id) return [m]
        const tiny = m.kind === 'circulo' ? (m.r ?? 0) < MIN_DRAG : Math.hypot((m.x2 ?? m.x) - m.x, (m.y2 ?? m.y) - m.y) < MIN_DRAG * 2
        if (!tiny) return [m]
        return m.kind === 'circulo' ? [{ ...m, r: 0.025 }] : []
      }),
    )
  }

  const onBackgroundDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    const p = toPoint(e)
    const m = { ...newMark(tool, p.x, p.y, color), ...(tool === 'circulo' ? { r: 0 } : {}) }
    setMarks((ms) => [...ms, m])
    begin(e, 'criar', m)
  }

  const H = 100 / aspect
  const handleR = 1.1

  return (
    <Modal open={open} onClose={() => onClose(marks)} title={title} maxWidth={1280}>
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line bg-bg-2 p-0.5">
              <ToolButton active={tool === 'circulo'} onClick={() => setTool('circulo')} label="Círculo (C)">
                <Circle size={15} /> Círculo
              </ToolButton>
              <ToolButton active={tool === 'seta'} onClick={() => setTool('seta')} label="Seta (S)">
                <MoveUpRight size={15} /> Seta
              </ToolButton>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-bg-2 px-2 py-1.5">
              {MARK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  onClick={() => {
                    setColor(c)
                    if (selected) patch(selected.id, { color: c })
                  }}
                  className={cn('size-5 rounded-full border-2 transition-transform hover:scale-110', (selected?.color ?? color) === c ? 'border-text' : 'border-transparent')}
                  style={{ background: c }}
                />
              ))}
            </div>
            <p className="ml-auto text-xs text-faint">Arraste para desenhar · clique para selecionar · Delete apaga</p>
          </div>

          <div className="grid place-items-center rounded-xl bg-black/60">
            <div
              ref={svgBox}
              className="relative cursor-crosshair touch-none select-none"
              style={{ aspectRatio: aspect, width: `min(100%, calc(64vh * ${aspect}))` }}
              onPointerDown={onBackgroundDown}
              onPointerMove={onMove}
              onPointerUp={end}
              onPointerCancel={end}
            >
              {src && (
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute inset-0 size-full"
                  onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
                />
              )}
              <MarksLayer marks={marks} aspect={aspect} selectedId={selectedId} labelScale={0.7} onMarkPointerDown={(e, m) => e.button === 0 && begin(e, 'mover', m)}>
                {selected &&
                  (selected.kind === 'circulo' ? (
                    <HandleDot x={(selected.x + (selected.r ?? 0)) * 100} y={selected.y * H} r={handleR} onDown={(e) => begin(e, 'raio', selected)} />
                  ) : (
                    <>
                      <HandleDot x={selected.x * 100} y={selected.y * H} r={handleR} onDown={(e) => begin(e, 'inicio', selected)} />
                      <HandleDot x={(selected.x2 ?? selected.x) * 100} y={(selected.y2 ?? selected.y) * H} r={handleR} onDown={(e) => begin(e, 'fim', selected)} />
                    </>
                  ))}
              </MarksLayer>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <div>
            <span className="label">Referências ({marks.length})</span>
            {marks.length === 0 && (
              <p className="rounded-lg border border-dashed border-line-2 px-3 py-4 text-xs leading-relaxed text-faint">
                Circule o detalhe que precisa alinhar com a mira: a fresta da barra de vida, o canto de um tijolo, a ponta de uma antena. Cada marcação ganha uma lupa na hora de consultar.
              </p>
            )}
          </div>
          <ul className="flex max-h-[58vh] flex-col gap-2 overflow-y-auto">
            <AnimatePresence initial={false}>
              {marks.map((m, i) => (
                <motion.li
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  onClick={() => setSelectedId(m.id)}
                  className={cn('flex gap-2.5 rounded-lg border p-2 transition-colors', m.id === selectedId ? 'border-accent/60 bg-panel-2' : 'border-line bg-bg-2')}
                >
                  {image && <ZoomLens image={image} mark={m} aspect={aspect} className="w-16 shrink-0 rounded-md" />}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="grid size-5 place-items-center rounded-full text-[11px] font-bold text-bg" style={{ background: m.color }}>
                        {i + 1}
                      </span>
                      <span className="text-xs text-muted">{m.kind === 'circulo' ? 'Círculo' : 'Seta'}</span>
                      <button
                        type="button"
                        aria-label="Apagar marcação"
                        onClick={(e) => {
                          e.stopPropagation()
                          remove(m.id)
                        }}
                        className="ml-auto grid size-6 place-items-center rounded text-faint hover:text-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <input
                      className="field !py-1.5 !text-xs"
                      value={m.note}
                      placeholder="Ex: fresta da vida no tijolo"
                      onChange={(e) => patch(m.id, { note: e.target.value })}
                      onFocus={() => setSelectedId(m.id)}
                    />
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <div className="mt-auto flex gap-2 pt-2">
            {marks.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setMarks([])}>
                Limpar tudo
              </Button>
            )}
            <Button variant="primary" className="ml-auto" onClick={() => onClose(marks)}>
              Concluir
            </Button>
          </div>
        </aside>
      </div>
    </Modal>
  )
}

function ToolButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors', active ? 'bg-panel-3 text-text' : 'text-muted hover:text-text')}
    >
      {children}
    </button>
  )
}

function HandleDot({ x, y, r, onDown }: { x: number; y: number; r: number; onDown: (e: ReactPointerEvent) => void }) {
  return <circle cx={x} cy={y} r={r} fill="#fff" stroke="#000" strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="cursor-grab" onPointerDown={onDown} />
}
