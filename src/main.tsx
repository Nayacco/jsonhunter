import React from 'react'
import ReactDOM from 'react-dom/client'
import { Theme } from '@astryxdesign/core/theme'
import { App } from './app/App'
import { AppProviders } from './app/providers'
import { jsonHunterTheme } from './theme/json-hunter'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import './theme/jsonHunterTheme.css'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Theme theme={jsonHunterTheme}>
      <AppProviders>
        <App />
      </AppProviders>
    </Theme>
  </React.StrictMode>,
)
