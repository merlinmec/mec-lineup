import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import { exportBackup, importBackup, isBackupFile, type BackupFile } from './backup'

/**
 * Backup automático numa pasta do PC (File System Access API, Edge/Chrome).
 * Arquivo no disco sobrevive a limpar os dados do navegador; numa pasta do
 * OneDrive/Drive ainda ganha cópia na nuvem.
 *
 * Além do "mais recente", guarda uma cópia por dia: se algo for apagado sem
 * querer, o arquivo principal é sobrescrito, mas o de ontem continua lá.
 */

export const LATEST_FILE = 'mec-lineup-backup.json'
export const KEEP_DAILY = 14
const DAILY_RE = /^mec-lineup-(\d{4}-\d{2}-\d{2})\.json$/
const DEBOUNCE_MS = 4000
const WATCHED = ['maps', 'agents', 'abilities', 'spots', 'lineups', 'settings'] as const
const HANDLE_KEY = 'backup:pasta'
const LAST_KEY = 'backup:ultimo'

/** Nome da cópia diária, na data local (não UTC: backup das 23h fica no dia certo). */
export function dailyName(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `mec-lineup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}

/** Cópias diárias além das `keep` mais novas; ignora qualquer outro arquivo da pasta. */
export function dailyToPrune(names: string[], keep = KEEP_DAILY) {
  return names
    .filter((n) => DAILY_RE.test(n))
    .sort()
    .reverse()
    .slice(keep)
}

/* ---------- tipos da File System Access API que o lib.dom ainda não traz ---------- */

type PermissionMode = { mode: 'readwrite' }
interface DirHandle extends FileSystemDirectoryHandle {
  queryPermission(d: PermissionMode): Promise<PermissionState>
  requestPermission(d: PermissionMode): Promise<PermissionState>
  keys(): AsyncIterableIterator<string>
}
declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<DirHandle>
  }
}

/* ---------- estado observável pela UI ---------- */

export type BackupStatus = 'indisponivel' | 'desligado' | 'pausado' | 'ativo' | 'salvando' | 'erro'

export interface BackupState {
  status: BackupStatus
  folder?: string
  lastAt?: number
  error?: string
}

let state: BackupState = { status: 'desligado' }
const listeners = new Set<() => void>()
const set = (next: Partial<BackupState>) => {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export function useBackupState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

let handle: DirHandle | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let dirty = false
let started = false
/** Pasta nova com backup dentro: não grava nada até o usuário decidir. */
let holdWrites = false

/** Liga os ganchos do banco e recupera a pasta escolhida antes (uma vez por sessão). */
export async function initAutoBackup() {
  if (started) return
  started = true
  if (!window.showDirectoryPicker) {
    set({ status: 'indisponivel' })
    return
  }
  for (const name of WATCHED) {
    // blocos sem retorno: nos hooks do Dexie, um valor retornado muda a gravação
    db.table(name).hook('creating', () => {
      schedule()
    })
    db.table(name).hook('updating', () => {
      schedule()
    })
    db.table(name).hook('deleting', () => {
      schedule()
    })
  }
  const saved = (await db.local.get(HANDLE_KEY))?.value as DirHandle | undefined
  const lastAt = (await db.local.get(LAST_KEY))?.value as number | undefined
  if (!saved) return set({ status: 'desligado', lastAt })
  handle = saved
  // Sem gesto do usuário o navegador pode não devolver a permissão; aí fica
  // "pausado" até um clique em reativar.
  const perm = await saved.queryPermission({ mode: 'readwrite' }).catch(() => 'prompt' as PermissionState)
  set({ folder: saved.name, lastAt, status: perm === 'granted' ? 'ativo' : 'pausado' })
}

function schedule() {
  dirty = true
  if (!handle || holdWrites || (state.status !== 'ativo' && state.status !== 'erro')) return
  clearTimeout(timer)
  timer = setTimeout(() => void runBackup(), DEBOUNCE_MS)
}

export interface ExistingBackup {
  file: BackupFile
  exportedAt: string
  lineups: number
}

async function readExisting(dir: DirHandle): Promise<ExistingBackup | null> {
  try {
    const parsed: unknown = JSON.parse(await (await (await dir.getFileHandle(LATEST_FILE)).getFile()).text())
    if (!isBackupFile(parsed)) return null
    return { file: parsed, exportedAt: parsed.exportedAt, lineups: parsed.tables.lineups?.length ?? 0 }
  } catch {
    return null // pasta sem backup (ou arquivo ilegível)
  }
}

/**
 * Escolher pasta precisa vir de um clique (exigência do navegador). Se a
 * pasta já tem backup, NÃO grava: devolve o backup pra UI perguntar se quer
 * restaurar. É o caso de quem limpou o navegador e está reconectando a pasta;
 * gravar direto sobrescreveria o backup com o app vazio.
 */
export async function chooseFolder(): Promise<ExistingBackup | null> {
  if (!window.showDirectoryPicker) return null
  const picked = await window.showDirectoryPicker({ id: 'mec-lineup-backup', mode: 'readwrite', startIn: 'documents' })
  handle = picked
  await db.local.put({ key: HANDLE_KEY, value: picked })
  set({ folder: picked.name, status: 'ativo', error: undefined })
  const existing = await readExisting(picked)
  if (existing) {
    holdWrites = true
    return existing
  }
  await runBackup()
  return null
}

/** Resposta à pergunta do chooseFolder: restaurar o que está na pasta, ou sobrescrever. */
export async function resolveExisting(choice: 'restaurar' | 'substituir', existing: ExistingBackup) {
  if (choice === 'restaurar') await importBackup(existing.file)
  // antes de sobrescrever, guarda o que estava lá num nome que a rotação não apaga
  else if (handle) await writeFile(handle, `mec-lineup-substituido-${dailyName(new Date()).slice(11, 21)}-${Date.now()}.json`, JSON.stringify(existing.file))
  holdWrites = false
  await runBackup()
}

export async function reactivate() {
  if (!handle) return
  const perm = await handle.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') return set({ status: 'pausado' })
  set({ status: 'ativo', error: undefined })
  if (dirty || !state.lastAt) await runBackup()
}

export async function disable() {
  clearTimeout(timer)
  holdWrites = false
  handle = null
  await db.local.delete(HANDLE_KEY)
  set({ status: 'desligado', folder: undefined, error: undefined })
}

async function writeFile(dir: DirHandle, name: string, content: string) {
  const file = await dir.getFileHandle(name, { create: true })
  const w = await file.createWritable()
  await w.write(content)
  await w.close()
}

export async function runBackup() {
  if (!handle || holdWrites) return
  clearTimeout(timer)
  dirty = false
  set({ status: 'salvando' })
  try {
    const json = JSON.stringify(await exportBackup())
    await writeFile(handle, LATEST_FILE, json)
    await writeFile(handle, dailyName(new Date()), json)
    const names: string[] = []
    for await (const n of handle.keys()) names.push(n)
    for (const old of dailyToPrune(names)) await handle.removeEntry(old)
    const lastAt = Date.now()
    await db.local.put({ key: LAST_KEY, value: lastAt })
    set({ status: 'ativo', lastAt, error: undefined })
  } catch (e) {
    dirty = true
    const denied = e instanceof DOMException && e.name === 'NotAllowedError'
    set(denied ? { status: 'pausado' } : { status: 'erro', error: e instanceof Error ? e.message : String(e) })
  }
  // mudanças feitas durante a gravação entram na próxima
  if (dirty && state.status === 'ativo') schedule()
}
