import { Router } from 'express'
import { queryTodos, queryPerfil, queryAcceso, buscarPerfil } from '../db/pool.js'

const router = Router()

function enrich(u) {
  return {
    ...u,
    sucursal_nombre:    u.sucursal_nombre || '',
    multas_acumuladas:  Number(u.multas_acumuladas) || 0,
  }
}

/**
 * Reconstruye usuarios desde los 2 fragmentos verticales:
 *  - Nodo 1 (UsuarioPerfil + Sucursal, JOIN local en Nodo 1)
 *  - Nodo 4 (UsuarioAcceso)
 * Las queries van en paralelo y el merge se hace en JS por id_usuario.
 */
async function reconstruirUsuario(idUsuario = null) {
  const whereClause = idUsuario ? 'WHERE up.id_usuario = ?' : ''
  const params      = idUsuario ? [idUsuario] : []

  const [perfilRes, accesoRes] = await Promise.allSettled([
    queryPerfil(
      `SELECT up.id_usuario, up.nombre, up.apellidos, up.telefono, up.direccion,
              up.id_sucursal_registro, up.fecha_registro,
              s.nombre AS sucursal_nombre
       FROM UsuarioPerfil up
       JOIN Sucursal s ON up.id_sucursal_registro = s.id_sucursal
       ${whereClause}
       ORDER BY up.id_usuario`,
      params
    ),
    queryAcceso(
      `SELECT id_usuario, email, multas_acumuladas
       FROM UsuarioAcceso
       ${idUsuario ? 'WHERE id_usuario = ?' : ''}`,
      params
    ),
  ])

  const perfiles = perfilRes.status === 'fulfilled' ? perfilRes.value : []
  const accesos  = accesoRes.status === 'fulfilled' ? accesoRes.value : []

  const accesoMap = new Map(accesos.map(a => [a.id_usuario, a]))
  return perfiles.map(p => enrich({
    ...p,
    email:             accesoMap.get(p.id_usuario)?.email             ?? '',
    multas_acumuladas: accesoMap.get(p.id_usuario)?.multas_acumuladas ?? 0,
  }))
}

// GET /api/usuarios
// Consulta Nodo 1 (Perfil + Sucursal) y Nodo 4 (Acceso) en paralelo.
// El merge se hace en JavaScript por id_usuario.
router.get('/', async (req, res) => {
  try {
    const usuarios = await reconstruirUsuario()
    res.json(usuarios)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuarios', detail: err.message })
  }
})

// GET /api/usuarios/:id
// Busca en Nodo 1 (Perfil) y Nodo 4 (Acceso) en paralelo.
router.get('/:id', async (req, res) => {
  try {
    const [u] = await reconstruirUsuario(Number(req.params.id))
    if (!u) return res.status(404).json({ message: 'Usuario no encontrado' })
    res.json(u)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuario', detail: err.message })
  }
})

// GET /api/usuarios/:id/prestamos
// Q5: verifica existencia del usuario SOLO en Nodo 1 (Perfil).
// Luego fan-out a 6 nodos para los préstamos (Prestamo sigue fragmentado H).
router.get('/:id/prestamos', async (req, res) => {
  try {
    const idUsuario = Number(req.params.id)

    // Q5: solo consulta UsuarioPerfil en Nodo 1 (no necesita email ni multas)
    const perfil = await buscarPerfil(idUsuario)
    if (!perfil) return res.status(404).json({ message: 'Usuario no encontrado' })

    // Fan-out a 6 nodos: el usuario pudo haber prestado en cualquier sucursal
    const prestamos = await queryTodos(
      `SELECT p.*, l.titulo AS libro_titulo, s.nombre AS sucursal_nombre
       FROM Prestamo p
       JOIN Libro    l ON p.id_libro    = l.id_libro
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
