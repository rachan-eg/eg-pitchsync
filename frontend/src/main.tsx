import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { TimerProvider, UIProvider, SessionProvider, AuthProvider } from './providers'

/**
 * Provider Hierarchy:
 * - AuthProvider: SSO authentication state (outermost)
 * - UIProvider: Loading, error, and leaderboard state (independent)
 * - TimerProvider: Phase timing with pause/resume (independent)
 * - SessionProvider: Game state (depends on Timer and UI)
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UIProvider>
          <TimerProvider>
            <SessionProvider>
              <App />
            </SessionProvider>
          </TimerProvider>
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
