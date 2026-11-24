import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import './styles/fixes.css'
import './styles/variant-b.css'
import './styles/ux-checklist.css'
import './styles/sprint-additions.css'
import { startTableLabels } from './tableLabels.js'

startTableLabels()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
