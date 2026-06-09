import { Router } from 'express'
import { queryNodo, queryAcceso, queryTodos } from '../db/pool.js'

const router = Router()

// GET /api/prestamos-nodos/:nodos
// Consulta préstamos en nodos específicos de la red Biblioteca BC
router.get('/:nodos', async (req, res) => {
  const { estatus } = req.query

  // 1. Parsear y validar nodos del path param
  const nodosRaw    = req.params.nodos.split(',').map(Number)
  const nodosValidos = nodosRaw.filter(n => Number.isInteger(n) && n >= 1 && n <= 6)

  if (nodosValidos.length === 0) {
    return res.status(400).json({
      error:   'Nodos inválidos. Usa números del 1 al 6 separados por coma.',
      ejemplo: '/api/prestamos-nodos/2,4?estatus=vencido'
    })
  }

  // 2. Construir SQL y params según si viene filtro de estatus
  let sql, params

  if (estatus) {
    sql = `
      SELECT
        p.id_prestamo,
        p.id_usuario,
        p.id_sucursal,
        p.estatus,
        p.multa,
        p.fecha_prestamo,
        p.fecha_devolucion_esperada,
        p.fecha_devolucion_real,
        l.titulo,
        l.autor
      FROM Prestamo AS p
      JOIN Libro AS l ON p.id_libro = l.id_libro
      WHERE p.estatus = ?
    `
    params = [estatus]
  } else {
    sql = `
      SELECT
        p.id_prestamo,
        p.id_usuario,
        p.id_sucursal,
        p.estatus,
        p.multa,
        p.fecha_prestamo,
        p.fecha_devolucion_esperada,
        p.fecha_devolucion_real,
        l.titulo,
        l.autor
      FROM Prestamo AS p
      JOIN Libro AS l ON p.id_libro = l.id_libro
    `
    params = []
  }

  // 3. Ejecutar en paralelo sobre los nodos solicitados (degradación elegante)
  const promesas = nodosValidos.map(nodo =>
    queryNodo(nodo, sql, params)
      .then(rows => ({ nodo, ok: true, rows }))
      .catch(err  => ({ nodo, ok: false, error: err.message, rows: [] }))
  )

  const resultados = await Promise.allSettled(promesas)

  // 4. Aplanar resultados y etiquetar cada fila con su nodo de origen
  const data = resultados.flatMap(r =>
    r.status === 'fulfilled'
      ? r.value.rows.map(row => ({ ...row, _nodo_origen: r.value.nodo }))
      : []
  )

  // 5. Resumen por nodo
  const resumen = resultados.map(r => ({
    nodo:  r.value.nodo,
    ok:    r.value.ok,
    total: r.value.rows.length,
    ...(r.value.error && { error: r.value.error })
  }))

  // 6. Enriquecer con email — UsuarioAcceso vive solo en Nodo 4 (fragmento vertical).
  //    Una sola consulta con IN() para todos los id_usuario distintos.
  let emailPorUsuario = new Map()
  const idsUsuario = [...new Set(data.map(r => r.id_usuario))]
  if (idsUsuario.length) {
    try {
      const placeholders = idsUsuario.map(() => '?').join(',')
      const filas = await queryAcceso(
        `SELECT id_usuario, email FROM UsuarioAcceso WHERE id_usuario IN (${placeholders})`,
        idsUsuario
      )
      emailPorUsuario = new Map(filas.map(f => [f.id_usuario, f.email]))
    } catch (err) {
      console.warn('[prestamos-nodos GET] Nodo 4 (email) no disponible:', err.message)
    }
  }
  data.forEach(r => { r.email = emailPorUsuario.get(r.id_usuario) ?? '' })

  res.json({
    nodos_consultados: nodosValidos,
    filtro_estatus:    estatus || 'todos',
    total:             data.length,
    resumen,
    resultados:        data
  })
})

