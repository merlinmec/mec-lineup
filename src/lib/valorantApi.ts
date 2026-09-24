import type { Ability, Agent, GameMap, Shape } from '../db/types'

const API = 'https://valorant-api.com/v1'
const MEDIA = 'https://media.valorant-api.com/agents'

export const VIPER_ID = '707eab51-4836-f488-046a-cda6bf494859'

type Slot = 'grenade' | 'ability1' | 'ability2' | 'ultimate'
const SLOT_KEY: Record<Slot, string> = { grenade: 'C', ability1: 'Q', ability2: 'E', ultimate: 'X' }
const SLOT_ORDER: Slot[] = ['grenade', 'ability1', 'ability2', 'ultimate']
const PALETTE = ['#c6f432', '#34e3b0', '#3cc8f0', '#ff5470']

export const agentIconUrl = (uuid: string) => `${MEDIA}/${uuid}/displayicon.png`
const abilityIconUrl = (uuid: string, slot: Slot) => `${MEDIA}/${uuid}/abilities/${slot}/displayicon.png`

interface AgentSeed {
  uuid: string
  name: string
  abilities: Record<Slot, string>
  /** Ids fixos só da Viper, pra manter compatibilidade com dados já salvos. */
  ids?: Record<Slot, string>
  /** Formas diferentes de 'ponto'. */
  shapes?: Partial<Record<Slot, Shape>>
}

/** Agentes de lineup que o app já traz prontos (nomes pt-BR da valorant-api). */
const SEEDS: AgentSeed[] = [
  {
    uuid: VIPER_ID,
    name: 'Viper',
    abilities: { grenade: 'Veneno', ability1: 'Orbe', ability2: 'Parede', ultimate: 'Ult' },
    ids: { grenade: 'veneno', ability1: 'orbe', ability2: 'parede', ultimate: 'ult' },
    shapes: { ability2: 'linha', ultimate: 'area' },
  },
  {
    uuid: '320b2a48-4d9b-a075-30f1-1f93a9b638fa',
    name: 'Sova',
    abilities: { grenade: 'Drone Coruja', ability1: 'Flecha de Choque', ability2: 'Flecha Rastreadora', ultimate: 'Fúria do Caçador' },
    shapes: { ultimate: 'linha' },
  },
  {
    uuid: '9f0d8ba9-4140-b941-57d3-a7ad57c6b417',
    name: 'Brimstone',
    abilities: { grenade: 'Sinalizador Estimulante', ability1: 'Incendiário', ability2: 'Fumaça Celeste', ultimate: 'Ataque Orbital' },
    shapes: { ultimate: 'area' },
  },
  {
    uuid: '601dbbe7-43ce-be57-2a40-4abd24953621',
    name: 'KAY/O',
    abilities: { grenade: 'FRAG/mento', ability1: 'GRANADA/clarão', ability2: 'PONTO/zero', ultimate: 'ANULAR/cmd' },
    shapes: { ultimate: 'area' },
  },
  {
    uuid: 'dade69b4-4f5a-8528-247b-219e5a1facd6',
    name: 'Fade',
    abilities: { grenade: 'Espreitador', ability1: 'Clausura', ability2: 'Assombrar', ultimate: 'Véu da Noite' },
    shapes: { ultimate: 'cone' },
  },
]

function build(seed: AgentSeed, order: number): { agent: Agent; abilities: Ability[] } {
  return {
    agent: { id: seed.uuid, name: seed.name, icon: { url: agentIconUrl(seed.uuid) }, order },
    abilities: SLOT_ORDER.map((slot, i) => ({
      id: seed.ids?.[slot] ?? `${seed.uuid}:${slot}`,
      agentId: seed.uuid,
      name: seed.abilities[slot],
      shape: seed.shapes?.[slot] ?? 'ponto',
      key: SLOT_KEY[slot],
      color: PALETTE[i],
      icon: { url: abilityIconUrl(seed.uuid, slot) },
      order: i,
    })),
  }
}

export const DEFAULT_AGENTS = SEEDS.map(build)

/** Forma padrão de uma habilidade embutida (dados antigos não tinham forma). */
export const defaultShape = (id: string): Shape =>
  DEFAULT_AGENTS.flatMap((a) => a.abilities).find((ab) => ab.id === id)?.shape ?? 'ponto'

/** Ícone padrão de uma habilidade embutida, pra "restaurar padrão". */
export const defaultAbilityIcon = (id: string) =>
  DEFAULT_AGENTS.flatMap((a) => a.abilities).find((ab) => ab.id === id)?.icon.url

interface ApiAgent {
  uuid: string
  displayName: string
  abilities: { slot: string; displayName: string }[]
}

/** Lista todos os agentes jogáveis, para adicionar um que não veio pronto. */
export async function fetchAgents(): Promise<{ uuid: string; name: string; build: (order: number) => ReturnType<typeof build> }[]> {
  const res = await fetch(`${API}/agents?isPlayableCharacter=true&language=pt-BR`)
  if (!res.ok) throw new Error(`valorant-api respondeu ${res.status}`)
  const json = (await res.json()) as { data: ApiAgent[] }
  return json.data
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((a) => {
      const names = Object.fromEntries(a.abilities.map((ab) => [ab.slot.toLowerCase(), ab.displayName])) as Record<Slot, string>
      const seed: AgentSeed = { uuid: a.uuid, name: a.displayName, abilities: names }
      return { uuid: a.uuid, name: a.displayName, build: (order: number) => build(seed, order) }
    })
}

export interface ApiMap {
  uuid: string
  displayName: string
  tacticalDescription: string | null
  displayIcon: string | null
  listViewIconTall: string | null
  splash: string | null
}

/** Só mapas competitivos têm descrição tática (A/B Sites) e minimapa. */
export function toGameMaps(apiMaps: ApiMap[], now = Date.now()): GameMap[] {
  return apiMaps
    .filter((m) => m.tacticalDescription && m.displayIcon)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((m, i) => ({
      id: m.uuid,
      name: m.displayName,
      subtitle: m.tacticalDescription ?? undefined,
      cover: { url: m.listViewIconTall ?? m.splash ?? undefined },
      minimap: { url: m.displayIcon ?? undefined },
      rotation: 0,
      order: i,
      createdAt: now,
    }))
}

export async function fetchMaps(): Promise<GameMap[]> {
  const res = await fetch(`${API}/maps`)
  if (!res.ok) throw new Error(`valorant-api respondeu ${res.status}`)
  const json = (await res.json()) as { data: ApiMap[] }
  return toGameMaps(json.data)
}
