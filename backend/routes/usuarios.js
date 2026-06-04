import { Router } from 'express'
import { queryLocal, queryTodos, queryNodo, nodoDeSucursal, MI_NODO } from '../db/pool.js'

const router = Router()

function enrich(u) {
  return { ...u, sucursal_nombre: u.sucursal_nombre || '' }
}

// GET /api/usuarios?distribuido=1
// Sin distribuido → solo usuarios de este nodo (fragmento local)
// Con distribuido=1 → fan-out a todos los nodos
router.get('/', async (req, res) => {
  try {
    const sql = `
      SELECT u.*, s.nombre AS sucursal_nombre
      FROM Usuario u
      JOIN Sucursal s ON u.id_sucursal_registro = s.id_sucursal
      ORDER BY u.id_usuario
    `

    const rows = req.query.distribuido === '1'
      ? await queryTodos(sql)
      : await queryLocal(sql)

    res.json(rows.map(enrich))
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuarios', detail: err.message })
  }
})

// GET /api/usuarios/:id
// Busca primero en local; si no está, consulta el nodo correcto por sucursal.
router.get('/:id', async (req, res) => {
  try {
    const idUsuario = Number(req.params.id)
    const sql = `
      SELECT u.*, s.nombre AS sucursal_nombre
      FROM Usuario u
      JOIN Sucursal s ON u.id_sucursal_registro = s.id_sucursal
      WHERE u.id_usuario = ?
    `

    // Intentar local
    let [u] = await queryLocal(sql, [idUsuario])

    // Si no está local, hacer fan-out (en otro nodo)
    if (!u) {
      const remoto = await queryTodos(sql, [idUsuario])
      u = remoto[0]
    }

    if (!u) return res.status(404).json({ message: 'Usuario no encontrado en ningún nodo' })
    res.json(enrich(u))
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuario', detail: err.message })
  }
})

// GET /api/usuarios/:id/prestamos
// Los préstamos del usuario pueden estar distribuidos en varios nodos
// (si el usuario ha prestado en distintas sucursales).
router.get('/:id/prestamos', async (req, res) => {
  try {
    const idUsuario = Number(req.params.id)

    // Verificar que el usuario existe
    const sqlUsuario = 'SELECT id_usuario FROM Usuario WHERE id_usuario = ?'
    let [u] = await queryLocal(sqlUsuario, [idUsuario])
    if (!u) {
      const remoto = await queryTodos(sqlUsuario, [idUsuario])
      u = remoto[0]
    }
    if (!u) return res.status(404).json({ message: 'Usuario no encontrado' })

    // Fan-out: el usuario puede haber prestado en cualquier sucursal
    const prestamos = await queryTodos(
      `SELECT p.*, l.titulo AS libro_titulo, s.nombre AS sucursal_nombre
       FROM Prestamo p
       JOIN Libro   l ON p.id_libro    = l.id_libro
       JOIN Sucursal s ON p.id_sucursal = s.id_sucursal
       WHERE p.id_usuario = ?
       ORDER BY p.fecha_prestamo DESC`,
      [idUsuario]
    )

    res.json(prestamos)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener préstamos del usuario', detail: err.message })
  }
})

export default router
