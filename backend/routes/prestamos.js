import { Router } from 'express'
import { queryLocal, queryTodos, queryNodo, buscarUsuario, nodoDeSucursal, MI_NODO } from '../db/pool.js'

const router = Router()

function today() {
  return new Date().toISOString().split('T')[0]//hola
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

/**
 * Enriquecer una fila de Prestamo con nombre de usuario, título de libro y nombre de sucursal.
 * El usuario puede estar en un nodo remoto → buscarUsuario() lo localiza.
 */
async function enrich(p) {
  const [libro, sucursal] = await Promise.all([
    queryLocal('SELECT titulo FROM Libro WHERE id_libro = ?', [p.id_libro]),
    queryLocal('SELECT nombre FROM Sucursal WHERE id_sucursal = ?', [p.id_sucursal]),
  ])

  let usuario_nombre = ''
  try {
    const resultado = await buscarUsuario(p.id_usuario)
    if (resultado) {
      const u = resultado.usuario
      usuario_nombre = `${u.nombre} ${u.apellidos}`
    }
  } catch (_) { /* usuario no localizado — no fatal */ }

  return {
    ...p,
    multa:          Number(p.multa) || 0,
    usuario_nombre,
    libro_titulo:   libro[0]?.titulo  || '',
    sucursal_nombre: sucursal[0]?.nombre || '',
  }
}

// GET /api/prestamos?estatus=activo|vencido|devuelto&id_sucursal=&id_usuario=&distribuido=1
router.get('/', async (req, res) => {
  try {
    const { estatus, id_sucursal, id_usuario, distribuido } = req.query

    let sql    = 'SELECT * FROM Prestamo WHERE 1=1'
    const params = []

    if (estatus)    { sql += ' AND estatus = ?';      params.push(estatus)              }
    if (id_usuario) { sql += ' AND id_usuario = ?';   params.push(Number(id_usuario))   }

    let filas
    if (distribuido === '1') {
      // Fan-out a todos los nodos — consulta global (ej. todos los activos de la red)
      filas = await queryTodos(sql, params)
    } else if (id_sucursal) {
      // Consulta a un nodo concreto por sucursal
      const idNodo = nodoDeSucursal(Number(id_sucursal))
      filas = await queryNodo(idNodo, sql + ' AND id_sucursal = ?', [...params, Number(id_sucursal)])
    } else {
      // Por defecto: solo mi sucursal local
      filas = await queryLocal(sql, params)
    }

    const resultado = await Promise.all(filas.map(enrich))
    res.json(resultado)
  } catch (err) {
    console.error('[prestamos GET]', err)
    res.status(500).json({ message: 'Error al obtener préstamos', detail: err.message })
  }
})

// GET /api/prestamos/:id
router.get('/:id', async (req, res) => {
  try {
    const [p] = await queryLocal('SELECT * FROM Prestamo WHERE id_prestamo = ?', [req.params.id])
    if (!p) return res.status(404).json({ message: 'Préstamo no encontrado en este nodo' })
    res.json(await enrich(p))
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener préstamo', detail: err.message })
  }
})

// POST /api/prestamos — crear nuevo préstamo (escribe en local)
router.post('/', async (req, res) => {
  try {
    const { id_usuario, id_libro, id_sucursal } = req.body

    if (!id_usuario || !id_libro || !id_sucursal) {
      return res.status(400).json({ message: 'Faltan campos: id_usuario, id_libro, id_sucursal' })
    }

    // Validar que la sucursal corresponde a este nodo
    if (Number(id_sucursal) !== MI_NODO) {
      return res.status(400).json({
        message: `Este nodo (${MI_NODO}) solo registra préstamos de la sucursal ${MI_NODO}`,
      })
    }

    // Validar usuario (puede estar en otro nodo — préstamo inter-sucursal)
    const resultadoUsuario = await buscarUsuario(Number(id_usuario))
    if (!resultadoUsuario) {
      return res.status(404).json({ message: `Usuario ${id_usuario} no encontrado en ningún nodo` })
    }

    // Validar libro (replicado → local)
    const [libro] = await queryLocal('SELECT id_libro FROM Libro WHERE id_libro = ?', [id_libro])
    if (!libro) return res.status(404).json({ message: 'Libro no encontrado' })

    // Validar inventario local
    const [inv] = await queryLocal(
      'SELECT * FROM Inventario WHERE id_libro = ? AND id_sucursal = ?',
      [id_libro, id_sucursal]
    )
    if (!inv || inv.copias_disponibles <= 0) {
      return res.status(409).json({ message: 'No hay copias disponibles en esta sucursal' })
    }

    // Descontar del inventario local
    await queryLocal(
      'UPDATE Inventario SET copias_disponibles = copias_disponibles - 1 WHERE id_libro = ? AND id_sucursal = ?',
      [id_libro, id_sucursal]
    )

    // Insertar préstamo en local
    const fechaPrestamo   = today()
    const fechaDevolucion = addDays(fechaPrestamo, 30)

    const result = await queryLocal(
      `INSERT INTO Prestamo (id_usuario, id_libro, id_sucursal, fecha_prestamo, fecha_devolucion_esperada, estatus, multa)
       VALUES (?, ?, ?, ?, ?, 'activo', 0.00)`,
      [id_usuario, id_libro, id_sucursal, fechaPrestamo, fechaDevolucion]
    )

    const [nuevo] = await queryLocal('SELECT * FROM Prestamo WHERE id_prestamo = ?', [result.insertId])
    res.status(201).json(await enrich(nuevo))
  } catch (err) {
    console.error('[prestamos POST]', err)
    res.status(500).json({ message: 'Error al crear préstamo', detail: err.message })
  }
})

// PUT /api/prestamos/:id/devolver — registrar devolución
router.put('/:id/devolver', async (req, res) => {
  try {
    const [p] = await queryLocal('SELECT * FROM Prestamo WHERE id_prestamo = ?', [req.params.id])
    if (!p) return res.status(404).json({ message: 'Préstamo no encontrado en este nodo' })
    if (p.estatus === 'devuelto') {
      return res.status(409).json({ message: 'El préstamo ya fue devuelto' })
    }

    const retraso = diasRetraso(p.fecha_devolucion_esperada)
    const multa   = retraso * 5   // $5 por día de retraso

    // Actualizar préstamo en local
    await queryLocal(
      `UPDATE Prestamo
       SET fecha_devolucion_real = ?, estatus = 'devuelto', multa = ?
       WHERE id_prestamo = ?`,
      [today(), multa, p.id_prestamo]
    )

    // Devolver copia al inventario local
    await queryLocal(
      'UPDATE Inventario SET copias_disponibles = copias_disponibles + 1 WHERE id_libro = ? AND id_sucursal = ?',
      [p.id_libro, p.id_sucursal]
    )

    // Si hay multa, actualizar multas_acumuladas en el nodo dueño del usuario
    if (multa > 0) {
      try {
        const resultadoUsuario = await buscarUsuario(p.id_usuario)
        if (resultadoUsuario) {
          await queryNodo(
            resultadoUsuario.idNodo,
            'UPDATE Usuario SET multas_acumuladas = multas_acumuladas + ? WHERE id_usuario = ?',
            [multa, p.id_usuario]
          )
        }
      } catch (err) {
        // No bloquear la devolución si el nodo del usuario está caído
        console.warn(`[prestamos] No se pudo actualizar multa del usuario ${p.id_usuario}:`, err.message)
      }
    }

    const [actualizado] = await queryLocal('SELECT * FROM Prestamo WHERE id_prestamo = ?', [p.id_prestamo])
    res.json(await enrich(actualizado))
  } catch (err) {
    console.error('[prestamos PUT devolver]', err)
    res.status(500).json({ message: 'Error al registrar devolución', detail: err.message })
  }
})

export default router
