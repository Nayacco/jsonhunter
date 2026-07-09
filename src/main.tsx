import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { AppProviders } from './app/providers'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
)
