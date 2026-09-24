import { AlertTriangle, CheckCircle2, FolderCog, FolderOpen, HardDriveDownload, History, Loader2, PauseCircle, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { chooseFolder, disable, KEEP_DAILY, LATEST_FILE, reactivate, resolvePending, runBackup, useBackupState, switchToProjectFolder, type BackupState } from '../../lib/autoBackup'
import type { BackupMeta } from '../../lib/backupFiles'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { useConfirm } from '../../ui/Confirm'
import { useToast } from '../../ui/Toast'

/** "agora", "há 5 min", "há 2 h", ou a data. Re-renderiza a cada 30 s. */
function useRelative(ts?: number) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!ts) return 'nunca'
  const s = (Date.now() - ts) / 1000
  if (s < 45) return 'agora'
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  if (s < 86400) return `há ${Math.round(s / 3600)} h`
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Cancelar o seletor de pasta lança AbortError: não é erro pro usuário. */
const ignoreAbort = (e: unknown) => {
  if (!(e instanceof DOMException && e.name === 'AbortError')) throw e
}

const folderName = (s: BackupState) => (s.kind === 'projeto' ? 'backups/ do projeto' : s.folder)

/**
 * Pergunta de restauração: aparece sozinha ao abrir o app quando o destino do
 * backup tem dados e este navegador está vazio (ex: limpou os dados).
 */
