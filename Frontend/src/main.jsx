import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';  // Import Tailwind CSS here
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
