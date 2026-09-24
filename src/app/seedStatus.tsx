import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { seedOnce } from '../db/seed'

type Status = 'carregando' | 'pronto' | 'erro'
const SeedContext = createContext<{ status: Status; retry: () => void }>({ status: 'carregando', retry: () => {} })

export function SeedProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('carregando')

  const run = useCallback(() => {
    setStatus('carregando')
    seedOnce().then(
      () => setStatus('pronto'),
      () => setStatus('erro'),
    )
  }, [])

  useEffect(run, [run])

  return <SeedContext.Provider value={{ status, retry: run }}>{children}</SeedContext.Provider>
}

export const useSeedStatus = () => useContext(SeedContext)
