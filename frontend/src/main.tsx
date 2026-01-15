import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { TimerProvider, UIProvider, SessionProvider } from './providers'

/**
 * Provider Hierarchy:
 * - UIProvider: Loading, error, and leaderboard state (independent)
 * - TimerProvider: Phase timing with pause/resume (independent)
 * - SessionProvider: Game state (depends on Timer and UI)
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <UIProvider>
        <TimerProvider>
          <SessionProvider>
            <App />
          </SessionProvider>
        </TimerProvider>
      </UIProvider>
    </BrowserRouter>
  </StrictMode>,
)


