import { Router } from 'express'
import { queryLocal, queryTodos, queryNodo, nodoDeSucursal } from '../db/pool.js'

const router = Router()

// GET /api/libros/categorias — tabla replicada → local
router.get('/categorias', async (req, res) => {
  try {
    const rows = await queryLocal('SELECT * FROM Categoria ORDER BY id_categoria')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener categorías', detail: err.message })
  }
})

// GET /api/libros?titulo=&autor=&id_categoria=
// Libro (catálogo público) está replicado → queryLocal
router.get('/', async (req, res) => {
  try {
    const { titulo, autor, id_categoria } = req.query
    let sql    = 'SELECT l.*, c.nombre AS categoria FROM Libro l JOIN Categoria c ON l.id_categoria = c.id_categoria WHERE 1=1'
    const params = []

    if (titulo)       { sql += ' AND l.titulo LIKE ?';       params.push(`%${titulo}%`)      }
    if (autor)        { sql += ' AND l.autor LIKE ?';        params.push(`%${autor}%`)       }
    if (id_categoria) { sql += ' AND l.id_categoria = ?';    params.push(Number(id_categoria)) }

    sql += ' ORDER BY l.id_libro'

    const rows = await queryLocal(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener libros', detail: err.message })
  }
})

// GET /api/libros/:id
router.get('/:id', async (req, res) => {
  try {
    const [libro] = await queryLocal(
      'SELECT l.*, c.nombre AS categoria FROM Libro l JOIN Categoria c ON l.id_categoria = c.id_categoria WHERE l.id_libro = ?',
      [req.params.id]
    )
    if (!libro) return res.status(404).json({ message: 'Libro no encontrado' })
    res.json(libro)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener libro', detail: err.message })
  }
})

// GET /api/libros/:id/disponibilidad
// Inventario está FRAGMENTADO → fan-out a los 6 nodos para ver copias en cada sucursal
router.get('/:id/disponibilidad', async (req, res) => {
  try {
    const idLibro = Number(req.params.id)

    // Verificar que el libro existe (local, replicado)
    const [libro] = await queryLocal('SELECT id_libro FROM Libro WHERE id_libro = ?', [idLibro])
    if (!libro) return res.status(404).json({ message: 'Libro no encontrado' })

    // Fan-out: cada nodo aporta su fila de Inventario para este libro
    const inventarios = await queryTodos(
      `SELECT i.id_sucursal, i.copias_totales, i.copias_disponibles, i.ubicacion_fisica,
              s.nombre AS sucursal, s.ciudad
       FROM Inventario i
       JOIN Sucursal s ON i.id_sucursal = s.id_sucursal
       WHERE i.id_libro = ?`,
      [idLibro]
    )

    // Rellenar sucursales sin inventario (nodos caídos) con ceros
    const sucursales = await queryLocal('SELECT id_sucursal, nombre, ciudad FROM Sucursal ORDER BY id_sucursal')
    const resultado  = sucursales.map(s => {
      const inv = inventarios.find(i => i.id_sucursal === s.id_sucursal)
      return {
        id_sucursal:        s.id_sucursal,
        sucursal:           inv?.sucursal           ?? s.nombre,
        ciudad:             inv?.ciudad             ?? s.ciudad,
        copias_totales:     inv?.copias_totales     ?? 0,
        copias_disponibles: inv?.copias_disponibles ?? 0,
        ubicacion_fisica:   inv?.ubicacion_fisica   ?? '-',
        disponible:         (inv?.copias_disponibles ?? 0) > 0,
      }
    })

    res.json(resultado)
  } catch (err) {
    res.status(500).json({ message: 'Error al consultar disponibilidad', detail: err.message })
  }
})

// GET /api/libros/:id/admin
// Datos básicos del libro (Nodo 4 sin columnas admin)
router.get('/:id/admin', async (req, res) => {
  try {
    const idLibro = Number(req.params.id)
    const [admin] = await queryLocal(
      `SELECT l.id_libro, l.titulo, l.autor, l.editorial, l.anio, l.paginas, l.idioma
       FROM Libro l
       WHERE l.id_libro = ?`,
      [idLibro]
    )
    if (!admin) return res.status(404).json({ message: 'Libro no encontrado' })
    res.json(admin)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener datos del libro', detail: err.message })
  }
})

// PUT /api/libros/:idLibro/inventario/:idSucursal
// Edita el fragmento Inventario en el nodo dueño de esa sucursal (escritura remota).
router.put('/:idLibro/inventario/:idSucursal', async (req, res) => {
  try {
    const idLibro    = Number(req.params.idLibro)
    const idSucursal = Number(req.params.idSucursal)
    const { copias_totales, copias_disponibles, ubicacion_fisica } = req.body

    if (copias_totales === undefined || copias_disponibles === undefined) {
      return res.status(400).json({ message: 'Faltan campos: copias_totales, copias_disponibles' })
    }
    if (Number(copias_disponibles) > Number(copias_totales)) {
      return res.status(400).json({ message: 'copias_disponibles no puede ser mayor que copias_totales' })
    }

    const idNodo = nodoDeSucursal(idSucursal)   // relación 1:1 sucursal↔nodo

    const result = await queryNodo(
      idNodo,
      `UPDATE Inventario
       SET copias_totales = ?, copias_disponibles = ?, ubicacion_fisica = ?
       WHERE id_libro = ? AND id_sucursal = ?`,
      [Number(copias_totales), Number(copias_disponibles), ubicacion_fisica ?? null, idLibro, idSucursal]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No existe inventario de ese libro en esa sucursal' })
    }

    res.json({ ok: true, id_libro: idLibro, id_sucursal: idSucursal, id_nodo: idNodo })
  } catch (err) {
    const msg = err.message.includes('ECONNREFUSED') || err.message.includes('connect')
      ? `Nodo de sucursal ${req.params.idSucursal} no disponible`
      : 'Error al actualizar inventario'
    res.status(503).json({ message: msg, detail: err.message })
  }
})

export default router
