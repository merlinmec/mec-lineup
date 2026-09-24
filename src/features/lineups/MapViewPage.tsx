import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Crosshair, Info, MousePointer2, PencilRuler, Shield, Swords } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { NotFound } from '../../app/NotFound'
import { useEditMode } from '../../app/editMode'
import { db } from '../../db/db'
import { lineupsRepo, spotsRepo } from '../../db/repo'
import type { Ability, Agent, GameMap, Lineup, Shape, Side, Spot } from '../../db/types'
import { countBySpot, matchesSide, sideForNew, spotVisible, useSideFilter, type SideCount, type SideFilter } from '../../lib/sideFilter'
import type { Point } from '../../lib/geometry'
import { cn } from '../../ui/cn'
import { Img } from '../../ui/Img'
import { LineupPreview } from './LineupPreview'
import { LineupLinks, LineupMarker, ShapeHandle, SpotMarker, SpotShape } from './markers'
import { ResultDock, SpotResultPreview } from './SpotResult'
import { geometryFor, iconAnchor, translate, withDefaults, type FullGeometry } from '../../lib/shapes'
import { LineupDetail, LineupEditor, SpotEditor } from './panels'
import { isTyping, Stage } from './Stage'

export function MapViewPage() {
  const { mapId = '' } = useParams()
  const map = useLiveQuery(() => db.maps.get(mapId).then((m) => m ?? null), [mapId])
  if (map === undefined) return null
  if (map === null) return <NotFound message="Esse mapa não existe mais." />
  return <MapView map={map} />
}

