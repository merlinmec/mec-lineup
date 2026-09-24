import { DEFAULT_AGENTS, fetchMaps, mapScale, type ApiMap } from '../lib/valorantApi'
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

/**
 * Mapas salvos antes da escala existir: busca a escala na API uma vez. Sem
 * rede, as formas seguem com a escala média até a próxima abertura.
 */
export async function fillMapScales(database: LineupDB = db, load = () => fetch('https://valorant-api.com/v1/maps').then((r) => r.json() as Promise<{ data: ApiMap[] }>)) {
  const missing = (await database.maps.toArray()).filter((m) => m.scale === undefined)
  if (!missing.length) return
  const byId = new Map((await load()).data.map((m) => [m.uuid, mapScale(m)]))
  for (const m of missing) {
    const scale = byId.get(m.id)
    if (scale) await database.maps.update(m.id, { scale })
  }
}

let pending: Promise<void> | null = null

/** Evita seed duplicado quando o StrictMode monta os efeitos duas vezes. */
export function seedOnce() {
  pending ??= ensureSeeded()
    .then(() => void fillMapScales().catch(() => {}))
    .catch((err) => {
    pending = null
    throw err
  })
  return pending
}
