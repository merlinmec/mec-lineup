import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-bg hover:bg-[#4ff0c2] shadow-[0_0_0_1px_rgba(52,227,176,.4),0_8px_24px_-8px_rgba(52,227,176,.55)]',
  ghost: 'text-muted hover:text-text hover:bg-panel-2',
  subtle: 'bg-panel-2 text-text border border-line hover:border-line-2 hover:bg-panel-3',
  danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Button({ variant = 'subtle', size = 'md', icon, className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background,color,border-color,transform] duration-150 active:scale-[.97] disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  tooltipSide?: 'top' | 'bottom' | 'left'
}

/** Botão quadrado só com ícone; o rótulo vira tooltip e aria-label. */
export function IconButton({ label, active, tooltipSide = 'bottom', className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'group/ib relative grid size-9 place-items-center rounded-lg border transition-[background,color,border-color,transform] duration-150 active:scale-95',
        active
          ? 'border-accent/50 bg-accent/15 text-accent'
          : 'border-line bg-panel-2 text-muted hover:border-line-2 hover:text-text',
        className,
      )}
      {...rest}
    >
      {children}
      <span
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-line bg-bg px-2 py-1 text-[11px] font-medium text-text opacity-0 shadow-xl transition-opacity duration-150 group-hover/ib:opacity-100 group-focus-visible/ib:opacity-100',
          tooltipSide === 'left'
            ? 'right-full top-1/2 mr-2 -translate-y-1/2'
            : tooltipSide === 'bottom'
              ? 'left-1/2 top-full mt-2 -translate-x-1/2'
              : 'bottom-full left-1/2 mb-2 -translate-x-1/2',
        )}
      >
        {label}
      </span>
    </button>
  )
}
