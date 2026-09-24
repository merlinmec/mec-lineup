import { DEFAULT_AGENTS, fetchMaps } from '../lib/valorantApi'
import { db, type LineupDB } from './db'
import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  mapsSeeded: false,
  agentsSeeded: false,
  minimapStyle: 'tatico',
}

/**
 * Agentes e habilidades são embutidos, então sempre entram. Mapas dependem
 * da rede: se falhar, a tela de mapas oferece tentar de novo.
 */
export async function ensureSeeded(database: LineupDB = db, loadMaps = fetchMaps) {
  await database.transaction('rw', database.settings, database.agents, database.abilities, async () => {
    const settings = await database.settings.get('app')
    if (!settings) await database.settings.put(DEFAULT_SETTINGS)
    if (settings?.agentsSeeded) return
    await database.agents.bulkPut(DEFAULT_AGENTS.map((a) => a.agent))
    await database.abilities.bulkPut(DEFAULT_AGENTS.flatMap((a) => a.abilities))
    await database.settings.update('app', { agentsSeeded: true })
  })

  const settings = await database.settings.get('app')
  if (settings?.mapsSeeded) return

  const maps = await loadMaps()
  await database.transaction('rw', database.maps, database.settings, async () => {
    await database.maps.bulkPut(maps)
    await database.settings.update('app', { mapsSeeded: true })
  })
}

let pending: Promise<void> | null = null

/** Evita seed duplicado quando o StrictMode monta os efeitos duas vezes. */
export function seedOnce() {
  pending ??= ensureSeeded().catch((err) => {
    pending = null
    throw err
  })
  return pending
}
