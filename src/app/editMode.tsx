import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const KEY = 'mec-lineup:edit-mode'
const EditModeContext = createContext<[boolean, (v: boolean) => void]>([false, () => {}])

function readStored() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Modo edição é global: vale para mapas, pontos e posições ao mesmo tempo. */
export function EditModeProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(readStored)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, on ? '1' : '0')
    } catch {
      /* armazenamento bloqueado: segue só em memória */
    }
  }, [on])
  return <EditModeContext.Provider value={[on, setOn]}>{children}</EditModeContext.Provider>
}

export const useEditMode = () => useContext(EditModeContext)
