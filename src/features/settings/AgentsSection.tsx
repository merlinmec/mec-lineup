import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { db } from '../../db/db'
import { abilitiesRepo, agentsRepo } from '../../db/repo'
import type { Ability, Agent } from '../../db/types'
import { agentIconUrl, defaultAbilityIcon, fetchAgents } from '../../lib/valorantApi'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { useConfirm } from '../../ui/Confirm'
import { CommitInput } from '../../ui/fields'
import { ImageDrop } from '../../ui/ImageDrop'
import { Img } from '../../ui/Img'
import { Modal } from '../../ui/Modal'
import { SHAPE_HINT, SHAPE_LABEL } from '../../lib/shapes'
import { defaultSize } from '../../lib/valorantApi'
import type { AbilitySize, Shape } from '../../db/types'
import { useToast } from '../../ui/Toast'

const SWATCHES = ['#c6f432', '#34e3b0', '#3cc8f0', '#ff5470', '#ffb547', '#b58cff', '#ffffff']

/** Agentes em abas; cada aba edita o retrato e as habilidades daquele agente. */
export function AgentsSection() {
  const agents = useLiveQuery(() => db.agents.orderBy('order').toArray())
  const [selectedId, setSelectedId] = useState<string>()
  const [adding, setAdding] = useState(false)
  const confirm = useConfirm()

  const selected = agents?.find((a) => a.id === selectedId) ?? agents?.[0]
  const index = agents && selected ? agents.indexOf(selected) : -1

  const remove = async (agent: Agent) => {
    const abilityIds = await db.abilities.where('agentId').equals(agent.id).primaryKeys()
    const spots = await db.spots.where('abilityId').anyOf(abilityIds).count()
    const ok = await confirm({
      title: `Remover ${agent.name}?`,
      message: spots
        ? `${spots} ${spots === 1 ? 'ponto' : 'pontos'} de ${agent.name} (e todas as posições) serão apagados em todos os mapas.`
        : `${agent.name} ainda não tem pontos cadastrados. Dá pra adicionar de volta depois.`,
      confirmLabel: 'Remover',
    })
    if (ok) {
      await agentsRepo.remove(agent.id)
      setSelectedId(undefined)
    }
  }

  if (!agents) return null

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        {agents.map((a) => {
          const active = a.id === selected?.id
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedId(a.id)}
              className={cn(
                'group relative flex w-20 flex-col items-center gap-1.5 rounded-xl border p-2 transition-[border-color,background] duration-200',
                active ? 'border-accent/60 bg-panel-2' : 'border-line bg-panel hover:border-line-2',
              )}
            >
              <span className="size-14 overflow-hidden rounded-lg bg-bg-2">
                <Img source={a.icon} maxSize={128} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </span>
              <span className={cn('max-w-full truncate text-xs font-semibold', active ? 'text-text' : 'text-muted')}>{a.name}</span>
              {active && <motion.span layoutId="settings-agent" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-[98px] w-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-2 text-muted transition-colors hover:border-accent/60 hover:text-accent"
        >
          <Plus size={18} />
          <span className="text-xs font-semibold">Agente</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mt-5"
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-semibold">{selected.name}</h3>
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" aria-label="Mover agente para a esquerda" disabled={index <= 0} onClick={() => agentsRepo.move(agents, index, -1)} icon={<ChevronLeft size={15} />} />
                <Button size="sm" variant="ghost" aria-label="Mover agente para a direita" disabled={index >= agents.length - 1} onClick={() => agentsRepo.move(agents, index, 1)} icon={<ChevronRight size={15} />} />
                <Button size="sm" variant="ghost" className="hover:!text-danger" icon={<Trash2 size={14} />} onClick={() => remove(selected)}>
                  Remover agente
                </Button>
              </div>
            </div>
            <AgentEditor agent={selected} />
          </motion.div>
        )}
      </AnimatePresence>

      <AddAgentDialog
        open={adding}
        existing={new Set(agents.map((a) => a.id))}
        onClose={() => setAdding(false)}
        onAdded={(id) => {
          setAdding(false)
          setSelectedId(id)
        }}
      />
    </div>
  )
}

