import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import { exportBackup, importBackup, isBackupFile, type BackupFile } from './backup'
import { dailyName, dailyToPrune, LATEST_FILE, replacedName, type BackupMeta } from './backupFiles'

export { KEEP_DAILY, LATEST_FILE } from './backupFiles'

/**
 * Backup automático, com dois destinos possíveis:
 *
 * - 'projeto' (padrão): a pasta backups/ do projeto, gravada pelo servidor
 *   local do Vite. Liga sozinho, sem clique e sem permissão expirando.
 * - 'pasta': uma pasta escolhida pelo usuário (File System Access API),
 *   ex. dentro do OneDrive pra ter cópia na nuvem.
 *
 * Nos dois, além do arquivo principal fica uma cópia por dia: apagar algo sem
 * querer sobrescreve o principal, mas a cópia de ontem continua lá.
 */

const DEBOUNCE_MS = 4000
const WATCHED = ['maps', 'agents', 'abilities', 'spots', 'lineups', 'settings'] as const
const HANDLE_KEY = 'backup:pasta'
const LAST_KEY = 'backup:ultimo'
const OFF_KEY = 'backup:desligado'
const API_HEADERS = { 'x-mec-lineup': '1' }

/* ---------- tipos da File System Access API que o lib.dom ainda não traz ---------- */

type PermissionMode = { mode: 'readwrite' }
interface DirHandle extends FileSystemDirectoryHandle {
  queryPermission(d: PermissionMode): Promise<PermissionState>
  requestPermission(d: PermissionMode): Promise<PermissionState>
}
declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<DirHandle>
  }
}

/* ---------- destinos ---------- */

interface Target {
  kind: 'projeto' | 'pasta'
  label: string
  write(json: string, opts?: { replacing?: boolean }): Promise<void>
  read(): Promise<BackupFile | null>
  meta(): Promise<BackupMeta | null>
}

const metaOf = (f: BackupFile): BackupMeta => ({
  exportedAt: f.exportedAt,
  lineups: f.tables.lineups?.length ?? 0,
  spots: f.tables.spots?.length ?? 0,
})

/** Existe servidor de backup? Só no `npm run dev`/`preview`; num deploy estático, não. */
async function projectStatus(): Promise<{ folder: string; latest: BackupMeta | null } | null> {
  try {
    const res = await fetch('/api/backup/status', { headers: API_HEADERS })
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null
    return (await res.json()) as { folder: string; latest: BackupMeta | null }
  } catch {
    return null
  }
}

function projectTarget(folder: string): Target {
  return {
    kind: 'projeto',
    label: folder,
    async write(json, opts) {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { ...API_HEADERS, 'content-type': 'application/json', ...(opts?.replacing ? { 'x-mec-lineup-replace': '1' } : {}) },
        body: json,
      })
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { erro?: string } | null)?.erro ?? `servidor respondeu ${res.status}`)
    },
    async read() {
      const res = await fetch('/api/backup', { headers: API_HEADERS })
      if (!res.ok) return null
      const parsed: unknown = await res.json()
      return isBackupFile(parsed) ? parsed : null
    },
    async meta() {
      return (await projectStatus())?.latest ?? null
    },
  }
}

async function writeFile(dir: DirHandle, name: string, content: string) {
  const file = await dir.getFileHandle(name, { create: true })
  const w = await file.createWritable()
  await w.write(content)
  await w.close()
}

function folderTarget(dir: DirHandle): Target {
  const read = async () => {
    try {
      const parsed: unknown = JSON.parse(await (await (await dir.getFileHandle(LATEST_FILE)).getFile()).text())
      return isBackupFile(parsed) ? parsed : null
    } catch {
      return null // pasta sem backup (ou arquivo ilegível)
    }
  }
  return {
    kind: 'pasta',
    label: dir.name,
    async write(json, opts) {
      if (opts?.replacing) {
        const old = await read()
        if (old) await writeFile(dir, replacedName(new Date()), JSON.stringify(old))
      }
      await writeFile(dir, LATEST_FILE, json)
      await writeFile(dir, dailyName(new Date()), json)
      const names: string[] = []
      for await (const n of dir.keys()) names.push(n)
      for (const old of dailyToPrune(names)) await dir.removeEntry(old)
    },
    read,
    async meta() {
      const f = await read()
      return f && metaOf(f)
    },
  }
}

/* ---------- estado observável pela UI ---------- */

export type BackupStatus = 'desligado' | 'pausado' | 'ativo' | 'salvando' | 'erro' | 'restaurar'

export interface BackupState {
  status: BackupStatus
  kind?: 'projeto' | 'pasta'
  folder?: string
  lastAt?: number
  error?: string
  /** Backup encontrado no destino, aguardando decisão (restaurar ou substituir). */
  pending?: BackupMeta
  /** O servidor do projeto está rodando (dá pra usar a pasta backups/). */
  projectAvailable: boolean
  /** O navegador permite escolher outra pasta (Edge/Chrome). */
  folderPickerAvailable: boolean
}

