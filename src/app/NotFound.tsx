import { Link } from 'react-router'

export function NotFound({ message = 'Essa página não existe.' }: { message?: string }) {
  return (
    <div className="bg-grid grid h-full place-items-center">
      <div className="text-center">
        <p className="font-display text-7xl font-bold text-line-2">404</p>
        <p className="mt-2 text-muted">{message}</p>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-accent hover:underline">
          Voltar aos mapas
        </Link>
      </div>
    </div>
  )
}