function MapView({ map }: { map: GameMap }) {
  const [editing] = useEditMode()
  const [params, setParams] = useSearchParams()
  const agents = useLiveQuery(() => db.agents.orderBy('order').toArray()) ?? []
  const allAbilities = useLiveQuery(() => db.abilities.orderBy('order').toArray()) ?? []
  const settings = useLiveQuery(() => db.settings.get('app'))
  const spots = useLiveQuery(() => db.spots.where('mapId').equals(map.id).sortBy('createdAt'), [map.id]) ?? []
  const [sideFilter, setSideFilter] = useSideFilter()
  const spotSides = (useLiveQuery(() => db.lineups.orderBy('[spotId+side]').keys()) ?? []) as unknown as [string, Side][]

  const agentId = params.get('agente') ?? readLastAgent()
  const agent = agents.find((a) => a.id === agentId) ?? agents[0]
  const abilities = allAbilities.filter((a) => a.agentId === agent?.id)
  const abilityId = params.get('hab')
  const ability = abilities.find((a) => a.id === abilityId) ?? abilities[0]
  const spotId = params.get('ponto')
  const selectedSpot = spots.find((s) => s.id === spotId && s.abilityId === ability?.id)
  const lineups =
    useLiveQuery(
      (): Promise<Lineup[]> => (selectedSpot ? db.lineups.where('spotId').equals(selectedSpot.id).sortBy('createdAt') : Promise.resolve([])),
      [selectedSpot?.id],
    ) ?? []

  const [lineupId, setLineupId] = useState<string | null>(null)
  const [hoverLineup, setHoverLineup] = useState<string | null>(null)
  const [hoverSpot, setHoverSpot] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; p: Point } | null>(null)
  /** Geometria ao vivo da forma sendo arrastada (ícone ou alça), antes de salvar. */
  const [shapeDrag, setShapeDrag] = useState<{ id: string; g: FullGeometry } | null>(null)

  const sideCounts = useMemo(() => countBySpot(spotSides, sideFilter), [spotSides, sideFilter])
  // consulta: esconde ponto só do outro lado; edição: mostra tudo pra poder editar
  const abilitySpots = spots.filter((s) => s.abilityId === ability?.id && (editing || spotVisible(sideCounts.get(s.id))))
  const shape: Shape = ability?.shape ?? 'ponto'
  const lineupCount = useMemo(() => new Map([...sideCounts].map(([id, c]) => [id, c.match])), [sideCounts])

  const setQuery = useCallback(
    (next: { agente?: string; hab?: string | null; ponto?: string | null }) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next.agente) p.set('agente', next.agente)
          if (next.hab === null) p.delete('hab')
          else if (next.hab) p.set('hab', next.hab)
          if (next.ponto === null) p.delete('ponto')
          else if (next.ponto) p.set('ponto', next.ponto)
          return p
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const selectAbility = useCallback(
    (id: string) => {
      setLineupId(null)
      setQuery({ hab: id, ponto: null })
    },
    [setQuery],
  )
  const selectAgent = (id: string) => {
    writeLastAgent(id)
    setLineupId(null)
    setQuery({ agente: id, hab: null, ponto: null })
  }
  const selectSpot = (id: string | null) => {
    setLineupId(null)
    setHoverLineup(null)
    setQuery({ ponto: id })
  }

  // editor e painel fixo são coisas diferentes: trocar de modo fecha a posição aberta
  useEffect(() => setLineupId(null), [editing])

  const matching = lineups.filter((l) => matchesSide(l.side, sideFilter))
  const shownLineups = editing ? lineups : matching
  const openLineup = lineups.find((l) => l.id === lineupId)
  const hovered = shownLineups.find((l) => l.id === hoverLineup)

  const onBackgroundClick = async (p: Point) => {
    if (editing && ability) {
      if (selectedSpot) {
        const l = await lineupsRepo.create({ spotId: selectedSpot.id, ...p }, sideForNew(sideFilter))
        setLineupId(l.id)
      } else {
        const s = await spotsRepo.create({ mapId: map.id, abilityId: ability.id, ...p }, shape)
        selectSpot(s.id)
      }
      return
    }
    if (lineupId) setLineupId(null)
    else if (selectedSpot) selectSpot(null)
  }

  // atalhos: 1-9 troca habilidade, Esc volta um nível, ←/→ navega entre posições
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const n = Number(e.key)
      if (n >= 1 && n <= abilities.length) selectAbility(abilities[n - 1].id)
      else if (e.key === 'Escape') {
        if (lineupId) setLineupId(null)
        else if (spotId) setQuery({ ponto: null })
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && lineupId && shownLineups.length > 1) {
        const i = shownLineups.findIndex((l) => l.id === lineupId)
        const dir = e.key === 'ArrowLeft' ? -1 : 1
        setLineupId(shownLineups[(i + dir + shownLineups.length) % shownLineups.length].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abilities, selectAbility, lineupId, spotId, shownLineups, setQuery])

  const drawerOpen = editing ? !!selectedSpot : !!openLineup
  const tactical = (settings?.minimapStyle ?? 'tatico') === 'tatico'
  const playerIcon = agent?.icon ?? {}
  const livePoint = (id: string, p: Point) => (dragging?.id === id ? dragging.p : p)
  const storedGeom = (sp: Spot) => withDefaults(sp, shape)
  const liveGeom = (sp: Spot) => (shapeDrag?.id === sp.id ? shapeDrag.g : storedGeom(sp))
  const anchorOf = (sp: Spot) => iconAnchor(liveGeom(sp), shape)
  const saveGeom = (id: string, g: FullGeometry) => spotsRepo.update(id, geometryFor(g, shape))
  const hoveredSpot = abilitySpots.find((sp) => sp.id === hoverSpot)
  const spotState = (id: string) =>
    id === selectedSpot?.id ? 'selecionado' : selectedSpot ? 'apagado' : id === hoverSpot ? 'destacado' : ('normal' as const)

  return (
    <div className="relative flex h-full overflow-hidden">
      <Backdrop map={map} />

      <Sidebar
        map={map}
        agents={agents}
        agent={agent}
        onSelectAgent={selectAgent}
        abilities={abilities}
        ability={ability}
        spots={spots}
        abilitySpots={abilitySpots}
        selectedSpot={selectedSpot}
        lineupCount={lineupCount}
        sideCounts={sideCounts}
        editing={editing}
        onSelectAbility={selectAbility}
        onSelectSpot={(id) => selectSpot(id === selectedSpot?.id && !editing ? null : id)}
        onHoverSpot={setHoverSpot}
      />

      <section className="relative min-w-0 flex-1">
        <div className="absolute inset-0 flex flex-col" style={{ right: drawerOpen ? 400 : 0, transition: 'right 300ms cubic-bezier(.25,1,.5,1)' }}>
          <StageTopBar
            editing={editing}
            ability={ability}
            spot={selectedSpot}
            hasSpots={abilitySpots.length > 0}
            lineupCount={matching.length}
            sideFilter={sideFilter}
            onSideFilter={setSideFilter}
            tactical={tactical}
            onToggleStyle={() => db.settings.update('app', { minimapStyle: tactical ? 'original' : 'tatico' })}
          />
          <motion.div
            className="min-h-0 flex-1"
            initial={{ opacity: 0, scale: 0.94, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          >
            <Stage
              minimap={map.minimap}
              rotation={map.rotation}
              tactical={tactical}
              cursor={editing ? 'cursor-crosshair' : 'cursor-default'}
              onBackgroundClick={onBackgroundClick}
              overlay={
                <>
                  <AnimatePresence>
                    {hovered && !dragging && hovered.id !== lineupId && <LineupPreview key={hovered.id} lineup={hovered} color={ability?.color ?? '#fff'} />}
                    {!hovered && !dragging && !shapeDrag && hoveredSpot?.resultImage && ability && hoveredSpot.id !== selectedSpot?.id && (
                      <SpotResultPreview key={`res-${hoveredSpot.id}`} spot={hoveredSpot} ability={ability} at={anchorOf(hoveredSpot)} />
                    )}
                  </AnimatePresence>
                  <AnimatePresence>{selectedSpot && ability && !editing && <ResultDock key={`dock-${selectedSpot.id}`} spot={selectedSpot} ability={ability} />}</AnimatePresence>
                </>
              }
            >
              {ability && (
                <>
                  <AnimatePresence>
                    {abilitySpots.map((sp) => (
                      <SpotShape
                        key={`shape-${sp.id}`}
                        shape={shape}
                        g={liveGeom(sp)}
                        color={ability.color}
                        state={spotState(sp.id)}
                        onClick={() => selectSpot(sp.id === selectedSpot?.id && !editing ? null : sp.id)}
                      />
                    ))}
                  </AnimatePresence>

                  <AnimatePresence>
                    {selectedSpot && (
                      <motion.div key={selectedSpot.id} className="absolute inset-0" exit={{ opacity: 0 }}>
                        <LineupLinks
                          spot={anchorOf(selectedSpot)}
                          lineups={shownLineups.map((l) => ({ id: l.id, ...livePoint(l.id, l) }))}
                          color={ability.color}
                          activeId={hoverLineup ?? lineupId ?? undefined}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {abilitySpots.map((s, i) => {
                      // o ícone fica no meio da linha / centro da área: arrastar move a forma inteira
                      const base = storedGeom(s)
                      const anchor = iconAnchor(base, shape)
                      const moved = (p: Point) => translate(base, p.x - anchor.x, p.y - anchor.y)
                      return (
                        <SpotMarker
                          key={s.id}
                          point={anchor}
                          ability={ability}
                          name={s.name}
                          delay={0.25 + i * 0.03}
                          state={spotState(s.id)}
                          draggable={editing}
                          onClick={() => selectSpot(s.id === selectedSpot?.id && !editing ? null : s.id)}
                          onMove={(p) => saveGeom(s.id, moved(p))}
                          onDrag={(p) => setShapeDrag(p ? { id: s.id, g: moved(p) } : null)}
                          onHover={(h) => setHoverSpot(h ? s.id : (cur) => (cur === s.id ? null : cur))}
                        />
                      )
                    })}
                    {editing && selectedSpot && (
                      <ShapeHandles
                        key={`handles-${selectedSpot.id}`}
                        spot={selectedSpot}
                        shape={shape}
                        base={storedGeom(selectedSpot)}
                        onDrag={(g) => setShapeDrag(g ? { id: selectedSpot.id, g } : null)}
                        onSave={(g) => saveGeom(selectedSpot.id, g)}
                      />
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {selectedSpot &&
                      shownLineups.map((l, i) => (
                        <LineupMarker
                          dimmed={!matchesSide(l.side, sideFilter)}
                          key={l.id}
                          point={l}
                          from={anchorOf(selectedSpot)}
                          color={ability.color}
                          icon={playerIcon}
                          label={`Posição: ${l.title}`}
                          active={l.id === lineupId || l.id === hoverLineup}
                          draggable={editing}
                          delay={0.05 + i * 0.045}
                          onClick={() => setLineupId(l.id)}
                          onMove={(p) => lineupsRepo.update(l.id, p)}
                          onDrag={(p) => setDragging(p ? { id: l.id, p } : null)}
                          onHover={(h) => setHoverLineup(h ? l.id : (cur) => (cur === l.id ? null : cur))}
                        />
                      ))}
                  </AnimatePresence>
                </>
              )}
            </Stage>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {ability && selectedSpot && editing && !openLineup && (
            <SpotEditor
              key={`spot-${selectedSpot.id}`}
              spot={selectedSpot}
              ability={ability}
              abilities={abilities}
              lineups={lineups}
              onSelectLineup={setLineupId}
              onClose={() => selectSpot(null)}
            />
          )}
          {ability && selectedSpot && editing && openLineup && (
            <LineupEditor
              key={`lu-${openLineup.id}`}
              lineup={openLineup}
              spot={selectedSpot}
              ability={ability}
              onBack={() => setLineupId(null)}
              onClose={() => selectSpot(null)}
            />
          )}
          {ability && selectedSpot && !editing && openLineup && (
            <LineupDetail
              key="detail"
              lineup={openLineup}
              siblings={matching.some((l) => l.id === openLineup.id) ? matching : lineups}
              spot={selectedSpot}
              ability={ability}
              onNavigate={setLineupId}
              onClose={() => setLineupId(null)}
            />
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}

/** Arte do mapa bem desfocada ao fundo: dá identidade sem competir com o minimapa. */
function Backdrop({ map }: { map: GameMap }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-0">
      <Img source={map.cover} alt="" className="absolute inset-0 size-full scale-110 object-cover !opacity-[.13] blur-2xl" />
      <div className="bg-grid absolute inset-0 opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--color-bg)_85%)]" />
    </div>
  )
}

interface SidebarProps {
  map: GameMap
  agents: Agent[]
  agent?: Agent
  onSelectAgent: (id: string) => void
  abilities: Ability[]
  ability?: Ability
  spots: Spot[]
  abilitySpots: Spot[]
  selectedSpot?: Spot
  lineupCount: Map<string, number>
  sideCounts: Map<string, SideCount>
  editing: boolean
  onSelectAbility: (id: string) => void
  onSelectSpot: (id: string) => void
  onHoverSpot: (id: string | null) => void
}

function Sidebar({ map, agents, agent, onSelectAgent, abilities, ability, spots, abilitySpots, selectedSpot, lineupCount, sideCounts, editing, onSelectAbility, onSelectSpot, onHoverSpot }: SidebarProps) {
  return (
    <motion.aside
      className="relative z-20 flex w-[300px] shrink-0 flex-col border-r border-line bg-panel/80 backdrop-blur-md"
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative h-32 shrink-0 overflow-hidden border-b border-line">
        <Img source={map.cover} alt="" className="absolute inset-0 size-full object-cover object-[center_40%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/40 to-transparent" />
        <Link
          to="/"
          className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-bg/70 px-2 py-1 text-xs font-semibold text-text/90 backdrop-blur transition-colors hover:bg-bg hover:text-accent"
        >
          <ArrowLeft size={13} /> Mapas
        </Link>
        <div className="absolute inset-x-4 bottom-3">
          <h1 className="font-display text-4xl font-bold leading-none">{map.name}</h1>
          {map.subtitle && <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{map.subtitle}</p>}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <section>
          <h2 className="label">
            Agente {agent && <span className="text-text">· {agent.name}</span>}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {agents.map((a) => {
              const active = a.id === agent?.id
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelectAgent(a.id)}
                  aria-label={a.name}
                  aria-pressed={active}
                  title={a.name}
                  className={cn(
                    'relative size-12 overflow-hidden rounded-lg border bg-bg-2 transition-[border-color,opacity,scale] duration-200 active:scale-95',
                    active ? 'border-accent' : 'border-line opacity-55 hover:border-line-2 hover:opacity-100',
                  )}
                >
                  <Img source={a.icon} maxSize={128} alt="" className="size-full object-cover" />
                  {active && (
                    <motion.span
                      layoutId="agent-active"
                      className="absolute inset-0 rounded-lg shadow-[inset_0_0_0_2px_var(--color-accent)]"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="label">Habilidade</h2>
          <div className="space-y-1.5">
            {abilities.map((a, i) => {
              const active = a.id === ability?.id
              const count = spots.filter((s) => s.abilityId === a.id && (editing || spotVisible(sideCounts.get(s.id)))).length
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelectAbility(a.id)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-[background,border-color] duration-200',
                    active ? 'border-transparent bg-panel-3' : 'border-line bg-bg-2/60 hover:border-line-2 hover:bg-panel-2',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="ability-active"
                      className="absolute inset-0 rounded-lg border"
                      style={{ borderColor: a.color, background: `linear-gradient(90deg, ${a.color}22, transparent 70%)` }}
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative grid size-9 shrink-0 place-items-center rounded-md bg-bg/70" style={{ boxShadow: active ? `inset 0 0 0 1px ${a.color}66` : undefined }}>
                    <Img source={a.icon} alt="" className="size-6 object-contain" fallback={<span className="size-3 rounded-full" style={{ background: a.color }} />} />
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <span className="font-display block text-lg font-semibold leading-tight">{a.name}</span>
                    <span className="block text-[11px] text-muted">
                      {count} {count === 1 ? 'ponto' : 'pontos'}
                    </span>
                  </span>
                  <kbd className="relative grid size-6 place-items-center rounded border border-line-2 bg-bg/60 text-[11px] font-semibold text-muted" title={`Atalho: ${i + 1}`}>
                    {i + 1}
                  </kbd>
                </button>
              )
            })}
          </div>
        </section>

        <section className="min-h-0">
          <h2 className="label">
            Pontos {ability && <span style={{ color: ability.color }}>· {ability.name}</span>}
          </h2>
          {abilitySpots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-2 px-3 py-4 text-center text-xs leading-relaxed text-faint">
              {editing ? 'Clique no minimapa para marcar onde a habilidade cai.' : 'Nenhum ponto cadastrado. Ative o modo edição para adicionar.'}
            </p>
          ) : (
            <ul className="space-y-1">
              <AnimatePresence initial={false}>
                {abilitySpots.map((s) => {
                  const n = lineupCount.get(s.id) ?? 0
                  const active = s.id === selectedSpot?.id
                  return (
                    <motion.li key={s.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}>
                      <button
                        type="button"
                        onClick={() => onSelectSpot(s.id)}
                        onMouseEnter={() => onHoverSpot(s.id)}
                        onMouseLeave={() => onHoverSpot(null)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                          active ? 'bg-panel-3 text-text' : 'text-muted hover:bg-panel-2 hover:text-text',
                        )}
                      >
                        <Crosshair size={13} style={{ color: ability?.color }} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        <span className="text-[11px] tabular-nums text-faint">{n}</span>
                      </button>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>

      <footer className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line px-4 py-3 text-[11px] text-faint">
        <Shortcut k="1-4">habilidade</Shortcut>
        <Shortcut k="Esc">voltar</Shortcut>
        <Shortcut k="Roda">zoom</Shortcut>
        <Shortcut k="← →">posições</Shortcut>
      </footer>
    </motion.aside>
  )
}

function Shortcut({ k, children }: { k: string; children: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded border border-line bg-bg-2 px-1 py-px font-sans text-[10px] font-semibold text-muted">{k}</kbd>
      {children}
    </span>
  )
}

interface TopBarProps {
  editing: boolean
  ability?: Ability
  spot?: Spot
  hasSpots: boolean
  lineupCount: number
  sideFilter: SideFilter
  onSideFilter: (f: SideFilter) => void
  tactical: boolean
  onToggleStyle: () => void
}

const SIDE_OPTIONS: { value: SideFilter; label: string; icon: ReactNode; active: string }[] = [
  { value: 'todos', label: 'Todos', icon: null, active: 'bg-panel-3 text-text' },
  { value: 'ataque', label: 'Ataque', icon: <Swords size={13} />, active: 'bg-danger/20 text-[#ff7a85]' },
  { value: 'defesa', label: 'Defesa', icon: <Shield size={13} />, active: 'bg-defesa/15 text-defesa' },
]

function StageTopBar({ editing, ability, spot, hasSpots, lineupCount, sideFilter, onSideFilter, tactical, onToggleStyle }: TopBarProps) {
  // sem artigo antes do nome: "a Flecha" x "o Veneno" varia por habilidade
  const name = ability?.name ?? 'habilidade'
  const message = editing
    ? spot
      ? `Clique no mapa para adicionar uma posição de lançamento para "${spot.name}"`
      : `Clique no mapa para marcar onde cai: ${name}`
    : spot
      ? lineupCount
        ? `${lineupCount} ${lineupCount === 1 ? 'posição' : 'posições'}. Passe o mouse para ver onde mirar`
        : sideFilter === 'todos'
          ? 'Este ponto ainda não tem posições cadastradas'
          : `Nenhuma posição de ${sideFilter} neste ponto`
      : hasSpots
        ? `Escolha no mapa um ponto de ${name}`
        : sideFilter === 'todos'
          ? `Nenhum ponto de ${name} neste mapa ainda`
          : `Nenhum ponto de ${name} para ${sideFilter} neste mapa`

  return (
    <div className="relative z-10 flex h-16 shrink-0 items-center gap-3 px-6">
      <div className="flex rounded-lg border border-line bg-panel/80 p-0.5 text-xs font-semibold backdrop-blur">
        {(['Tático', 'Original'] as const).map((label, i) => {
          const on = tactical === (i === 0)
          return (
            <button
              key={label}
              type="button"
              onClick={() => !on && onToggleStyle()}
              className={cn('rounded-md px-2.5 py-1.5 transition-colors', on ? 'bg-panel-3 text-text' : 'text-muted hover:text-text')}
            >
              {label}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={message}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.18 }}
          className={cn(
            'mx-auto flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] backdrop-blur',
            editing ? 'border-accent/40 bg-accent/10 text-accent' : 'border-line bg-panel/80 text-muted',
          )}
        >
          {editing ? <PencilRuler size={14} /> : spot ? <MousePointer2 size={14} /> : <Info size={14} />}
          {message}
          {spot && <kbd className="ml-1 rounded border border-current/30 px-1 text-[10px] font-semibold opacity-70">Esc</kbd>}
        </motion.div>
      </AnimatePresence>

      <div className="flex rounded-lg border border-line bg-panel/80 p-0.5 text-xs font-semibold backdrop-blur" role="radiogroup" aria-label="Filtrar por lado">
        {SIDE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={sideFilter === o.value}
            onClick={() => onSideFilter(o.value)}
            className={cn('relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors', sideFilter === o.value ? o.active : 'text-muted hover:text-text')}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Último agente usado, pra abrir outros mapas já nele. */
const LAST_AGENT = 'mec-lineup:agente'
function readLastAgent() {
  try {
    return localStorage.getItem(LAST_AGENT)
  } catch {
    return null
  }
}
function writeLastAgent(id: string) {
  try {
    localStorage.setItem(LAST_AGENT, id)
  } catch {
    /* armazenamento bloqueado: só não lembra */
  }
}

/** Alças de ajuste da forma selecionada: pontas da linha, raio da área, alcance do cone. */
function ShapeHandles({ spot, shape, base, onDrag, onSave }: { spot: Spot; shape: Shape; base: FullGeometry; onDrag: (g: FullGeometry | null) => void; onSave: (g: FullGeometry) => void }) {
  if (shape === 'ponto') return null
  const handle = (key: string, label: string, at: Point, apply: (p: Point) => FullGeometry) => (
    <ShapeHandle key={`${spot.id}-${key}`} point={at} label={label} onDrag={(p) => onDrag(p ? apply(p) : null)} onDragEnd={(p) => onSave(apply(p))} />
  )
  if (shape === 'area') {
    return handle('raio', 'Raio da área', { x: Math.min(1, base.x + base.r), y: base.y }, (p) => ({ ...base, r: Math.max(0.008, Math.hypot(p.x - base.x, p.y - base.y)) }))
  }
  return (
    <>
      {shape === 'linha' && handle('inicio', 'Início da linha', { x: base.x, y: base.y }, (p) => ({ ...base, x: p.x, y: p.y }))}
      {handle('fim', shape === 'cone' ? 'Direção e alcance do cone' : 'Fim da linha', { x: base.x2, y: base.y2 }, (p) => ({ ...base, x2: p.x, y2: p.y }))}
    </>
  )
}
