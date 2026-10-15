import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { runWorkflow } from './lib/runner'
import { useGraph } from './store/graph'

// handy for debugging and automated UI checks
if (import.meta.env.DEV) Object.assign(window, { __graph: useGraph, __run: runWorkflow })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
