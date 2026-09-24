import { AlertTriangle, CheckCircle2, FolderOpen, HardDriveDownload, Loader2, PauseCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { chooseFolder, disable, KEEP_DAILY, LATEST_FILE, reactivate, resolveExisting, runBackup, useBackupState } from '../../lib/autoBackup'
import { useConfirm } from '../../ui/Confirm'
import { useToast } from '../../ui/Toast'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'

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

export function BackupCard() {
  const s = useBackupState()
  const last = useRelative(s.lastAt)
  const confirm = useConfirm()
  const toast = useToast()

  const pick = async () => {
    const existing = await chooseFolder().catch((e) => (ignoreAbort(e), null))
    if (!existing) return
    const when = new Date(existing.exportedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const restore = await confirm({
      title: 'Essa pasta já tem um backup',
      message: (
        <>
          Backup de <b className="text-text">{when}</b> com <b className="text-text">{existing.lineups}</b> {existing.lineups === 1 ? 'posição' : 'posições'}. Quer restaurar ele agora? Se escolher não, os dados atuais deste navegador passam a ser o backup; o arquivo antigo é guardado como cópia na pasta.
        </>
      ),
      confirmLabel: 'Restaurar backup',
      cancelLabel: 'Não, substituir',
      tone: 'primary',
    })
    if (restore === null) {
      // fechou sem escolher: não arrisca nada, desconecta a pasta
      await disable()
      return toast('Nada foi alterado. A pasta não foi conectada.')
    }
    await resolveExisting(restore ? 'restaurar' : 'substituir', existing)
    toast(restore ? 'Backup restaurado' : 'Backup atualizado com os dados atuais')
  }

  if (s.status === 'indisponivel') {
    return (
      <div className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">
        Este navegador não permite gravar numa pasta do PC. O backup automático funciona no <b className="text-text">Edge</b> ou no <b className="text-text">Chrome</b>. Aqui, use o exportar manual abaixo.
      </div>
    )
  }

  const tone =
    s.status === 'ativo' || s.status === 'salvando' ? 'ok' : s.status === 'desligado' ? 'neutro' : s.status === 'pausado' ? 'aviso' : 'erro'

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
          {s.status === 'salvando' ? <Loader2 size={19} className="animate-spin" /> : tone === 'ok' ? <CheckCircle2 size={19} /> : tone === 'aviso' ? <PauseCircle size={19} /> : tone === 'erro' ? <AlertTriangle size={19} /> : <HardDriveDownload size={19} />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {s.status === 'desligado' && 'Backup automático desligado'}
            {(s.status === 'ativo' || s.status === 'salvando') && (
              <>
                Salvando automaticamente em <span className="text-accent">{s.folder}</span>
              </>
            )}
            {s.status === 'pausado' && (
              <>
                Backup pausado em <span className="text-[#ffb547]">{s.folder}</span>
              </>
            )}
            {s.status === 'erro' && 'Não foi possível gravar o backup'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {s.status === 'desligado' &&
              'Escolha uma pasta e o app grava tudo lá sozinho a cada alteração. Limpar os dados do navegador não afeta esses arquivos. Dica: uma pasta dentro do OneDrive ou Google Drive vira cópia na nuvem.'}
            {(s.status === 'ativo' || s.status === 'salvando') && (
              <>
                Último backup: <b className="text-text">{s.status === 'salvando' ? 'salvando…' : last}</b>. Arquivo principal <code className="text-xs text-text">{LATEST_FILE}</code> + uma cópia por dia dos últimos {KEEP_DAILY} dias.
              </>
            )}
            {s.status === 'pausado' && 'Por segurança, o navegador pede sua confirmação para voltar a gravar na pasta depois que ele é reaberto. As alterações feitas enquanto isso entram no próximo backup.'}
            {s.status === 'erro' && (s.error ?? 'Erro desconhecido.')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {s.status === 'desligado' && (
            <Button variant="primary" icon={<FolderOpen size={15} />} onClick={pick}>
              Escolher pasta
            </Button>
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
          {s.status !== 'desligado' && (
            <>
              <Button variant="ghost" onClick={pick}>
                Trocar pasta
              </Button>
              <Button variant="ghost" onClick={() => disable()}>
                Desligar
              </Button>
            </>
          )}
        </div>
      </div>
      {s.status !== 'desligado' && (
        <p className="mt-4 border-t border-line/70 pt-3 text-xs text-faint">
          Limpou o navegador? Clique em <b className="text-muted">Escolher pasta</b> e selecione esta mesma pasta: o app encontra o backup e oferece restaurar. Pra voltar a um dia específico, use <b className="text-muted">Importar backup</b> com a cópia daquele dia.
        </p>
      )}
    </div>
  )
}

/** Indicador compacto no topo: sempre à vista se o backup está em dia. */
export function BackupIndicator() {
  const s = useBackupState()
  const last = useRelative(s.lastAt)
  if (s.status === 'indisponivel') return null

  const base = 'flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors'
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