let state: BackupState = { status: 'desligado', projectAvailable: false, folderPickerAvailable: false }
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

let target: Target | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let dirty = false
let started = false
/** Destino com backup ainda não decidido: não grava nada por cima. */
let holdWrites = false
let projectFolder = ''

/** Liga os ganchos do banco e escolhe o destino (uma vez por sessão). */
export async function initAutoBackup() {
  if (started) return
  started = true
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

  const project = await projectStatus()
  projectFolder = project?.folder ?? ''
  const lastAt = (await db.local.get(LAST_KEY))?.value as number | undefined
  set({ projectAvailable: !!project, folderPickerAvailable: !!window.showDirectoryPicker, lastAt })

  // 1º: pasta escolhida pelo usuário, se houver
  const saved = (await db.local.get(HANDLE_KEY))?.value as DirHandle | undefined
  if (saved && window.showDirectoryPicker) {
    target = folderTarget(saved)
    // sem gesto do usuário o navegador pode não devolver a permissão: fica
    // "pausado" até um clique em reativar
    const perm = await saved.queryPermission({ mode: 'readwrite' }).catch(() => 'prompt' as PermissionState)
    return set({ kind: 'pasta', folder: saved.name, status: perm === 'granted' ? 'ativo' : 'pausado' })
  }

  // 2º: pasta do projeto, ligada por padrão (a não ser que tenha sido desligada)
  if (project && !(await db.local.get(OFF_KEY))?.value) {
    await activate(projectTarget(project.folder), project.latest)
  }
}

/**
 * Ativa um destino. Se ele já tem backup com dados e este navegador está sem
 * pontos nem posições (limpou os dados, outro PC...), NÃO grava: pergunta antes.
 */
async function activate(t: Target, existing?: BackupMeta | null) {
  target = t
  holdWrites = false
  set({ kind: t.kind, folder: t.label, status: 'ativo', error: undefined, pending: undefined })
  const meta = existing === undefined ? await t.meta() : existing
  if (meta && meta.spots + meta.lineups > 0) {
    const local = (await db.spots.count()) + (await db.lineups.count())
    if (local === 0) {
      holdWrites = true
      return set({ status: 'restaurar', pending: meta })
    }
  }
  if (dirty || !meta) await runBackup()
}

function schedule() {
  dirty = true
  if (!target || holdWrites || (state.status !== 'ativo' && state.status !== 'erro')) return
  clearTimeout(timer)
  timer = setTimeout(() => void runBackup(), DEBOUNCE_MS)
}

/** Escolher outra pasta precisa vir de um clique (exigência do navegador). */
export async function chooseFolder() {
  if (!window.showDirectoryPicker) return
  const picked = await window.showDirectoryPicker({ id: 'mec-lineup-backup', mode: 'readwrite', startIn: 'documents' })
  await db.local.put({ key: HANDLE_KEY, value: picked })
  await db.local.delete(OFF_KEY)
  await activate(folderTarget(picked))
}

/** Volta pra pasta backups/ do projeto. */
export async function switchToProjectFolder() {
  if (!state.projectAvailable) return
  await db.local.delete(HANDLE_KEY)
  await db.local.delete(OFF_KEY)
  await activate(projectTarget(projectFolder))
}

/** Resposta à pergunta de restauração: trazer o backup, ou gravar os dados atuais por cima. */
export async function resolvePending(choice: 'restaurar' | 'substituir') {
  if (!target) return
  if (choice === 'restaurar') {
    const file = await target.read()
    if (file) await importBackup(file)
  }
  holdWrites = false
  await runBackup({ replacing: choice === 'substituir' })
}

export async function reactivate() {
  if (target?.kind !== 'pasta') return
  const saved = (await db.local.get(HANDLE_KEY))?.value as DirHandle | undefined
  const perm = await saved?.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') return set({ status: 'pausado' })
  set({ status: 'ativo', error: undefined })
  if (dirty || !state.lastAt) await runBackup()
}

export async function disable() {
  clearTimeout(timer)
  holdWrites = false
  target = null
  await db.local.delete(HANDLE_KEY)
  await db.local.put({ key: OFF_KEY, value: true })
  set({ status: 'desligado', kind: undefined, folder: undefined, error: undefined, pending: undefined })
}

export async function runBackup(opts?: { replacing?: boolean }) {
  if (!target || holdWrites) return
  clearTimeout(timer)
  dirty = false
  set({ status: 'salvando' })
  try {
    await target.write(JSON.stringify(await exportBackup()), opts)
    const lastAt = Date.now()
    await db.local.put({ key: LAST_KEY, value: lastAt })
    set({ status: 'ativo', lastAt, error: undefined, pending: undefined })
  } catch (e) {
    dirty = true
    const denied = e instanceof DOMException && e.name === 'NotAllowedError'
    set(denied ? { status: 'pausado' } : { status: 'erro', error: e instanceof Error ? e.message : String(e) })
  }
  // mudanças feitas durante a gravação entram na próxima
  if (dirty && state.status === 'ativo') schedule()
}
