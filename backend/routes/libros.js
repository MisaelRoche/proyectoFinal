import { Router } from 'express'
import { db } from '../data/mockData.js'

const router = Router()

// GET /api/categorias — para el select de filtros
router.get('/categorias', (req, res) => {
  res.json(db.categorias)
})

// GET /api/libros?titulo=&autor=&id_categoria=
router.get('/', (req, res) => {
  let resultado = db.libros
  const { titulo, autor, id_categoria } = req.query

  if (titulo) {
    resultado = resultado.filter(l => l.titulo.toLowerCase().includes(titulo.toLowerCase()))
  }
  if (autor) {
    resultado = resultado.filter(l => l.autor.toLowerCase().includes(autor.toLowerCase()))
  }
  if (id_categoria) {
    resultado = resultado.filter(l => l.id_categoria === Number(id_categoria))
  }

  // Enriquecer con nombre de categoría
  const enriched = resultado.map(l => ({
    ...l,
    categoria: db.categorias.find(c => c.id_categoria === l.id_categoria)?.nombre || '',
  }))
  res.json(enriched)
})

// GET /api/libros/:id
router.get('/:id', (req, res) => {
  const libro = db.libros.find(l => l.id_libro === Number(req.params.id))
  if (!libro) return res.status(404).json({ message: 'Libro no encontrado' })
  const categoria = db.categorias.find(c => c.id_categoria === libro.id_categoria)
  res.json({ ...libro, categoria: categoria?.nombre || '' })
})

// GET /api/libros/:id/disponibilidad — copias por sucursal
router.get('/:id/disponibilidad', (req, res) => {
  const idLibro = Number(req.params.id)
  if (!db.libros.find(l => l.id_libro === idLibro)) {
    return res.status(404).json({ message: 'Libro no encontrado' })
  }
  const disponibilidad = db.sucursales.map(s => {
    const inv = db.inventario.find(i => i.id_libro === idLibro && i.id_sucursal === s.id_sucursal)
    return {
      id_sucursal: s.id_sucursal,
      sucursal: s.nombre,
      ciudad: s.ciudad,
      copias_totales: inv?.copias_totales ?? 0,
      copias_disponibles: inv?.copias_disponibles ?? 0,
      ubicacion_fisica: inv?.ubicacion_fisica ?? '-',
    }
  })
  res.json(disponibilidad)
})

export default router
