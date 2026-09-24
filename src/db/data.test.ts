import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup, isBackupFile } from '../lib/backup'
import Dexie from 'dexie'
import { toGameMaps, VIPER_ID, type ApiMap } from '../lib/valorantApi'
import { fillShapes, LineupDB, moveResultToLineups } from './db'
import { ensureSeeded, fillMapScales } from './seed'

let n = 0
let database: LineupDB

beforeEach(async () => {
  database = new LineupDB(`test-${n++}`)
  await database.open()
})

const apiMap = (name: string, competitive = true): ApiMap => ({
  uuid: name,
  displayName: name,
  tacticalDescription: competitive ? 'A/B Sites' : null,
  displayIcon: competitive ? `${name}.png` : null,
  listViewIconTall: `${name}-tall.png`,
  splash: null,
})

describe('mapas da valorant-api', () => {
  it('mantém só os competitivos, em ordem alfabética', () => {
    const maps = toGameMaps([apiMap('Split'), apiMap('The Range', false), apiMap('Ascent')])
    expect(maps.map((m) => m.name)).toEqual(['Ascent', 'Split'])
    expect(maps.map((m) => m.order)).toEqual([0, 1])
  })
})

describe('seed', () => {
  it('cria agentes e habilidades mesmo se a API de mapas falhar, e tenta de novo depois', async () => {
    await expect(
      ensureSeeded(database, () => Promise.reject(new Error('offline'))),
    ).rejects.toThrow('offline')
    expect(await database.agents.count()).toBe(5)
    expect(await database.abilities.where('agentId').equals(VIPER_ID).count()).toBe(4)
    expect((await database.settings.get('app'))?.mapsSeeded).toBe(false)

    await ensureSeeded(database, async () => toGameMaps([apiMap('Haven')]))
    expect(await database.maps.count()).toBe(1)

    // já semeado: não chama a API de novo
    await ensureSeeded(database, () => Promise.reject(new Error('não deveria chamar')))
  })

  it('não recria um agente que o usuário removeu', async () => {
    await ensureSeeded(database, async () => [])
    await database.agents.delete(VIPER_ID)
    await ensureSeeded(database, async () => [])
    expect(await database.agents.get(VIPER_ID)).toBeUndefined()
  })
})

/** Banco com o schema da v1 (antes dos agentes), como estava no navegador do usuário. */
async function createV1Database(name: string) {
  const v1 = new Dexie(name)
  v1.version(1).stores({ maps: 'id, order', abilities: 'id, order', spots: 'id, mapId, abilityId, [mapId+abilityId]', lineups: 'id, spotId', settings: 'id' })
  await v1.open()
  const icon = new Blob([new Uint8Array([9, 9])], { type: 'image/webp' })
  await v1.table('settings').put({ id: 'app', mapsSeeded: true, minimapStyle: 'tatico', playerIcon: { url: 'x', blob: icon } })
  await v1.table('abilities').bulkPut([
    { id: 'veneno', name: 'Veneno', key: 'C', color: '#fff', icon: {}, order: 0 },
    { id: 'custom', name: 'Minha', key: '', color: '#fff', icon: {}, order: 4 },
    { id: 'parede', name: 'Parede', key: 'E', color: '#fff', icon: {}, order: 2 },
    { id: 'ult', name: 'Ult', key: 'X', color: '#fff', icon: {}, order: 3 },
  ])
  await v1.table('spots').put({ id: 's1', mapId: 'm', abilityId: 'veneno', name: 'A', x: 0, y: 0, createdAt: 1 })
  v1.close()
}

describe('migração v1 → agentes', () => {
  it('move as habilidades pra Viper, leva o ícone personalizado e adiciona os outros agentes', async () => {
    const name = `test-${n++}`
    await createV1Database(name)
    const migrated = new LineupDB(name)
    await migrated.open()

    expect((await migrated.abilities.get('veneno'))?.agentId).toBe(VIPER_ID)
    expect((await migrated.abilities.get('custom'))?.agentId).toBe(VIPER_ID)
    // formas (v4): parede vira linha, ult vira área, o resto fica ponto
    expect((await migrated.abilities.get('parede'))?.shape).toBe('linha')
    expect((await migrated.abilities.get('ult'))?.shape).toBe('area')
    expect((await migrated.abilities.get('veneno'))?.shape).toBe('ponto')
    expect((await migrated.abilities.get('custom'))?.shape).toBe('ponto')
    expect(await migrated.spots.get('s1')).toBeDefined()
    const viper = await migrated.agents.get(VIPER_ID)
    expect([...new Uint8Array(await viper!.icon.blob!.arrayBuffer())]).toEqual([9, 9])
    expect(await migrated.agents.count()).toBe(5)
    const settings = await migrated.settings.get('app')
    expect(settings?.agentsSeeded).toBe(true)
    expect(settings).not.toHaveProperty('playerIcon')
  })
})