function AgentEditor({ agent }: { agent: Agent }) {
  const abilities = useLiveQuery(() => db.abilities.where('agentId').equals(agent.id).sortBy('order'), [agent.id])
  const confirm = useConfirm()
  const defaultIcon = agentIconUrl(agent.id)

  const removeAbility = async (a: Ability) => {
    const spots = await db.spots.where('abilityId').equals(a.id).count()
    const ok = await confirm({
      title: `Excluir ${a.name}?`,
      message: spots ? `${spots} ${spots === 1 ? 'ponto' : 'pontos'} dessa habilidade (e todas as posições) serão apagados em todos os mapas.` : 'Nenhum ponto usa essa habilidade.',
    })
    if (ok) await abilitiesRepo.remove(a.id)
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[150px_1fr]">
      <div>
        <ImageDrop
          label="Retrato"
          hint="Vira o marcador de posição"
          aspect="1/1"
          maxSize={256}
          value={agent.icon}
          onChange={(blob) => agentsRepo.update(agent.id, { icon: { url: agent.icon.url ?? defaultIcon, blob } })}
          onReset={agent.icon.url ? () => agentsRepo.update(agent.id, { icon: { url: agent.icon.url } }) : undefined}
        />
        <label className="label mt-3" htmlFor={`agent-name-${agent.id}`}>Nome</label>
        <CommitInput id={`agent-name-${agent.id}`} value={agent.name} onCommit={(name) => agentsRepo.update(agent.id, { name: name || agent.name })} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {abilities?.map((a, i) => (
          <motion.div layout key={a.id} className="flex gap-4 rounded-xl border border-line bg-panel p-4" style={{ borderLeft: `3px solid ${a.color}` }}>
            <div className="w-20 shrink-0">
              <ImageDrop
                label="Ícone"
                hint="PNG"
                aspect="1/1"
                fit="contain"
                maxSize={256}
                value={a.icon}
                onChange={(blob) => abilitiesRepo.update(a.id, { icon: { url: a.icon.url ?? defaultAbilityIcon(a.id), blob } })}
                onReset={a.icon.url ? () => abilitiesRepo.update(a.id, { icon: { url: a.icon.url } }) : undefined}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <label className="label" htmlFor={`ab-name-${a.id}`}>Nome</label>
                  <CommitInput id={`ab-name-${a.id}`} value={a.name} onCommit={(name) => abilitiesRepo.update(a.id, { name: name || 'Sem nome' })} />
                </div>
                <div className="w-14">
                  <label className="label" htmlFor={`ab-key-${a.id}`}>Tecla</label>
                  <CommitInput id={`ab-key-${a.id}`} className="field text-center uppercase" maxLength={2} value={a.key} onCommit={(key) => abilitiesRepo.update(a.id, { key: key.toUpperCase() })} />
                </div>
              </div>
              <div>
                <span className="label">Forma no mapa</span>
                <div className="grid grid-cols-5 gap-1 rounded-lg border border-line bg-bg-2 p-0.5">
                  {SHAPES.map((sh) => (
                    <button
                      key={sh}
                      type="button"
                      title={SHAPE_HINT[sh]}
                      onClick={() => abilitiesRepo.update(a.id, { shape: sh })}
                      className={cn(
                        'flex flex-col items-center gap-0.5 rounded-md py-1 text-[10px] font-semibold transition-colors',
                        (a.shape ?? 'ponto') === sh ? 'bg-panel-3 text-text' : 'text-muted hover:text-text',
                      )}
                    >
                      <ShapeIcon shape={sh} color={(a.shape ?? 'ponto') === sh ? a.color : 'currentColor'} />
                      {SHAPE_LABEL[sh]}
                    </button>
                  ))}
                </div>
              </div>
              <SizeFields ability={a} />
              <div>
                <span className="label">Cor</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cor ${c}`}
                      onClick={() => abilitiesRepo.update(a.id, { color: c })}
                      className={cn('size-5 rounded-full border-2 transition-transform hover:scale-110', a.color === c ? 'border-text' : 'border-transparent')}
                      style={{ background: c }}
                    />
                  ))}
                  <label className="relative size-5 cursor-pointer overflow-hidden rounded-full border border-dashed border-line-2" title="Cor personalizada">
                    <input type="color" value={a.color} onChange={(e) => abilitiesRepo.update(a.id, { color: e.target.value })} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                    <Plus size={11} className="absolute inset-0 m-auto text-muted" />
                  </label>
                </div>
              </div>
              <div className="mt-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => abilitiesRepo.move(abilities, i, -1)} icon={<ChevronUp size={15} />} />
                <Button size="sm" variant="ghost" aria-label="Descer" disabled={i === abilities.length - 1} onClick={() => abilitiesRepo.move(abilities, i, 1)} icon={<ChevronDown size={15} />} />
                <span className="ml-1 text-[11px] text-faint">Atalho {i + 1}</span>
                <Button size="sm" variant="ghost" className="ml-auto hover:!text-danger" onClick={() => removeAbility(a)} aria-label={`Excluir ${a.name}`} icon={<Trash2 size={14} />} />
              </div>
            </div>
          </motion.div>
        ))}
        <button
          type="button"
          onClick={() => abilitiesRepo.create(agent.id)}
          className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-2 text-muted transition-colors hover:border-accent/60 hover:text-accent"
        >
          <Plus size={20} />
          <span className="text-sm font-medium">Adicionar habilidade</span>
        </button>
      </div>
    </div>
  )
}

type AgentOption = Awaited<ReturnType<typeof fetchAgents>>[number]

function AddAgentDialog({ open, existing, onClose, onAdded }: { open: boolean; existing: Set<string>; onClose: () => void; onAdded: (id: string) => void }) {
  const [options, setOptions] = useState<AgentOption[]>()
  const [error, setError] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!open || options) return
    setError(false)
    fetchAgents().then(setOptions, () => setError(true))
  }, [open, options])

  const add = async (option: AgentOption) => {
    const { agent, abilities } = option.build(await agentsRepo.nextOrder())
    await agentsRepo.add(agent, abilities)
    toast(`${agent.name} adicionado`)
    onAdded(agent.id)
  }

  const available = options?.filter((o) => !existing.has(o.uuid))

  return (
    <Modal open={open} onClose={onClose} title="Adicionar agente" maxWidth={672}>
      {error ? (
        <p className="py-8 text-center text-sm text-muted">Não foi possível carregar a lista de agentes da valorant-api. Confira a conexão.</p>
      ) : !available ? (
        <div className="grid place-items-center py-10 text-muted">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : available.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Todos os agentes já foram adicionados.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {available.map((o) => (
            <button
              key={o.uuid}
              type="button"
              onClick={() => add(o)}
              className="group flex flex-col items-center gap-1.5 rounded-xl border border-line bg-bg-2 p-2 transition-colors hover:border-accent/60 hover:bg-panel-2"
            >
              <span className="size-14 overflow-hidden rounded-lg bg-panel">
                <Img source={{ url: agentIconUrl(o.uuid) }} maxSize={128} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </span>
              <span className="max-w-full truncate text-[11px] font-semibold text-muted group-hover:text-text">{o.name}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

const SHAPES: Shape[] = ['ponto', 'linha', 'area', 'faixa', 'cone']

/** Miniatura de cada forma, no mesmo desenho do minimapa. */
function ShapeIcon({ shape, color }: { shape: Shape; color: string }) {
  return (
    <svg viewBox="0 0 20 14" className="h-3.5 w-5" aria-hidden>
      {shape === 'ponto' && <circle cx="10" cy="7" r="3" fill={color} />}
      {shape === 'linha' && <line x1="2" y1="11" x2="18" y2="3" stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
      {shape === 'area' && <circle cx="10" cy="7" r="5.5" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5" />}
      {shape === 'faixa' && <rect x="3" y="3.5" width="14" height="7" rx="1" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5" />}
      {shape === 'cone' && <path d="M3 7 L17 1.5 A8 8 0 0 1 17 12.5 Z" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />}
    </svg>
  )
}

/** Quais medidas fazem sentido pra cada forma. */
const SIZE_FIELDS: Record<Shape, { key: 'radius' | 'length' | 'width'; label: string }[]> = {
  ponto: [{ key: 'radius', label: 'Raio da zona' }],
  area: [{ key: 'radius', label: 'Raio' }],
  linha: [
    { key: 'length', label: 'Comprimento' },
    { key: 'width', label: 'Largura' },
  ],
  faixa: [
    { key: 'length', label: 'Comprimento' },
    { key: 'width', label: 'Largura' },
  ],
  cone: [{ key: 'length', label: 'Alcance' }],
}

/**
 * Medidas reais em metros (vêm da wiki oficial pros agentes padrão). Ficam
 * editáveis pra acompanhar patches e pra agentes adicionados depois.
 */
function SizeFields({ ability }: { ability: Ability }) {
  const shape = ability.shape ?? 'ponto'
  const size = ability.size ?? {}
  const fields = SIZE_FIELDS[shape]
  const original = defaultSize(ability.id)
  const set = (changes: Partial<AbilitySize>) => abilitiesRepo.update(ability.id, { size: { ...size, ...changes } })
  const canFix = shape !== 'ponto'

  return (
    <div>
      <span className="label">
        Tamanho no jogo (metros)
        {original && JSON.stringify(original) !== JSON.stringify(ability.size) && (
          <button type="button" onClick={() => abilitiesRepo.update(ability.id, { size: original })} className="ml-2 normal-case tracking-normal text-accent hover:underline">
            restaurar
          </button>
        )}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {fields.map((f) => (
          <label key={f.key} className="flex items-center gap-1.5 text-[11px] text-muted">
            {f.label}
            <input
              type="number"
              min={0}
              step={0.5}
              value={size[f.key] ?? ''}
              placeholder="—"
              onChange={(e) => set({ [f.key]: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
              className="field !w-16 !px-2 !py-1 text-center !text-xs"
            />
          </label>
        ))}
        {canFix && (
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted" title="No jogo o tamanho não muda: só posição e direção">
            <input type="checkbox" checked={!!size.fixed} onChange={(e) => set({ fixed: e.target.checked })} style={{ accentColor: ability.color }} />
            fixo
          </label>
        )}
      </div>
    </div>
  )
}
