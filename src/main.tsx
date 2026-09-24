import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { EditModeProvider } from './app/editMode'
import { RootLayout } from './app/RootLayout'
import { SeedProvider } from './app/seedStatus'
import { MapSelectPage } from './features/maps/MapSelectPage'
import { MapViewPage } from './features/lineups/MapViewPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { NotFound } from './app/NotFound'
import { ConfirmProvider } from './ui/Confirm'
import { ToastProvider } from './ui/Toast'
import { initAutoBackup } from './lib/autoBackup'
import './styles.css'

// Pede armazenamento persistente: sem isso o navegador pode apagar o IndexedDB
// sozinho quando o disco enche. Não protege contra o usuário limpar os dados.
navigator.storage?.persist?.().catch(() => {})
void initAutoBackup()

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <MapSelectPage /> },
      { path: 'mapa/:mapId', element: <MapViewPage /> },
      { path: 'config', element: <SettingsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SeedProvider>
      <EditModeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <RouterProvider router={router} />
          </ConfirmProvider>
        </ToastProvider>
      </EditModeProvider>
    </SeedProvider>
  </StrictMode>,
)
