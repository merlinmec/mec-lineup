import { describe, expect, it } from 'vitest'
import { dailyName, dailyToPrune, LATEST_FILE } from './autoBackup'

describe('cópias diárias do backup', () => {
  it('usa a data local no nome', () => {
    expect(dailyName(new Date(2026, 8, 4, 23, 59))).toBe('mec-lineup-2026-09-04.json')
  })

  it('mantém as N mais novas e apaga as antigas', () => {
    const names = ['mec-lineup-2026-09-01.json', 'mec-lineup-2026-09-03.json', 'mec-lineup-2026-09-02.json', 'mec-lineup-2026-08-30.json']
    expect(dailyToPrune(names, 2).sort()).toEqual(['mec-lineup-2026-08-30.json', 'mec-lineup-2026-09-01.json'])
  })

  it('nunca apaga o arquivo principal nem arquivos que não são do app', () => {
    const names = [LATEST_FILE, 'notas.txt', 'mec-lineup-2026-01-01.json.bak', 'mec-lineup-2026-01-01.json']
    expect(dailyToPrune(names, 0)).toEqual(['mec-lineup-2026-01-01.json'])
  })
})
