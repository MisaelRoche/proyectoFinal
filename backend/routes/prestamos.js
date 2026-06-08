import { Router } from 'express'
import { queryLocal, queryTodos, queryNodo, buscarUsuario, nodoDeSucursal, MI_NODO } from '../db/pool.js'

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

/**
 * Ejecuta queryLocal con timeout para tablas federadas.
 * Si el nodo remoto no responde en msTimeout, devuelve [].
 */
async function queryFed(sql, params = [], msTimeout = 15000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), msTimeout)
  )
  try {
    return await Promise.race([queryLocal(sql, params), timeout])
  } catch (err) {
    if (err.message === 'TIMEOUT') {
      console.warn('[prestamos federado] Timeout en tabla federada')
      return []
    }
    throw err
  }
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

// Consulta federada: prestamo_nodo2 y prestamo_nodo3 contra Libro local (Nodo 4)
router.get('/activos/tijuana-ensenada', async (req, res) => {
  try {
    const idSucursal = Number(req.query.id_sucursal) || 0
    let filas = []

    const sqlBase = (tabla, suc) => `
      SELECT l.titulo AS libro, p.id_prestamo, p.id_usuario,
             p.fecha_prestamo, p.fecha_devolucion_esperada, p.id_sucursal
      FROM ${tabla} p
      JOIN Libro l ON p.id_libro = l.id_libro
      WHERE p.estatus = 'activo'
      ORDER BY p.fecha_prestamo`

    if (idSucursal === 2) {
      filas = await queryFed(sqlBase('prestamo_nodo2', 2))
    } else if (idSucursal === 3) {
      filas = await queryFed(sqlBase('prestamo_nodo3', 3))
    } else {
      const [res2, res3] = await Promise.allSettled([
        queryFed(sqlBase('prestamo_nodo2', 2)),
        queryFed(sqlBase('prestamo_nodo3', 3)),
      ])
      if (res2.status === 'fulfilled') filas = filas.concat(res2.value)
      if (res3.status === 'fulfilled') filas = filas.concat(res3.value)
      filas.sort((a, b) => a.id_sucursal - b.id_sucursal || new Date(a.fecha_prestamo) - new Date(b.fecha_prestamo))
    }

    res.json(filas)
  } catch (err) {
    res.status(500).json({ message: 'Error al consultar préstamos federados', detail: err.message })
  }
})

// POST /api/prestamos/federado
// Crea préstamo en Nodo 2 o Nodo 3 vía tablas federadas (prestamo_nodo2 / prestamo_nodo3)
router.post('/federado', async (req, res) => {
  try {
    const { id_usuario, id_libro, id_sucursal } = req.body

    if (!id_usuario || !id_libro || !id_sucursal) {
      return res.status(400).json({ message: 'Faltan campos: id_usuario, id_libro, id_sucursal' })
    }
    if (![2, 3].includes(Number(id_sucursal))) {
      return res.status(400).json({ message: 'Sucursal debe ser 2 (Tijuana) o 3 (Ensenada)' })
    }

    const fechaPrestamo   = today()
    const fechaDevolucion  = addDays(fechaPrestamo, 30)
    const tabla = Number(id_sucursal) === 2 ? 'prestamo_nodo2' : 'prestamo_nodo3'

    const [maxRow] = await queryLocal(`SELECT COALESCE(MAX(id_prestamo), 0) + 1 AS nextId FROM ${tabla}`)
    const nextId = maxRow.nextId

    await queryLocal(
      `INSERT INTO ${tabla} (id_prestamo, id_usuario, id_libro, id_sucursal, fecha_prestamo,
         fecha_devolucion_esperada, estatus, multa)
       VALUES (?, ?, ?, ?, ?, ?, 'activo', 0.00)`,
      [nextId, id_usuario, id_libro, Number(id_sucursal), fechaPrestamo, fechaDevolucion]
    )

    const [nuevo] = await queryLocal(
      `SELECT * FROM ${tabla} WHERE id_prestamo = ?`,
      [nextId]
    )

    res.status(201).json(nuevo)
  } catch (err) {
    console.error('[prestamos POST federado]', err)
    res.status(500).json({ message: 'Error al crear préstamo federado', detail: err.message })
  }
})

// DELETE /api/prestamos/federado/:idSucursal/:idPrestamo
// Elimina préstamo de Nodo 2 o Nodo 3 vía tabla federada
router.delete('/federado/:idSucursal/:idPrestamo', async (req, res) => {
  try {
    const idSucursal  = Number(req.params.idSucursal)
    const idPrestamo  = Number(req.params.idPrestamo)

    if (![2, 3].includes(idSucursal)) {
      return res.status(400).json({ message: 'Sucursal debe ser 2 (Tijuana) o 3 (Ensenada)' })
    }

    const tabla = idSucursal === 2 ? 'prestamo_nodo2' : 'prestamo_nodo3'

    const result = await queryLocal(
      `DELETE FROM ${tabla} WHERE id_prestamo = ?`,
      [idPrestamo]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: `Préstamo ${idPrestamo} no encontrado en sucursal ${idSucursal}` })
    }

    res.json({ ok: true, id_prestamo: idPrestamo, id_sucursal: idSucursal })
  } catch (err) {
    console.error('[prestamos DELETE federado]', err)
    res.status(500).json({ message: 'Error al eliminar préstamo federado', detail: err.message })
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
          // Q4: solo actualiza UsuarioAcceso (fragmento vertical de alto acceso)
          // UsuarioPerfil (datos de identidad) no se toca en devoluciones
          await queryNodo(
            resultadoUsuario.idNodoAcceso,   // siempre será Nodo 4 (NODO_ACCESO)
            'UPDATE UsuarioAcceso SET multas_acumuladas = multas_acumuladas + ? WHERE id_usuario = ?',
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
