import { Router } from 'express'
import { db } from '../data/mockData.js'

const router = Router()

function today() {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function diasRetraso(esperada) {
  const exp = new Date(esperada)
  const hoy = new Date(today())
  const diff = Math.floor((hoy - exp) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

// Enriquecer préstamo con nombres
function enrich(p) {
  const usuario = db.usuarios.find(u => u.id_usuario === p.id_usuario)
  const libro   = db.libros.find(l => l.id_libro === p.id_libro)
  const sucursal = db.sucursales.find(s => s.id_sucursal === p.id_sucursal)
  return {
    ...p,
    usuario_nombre: usuario ? `${usuario.nombre} ${usuario.apellidos}` : '',
    libro_titulo: libro?.titulo || '',
    sucursal_nombre: sucursal?.nombre || '',
  }
}

// GET /api/prestamos?estatus=activo|vencido|devuelto&id_sucursal=&id_usuario=
router.get('/', (req, res) => {
  let resultado = db.prestamos
  const { estatus, id_sucursal, id_usuario } = req.query

  if (estatus) {
    resultado = resultado.filter(p => p.estatus === estatus)
  }
  if (id_sucursal) {
    resultado = resultado.filter(p => p.id_sucursal === Number(id_sucursal))
  }
  if (id_usuario) {
    resultado = resultado.filter(p => p.id_usuario === Number(id_usuario))
  }

  res.json(resultado.map(enrich))
})

// GET /api/prestamos/:id
router.get('/:id', (req, res) => {
  const p = db.prestamos.find(p => p.id_prestamo === Number(req.params.id))
  if (!p) return res.status(404).json({ message: 'Préstamo no encontrado' })
  res.json(enrich(p))
})

// POST /api/prestamos — crear nuevo préstamo
router.post('/', (req, res) => {
  const { id_usuario, id_libro, id_sucursal } = req.body

  if (!id_usuario || !id_libro || !id_sucursal) {
    return res.status(400).json({ message: 'Faltan campos: id_usuario, id_libro, id_sucursal' })
  }

  if (!db.usuarios.find(u => u.id_usuario === id_usuario)) {
    return res.status(404).json({ message: 'Usuario no encontrado' })
  }
  if (!db.libros.find(l => l.id_libro === id_libro)) {
    return res.status(404).json({ message: 'Libro no encontrado' })
  }
  if (!db.sucursales.find(s => s.id_sucursal === id_sucursal)) {
    return res.status(404).json({ message: 'Sucursal no encontrada' })
  }

  const inv = db.inventario.find(i => i.id_libro === id_libro && i.id_sucursal === id_sucursal)
  if (!inv || inv.copias_disponibles <= 0) {
    return res.status(409).json({ message: 'No hay copias disponibles en esta sucursal' })
  }

  inv.copias_disponibles -= 1

  const nuevo = {
    id_prestamo: db.prestamos.length + 1,
    id_usuario,
    id_libro,
    id_sucursal,
    fecha_prestamo: today(),
    fecha_devolucion_esperada: addDays(today(), 30),
    fecha_devolucion_real: null,
    estatus: 'activo',
    multa: 0,
  }
  db.prestamos.push(nuevo)
  res.status(201).json(enrich(nuevo))
})

// PUT /api/prestamos/:id/devolver — registrar devolución
router.put('/:id/devolver', (req, res) => {
  const p = db.prestamos.find(p => p.id_prestamo === Number(req.params.id))
  if (!p) return res.status(404).json({ message: 'Préstamo no encontrado' })
  if (p.estatus === 'devuelto') {
    return res.status(409).json({ message: 'El préstamo ya fue devuelto' })
  }

  const retraso = diasRetraso(p.fecha_devolucion_esperada)
  const multa = retraso * 5  // $5 por día

  p.fecha_devolucion_real = today()
  p.estatus = 'devuelto'
  p.multa = multa

  // Actualizar multas del usuario
  if (multa > 0) {
    const usuario = db.usuarios.find(u => u.id_usuario === p.id_usuario)
    if (usuario) usuario.multas_acumuladas += multa
  }

  // Devolver copia al inventario
  const inv = db.inventario.find(i => i.id_libro === p.id_libro && i.id_sucursal === p.id_sucursal)
  if (inv) inv.copias_disponibles += 1

  res.json(enrich(p))
})

export default router
