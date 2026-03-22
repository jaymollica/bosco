import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Studio from './studio/Studio.js'
import Player from './player/Player.js'
import Home from './player/Home.js'
import Results from './player/Results.js'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/studio/*" element={<Studio />} />
        <Route path="/t/:slug" element={<Player />} />
        <Route path="/t/:slug/results/:sessionId" element={<Results />} />
        <Route path="/" element={<Home />} />
        <Route path="*" element={<div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#888' }}>Not found</div>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
