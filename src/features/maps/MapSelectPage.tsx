import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Trash2, WifiOff } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useEditMode } from '../../app/editMode'
import { useSeedStatus } from '../../app/seedStatus'
import { db } from '../../db/db'
import { mapsRepo } from '../../db/repo'
import type { GameMap } from '../../db/types'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { useConfirm } from '../../ui/Confirm'
import { Img } from '../../ui/Img'
import { MapFormDialog } from './MapFormDialog'

const EXPAND_MS = 480

export function MapSelectPage() {
  const maps = useLiveQuery(() => db.maps.orderBy('order').toArray())
  const counts = useLineupCounts()
  const { status, retry } = useSeedStatus()
  const [editing] = useEditMode()
  const [chosen, setChosen] = useState<string>()
  const [form, setForm] = useState<{ open: boolean; map?: GameMap }>({ open: false })
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const confirm = useConfirm()
  const row = useRef<HTMLDivElement>(null)

  const open = (id: string) => {
    if (chosen) return
    setChosen(id)
    setTimeout(() => navigate(`/mapa/${id}`), reduced ? 0 : EXPAND_MS)
  }

  const remove = async (map: GameMap) => {
    const n = counts.get(map.id)?.lineups ?? 0
    const ok = await confirm({
      title: `Excluir ${map.name}?`,
      message: n
        ? `Isso apaga também ${n} ${n === 1 ? 'posição cadastrada' : 'posições cadastradas'} nesse mapa. Não dá pra desfazer.`
        : 'O mapa sai do menu. Você pode recriá-lo depois em Configurações → Recarregar mapas oficiais.',
    })
    if (ok) await mapsRepo.remove(map.id)
  }

  if (!maps) return null

  if (maps.length === 0 && !editing) {
    return <EmptyState status={status} onRetry={retry} onCreate={() => setForm({ open: true })} />
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={row}
        className="group/row flex h-full overflow-x-auto overflow-y-hidden"
        onWheel={(e) => {
          // roda do mouse rola na horizontal quando há mais mapas que a largura
          if (row.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) row.current.scrollLeft += e.deltaY
        }}
      >
        {maps.map((map, i) => (
          <MapColumn
            key={map.id}
            map={map}
            index={i}
            count={counts.get(map.id)}
            chosen={chosen}
            editing={editing}
            isFirst={i === 0}
            isLast={i === maps.length - 1}
            onOpen={() => open(map.id)}
            onEdit={() => setForm({ open: true, map })}
            onRemove={() => remove(map)}
          />
        ))}
        {editing && (
          <motion.button
            type="button"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 132 }}
            exit={{ opacity: 0, width: 0 }}
            onClick={() => setForm({ open: true })}
            className="flex shrink-0 flex-col items-center justify-center gap-3 border-l border-dashed border-line-2 bg-bg-2 text-muted transition-colors hover:bg-panel hover:text-accent"
          >
            <span className="grid size-12 place-items-center rounded-full border border-dashed border-current">
              <Plus size={22} />
            </span>
            <span className="font-display text-sm font-semibold">Novo mapa</span>
          </motion.button>
        )}
      </div>

      <MapFormDialog open={form.open} map={form.map} onClose={() => setForm({ open: false })} />
    </div>
  )
}

interface ColumnProps {
  map: GameMap
  index: number
  count?: { spots: number; lineups: number }
  chosen?: string
  editing: boolean
  isFirst: boolean
  isLast: boolean
  onOpen: () => void
  onEdit: () => void
  onRemove: () => void
}