describe('backup', () => {
  it('ida e volta preserva dados e imagens', async () => {
    await ensureSeeded(database, async () => toGameMaps([apiMap('Haven')]))
    await database.spots.add({ id: 's1', mapId: 'Haven', abilityId: 'veneno', name: 'A main', x: 0.5, y: 0.5, createdAt: 1 })
    const print = new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/webp' })
    await database.lineups.add({
      id: 'l1', spotId: 's1', title: 'Spawn', notes: '', throwType: 'Pulo', side: 'ataque',
      x: 0.1, y: 0.2, aimImage: print, createdAt: 1,
    })

    const file = JSON.parse(JSON.stringify(await exportBackup(database)))
    expect(isBackupFile(file)).toBe(true)

    const other = new LineupDB(`test-${n++}`)
    await importBackup(file, other)
    const lineup = await other.lineups.get('l1')
    expect(lineup?.title).toBe('Spawn')
    const bytes = new Uint8Array(await lineup!.aimImage!.arrayBuffer())
    expect([...bytes]).toEqual([1, 2, 3, 250])
    expect(await other.maps.count()).toBe(1)
    expect(await other.agents.count()).toBe(5)
  })

  it('backup da v1 (sem agentes) é migrado ao importar', async () => {
    const file = {
      format: 'mec-lineup-backup',
      version: 1,
      exportedAt: '',
      tables: {
        maps: [],
        abilities: [{ id: 'veneno', name: 'Veneno', key: 'C', color: '#fff', icon: {}, order: 0 }],
        spots: [],
        lineups: [],
        settings: [{ id: 'app', mapsSeeded: true, minimapStyle: 'tatico', playerIcon: { url: 'x' } }],
      },
    }
    await importBackup(file as never, database)
    expect((await database.abilities.get('veneno'))?.agentId).toBe(VIPER_ID)
    expect(await database.agents.count()).toBe(5)
  })
})

describe('revisão das habilidades (v6)', () => {
  const FADE_ULT = 'dade69b4-4f5a-8528-247b-219e5a1facd6:ultimate'

  it('ult da Fade salva como cone vira faixa 40 × 20 m', async () => {
    await database.abilities.put({ id: FADE_ULT, agentId: 'fade', name: 'Véu da Noite', shape: 'cone', key: 'X', color: '#fff', icon: {}, order: 3 })
    await fillShapes((n) => database.table(n))
    const a = await database.abilities.get(FADE_ULT)
    expect(a?.shape).toBe('faixa')
    expect(a?.size).toEqual({ length: 40, width: 20, fixed: true })
  })

  it('não desfaz medidas que o usuário editou', async () => {
    await database.abilities.put({ id: 'orbe', agentId: VIPER_ID, name: 'Orbe', shape: 'ponto', size: { radius: 5 }, key: 'Q', color: '#fff', icon: {}, order: 1 })
    await fillShapes((n) => database.table(n))
    expect((await database.abilities.get('orbe'))?.size).toEqual({ radius: 5 })
  })

  it('agentes novos já vêm com as medidas da wiki oficial', async () => {
    await ensureSeeded(database, async () => [])
    expect((await database.abilities.get('ult'))?.size).toEqual({ radius: 9, fixed: true })
    expect((await database.abilities.get('parede'))?.size).toEqual({ length: 60, width: 2 })
  })

  it('preenche a escala dos mapas antigos pela API', async () => {
    await database.maps.put({ id: 'haven', name: 'Haven', cover: {}, minimap: {}, rotation: 0, order: 0, createdAt: 1 })
    await fillMapScales(database, async () => ({ data: [{ uuid: 'haven', xMultiplier: 0.000075 } as never] }))
    expect((await database.maps.get('haven'))?.scale).toBeCloseTo(0.0075)
  })
})

describe('print de "onde cai" por posição (v7)', () => {
  const img = (n: number) => new Blob([new Uint8Array([n])], { type: 'image/webp' })
  const lineup = (id: string, spotId: string, extra = {}) => ({
    id, spotId, title: id, notes: '', throwType: '', side: 'ambos' as const, x: 0, y: 0, createdAt: 1, ...extra,
  })

  it('copia do ponto pras posições sem sobrescrever e tira do ponto', async () => {
    await database.spots.put({ id: 's1', mapId: 'm', abilityId: 'veneno', name: 'A', x: 0, y: 0, createdAt: 1, resultImage: img(1), resultMarks: [] })
    await database.lineups.bulkPut([lineup('l1', 's1'), lineup('l2', 's1', { resultImage: img(2) })])
    await moveResultToLineups((n) => database.table(n))

    const bytes = async (b?: Blob) => [...new Uint8Array(await b!.arrayBuffer())]
    expect(await bytes((await database.lineups.get('l1'))?.resultImage)).toEqual([1])
    expect(await bytes((await database.lineups.get('l2'))?.resultImage)).toEqual([2]) // já tinha: mantém
    expect((await database.spots.get('s1'))?.resultImage).toBeUndefined()
  })

  it('ponto sem posição mantém o print, e a primeira posição criada herda', async () => {
    const { lineupsRepo } = await import('./repo')
    const { db } = await import('./db')
    await db.spots.put({ id: 'orfao', mapId: 'm', abilityId: 'veneno', name: 'B', x: 0, y: 0, createdAt: 1, resultImage: img(7) })
    await moveResultToLineups((n) => db.table(n))
    expect((await db.spots.get('orfao'))?.resultImage).toBeDefined()

    const created = await lineupsRepo.create({ spotId: 'orfao', x: 0.1, y: 0.1 })
    expect(created.resultImage).toBeDefined()
    expect((await db.spots.get('orfao'))?.resultImage).toBeUndefined()
  })
})

describe('importar backup antigo (v2) com "onde cai" no ponto', () => {
  it('move o print pras posições na importação', async () => {
    const res = { __blob: 'data:image/webp;base64,AQ==' }
    const file = {
      format: 'mec-lineup-backup', version: 2, exportedAt: '',
      tables: {
        maps: [], agents: [], abilities: [], settings: [],
        spots: [{ id: 's', mapId: 'm', abilityId: 'veneno', name: 'A', x: 0, y: 0, createdAt: 1, resultImage: res }],
        lineups: [{ id: 'l', spotId: 's', title: 'P', notes: '', throwType: '', side: 'ambos', x: 0, y: 0, createdAt: 1 }],
      },
    }
    await importBackup(file as never, database)
    expect((await database.lineups.get('l'))?.resultImage).toBeDefined()
    expect((await database.spots.get('s'))?.resultImage).toBeUndefined()
  })
})
