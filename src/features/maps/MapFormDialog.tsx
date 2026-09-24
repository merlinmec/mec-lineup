import { useEffect, useState } from 'react'
import { mapsRepo } from '../../db/repo'
import type { GameMap, ImageSource, Rotation } from '../../db/types'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { ImageDrop } from '../../ui/ImageDrop'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/Toast'

interface Props {
  open: boolean
  map?: GameMap
  onClose: () => void
}

const ROTATIONS: Rotation[] = [0, 90, 180, 270]

/** Mesmo formulário pra criar e editar; só grava ao clicar em salvar. */
export function MapFormDialog({ open, map, onClose }: Props) {
  const [name, setName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [cover, setCover] = useState<ImageSource>({})
  const [minimap, setMinimap] = useState<ImageSource>({})
  const [rotation, setRotation] = useState<Rotation>(0)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setName(map?.name ?? '')
    setSubtitle(map?.subtitle ?? '')
    setCover(map?.cover ?? {})
    setMinimap(map?.minimap ?? {})
    setRotation(map?.rotation ?? 0)
  }, [open, map])

  const valid = name.trim() && (minimap.blob || minimap.url)

  const save = async () => {
    if (!valid) return
    const data = { name: name.trim(), subtitle: subtitle.trim() || undefined, cover, minimap, rotation }
    if (map) await mapsRepo.update(map.id, data)
    else await mapsRepo.create(data)
    toast(map ? 'Mapa atualizado' : 'Mapa criado')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={map ? `Editar ${map.name}` : 'Novo mapa'}
      maxWidth={672}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className="grid gap-5 sm:grid-cols-[1fr_180px]"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="map-name">
              Nome
            </label>
            <input id="map-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Haven" autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="map-sub">
              Subtítulo
            </label>
            <input id="map-sub" className="field" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex: A/B/C Sites" />
          </div>
          <ImageDrop
            label="Minimapa *"
            aspect="1/1"
            fit="contain"
            maxSize={2048}
            value={minimap}
            onChange={(blob) => setMinimap((m) => ({ ...m, blob }))}
            onReset={minimap.url ? () => setMinimap((m) => ({ url: m.url })) : undefined}
          />
          <div>
            <span className="label">Rotação do minimapa</span>
            <div className="flex gap-1 rounded-lg border border-line bg-bg-2 p-1">
              {ROTATIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRotation(r)}
                  className={cn(
                    'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
                    rotation === r ? 'bg-panel-3 text-text' : 'text-muted hover:text-text',
                  )}
                >
                  {r}°
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-faint">Use se o minimapa no jogo aparece girado em relação a esta imagem.</p>
          </div>
        </div>
        <ImageDrop
          label="Capa (menu)"
          aspect="9/16"
          value={cover}
          onChange={(blob) => setCover((c) => ({ ...c, blob }))}
          onReset={cover.url ? () => setCover((c) => ({ url: c.url })) : undefined}
        />
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