function useRestorePrompt() {
  const s = useBackupState()
  const confirm = useConfirm()
  const toast = useToast()
  const asked = useRef(false)
  const folder = folderName(s)

  const ask = async (meta: BackupMeta) => {
    const when = new Date(meta.exportedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const restore = await confirm({
      title: 'Encontrei um backup seu',
      message: (
        <>
          Na pasta <b className="text-text">{folder}</b> tem um backup de <b className="text-text">{when}</b> com <b className="text-text">{meta.spots}</b> {meta.spots === 1 ? 'ponto' : 'pontos'} e{' '}
          <b className="text-text">{meta.lineups}</b> {meta.lineups === 1 ? 'posição' : 'posições'}, e este navegador está vazio. Restaurar agora?
          <br />
          <br />
          Se começar do zero, o backup antigo é guardado como cópia na mesma pasta antes.
        </>
      ),
      confirmLabel: 'Restaurar backup',
      cancelLabel: 'Não, começar do zero',
      tone: 'primary',
    })
    if (restore === null) return // fechou sem escolher: continua pendente, o aviso no topo fica
    await resolvePending(restore ? 'restaurar' : 'substituir')
    toast(restore ? 'Backup restaurado' : 'Começando do zero; o backup antigo foi guardado como cópia')
  }

  const askRef = useRef(ask)
  askRef.current = ask
  useEffect(() => {
    if (s.status === 'restaurar' && s.pending && !asked.current) {
      asked.current = true
      void askRef.current(s.pending)
    }
  }, [s.status, s.pending])

  return () => s.pending && ask(s.pending)
}

export function BackupCard() {
  const s = useBackupState()
  const last = useRelative(s.lastAt)
  const pick = () => chooseFolder().catch(ignoreAbort)

  if (!s.projectAvailable && !s.folderPickerAvailable && s.status === 'desligado') {
    return (
      <div className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">
        Backup automático indisponível aqui: rode o app com <code className="text-text">npm run dev</code> (grava em <code className="text-text">backups/</code>) ou use Edge/Chrome pra escolher uma pasta. Enquanto isso, use o exportar manual abaixo.
      </div>
    )
  }

  const tone = s.status === 'ativo' || s.status === 'salvando' ? 'ok' : s.status === 'desligado' ? 'neutro' : s.status === 'erro' ? 'erro' : 'aviso'

  return (
    <div
      id="backup"
      className={cn(
        'rounded-xl border p-5',
        tone === 'ok' && 'border-accent/35 bg-accent/[.05]',
        tone === 'neutro' && 'border-line bg-panel',
        tone === 'aviso' && 'border-[#ffb547]/40 bg-[#ffb547]/[.06]',
        tone === 'erro' && 'border-danger/40 bg-danger/[.06]',
      )}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-lg',
            tone === 'ok' ? 'bg-accent/15 text-accent' : tone === 'aviso' ? 'bg-[#ffb547]/15 text-[#ffb547]' : tone === 'erro' ? 'bg-danger/15 text-danger' : 'bg-panel-3 text-muted',
          )}
        >
          {s.status === 'salvando' ? (
            <Loader2 size={19} className="animate-spin" />
          ) : tone === 'ok' ? (
            <CheckCircle2 size={19} />
          ) : s.status === 'restaurar' ? (
            <History size={19} />
          ) : tone === 'aviso' ? (
            <PauseCircle size={19} />
          ) : tone === 'erro' ? (
            <AlertTriangle size={19} />
          ) : (
            <HardDriveDownload size={19} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {s.status === 'desligado' && 'Backup automático desligado'}
            {(s.status === 'ativo' || s.status === 'salvando') && (
              <>
                Salvando automaticamente em <span className="text-accent">{folderName(s)}</span>
              </>
            )}
            {s.status === 'pausado' && (
              <>
                Backup pausado em <span className="text-[#ffb547]">{s.folder}</span>
              </>
            )}
            {s.status === 'restaurar' && 'Backup encontrado, aguardando sua decisão'}
            {s.status === 'erro' && 'Não foi possível gravar o backup'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {s.status === 'desligado' &&
              (s.projectAvailable
                ? 'Ligue pra gravar sozinho na pasta backups/ do projeto a cada alteração.'
                : 'Escolha uma pasta e o app grava tudo lá sozinho a cada alteração.')}
            {(s.status === 'ativo' || s.status === 'salvando') && (
              <>
                Último backup: <b className="text-text">{s.status === 'salvando' ? 'salvando…' : last}</b>. Arquivo <code className="text-xs text-text">{LATEST_FILE}</code> + uma cópia por dia dos últimos {KEEP_DAILY} dias.
                {s.kind === 'projeto' && (
                  <span className="mt-1 block break-all text-xs text-faint" title="Caminho completo">
                    {s.folder}
                  </span>
                )}
              </>
            )}
            {s.status === 'pausado' && 'O navegador pede sua confirmação pra voltar a gravar na pasta depois de reaberto. As alterações feitas enquanto isso entram no próximo backup.'}
            {s.status === 'restaurar' && 'Nada foi gravado por cima. Escolha se quer restaurar o backup ou começar do zero.'}
            {s.status === 'erro' && (s.error ?? 'Erro desconhecido.')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {s.status === 'restaurar' && (
            <>
              <Button variant="primary" icon={<History size={15} />} onClick={() => resolvePending('restaurar')}>
                Restaurar
              </Button>
              <Button variant="ghost" onClick={() => resolvePending('substituir')}>
                Começar do zero
              </Button>
            </>
          )}
          {s.status === 'pausado' && (
            <Button variant="primary" icon={<RefreshCw size={15} />} onClick={() => reactivate()}>
              Reativar
            </Button>
          )}
          {(s.status === 'ativo' || s.status === 'erro') && (
            <Button icon={<RefreshCw size={15} />} onClick={() => runBackup()}>
              Salvar agora
            </Button>
          )}
          {s.projectAvailable && s.kind !== 'projeto' && (
            <Button variant={s.status === 'desligado' ? 'primary' : 'ghost'} icon={<FolderCog size={15} />} onClick={() => switchToProjectFolder()}>
              Usar pasta do projeto
            </Button>
          )}
          {s.folderPickerAvailable && (
            <Button variant={s.status === 'desligado' && !s.projectAvailable ? 'primary' : 'ghost'} icon={<FolderOpen size={15} />} onClick={pick}>
              {s.kind === 'pasta' ? 'Trocar pasta' : 'Usar outra pasta'}
            </Button>
          )}
          {s.status !== 'desligado' && (
            <Button variant="ghost" onClick={() => disable()}>
              Desligar
            </Button>
          )}
        </div>
      </div>
      {s.status !== 'desligado' && (
        <p className="mt-4 border-t border-line/70 pt-3 text-xs text-faint">
          {s.kind === 'projeto'
            ? 'Limpou o navegador? Ao abrir, o app encontra o backup nessa pasta e pergunta se quer restaurar. Pra voltar a um dia específico, use Importar backup com a cópia daquele dia. Dica: "Usar outra pasta" dentro do OneDrive/Drive dá cópia na nuvem.'
            : 'Limpou o navegador? Escolha esta mesma pasta de novo: o app encontra o backup e pergunta se quer restaurar. Pra voltar a um dia específico, use Importar backup com a cópia daquele dia.'}
        </p>
      )}
    </div>
  )
}

/** Indicador compacto no topo: sempre à vista se o backup está em dia. */
export function BackupIndicator() {
  const s = useBackupState()
  const last = useRelative(s.lastAt)
  const askRestore = useRestorePrompt()
  if (!s.projectAvailable && !s.folderPickerAvailable && s.status === 'desligado') return null

  const base = 'flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors'
  if (s.status === 'restaurar') {
    return (
      <button type="button" onClick={() => askRestore()} className={cn(base, 'border-[#ffb547]/40 bg-[#ffb547]/10 text-[#ffb547] hover:bg-[#ffb547]/15')}>
        <History size={14} /> Backup encontrado · restaurar?
      </button>
    )
  }
  if (s.status === 'pausado') {
    return (
      <button type="button" onClick={() => reactivate()} className={cn(base, 'border-[#ffb547]/40 bg-[#ffb547]/10 text-[#ffb547] hover:bg-[#ffb547]/15')} title="O navegador pede confirmação pra voltar a gravar na pasta">
        <PauseCircle size={14} /> Backup pausado · reativar
      </button>
    )
  }
  if (s.status === 'desligado' || s.status === 'erro') {
    return (
      <Link to="/config#backup" className={cn(base, s.status === 'erro' ? 'border-danger/40 bg-danger/10 text-danger' : 'border-[#ffb547]/40 text-[#ffb547] hover:bg-[#ffb547]/10')}>
        <AlertTriangle size={14} /> {s.status === 'erro' ? 'Erro no backup' : 'Sem backup automático'}
      </Link>
    )
  }
  return (
    <Link to="/config#backup" className={cn(base, 'border-line text-muted hover:border-line-2 hover:text-text')} title={`Backup em ${s.folder}`}>
      {s.status === 'salvando' ? <Loader2 size={14} className="animate-spin text-accent" /> : <CheckCircle2 size={14} className="text-accent" />}
      {s.status === 'salvando' ? 'Salvando…' : `Salvo ${last}`}
    </Link>
  )
}
