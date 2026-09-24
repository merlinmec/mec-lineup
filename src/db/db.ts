import Dexie, { type EntityTable, type Table } from 'dexie'
import { agentIconUrl, DEFAULT_AGENTS, defaultShape, defaultSize, VIPER_ID } from '../lib/valorantApi'
import type { Ability, Agent, CachedImage, GameMap, ImageSource, Lineup, LocalEntry, Settings, Spot } from './types'

export class LineupDB extends Dexie {
  maps!: EntityTable<GameMap, 'id'>
  agents!: EntityTable<Agent, 'id'>
  abilities!: EntityTable<Ability, 'id'>
  spots!: EntityTable<Spot, 'id'>
  lineups!: EntityTable<Lineup, 'id'>
  settings!: EntityTable<Settings, 'id'>
  imageCache!: EntityTable<CachedImage, 'url'>
  /** Coisas só deste navegador (ex: pasta de backup). Fora do backup de propósito. */
  local!: EntityTable<LocalEntry, 'key'>

  constructor(name = 'mec-lineup') {
    super(name)
    this.version(1).stores({
      maps: 'id, order',
      abilities: 'id, order',
      spots: 'id, mapId, abilityId, [mapId+abilityId]',
      lineups: 'id, spotId',
      settings: 'id',
    })
    this.version(2)
      .stores({
        agents: 'id, order',
        abilities: 'id, order, agentId',
        imageCache: 'url',
      })
      .upgrade((tx) => migrateToAgents((n) => tx.table(n)))
    this.version(3).stores({ local: 'key' })
    this.version(4)
      .stores({})
      .upgrade((tx) => fillShapes((n) => tx.table(n)))
    // lado por ponto sem carregar os prints: o filtro lê só as chaves desse índice
    this.version(5).stores({ lineups: 'id, spotId, [spotId+side]' })
    this.version(6)
      .stores({})
      .upgrade((tx) => fillShapes((n) => tx.table(n)))
    this.version(7)
      .stores({})
      .upgrade((tx) => moveResultToLineups((n) => tx.table(n)))
  }
}

/**
 * v1 não tinha agentes: tudo era da Viper. Move as habilidades existentes pra
 * Viper, leva o ícone de jogador personalizado pro retrato dela e adiciona os
 * outros agentes padrão. Também usado ao importar backups da v1.
 */
export async function migrateToAgents(table: (name: string) => Table) {
  const settings = (await table('settings').get('app')) as (Settings & { playerIcon?: ImageSource }) | undefined
  const viperIcon: ImageSource = { url: agentIconUrl(VIPER_ID), blob: settings?.playerIcon?.blob }

  await table('abilities').toCollection().modify((a: Ability) => {
    a.agentId = VIPER_ID
  })
  for (const { agent, abilities } of DEFAULT_AGENTS) {
    if (agent.id === VIPER_ID) {
      await table('agents').put({ ...agent, icon: viperIcon })
      continue
    }
    await table('agents').put(agent)
    await table('abilities').bulkPut(abilities)
  }
  if (settings) {
    delete settings.playerIcon
    await table('settings').put({ ...settings, agentsSeeded: true })
  }
}

/**
 * Habilidades de antes das formas: aplica a forma padrão (parede da Viper vira
 * linha, ults viram área/cone...). Só preenche o que falta; também roda ao
 * importar backups antigos.
 */
export async function fillShapes(table: (name: string) => Table) {
  await table('abilities').toCollection().modify((a: Ability) => {
    a.shape ??= defaultShape(a.id)
    // v6: ult da Fade era cone por engano; é uma faixa retangular
    if (a.shape === 'cone' && defaultShape(a.id) === 'faixa') a.shape = 'faixa'
    a.size ??= defaultSize(a.id)
  })
}

/**
 * v7: o print de "onde cai" era do ponto, mas cada lineup cai num lugar um
 * pouco diferente. Copia pras posições do ponto (sem sobrescrever) e tira do
 * ponto; ponto sem posição mantém, e a primeira posição criada herda.
 */
export async function moveResultToLineups(table: (name: string) => Table) {
  const spots = (await table('spots').toArray()) as Spot[]
  for (const spot of spots.filter((s) => s.resultImage)) {
    const lineups = table('lineups').where('spotId').equals(spot.id)
    if ((await lineups.count()) === 0) continue
    await lineups.modify((l: Lineup) => {
      if (l.resultImage) return
      l.resultImage = spot.resultImage
      l.resultMarks = spot.resultMarks ?? []
    })
    await table('spots').update(spot.id, { resultImage: undefined, resultMarks: undefined })
  }
}

export const db = new LineupDB()
