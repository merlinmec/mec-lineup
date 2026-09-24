import { useLiveQuery } from 'dexie-react-hooks'
import { Download, RefreshCw, Trash2, Upload } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { db } from '../../db/db'
import { exportBackup, importBackup, isBackupFile } from '../../lib/backup'
import { fetchMaps } from '../../lib/valorantApi'
import { cn } from '../../ui/cn'
import { useConfirm } from '../../ui/Confirm'
import { useToast } from '../../ui/Toast'
import { AgentsSection } from './AgentsSection'
import { BackupCard } from './BackupCard'

export function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get('app'))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-5xl font-bold">
          Configurações
        </motion.h1>
        <p className="mt-2 text-muted">Tudo fica salvo neste navegador. Exporte um backup para levar a outro PC.</p>

        <Section
          title="Agentes e habilidades"
          description="Ícones padrão são os do jogo. Troque qualquer imagem clicando, arrastando ou colando (Ctrl+V). O retrato do agente é o marcador de posição no mapa."
          delay={0.05}
        >
          <AgentsSection />
        </Section>

        <Section title="Aparência" delay={0.1}>
          <div>
              <span className="label">Estilo do minimapa</span>
              <div className="flex max-w-sm gap-1 rounded-lg border border-line bg-bg-2 p-1">
                {(
                  [
                    ['tatico', 'Tático'],
                    ['original', 'Original'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => db.settings.update('app', { minimapStyle: value })}
                    className={cn('flex-1 rounded-md py-1.5 text-sm font-medium transition-colors', settings?.minimapStyle === value ? 'bg-panel-3 text-text' : 'text-muted hover:text-text')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-faint">
                O tático recolore o minimapa em tons de teal pra destacar os marcadores. O original mostra a imagem como veio.
              </p>
          </div>
        </Section>

        <DataSection delay={0.15} />
      </div>
    </div>
  )
}

function DataSection({ delay }: { delay: number }) {
  const file = useRef<HTMLInputElement>(null)
  const confirm = useConfirm()
  const toast = useToast()

  const doExport = async () => {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mec-lineup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toast('Backup exportado')
  }

  const doImport = async (f: File | undefined) => {
    if (!f) return
    let parsed: unknown
    try {
      parsed = JSON.parse(await f.text())
    } catch {
      return toast('Arquivo inválido', 'erro')
    }
    if (!isBackupFile(parsed)) return toast('Esse arquivo não é um backup do MEC Lineup', 'erro')
    const ok = await confirm({
      title: 'Importar backup?',
      message: 'Todos os mapas, pontos e posições atuais serão substituídos pelos do arquivo.',
      confirmLabel: 'Substituir tudo',
    })
    if (!ok) return
    try {
      await importBackup(parsed)
      toast('Backup importado')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Falha ao importar', 'erro')
    }
  }

  const restoreMaps = async () => {
    try {
      const official = await fetchMaps()
      const existing = new Set(await db.maps.toCollection().primaryKeys())
      const last = await db.maps.orderBy('order').last()
      const missing = official.filter((m) => !existing.has(m.id)).map((m, i) => ({ ...m, order: (last?.order ?? -1) + 1 + i }))
      await db.maps.bulkAdd(missing)
      toast(missing.length ? `${missing.length} ${missing.length === 1 ? 'mapa restaurado' : 'mapas restaurados'}` : 'Todos os mapas oficiais já estão no menu')
    } catch {
      toast('Não foi possível acessar a valorant-api', 'erro')
    }
  }

  const resetAll = async () => {
    const ok = await confirm({
      title: 'Apagar tudo?',
      message: 'Mapas, habilidades, pontos, posições e prints voltam ao estado inicial. Os arquivos da pasta de backup automático não são apagados.',
      confirmLabel: 'Apagar tudo',
    })
    if (!ok) return
    await db.delete()
    location.href = '/'
  }

  return (
    <Section title="Dados" description="Nada vai pra servidor nenhum: os dados ficam no IndexedDB deste navegador." delay={delay}>
      <div className="mb-3">
        <BackupCard />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DataAction icon={<Download size={18} />} title="Exportar backup" text="Arquivo .json com tudo, prints incluídos." onClick={doExport} />
        <DataAction icon={<Upload size={18} />} title="Importar backup" text="Substitui os dados atuais pelos do arquivo." onClick={() => file.current?.click()} />
        <DataAction icon={<RefreshCw size={18} />} title="Recarregar mapas oficiais" text="Traz de volta mapas excluídos e novos mapas lançados." onClick={restoreMaps} />
        <DataAction icon={<Trash2 size={18} />} title="Apagar tudo" text="Volta o app ao estado inicial." onClick={resetAll} danger />
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          doImport(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </Section>
  )
}

function DataAction({ icon, title, text, onClick, danger }: { icon: ReactNode; title: string; text: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-line bg-panel p-4 text-left transition-colors',
        danger ? 'hover:border-danger/50 hover:bg-danger/5' : 'hover:border-line-2 hover:bg-panel-2',
      )}
    >
      <span className={cn('mt-0.5', danger ? 'text-danger' : 'text-accent')}>{icon}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{text}</span>
      </span>
    </button>
  )
}

function Section({ title, description, delay = 0, children }: { title: string; description?: string; delay?: number; children: ReactNode }) {
  return (
    <motion.section
      className="mt-12"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </motion.section>
  )
}
