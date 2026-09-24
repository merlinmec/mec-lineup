import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Connect, Plugin } from 'vite'
import { dailyName, dailyToPrune, LATEST_FILE, replacedName, type BackupMeta } from './src/lib/backupFiles.ts'

/**
 * Backup na pasta backups/ do projeto, gravado pelo servidor local do Vite.
 * O navegador não consegue gravar numa pasta fixa sem o usuário escolher;
 * o servidor consegue, sem clique e sem permissão expirando.
 *
 * Só existe no servidor local (`npm run servir` / `npm run dev`), não num deploy estático.
 */

const ROOT = dirname(fileURLToPath(import.meta.url))
/** App de uso (preview, porta 5180). MEC_BACKUP_DIR sobrescreve (testes). */
export const BACKUP_DIR = process.env.MEC_BACKUP_DIR ?? resolve(ROOT, 'backups')
/** Desenvolvimento (porta 5181): pasta própria, pra testes não sobrescreverem o backup real. */
const DEV_BACKUP_DIR = process.env.MEC_BACKUP_DIR ?? resolve(ROOT, 'backups-dev')
const MAX_BODY = 512 * 1024 * 1024 // prints em base64 somam rápido
// Header customizado força preflight de CORS: outro site aberto no navegador
// não consegue mandar POST pra cá e sobrescrever o backup.
const GUARD_HEADER = 'x-mec-lineup'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        fail(new Error('Backup grande demais'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')))
    req.on('error', fail)
  })
}

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

interface BackupJson {
  format?: string
  exportedAt?: string
  tables?: { lineups?: unknown[]; spots?: unknown[] }
}

const metaOf = (j: BackupJson): BackupMeta => ({
  exportedAt: j.exportedAt ?? '',
  lineups: j.tables?.lineups?.length ?? 0,
  spots: j.tables?.spots?.length ?? 0,
})

/** Grava de forma atômica: arquivo temporário + rename, nunca um JSON pela metade. */
async function atomicWrite(file: string, content: string) {
  const tmp = `${file}.tmp`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, file)
}

async function readLatest(dir: string): Promise<string | null> {
  try {
    return await readFile(join(dir, LATEST_FILE), 'utf8')
  } catch {
    return null
  }
}

export function backupMiddleware(dir = BACKUP_DIR): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url?.split('?')[0]
    if (!url?.startsWith('/api/backup')) return next()
    try {
      if (req.headers[GUARD_HEADER] !== '1') return send(res, 403, { erro: 'cabeçalho ausente' })

      if (req.method === 'GET' && url === '/api/backup/status') {
        const raw = await readLatest(dir)
        return send(res, 200, { folder: dir, latest: raw ? metaOf(JSON.parse(raw)) : null })
      }

      if (req.method === 'GET' && url === '/api/backup') {
        const raw = await readLatest(dir)
        if (!raw) return send(res, 404, { erro: 'sem backup' })
        res.setHeader('Content-Type', 'application/json')
        return res.end(raw)
      }

      if (req.method === 'POST' && url === '/api/backup') {
        const raw = await readBody(req)
        const parsed = JSON.parse(raw) as BackupJson
        if (parsed.format !== 'mec-lineup-backup') return send(res, 400, { erro: 'não é um backup do MEC Lineup' })
        await mkdir(dir, { recursive: true })
        // substituindo um backup que tinha dados por outro: guarda o antigo antes
        if (req.headers['x-mec-lineup-replace'] === '1') {
          const old = await readLatest(dir)
          if (old) await writeFile(join(dir, replacedName(new Date())), old, 'utf8')
        }
        await atomicWrite(join(dir, LATEST_FILE), raw)
        await atomicWrite(join(dir, dailyName(new Date())), raw)
        for (const old of dailyToPrune(await readdir(dir))) await rm(join(dir, old), { force: true })
        return send(res, 200, metaOf(parsed))
      }

      return send(res, 405, { erro: 'método não suportado' })
    } catch (e) {
      return send(res, 500, { erro: e instanceof Error ? e.message : String(e) })
    }
  }
}

export function backupPlugin(): Plugin {
  return {
    name: 'mec-lineup-backup',
    configureServer: (server) => void server.middlewares.use(backupMiddleware(DEV_BACKUP_DIR)),
    configurePreviewServer: (server) => void server.middlewares.use(backupMiddleware(BACKUP_DIR)),
  }
}
