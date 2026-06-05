import { Router } from 'express'
import { queryLocal, queryTodos, escribirEnTodos, MI_NODO } from '../db/pool.js'

const router = Router()

// GET /api/sucursales/dashboard — stats de las 6 sucursales (consulta distribuida)
router.get('/dashboard', async (req, res) => {
  try {
    // Sucursal está replicada → leemos de local
    const sucursales = await queryLocal('SELECT * FROM Sucursal ORDER BY id_sucursal')

    // Inventario y Prestamo están fragmentados → fan-out a todos los nodos
    const [inventarios, prestamos] = await Promise.all([
      queryTodos('SELECT id_sucursal, SUM(copias_totales) AS total_libros FROM Inventario GROUP BY id_sucursal'),
      queryTodos("SELECT id_sucursal, estatus, COUNT(*) AS cantidad FROM Prestamo GROUP BY id_sucursal, estatus"),
    ])

    const stats = sucursales.map(s => {
      const inv = inventarios.find(i => i.id_sucursal === s.id_sucursal)
      const activos  = prestamos.find(p => p.id_sucursal === s.id_sucursal && p.estatus === 'activo')
      const vencidos = prestamos.find(p => p.id_sucursal === s.id_sucursal && p.estatus === 'vencido')
      return {
        ...s,
        total_libros:       Number(inv?.total_libros ?? 0),
        prestamos_activos:  Number(activos?.cantidad  ?? 0),
        prestamos_vencidos: Number(vencidos?.cantidad ?? 0),
      }
    })

    res.json(stats)
  } catch (err) {
    console.error('[sucursales/dashboard]', err)
    res.status(500).json({ message: 'Error al obtener datos del dashboard', detail: err.message })
  }
})

// GET /api/sucursales — lista completa (tabla replicada → local)
router.get('/', async (req, res) => {
  try {
    const rows = await queryLocal('SELECT * FROM Sucursal ORDER BY id_sucursal')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener sucursales', detail: err.message })
  }
})

// GET /api/sucursales/:id
router.get('/:id', async (req, res) => {
  try {
    const [suc] = await queryLocal('SELECT * FROM Sucursal WHERE id_sucursal = ?', [req.params.id])
    if (!suc) return res.status(404).json({ message: 'Sucursal no encontrada' })
    res.json(suc)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener sucursal', detail: err.message })
  }
})

// PUT /api/sucursales/:id — actualiza una sucursal en los 6 nodos (tabla replicada → fan-out de escritura)
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { nombre, direccion, ciudad, telefono, responsable } = req.body

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ message: 'El campo "nombre" es obligatorio' })
    }

    // Verificar que la sucursal existe (lectura local es suficiente — tabla replicada)
    const [existe] = await queryLocal('SELECT id_sucursal FROM Sucursal WHERE id_sucursal = ?', [id])
    if (!existe) {
      return res.status(404).json({ message: `Sucursal ${id} no encontrada` })
    }

    // Escritura distribuida: la misma sentencia en los 6 nodos en paralelo
    const resultados = await escribirEnTodos(
      `UPDATE Sucursal
         SET nombre      = ?,
             direccion   = ?,
             ciudad      = ?,
             telefono    = ?,
             responsable = ?
       WHERE id_sucursal = ?`,
      [nombre.trim(), direccion ?? null, ciudad ?? null, telefono ?? null, responsable ?? null, id]
    )

    const todosOk = resultados.every(r => r.ok)

    res.json({
      ok:         todosOk,
      id_sucursal: id,
      resultados,                          // [{ idNodo, nombre_nodo, ok, affectedRows|error }]
    })
  } catch (err) {
    console.error('[sucursales/PUT]', err)
    res.status(500).json({ message: 'Error al actualizar sucursal', detail: err.message })
  }
})

export default router
