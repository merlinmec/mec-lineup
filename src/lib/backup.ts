import { db as defaultDb, fillShapes, migrateToAgents, moveResultToLineups, type LineupDB } from '../db/db'

/**
 * Backup em JSON único: Blobs viram data URLs pra que o arquivo carregue os
 * prints junto e possa ser levado pra outro PC/navegador. O cache de imagens
 * fica de fora: é refeito sozinho a partir das URLs.
 */
const BLOB_TAG = '__blob'
const FORMAT = 'mec-lineup-backup'
const VERSION = 3

const TABLES = ['maps', 'agents', 'abilities', 'spots', 'lineups', 'settings'] as const
type TableName = (typeof TABLES)[number]

export interface BackupFile {
  format: typeof FORMAT
  version: number
  exportedAt: string
  tables: Record<TableName, unknown[]>
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

async function encode(value: unknown): Promise<unknown> {
  if (value instanceof Blob) return { [BLOB_TAG]: await blobToDataUrl(value) }
  if (Array.isArray(value)) return Promise.all(value.map(encode))
  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value).map(async ([k, v]) => [k, await encode(v)] as const),
    )
    return Object.fromEntries(entries)
  }
  return value
}

async function decode(value: unknown): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map(decode))
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj[BLOB_TAG] === 'string') return dataUrlToBlob(obj[BLOB_TAG])
    const entries = await Promise.all(
      Object.entries(obj).map(async ([k, v]) => [k, await decode(v)] as const),
    )
    return Object.fromEntries(entries)
  }
  return value
}

export async function exportBackup(database: LineupDB = defaultDb): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>
  for (const name of TABLES) {
    tables[name] = (await encode(await database.table(name).toArray())) as unknown[]
  }
  return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), tables }
}

export function isBackupFile(value: unknown): value is BackupFile {
  const v = value as BackupFile
  return v?.format === FORMAT && typeof v.tables === 'object' && v.tables !== null
}

/** Substitui todos os dados atuais pelos do backup. */
export async function importBackup(file: BackupFile, database: LineupDB = defaultDb) {
  if (file.version > VERSION) throw new Error('Backup de uma versão mais nova do app.')
  const decoded = {} as Record<TableName, unknown[]>
  for (const name of TABLES) {
    decoded[name] = (await decode(file.tables[name] ?? [])) as unknown[]
  }
  await database.transaction('rw', TABLES.map((t) => database.table(t)), async () => {
    for (const name of TABLES) {
      await database.table(name).clear()
      await database.table(name).bulkPut(decoded[name])
    }
    // backup da v1 não tinha agentes: aplica a mesma migração do banco
    if (file.version < 2) await migrateToAgents((n) => database.table(n))
    await fillShapes((n) => database.table(n))
    // v3: "onde cai" passou do ponto pra posição
    if (file.version < 3) await moveResultToLineups((n) => database.table(n))
  })
}
