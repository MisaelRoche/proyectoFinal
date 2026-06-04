import { Router } from 'express'
import { db } from '../data/mockData.js'

const router = Router()

function enrich(u) {
  const sucursal = db.sucursales.find(s => s.id_sucursal === u.id_sucursal_registro)
  return { ...u, sucursal_nombre: sucursal?.nombre || '' }
}

// GET /api/usuarios
router.get('/', (req, res) => {
  res.json(db.usuarios.map(enrich))
})

// GET /api/usuarios/:id
router.get('/:id', (req, res) => {
  const u = db.usuarios.find(u => u.id_usuario === Number(req.params.id))
  if (!u) return res.status(404).json({ message: 'Usuario no encontrado' })
  res.json(enrich(u))
})

// GET /api/usuarios/:id/prestamos
router.get('/:id/prestamos', (req, res) => {
  const idUsuario = Number(req.params.id)
  if (!db.usuarios.find(u => u.id_usuario === idUsuario)) {
    return res.status(404).json({ message: 'Usuario no encontrado' })
  }
  const prestamos = db.prestamos
    .filter(p => p.id_usuario === idUsuario)
    .map(p => {
      const libro    = db.libros.find(l => l.id_libro === p.id_libro)
      const sucursal = db.sucursales.find(s => s.id_sucursal === p.id_sucursal)
      return { ...p, libro_titulo: libro?.titulo || '', sucursal_nombre: sucursal?.nombre || '' }
    })
  res.json(prestamos)
})

export default router
