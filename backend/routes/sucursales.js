import { Router } from 'express'
import { db } from '../data/mockData.js'

const router = Router()

// GET /api/sucursales/dashboard — stats de las 6 sucursales
router.get('/dashboard', (req, res) => {
  const stats = db.sucursales.map(s => {
    const invSuc = db.inventario.filter(i => i.id_sucursal === s.id_sucursal)
    const totalLibros = invSuc.reduce((sum, i) => sum + i.copias_totales, 0)
    const prestamosActivos  = db.prestamos.filter(p => p.id_sucursal === s.id_sucursal && p.estatus === 'activo').length
    const prestamosVencidos = db.prestamos.filter(p => p.id_sucursal === s.id_sucursal && p.estatus === 'vencido').length
    return { ...s, total_libros: totalLibros, prestamos_activos: prestamosActivos, prestamos_vencidos: prestamosVencidos }
  })
  res.json(stats)
})

// GET /api/sucursales — lista completa
router.get('/', (req, res) => {
  res.json(db.sucursales)
})

// GET /api/sucursales/:id
router.get('/:id', (req, res) => {
  const suc = db.sucursales.find(s => s.id_sucursal === Number(req.params.id))
  if (!suc) return res.status(404).json({ message: 'Sucursal no encontrada' })
  res.json(suc)
})

export default router
