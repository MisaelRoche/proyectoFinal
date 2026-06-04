import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Catalogo from './pages/Catalogo'
import Prestamos from './pages/Prestamos'
import Usuarios from './pages/Usuarios'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/prestamos" element={<Prestamos />} />
          <Route path="/usuarios" element={<Usuarios />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