function today() {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function validarNodo(n) {
  return Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= 6
}

// Normaliza nodo/nodos del body a un array de números válidos.
// Acepta: nodos:[2,4]  o  nodo:2  (compatibilidad)
function parseNodos(body) {
  const raw = body.nodos ?? (body.nodo !== undefined ? [body.nodo] : [])
  const arr  = Array.isArray(raw) ? raw : [raw]
  return arr.map(Number).filter(n => validarNodo(n))
}

// POST /api/prestamos-nodos
// Crea el mismo préstamo en uno o varios nodos en paralelo.
router.post('/', async (req, res) => {
  try {
    const { id_usuario, id_libro } = req.body
    const nodos = parseNodos(req.body)

    if (nodos.length === 0) {
      return res.status(400).json({ message: 'Indica al menos un nodo válido (1-6) en "nodos" o "nodo".' })
    }
    if (!id_usuario || !id_libro) {
      return res.status(400).json({ message: 'Faltan campos: id_usuario, id_libro' })
    }

    const fechaPrestamo   = today()
    const fechaDevolucion = addDays(fechaPrestamo, 30)

    const promesas = nodos.map(async idNodo => {
      // Cada nodo solo tiene su propia sucursal (id_sucursal === id_nodo en este diseño)
      const idSucursalNodo = idNodo
      try {
        const result = await queryNodo(
          idNodo,
          `INSERT INTO Prestamo (id_usuario, id_libro, id_sucursal, fecha_prestamo, fecha_devolucion_esperada, estatus, multa)
           VALUES (?, ?, ?, ?, ?, 'activo', 0.00)`,
          [Number(id_usuario), Number(id_libro), idSucursalNodo, fechaPrestamo, fechaDevolucion]
        )
        const [nuevo] = await queryNodo(
          idNodo,
          'SELECT * FROM Prestamo WHERE id_prestamo = ?',
          [result.insertId]
        )
        return { nodo: idNodo, ok: true, data: { ...nuevo, _nodo_origen: idNodo } }
      } catch (err) {
        console.error(`[prestamosNodosCRUD POST] Nodo ${idNodo}:`, err.message)
        return { nodo: idNodo, ok: false, error: err.message }
      }
    })

    const resultados  = await Promise.all(promesas)
    const total_ok    = resultados.filter(r => r.ok).length
    const total_error = resultados.filter(r => !r.ok).length

    // Siempre 200 para que el frontend pueda leer los detalles por nodo
    res.status(200).json({ resultados, total_ok, total_error })
  } catch (err) {
    console.error('[prestamosNodosCRUD POST]', err)
    res.status(500).json({ message: 'Error al crear préstamo', detail: err.message })
  }
})

// PUT /api/prestamos-nodos/:id/multa
// Modifica la multa de un préstamo en uno o varios nodos en paralelo.
router.put('/:id/multa', async (req, res) => {
  try {
    const { multa } = req.body
    const idPrestamo = Number(req.params.id)
    const nodos      = parseNodos(req.body)

    if (nodos.length === 0) {
      return res.status(400).json({ message: 'Indica al menos un nodo válido (1-6) en "nodos" o "nodo".' })
    }
    if (multa === undefined || multa === null) {
      return res.status(400).json({ message: 'Falta el campo: multa' })
    }
    if (Number(multa) < 0) {
      return res.status(400).json({ message: 'La multa no puede ser negativa.' })
    }

    const promesas = nodos.map(async idNodo => {
      try {
        const result = await queryNodo(
          idNodo,
          'UPDATE Prestamo SET multa = ? WHERE id_prestamo = ?',
          [Number(multa), idPrestamo]
        )

        // Si no se afectó ninguna fila, el préstamo no existe en este nodo
        if (result.affectedRows === 0) {
          return {
            nodo: idNodo,
            ok: false,
            affectedRows: 0,
            error: `Préstamo #${idPrestamo} no existe en el nodo ${idNodo}`,
          }
        }

        // Sincronizar multas_acumuladas en UsuarioAcceso (Nodo 4, fragmento vertical).
        // El total se recalcula como SUM(multa) de Prestamo en TODOS los nodos activos.
        try {
          const [prestamo] = await queryNodo(
            idNodo,
            'SELECT id_usuario FROM Prestamo WHERE id_prestamo = ?',
            [idPrestamo]
          )
          if (prestamo) {
            // fan-out: cada nodo devuelve una fila con el SUM de ese usuario
            const filas = await queryTodos(
              'SELECT COALESCE(SUM(multa), 0) AS total FROM Prestamo WHERE id_usuario = ?',
              [prestamo.id_usuario]
            )
            const totalMultas = filas.reduce((acc, f) => acc + Number(f.total ?? 0), 0)
            await queryAcceso(
              'UPDATE UsuarioAcceso SET multas_acumuladas = ? WHERE id_usuario = ?',
              [totalMultas, prestamo.id_usuario]
            )
          }
        } catch (syncErr) {
          console.warn(
            `[prestamosNodosCRUD PUT multa] No se pudo sincronizar multas_acumuladas: ${syncErr.message}`
          )
        }

        return { nodo: idNodo, ok: true, affectedRows: result.affectedRows }
      } catch (err) {
        return { nodo: idNodo, ok: false, error: err.message }
      }
    })

    const resultados  = await Promise.all(promesas)
    const total_ok    = resultados.filter(r => r.ok).length
    const total_error = resultados.filter(r => !r.ok).length

    res.json({ resultados, total_ok, total_error })
  } catch (err) {
    console.error('[prestamosNodosCRUD PUT multa]', err)
    res.status(500).json({ message: 'Error al modificar multa', detail: err.message })
  }
})

// DELETE /api/prestamos-nodos/:id?nodo=<nodo>
// Elimina un préstamo del nodo indicado (siempre nodo único).
router.delete('/:id', async (req, res) => {
  try {
    const idPrestamo = Number(req.params.id)
    const nodo       = req.query.nodo ?? req.body?.nodo

    if (!nodo) {
      return res.status(400).json({ message: 'Falta el parámetro nodo (query string o body).' })
    }
    if (!validarNodo(nodo)) {
      return res.status(400).json({ message: 'Nodo inválido. Usa un número del 1 al 6.' })
    }

    const result = await queryNodo(
      Number(nodo),
      'DELETE FROM Prestamo WHERE id_prestamo = ?',
      [idPrestamo]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: `Préstamo ${idPrestamo} no encontrado en el nodo ${nodo}` })
    }

    res.json({ ok: true, id_prestamo: idPrestamo, nodo: Number(nodo), affectedRows: result.affectedRows })
  } catch (err) {
    console.error('[prestamosNodosCRUD DELETE]', err)
    res.status(500).json({ message: 'Error al eliminar préstamo', detail: err.message })
  }
})

export default router
