import { Map as MapIcon, PencilRuler, Settings } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { NavLink, useLocation, useOutlet } from 'react-router'
import { cn } from '../ui/cn'
import { BackupIndicator } from '../features/settings/BackupCard'
import { useEditMode } from './editMode'

/** Congela o outlet da rota que está saindo, pra animação de saída mostrar a página certa. */
function FrozenOutlet() {
  const outlet = useOutlet()
  const [frozen] = useState(outlet)
  return frozen
}

export function RootLayout() {
  const location = useLocation()
  const [editing, setEditing] = useEditMode()

  return (
    <div className="flex h-full flex-col">
      <MinimapFilters />
      <header className="relative z-40 flex h-14 shrink-0 items-center gap-6 border-b border-line bg-bg/90 px-5 backdrop-blur">
        <NavLink to="/" className="flex items-center gap-2.5" aria-label="MEC Lineup, início">
          <Logo />
          <span className="font-display text-lg font-bold leading-none">
            Mec<span className="text-accent">/</span>Lineup
          </span>
        </NavLink>

        <nav className="flex h-full items-stretch gap-1">
          <TopLink to="/" icon={<MapIcon size={15} />} end>
            Mapas
          </TopLink>
          <TopLink to="/config" icon={<Settings size={15} />}>
            Configurações
          </TopLink>
        </nav>

        <div className="ml-auto">
          <BackupIndicator />
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={editing}
          onClick={() => setEditing(!editing)}
          className={cn(
            'flex h-9 items-center gap-2.5 rounded-lg border px-3 text-sm font-medium transition-colors duration-200',
            editing ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:border-line-2 hover:text-text',
          )}
        >
          <PencilRuler size={15} />
          Modo edição
          <span className={cn('relative h-5 w-9 rounded-full transition-colors duration-200', editing ? 'bg-accent' : 'bg-panel-3')}>
            <motion.span
              className="absolute top-0.5 left-0.5 size-4 rounded-full bg-text shadow"
              animate={{ x: editing ? 16 : 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 32 }}
            />
          </span>
        </button>
      </header>

      <main className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
          >
            <FrozenOutlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

function TopLink({ to, icon, end, children }: { to: string; icon: React.ReactNode; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-2 px-3 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors',
          isActive ? 'text-text' : 'text-muted hover:text-text',
        )
      }
    >
      {({ isActive }) => (
        <>
          {icon}
          {children}
          {isActive && (
            <motion.span
              layoutId="top-link-underline"
              className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
        </>
      )}
    </NavLink>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#16232d" />
      <path d="M8 24 16 6l8 18h-4.5L16 15.5 12.5 24z" fill="#34e3b0" />
    </svg>
  )
}

/**
 * O minimapa da valorant-api é cinza sobre transparente. Esta matriz mapeia a
 * luminância para teal escuro (piso) → teal claro (bordas), no estilo das
 * ferramentas táticas, mantendo o alfa original.
 */
function MinimapFilters() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <filter id="minimap-tatico" colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="0.12 0.12 0.12 0 -0.115
                  0.45 0.45 0.45 0 -0.47
                  0.36 0.36 0.36 0 -0.30
                  0    0    0    1  0"
        />
      </filter>
    </svg>
  )
}
