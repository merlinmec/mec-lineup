import type { Table } from 'dexie'
import { db } from './db'
import { geometryFor, withDefaults } from '../lib/shapes'
import type { Ability, Agent, GameMap, Lineup, Shape, Side, Spot } from './types'

const newId = () => crypto.randomUUID()

export const mapsRepo = {
  async create(data: Omit<GameMap, 'id' | 'order' | 'createdAt'>) {
    const last = await db.maps.orderBy('order').last()
    const map: GameMap = { ...data, id: newId(), order: (last?.order ?? -1) + 1, createdAt: Date.now() }
    await db.maps.add(map)
    return map
  },
  update: (id: string, changes: Partial<GameMap>) => db.maps.update(id, changes),

  /** Troca de posição com o vizinho na direção indicada. */
  async move(id: string, dir: -1 | 1) {
    const all = await db.maps.orderBy('order').toArray()
    const i = all.findIndex((m) => m.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= all.length) return
    await db.transaction('rw', db.maps, async () => {
      await db.maps.update(all[i].id, { order: all[j].order })
      await db.maps.update(all[j].id, { order: all[i].order })
    })
  },

  async remove(id: string) {
    await db.transaction('rw', db.maps, db.spots, db.lineups, async () => {
      const spotIds = await db.spots.where('mapId').equals(id).primaryKeys()
      await db.lineups.where('spotId').anyOf(spotIds).delete()
      await db.spots.bulkDelete(spotIds)
      await db.maps.delete(id)
    })
  },
}

/** Troca a ordem de dois itens vizinhos numa lista já ordenada. */
async function swapOrder<T extends { id: string; order: number }>(table: Table<any, string>, list: T[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return
  await db.transaction('rw', table, async () => {
    await table.update(list[i].id, { order: list[j].order })
    await table.update(list[j].id, { order: list[i].order })
  })
}

async function removeAbilitiesCascade(abilityIds: string[]) {
  const spotIds = await db.spots.where('abilityId').anyOf(abilityIds).primaryKeys()
  await db.lineups.where('spotId').anyOf(spotIds).delete()
  await db.spots.bulkDelete(spotIds)
  await db.abilities.bulkDelete(abilityIds)
}

export const agentsRepo = {
  async add(agent: Agent, abilities: Ability[]) {
    await db.transaction('rw', db.agents, db.abilities, async () => {
      await db.agents.put(agent)
      await db.abilities.bulkPut(abilities)
    })
  },
  async nextOrder() {
    return ((await db.agents.orderBy('order').last())?.order ?? -1) + 1
  },
  update: (id: string, changes: Partial<Agent>) => db.agents.update(id, changes),
  move: (list: Agent[], i: number, dir: -1 | 1) => swapOrder(db.agents, list, i, dir),
  async remove(id: string) {
    await db.transaction('rw', db.agents, db.abilities, db.spots, db.lineups, async () => {
      await removeAbilitiesCascade(await db.abilities.where('agentId').equals(id).primaryKeys())
      await db.agents.delete(id)
    })
  },
}

export const abilitiesRepo = {
  async create(agentId: string) {
    const last = (await db.abilities.where('agentId').equals(agentId).sortBy('order')).at(-1)
    const ability: Ability = {
      id: newId(),
      agentId,
      name: 'Nova habilidade',
      key: '',
      color: '#34e3b0',
      icon: {},
      order: (last?.order ?? -1) + 1,
    }
    await db.abilities.add(ability)
    return ability
  },
  update: (id: string, changes: Partial<Ability>) => db.abilities.update(id, changes),
  move: (list: Ability[], i: number, dir: -1 | 1) => swapOrder(db.abilities, list, i, dir),
  async remove(id: string) {
    await db.transaction('rw', db.abilities, db.spots, db.lineups, () => removeAbilitiesCascade([id]))
  },
}

export const spotsRepo = {
  /** Já nasce com a geometria padrão da forma (linha com fim, área com raio...). */
  async create(data: Pick<Spot, 'mapId' | 'abilityId' | 'x' | 'y'>, shape: Shape = 'ponto') {
    const count = await db.spots.where({ mapId: data.mapId, abilityId: data.abilityId }).count()
    const geometry = geometryFor(withDefaults(data, shape), shape)
    const spot: Spot = { ...data, ...geometry, id: newId(), name: `Ponto ${count + 1}`, createdAt: Date.now() }
    await db.spots.add(spot)
    return spot
  },
  update: (id: string, changes: Partial<Spot>) => db.spots.update(id, changes),
  async remove(id: string) {
    await db.transaction('rw', db.spots, db.lineups, async () => {
      await db.lineups.where('spotId').equals(id).delete()
      await db.spots.delete(id)
    })
  },
}

export const lineupsRepo = {
  async create(data: Pick<Lineup, 'spotId' | 'x' | 'y'>, side: Side = 'ambos') {
    const count = await db.lineups.where('spotId').equals(data.spotId).count()
    const lineup: Lineup = {
      ...data,
      id: newId(),
      title: `Posição ${count + 1}`,
      notes: '',
      throwType: 'Clique esquerdo',
      side,
      createdAt: Date.now(),
    }
    await db.lineups.add(lineup)
    return lineup
  },
  update: (id: string, changes: Partial<Lineup>) => db.lineups.update(id, changes),
  remove: (id: string) => db.lineups.delete(id),
}
