import { Router } from 'express'
import { queryNodo } from '../db/pool.js'

const router = Router()

// Sucursal 4 (Mexicali Universidad), Categoria 2 (Ciencias)
const ID_SUCURSAL = 4
const ID_CATEGORIA = 2
const ID_NODO = 4

/
// Nodo 2 (Yair) -> Nodo 4
router.get('/yair/prestamos-activos', async (req, res) => {
  try {
    const filas = await queryNodo(
      ID_NODO,
      `SELECT p2.id_prestamo, p2.id_usuario, l2.titulo AS libro,
              p2.fecha_prestamo, p2.estatus
       FROM (SELECT * FROM Prestamo WHERE id_sucursal = ? AND estatus = 'activo') p2
       JOIN (SELECT id_libro, titulo FROM Libro WHERE id_categoria = ?) l2
       ON p2.id_libro = l2.id_libro`,
      [ID_SUCURSAL, ID_CATEGORIA]
    )

    res.json(filas)
  } catch (err) {
    res.status(500).json({ message: 'Error en consulta distribuida', detail: err.message })
  }
})


// Alta de prestamo en Nodo 4
router.post('/yair/prestamos', async (req, res) => {
  try {
    const { id_usuario, id_libro } = req.body

    if (!id_usuario || !id_libro) {
      return res.status(400).json({ message: 'Faltan campos: id_usuario, id_libro' })
    }

    const hoy = new Date().toISOString().split('T')[0]
    const devolucion = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

    const result = await queryNodo(
      ID_NODO,
      `INSERT INTO Prestamo (id_usuario, id_libro, id_sucursal, fecha_prestamo, fecha_devolucion_esperada, estatus, multa)
       VALUES (?, ?, ?, ?, ?, 'activo', 0.00)`,
      [Number(id_usuario), Number(id_libro), ID_SUCURSAL, hoy, devolucion]
    )

    res.status(201).json({ ok: true, id_prestamo: result.insertId })
  } catch (err) {
    res.status(500).json({ message: 'Error al crear prestamo', detail: err.message })
  }
})


// Baja de prestamo en Nodo 4
router.delete('/yair/prestamos/:idPrestamo', async (req, res) => {
  try {
    const result = await queryNodo(
      ID_NODO,
      'DELETE FROM Prestamo WHERE id_prestamo = ? AND id_sucursal = ?',
      [Number(req.params.idPrestamo), ID_SUCURSAL]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Prestamo no encontrado en sucursal 4' })
    }

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar prestamo', detail: err.message })
  }
})

export default router
