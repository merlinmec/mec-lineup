import { ArrowLeft, ChevronLeft, ChevronRight, Crosshair, Eye, Footprints, ImageOff, MapPin, MousePointerClick, Plus, Target, Trash2, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { lineupsRepo, spotsRepo } from '../../db/repo'
import type { Ability, Lineup, Mark, Side, Spot } from '../../db/types'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { useConfirm } from '../../ui/Confirm'
import { CommitInput, CommitTextarea } from '../../ui/fields'
import { ImageDrop } from '../../ui/ImageDrop'
import { Img } from '../../ui/Img'
import { Lightbox } from '../../ui/Lightbox'
import { AnnotatedImage, ZoomLens } from '../../ui/annotated'
import { MarkEditor } from './MarkEditor'
import { SIDE_LABEL, SideBadge } from './SideBadge'
import { DEFAULT_ANGLE, SHAPE_LABEL } from '../../lib/shapes'

function Drawer({ children }: { children: ReactNode }) {
  return (
    <motion.aside
      className="absolute inset-y-0 right-0 z-30 flex w-[400px] flex-col border-l border-line bg-panel/95 shadow-[-30px_0_60px_-30px_rgba(0,0,0,.9)] backdrop-blur-md"
      initial={{ x: 48, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 48, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </motion.aside>
  )
}

function DrawerHeader({ eyebrow, title, onBack, onClose, actions }: { eyebrow: ReactNode; title: ReactNode; onBack?: () => void; onClose: () => void; actions?: ReactNode }) {
  return (
    <header className="flex items-start gap-2 border-b border-line px-4 py-3.5">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Voltar ao ponto" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-text">
          <ArrowLeft size={17} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{eyebrow}</div>
        <div className="font-display mt-0.5 truncate text-2xl font-semibold leading-tight">{title}</div>
      </div>
      {actions}
      <button type="button" onClick={onClose} aria-label="Fechar (Esc)" title="Fechar (Esc)" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-text">
        <X size={17} />
      </button>
    </header>
  )
}

function AbilityEyebrow({ ability, spot }: { ability: Ability; spot?: Spot }) {
  return (
    <>
      <Img source={ability.icon} alt="" className="size-3.5 object-contain" />
      <span style={{ color: ability.color }}>{ability.name}</span>
      {spot && (
        <>
          <span className="text-faint">/</span>
          <span className="truncate">{spot.name}</span>
        </>
      )}
    </>
  )
}

/* ---------- Visualização fixa (modo jogo) ---------- */

interface DetailProps {
  lineup: Lineup
  siblings: Lineup[]
  spot: Spot
  ability: Ability
  onNavigate: (id: string) => void
  onClose: () => void
}

export function LineupDetail({ lineup, siblings, spot, ability, onNavigate, onClose }: DetailProps) {
  const [zoomed, setZoomed] = useState<'aim' | 'position' | 'result'>()
  const index = siblings.findIndex((l) => l.id === lineup.id)
  const go = (dir: -1 | 1) => onNavigate(siblings[(index + dir + siblings.length) % siblings.length].id)

  return (
    <Drawer>
      <DrawerHeader
        eyebrow={<AbilityEyebrow ability={ability} spot={spot} />}
        title={lineup.title}
        onClose={onClose}
        actions={
          siblings.length > 1 && (
            <div className="mt-0.5 flex items-center gap-0.5">
              <button type="button" onClick={() => go(-1)} aria-label="Posição anterior (←)" title="Anterior (←)" className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-text">
                <ChevronLeft size={17} />
              </button>
              <span className="w-9 text-center text-xs tabular-nums text-muted">
                {index + 1}/{siblings.length}
              </span>
              <button type="button" onClick={() => go(1)} aria-label="Próxima posição (→)" title="Próxima (→)" className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-text">
                <ChevronRight size={17} />
              </button>
            </div>
          )
        }
      />
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <Shot label="Onde mirar" icon={<Crosshair size={12} />} color={ability.color} image={lineup.aimImage} marks={lineup.aimMarks} onZoom={() => setZoomed('aim')} />
        {lineup.positionImage && (
          <Shot label="Onde ficar" icon={<Footprints size={12} />} color={ability.color} image={lineup.positionImage} marks={lineup.positionMarks} onZoom={() => setZoomed('position')} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md border border-line bg-bg-2 px-2.5 py-1.5 text-sm">
            <MousePointerClick size={15} style={{ color: ability.color }} />
            {lineup.throwType || 'Lançamento não informado'}
          </span>
          <SideBadge side={lineup.side} />
        </div>
        {lineup.notes && <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{lineup.notes}</p>}
        {spot.resultImage && (
          <div className="border-t border-line pt-4">
            <Shot label="Como fica em jogo" icon={<Eye size={12} />} color={ability.color} image={spot.resultImage} marks={spot.resultMarks} onZoom={() => setZoomed('result')} />
          </div>
        )}
      </div>
      <Lightbox
        image={zoomed === 'aim' ? lineup.aimImage : zoomed === 'position' ? lineup.positionImage : zoomed === 'result' ? spot.resultImage : undefined}
        marks={zoomed === 'aim' ? lineup.aimMarks : zoomed === 'position' ? lineup.positionMarks : spot.resultMarks}
        alt={lineup.title}
        onClose={() => setZoomed(undefined)}
      />
    </Drawer>
  )
}

function Shot({ label, icon, color, image, marks = [], onZoom }: { label: string; icon: ReactNode; color: string; image?: Blob; marks?: Mark[]; onZoom: () => void }) {
  const [aspect, setAspect] = useState(16 / 9)
  return (
    <figure>
      <figcaption className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        <span style={{ color }}>{icon}</span>
        {label}
      </figcaption>
      {image ? (
        <button type="button" onClick={onZoom} className="group relative block w-full cursor-zoom-in overflow-hidden rounded-lg border border-line">
          <AnnotatedImage image={image} marks={marks} pulse alt={label} onAspect={setAspect} className="w-full transition-transform duration-500 group-hover:scale-[1.02]" />
        </button>
      ) : (
        <div className="grid aspect-video place-items-center rounded-lg border border-dashed border-line-2 bg-bg-2 text-center text-faint">
          <div>
            <ImageOff size={22} className="mx-auto" />
            <p className="mt-2 text-xs">Sem print ainda. Ative o modo edição pra adicionar.</p>
          </div>
        </div>
      )}
      {image && marks.length > 0 && (
        <ul className="mt-2.5 space-y-2">
          {marks.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg border border-line bg-bg-2 p-2">
              <ZoomLens image={image} mark={m} aspect={aspect} className="w-24 shrink-0 rounded-md" />
              <div className="min-w-0">
                <span className="mb-1 grid size-5 place-items-center rounded-full text-[11px] font-bold text-bg" style={{ background: m.color }}>
                  {i + 1}
                </span>
                <p className="text-sm leading-snug">{m.note || <span className="text-faint">Sem descrição</span>}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}

/* ---------- Edição ---------- */

interface SpotEditorProps {
  spot: Spot
  ability: Ability
  abilities: Ability[]
  lineups: Lineup[]
  onSelectLineup: (id: string) => void
  onClose: () => void
}

export function SpotEditor({ spot, ability, abilities, lineups, onSelectLineup, onClose }: SpotEditorProps) {
  const confirm = useConfirm()
  const [marking, setMarking] = useState(false)
  const shape = ability.shape ?? 'ponto'
  const remove = async () => {
    const ok = await confirm({
      title: `Excluir ${spot.name}?`,
      message: lineups.length
        ? `As ${lineups.length} posições ligadas a este ponto também serão apagadas, junto com os prints.`
        : 'Este ponto ainda não tem posições cadastradas.',
    })
    if (ok) {
      await spotsRepo.remove(spot.id)
      onClose()
    }
  }

  return (
    <Drawer>
      <DrawerHeader eyebrow={<AbilityEyebrow ability={ability} />} title={spot.name} onClose={onClose} />
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <Hint>
          Clique no minimapa para adicionar uma <b className="text-text">posição de lançamento</b> para este ponto.
          {shape === 'ponto'
            ? ' Arraste os marcadores para ajustar.'
            : ` Arraste o ícone para mover a ${SHAPE_LABEL[shape].toLowerCase()} e as alças brancas para ajustar ${shape === 'area' ? 'o raio' : shape === 'cone' ? 'a direção e o alcance' : 'as pontas'}.`}
        </Hint>
        <div>
          <label className="label" htmlFor="spot-name">Nome do ponto</label>
          <CommitInput key={spot.id} id="spot-name" value={spot.name} onCommit={(name) => spotsRepo.update(spot.id, { name })} placeholder="Ex: Garagem, A main, Site B" />
        </div>
        {shape === 'cone' && (
          <div>
            <label className="label" htmlFor="cone-angle">
              Abertura do cone: {spot.angle ?? DEFAULT_ANGLE}°
            </label>
            <input
              id="cone-angle"
              type="range"
              min={15}
              max={180}
              step={5}
              value={spot.angle ?? DEFAULT_ANGLE}
              onChange={(e) => spotsRepo.update(spot.id, { angle: Number(e.target.value) })}
              className="w-full"
              style={{ accentColor: ability.color }}
            />
          </div>
        )}
        <ImageDrop
          label="Como fica em jogo (opcional)"
          hint="Print do efeito: a parede erguida, a ult caindo"
          value={spot.resultImage}
          onChange={(resultImage) => {
            spotsRepo.update(spot.id, { resultImage, resultMarks: [] })
            if (resultImage) setMarking(true)
          }}
          renderImage={() => <AnnotatedImage image={spot.resultImage} marks={spot.resultMarks ?? []} className="max-h-full w-full" />}
          footer={
            spot.resultImage && (
              <button
                type="button"
                onClick={() => setMarking(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-xs font-semibold text-muted transition-colors hover:border-line-2 hover:text-text"
              >
                <Target size={14} />
                {spot.resultMarks?.length ? `Editar marcações (${spot.resultMarks.length})` : 'Marcar detalhes (opcional)'}
              </button>
            )
          }
        />
        <div>
          <span className="label">Habilidade</span>
          <div className="grid grid-cols-4 gap-1.5">
            {abilities.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => spotsRepo.update(spot.id, { abilityId: a.id })}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] font-semibold transition-colors',
                  a.id === spot.abilityId ? 'bg-panel-3 text-text' : 'border-line text-muted hover:border-line-2 hover:text-text',
                )}
                style={a.id === spot.abilityId ? { borderColor: a.color } : undefined}
              >
                <Img source={a.icon} alt="" className="size-5 object-contain" />
                {a.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Posições ({lineups.length})</span>
          {lineups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-2 px-3 py-4 text-center text-xs text-faint">Nenhuma posição ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {lineups.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onSelectLineup(l.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-line bg-bg-2 p-2 text-left transition-colors hover:border-line-2 hover:bg-panel-2"
                  >
                    <div className="aspect-video w-16 shrink-0 overflow-hidden rounded bg-panel-3">
                      <Img source={l.aimImage} alt="" className="size-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="truncate text-xs text-muted">{l.throwType}</p>
                    </div>
                    <ChevronRight size={16} className="text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <footer className="border-t border-line p-4">
        <Button variant="danger" className="w-full" icon={<Trash2 size={15} />} onClick={remove}>
          Excluir ponto
        </Button>
      </footer>
      <MarkEditor
        open={marking}
        title="Marcar · como fica em jogo"
        image={spot.resultImage}
        marks={spot.resultMarks ?? []}
        onClose={(resultMarks) => {
          spotsRepo.update(spot.id, { resultMarks })
          setMarking(false)
        }}
      />
    </Drawer>
  )
}

const THROW_PRESETS = ['Clique esquerdo', 'Clique direito', 'Pulo + clique esquerdo', 'Agachado + clique', 'Correndo + pulo']
const SIDES: Side[] = ['ataque', 'defesa', 'ambos']

interface LineupEditorProps {
  lineup: Lineup
  spot: Spot
  ability: Ability
  onBack: () => void
  onClose: () => void
}

export function LineupEditor({ lineup, spot, ability, onBack, onClose }: LineupEditorProps) {
  const confirm = useConfirm()
  const [marking, setMarking] = useState<'aim' | 'position'>()
  const update = (changes: Partial<Lineup>) => lineupsRepo.update(lineup.id, changes)
  const remove = async () => {
    if (await confirm({ title: `Excluir ${lineup.title}?`, message: 'A posição e os prints dela serão apagados.' })) {
      await lineupsRepo.remove(lineup.id)
      onBack()
    }
  }

  return (
    <Drawer>
      <DrawerHeader eyebrow={<AbilityEyebrow ability={ability} spot={spot} />} title={lineup.title} onBack={onBack} onClose={onClose} />
      <div key={lineup.id} className="flex-1 space-y-5 overflow-y-auto p-4">
        <div>
          <label className="label" htmlFor="lu-title">Nome da posição</label>
          <CommitInput id="lu-title" value={lineup.title} onCommit={(title) => update({ title })} placeholder="Ex: Canto do spawn" />
        </div>
        <ShotField
          label="Print de onde mirar"
          hint="Win+Shift+S no jogo, depois Ctrl+V aqui"
          image={lineup.aimImage}
          marks={lineup.aimMarks}
          onImage={(aimImage) => {
            // print novo invalida as marcações antigas; já abre pra marcar a referência
            update({ aimImage, aimMarks: [] })
            if (aimImage) setMarking('aim')
          }}
          onMark={() => setMarking('aim')}
        />
        <ShotField
          label="Print da posição (opcional)"
          hint="Pra quando precisa estar num ponto exato"
          image={lineup.positionImage}
          marks={lineup.positionMarks}
          onImage={(positionImage) => update({ positionImage, positionMarks: [] })}
          onMark={() => setMarking('position')}
        />
        <div>
          <label className="label" htmlFor="lu-throw">Como lançar</label>
          <CommitInput id="lu-throw" value={lineup.throwType} onCommit={(throwType) => update({ throwType })} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {THROW_PRESETS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update({ throwType: t })}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  lineup.throwType === t ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted hover:border-line-2 hover:text-text',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Lado</span>
          <div className="flex gap-1 rounded-lg border border-line bg-bg-2 p-1">
            {SIDES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => update({ side: s })}
                className={cn('flex-1 rounded-md py-1.5 text-sm font-medium transition-colors', lineup.side === s ? 'bg-panel-3 text-text' : 'text-muted hover:text-text')}
              >
                {SIDE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="lu-notes">Observações</label>
          <CommitTextarea id="lu-notes" rows={4} value={lineup.notes} onCommit={(notes) => update({ notes })} placeholder="Ex: encostar no canto da caixa, mirar na ponta da antena" />
        </div>
      </div>
      <footer className="flex gap-2 border-t border-line p-4">
        <Button variant="subtle" className="flex-1" icon={<MapPin size={15} />} onClick={onBack}>
          Voltar ao ponto
        </Button>
        <Button variant="danger" icon={<Trash2 size={15} />} onClick={remove} aria-label="Excluir posição" />
      </footer>
      <MarkEditor
        open={!!marking}
        title={marking === 'position' ? 'Marcar referência · posição' : 'Marcar referência · mira'}
        image={marking === 'position' ? lineup.positionImage : lineup.aimImage}
        marks={(marking === 'position' ? lineup.positionMarks : lineup.aimMarks) ?? []}
        onClose={(marks) => {
          update(marking === 'position' ? { positionMarks: marks } : { aimMarks: marks })
          setMarking(undefined)
        }}
      />
    </Drawer>
  )
}

function ShotField({ label, hint, image, marks = [], onImage, onMark }: { label: string; hint: string; image?: Blob; marks?: Mark[]; onImage: (b: Blob | undefined) => void; onMark: () => void }) {
  return (
    <ImageDrop
      label={label}
      hint={hint}
      value={image}
      onChange={onImage}
      renderImage={() => <AnnotatedImage image={image} marks={marks} className="max-h-full w-full" />}
      footer={
        image && (
          <button
            type="button"
            onClick={onMark}
            className={cn(
              'mt-2 flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold transition-colors',
              marks.length ? 'border-line text-muted hover:border-line-2 hover:text-text' : 'border-accent/50 bg-accent/10 text-accent hover:bg-accent/15',
            )}
          >
            <Target size={14} />
            {marks.length ? `Editar referências (${marks.length})` : 'Marcar ponto de referência'}
          </button>
        )
      }
    />
  )
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-accent/25 bg-accent/[.06] px-3 py-2.5 text-xs leading-relaxed text-muted">
      <Plus size={15} className="mt-px shrink-0 text-accent" />
      <p>{children}</p>
    </div>
  )
}
