import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ReservaPage from './pages/ReservaPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/reservar" element={<ReservaPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
