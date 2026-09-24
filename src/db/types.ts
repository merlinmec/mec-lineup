/**
 * Imagens podem vir de duas fontes: URL remota (padrão, vinda da valorant-api)
 * ou Blob enviado pelo usuário. O Blob sempre tem prioridade quando existe.
 */
export interface ImageSource {
  url?: string
  blob?: Blob
}

export type Rotation = 0 | 90 | 180 | 270

export interface GameMap {
  id: string
  name: string
  /** Texto curto exibido sob o nome (ex: "A/B/C Sites"). */
  subtitle?: string
  cover: ImageSource
  minimap: ImageSource
  /** Alguns mapas aparecem girados no minimapa do jogo. */
  rotation: Rotation
  /**
   * Quanto 1 metro do jogo ocupa no minimapa (fração do lado). Vem da
   * valorant-api (xMultiplier × 100); sem ele, formas usam uma escala média.
   */
  scale?: number
  order: number
  createdAt: number
}

export interface Agent {
  id: string
  name: string
  /** Retrato: usado no seletor e como marcador de posição no minimapa. */
  icon: ImageSource
  order: number
}

/**
 * Como a habilidade aparece no minimapa: ponto de impacto com zona (orbe,
 * veneno), linha (parede da Viper, ult do Sova), área circular (ults da Viper,
 * do Brimstone e do KAY/O), faixa retangular (ult da Fade) ou cone.
 */
export type Shape = 'ponto' | 'linha' | 'area' | 'faixa' | 'cone'

/**
 * Medidas reais da habilidade, em metros (wiki oficial da Riot). `fixed`
 * trava o tamanho: no jogo o feixe do Sova sempre tem 66 m e a ult do
 * Brimstone sempre 9 m de raio; só posição/direção mudam.
 */
export interface AbilitySize {
  /** Raio da área, ou da zona de efeito de um ponto. */
  radius?: number
  /** Comprimento (máximo, se não for fixo) da linha/faixa/cone. */
  length?: number
  width?: number
  fixed?: boolean
}

export interface Ability {
  id: string
  agentId: string
  name: string
  /** Ausente em dados antigos = 'ponto'. */
  shape?: Shape
  size?: AbilitySize
  /** Tecla no jogo (C, Q, E, X), só informativa. */
  key: string
  color: string
  icon: ImageSource
  order: number
}

/**
 * Onde a habilidade tem efeito. x/y é o início (linha), o centro (área) ou o
 * vértice (cone); os demais campos só existem pras formas que usam.
 * Coordenadas normalizadas do minimapa (quadrado), raio na mesma escala.
 */
export interface Spot {
  id: string
  mapId: string
  abilityId: string
  name: string
  x: number
  y: number
  /** Fim da linha / direção e alcance do cone. */
  x2?: number
  y2?: number
  /** Raio da área. */
  r?: number
  /** Abertura do cone, em graus. */
  angle?: number
  /** Print de como o efeito fica em jogo (a parede erguida, a ult caindo). */
  resultImage?: Blob
  resultMarks?: Mark[]
  createdAt: number
}

export type Side = 'ataque' | 'defesa' | 'ambos'

/**
 * Marcação sobre um print (ex: "fresta da barra de vida no tijolo"). Fica
 * separada da imagem pra poder editar depois e desenhar nítida em qualquer
 * tamanho. x/y normalizados pela largura/altura; r e comprimentos pela largura.
 */
export interface Mark {
  id: string
  kind: 'circulo' | 'seta'
  x: number
  y: number
  /** Raio do círculo. */
  r?: number
  /** Ponta da seta (onde está a referência). */
  x2?: number
  y2?: number
  color: string
  note: string
}

/** Posição de onde a habilidade é lançada para cair num Spot. */
export interface Lineup {
  id: string
  spotId: string
  title: string
  notes: string
  /** Como lançar: "clique esquerdo", "pulo + clique", etc. */
  throwType: string
  side: Side
  x: number
  y: number
  /** Print de onde mirar. */
  aimImage?: Blob
  aimMarks?: Mark[]
  /** Print da posição exata em que ficar. */
  positionImage?: Blob
  positionMarks?: Mark[]
  createdAt: number
}

export type MinimapStyle = 'tatico' | 'original'

export interface Settings {
  id: 'app'
  mapsSeeded: boolean
  /** Evita recriar os agentes padrão se o usuário excluir algum de propósito. */
  agentsSeeded: boolean
  minimapStyle: MinimapStyle
}

/** Versão reduzida (WebP) de uma imagem remota, pra não decodificar PNGs de 3 MB. */
export interface CachedImage {
  url: string
  blob: Blob
}

/** Chave/valor local deste navegador, que não vai pro backup. */
export interface LocalEntry {
  key: string
  value: unknown
}
