/**
 * Nomes e rotação dos arquivos de backup. Sem dependências de propósito: é
 * usado tanto no navegador (pasta escolhida) quanto no servidor do Vite
 * (pasta backups/ do projeto).
 */

export const LATEST_FILE = 'mec-lineup-backup.json'
export const KEEP_DAILY = 14
const DAILY_RE = /^mec-lineup-(\d{4}-\d{2}-\d{2})\.json$/

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

/** Nome da cópia guardada antes de substituir um backup existente (nunca é apagada). */
export const replacedName = (d: Date) => `mec-lineup-substituido-${dailyName(d).slice(11, 21)}-${d.getTime()}.json`

/** Resumo leve do backup, pra decidir se vale oferecer restauração. */
export interface BackupMeta {
  exportedAt: string
  lineups: number
  spots: number
}