function MapColumn({ map, index, count, chosen, editing, isFirst, isLast, onOpen, onEdit, onRemove }: ColumnProps) {
  const isChosen = chosen === map.id
  const faded = !!chosen && !isChosen

  return (
    // Só opacidade/transform na entrada (rodam na GPU); clip-path e filter em
    // 13 camadas grandes faziam a abertura do menu engasgar.
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: faded ? 0 : 1, y: 0 }}
      transition={{ duration: 0.6, delay: chosen ? 0 : 0.035 * index, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group/col @container relative h-full min-w-[118px] cursor-pointer overflow-hidden border-r border-bg',
        'transition-[flex-grow] duration-500 ease-[cubic-bezier(.16,1,.3,1)]',
        isChosen ? 'grow-[60]' : faded ? 'grow-0 !min-w-0' : 'grow hover:grow-[3]',
      )}
      style={{ flexBasis: 0 }}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      role="link"
      tabIndex={0}
      aria-label={`Abrir ${map.name}`}
    >
      <Img
        source={map.cover}
        alt=""
        className="absolute inset-0 size-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover/col:scale-[1.06]"
        fallback={<div className="bg-grid absolute inset-0 bg-panel" />}
      />
      {/* legibilidade do nome + escurece as outras colunas no hover + faixa de cor */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-transparent to-bg/85" />
      {!chosen && (
        <div className="absolute inset-0 bg-bg opacity-0 transition-opacity duration-300 group-hover/row:opacity-45 group-hover/col:!opacity-0" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-accent transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover/col:scale-x-100" />

      <div className="absolute inset-x-0 top-[44%] flex -translate-y-1/2 flex-col items-center px-2 text-center">
        <h2
          className="font-display font-bold leading-none text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.7)]"
          style={{ fontSize: 'min(20cqi, 3.25rem)' }}
        >
          {map.name}
        </h2>
        {map.subtitle && (
          <p className="mt-2 max-h-0 overflow-hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 opacity-0 transition-all duration-300 group-hover/col:max-h-6 group-hover/col:opacity-100">
            {map.subtitle}
          </p>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-6 flex justify-center">
        <span
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
            count?.lineups
              ? 'border-accent/40 bg-bg/80 text-accent'
              : 'border-white/15 bg-bg/60 text-white/60',
          )}
        >
          {count?.lineups ?? 0} {count?.lineups === 1 ? 'lineup' : 'lineups'}
        </span>
      </div>

      {editing && !chosen && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-x-0 top-3 flex justify-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <ColumnAction label="Mover para a esquerda" disabled={isFirst} onClick={() => mapsRepo.move(map.id, -1)}>
            <ChevronLeft size={15} />
          </ColumnAction>
          <ColumnAction label="Editar mapa" onClick={onEdit}>
            <Pencil size={14} />
          </ColumnAction>
          <ColumnAction label="Excluir mapa" danger onClick={onRemove}>
            <Trash2 size={14} />
          </ColumnAction>
          <ColumnAction label="Mover para a direita" disabled={isLast} onClick={() => mapsRepo.move(map.id, 1)}>
            <ChevronRight size={15} />
          </ColumnAction>
        </motion.div>
      )}
    </motion.div>
  )
}

function ColumnAction(props: { label: string; danger?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        'grid size-7 place-items-center rounded-md border border-white/10 bg-bg/75 text-white/80 backdrop-blur transition-colors disabled:opacity-30',
        props.danger ? 'hover:bg-danger hover:text-white' : 'hover:bg-accent hover:text-bg',
      )}
    >
      {props.children}
    </button>
  )
}

function EmptyState({ status, onRetry, onCreate }: { status: string; onRetry: () => void; onCreate: () => void }) {
  return (
    <div className="bg-grid grid h-full place-items-center">
      <div className="max-w-sm text-center">
        {status === 'erro' ? (
          <>
            <WifiOff className="mx-auto text-muted" size={32} />
            <h2 className="font-display mt-4 text-2xl font-semibold">Não deu pra baixar os mapas</h2>
            <p className="mt-2 text-sm text-muted">
              Os mapas oficiais vêm da valorant-api.com. Confira a conexão e tente de novo, ou cadastre um mapa manualmente.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="primary" icon={<RefreshCw size={15} />} onClick={onRetry}>
                Tentar de novo
              </Button>
              <Button onClick={onCreate}>Cadastrar mapa</Button>
            </div>
          </>
        ) : status === 'carregando' ? (
          <p className="font-display animate-pulse text-xl text-muted">Carregando mapas…</p>
        ) : (
          <>
            <h2 className="font-display text-2xl font-semibold">Nenhum mapa ainda</h2>
            <p className="mt-2 text-sm text-muted">Ative o modo edição e adicione o primeiro.</p>
            <Button variant="primary" className="mt-6" icon={<Plus size={15} />} onClick={onCreate}>
              Novo mapa
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Conta pontos e posições por mapa. Das posições lê só as chaves do índice
 * spotId, pra não carregar os prints na memória só pra contar.
 */
function useLineupCounts() {
  const spots = useLiveQuery(() => db.spots.toArray())
  const lineupSpotIds = useLiveQuery(() => db.lineups.orderBy('spotId').keys())
  return useMemo(() => {
    const out = new Map<string, { spots: number; lineups: number }>()
    const spotMap = new Map<string, string>()
    for (const s of spots ?? []) {
      spotMap.set(s.id, s.mapId)
      const c = out.get(s.mapId) ?? { spots: 0, lineups: 0 }
      c.spots++
      out.set(s.mapId, c)
    }
    for (const spotId of lineupSpotIds ?? []) {
      const mapId = spotMap.get(spotId as string)
      if (mapId) out.get(mapId)!.lineups++
    }
    return out
  }, [spots, lineupSpotIds])
}
