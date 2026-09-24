import { mkdtempSync, readdirSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backupMiddleware } from '../../backupServer'
import { dailyName, LATEST_FILE } from './backupFiles'

let server: Server
let dir: string
let base: string
const H = { 'x-mec-lineup': '1', 'content-type': 'application/json' }
const backup = (lineups: number) => JSON.stringify({ format: 'mec-lineup-backup', version: 2, exportedAt: '2026-09-24T12:00:00Z', tables: { lineups: Array(lineups).fill({}), spots: [{}] } })

beforeEach(async () => {
  dir = join(mkdtempSync(join(tmpdir(), 'mec-bkp-')), 'backups')
  const mw = backupMiddleware(dir)
  server = createServer((req, res) => mw(req, res, () => ((res.statusCode = 404), res.end())))
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  const addr = server.address() as { port: number }
  base = `http://127.0.0.1:${addr.port}`
})
afterEach(() => new Promise<void>((ok) => server.close(() => ok())))

describe('backup na pasta do projeto', () => {
  it('recusa pedido sem o cabeçalho (outro site não consegue gravar)', async () => {
    const res = await fetch(`${base}/api/backup`, { method: 'POST', body: backup(1) })
    expect(res.status).toBe(403)
  })

  it('grava o principal e a cópia do dia, e devolve o resumo', async () => {
    const res = await fetch(`${base}/api/backup`, { method: 'POST', headers: H, body: backup(3) })
    expect(res.status).toBe(200)
    expect(readdirSync(dir).sort()).toEqual([dailyName(new Date()), LATEST_FILE].sort())
    const status = await (await fetch(`${base}/api/backup/status`, { headers: H })).json()
    expect(status.latest).toEqual({ exportedAt: '2026-09-24T12:00:00Z', lineups: 3, spots: 1 })
    expect(status.folder).toBe(dir)
  })

  it('sem backup ainda: status sem "latest" e GET 404', async () => {
    const status = await (await fetch(`${base}/api/backup/status`, { headers: H })).json()
    expect(status.latest).toBeNull()
    expect((await fetch(`${base}/api/backup`, { headers: H })).status).toBe(404)
  })

  it('substituir guarda uma cópia do backup anterior', async () => {
    await fetch(`${base}/api/backup`, { method: 'POST', headers: H, body: backup(5) })
    await fetch(`${base}/api/backup`, { method: 'POST', headers: { ...H, 'x-mec-lineup-replace': '1' }, body: backup(0) })
    expect(readdirSync(dir).some((f) => f.startsWith('mec-lineup-substituido-'))).toBe(true)
    const latest = await (await fetch(`${base}/api/backup`, { headers: H })).json()
    expect(latest.tables.lineups).toHaveLength(0)
  })

  it('rejeita JSON que não é backup do app', async () => {
    const res = await fetch(`${base}/api/backup`, { method: 'POST', headers: H, body: JSON.stringify({ oi: 1 }) })
    expect(res.status).toBe(400)
  })
})
