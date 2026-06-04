import { NavLink } from 'react-router-dom'
import './Navbar.css'

export default function Navbar() {
  return (
    <nav className="navbar">
      <span className="navbar-brand">Biblioteca Distribuida BC</span>
      <div className="navbar-links">
        <NavLink to="/"          className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink>
        <NavLink to="/catalogo"  className={({ isActive }) => isActive ? 'active' : ''}>Catálogo</NavLink>
        <NavLink to="/prestamos" className={({ isActive }) => isActive ? 'active' : ''}>Préstamos</NavLink>
        <NavLink to="/usuarios"  className={({ isActive }) => isActive ? 'active' : ''}>Usuarios</NavLink>
      </div>
    </nav>
  )
}
