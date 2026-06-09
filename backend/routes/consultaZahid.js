import { Router } from 'express'
import { queryNodo } from '../db/pool.js'

const router = Router()

function normalizeUsuario(body) {
  const nombre = String(body.nombre ?? '').trim()
  const apellidos = String(body.apellidos ?? '').trim()
  const telefono = body.telefono != null ? String(body.telefono).trim() : null
  const direccion = body.direccion != null ? String(body.direccion).trim() : null
  const email = String(body.email ?? '').trim()
  const idSucursalRegistro = Number(body.id_sucursal_registro)
  const multas = Number(body.multas_acumuladas ?? 0)

  return { nombre, apellidos, telefono, direccion, email, idSucursalRegistro, multas }
}

// GET /api/consulta-zahid/usuarios
// Join lógico entre UsuarioPerfil (Nodo 1) y UsuarioAcceso (Nodo 4) por id_usuario.
router.get('/usuarios', async (req, res) => {
  try {
    const resultados = await Promise.allSettled([
      queryNodo(1, 'SELECT id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro, 1 AS nodo_perfil FROM UsuarioPerfil WHERE id_sucursal_registro = 2 ORDER BY id_usuario'),
      queryNodo(4, 'SELECT id_usuario, email, multas_acumuladas, 4 AS nodo_acceso FROM UsuarioAcceso ORDER BY id_usuario'),
    ])

    const perfil = resultados[0].status === 'fulfilled' ? resultados[0].value : []
    const acceso = resultados[1].status === 'fulfilled' ? resultados[1].value : []
    const errores = resultados
      .map((r, idx) => (r.status === 'rejected' ? { nodo: idx === 0 ? 1 : 4, error: r.reason?.message } : null))
      .filter(Boolean)

    if (perfil.length === 0 && acceso.length === 0) {
      return res.status(503).json({
        ok: false,
        message: 'No fue posible consultar los nodos 1 y 4',
        errores,
      })
    }

    const accesoMap = new Map(acceso.map(r => [r.id_usuario, r]))
    const usuarios = perfil.map(p => {
      const a = accesoMap.get(p.id_usuario)
      return {
        id_usuario: p.id_usuario,
        nombre_completo: `${p.nombre ?? ''} ${p.apellidos ?? ''}`.trim(),
        telefono: p.telefono,
        direccion: p.direccion,
        id_sucursal_registro: p.id_sucursal_registro,
        fecha_registro: p.fecha_registro,
        email: a?.email ?? '',
        multas_acumuladas: a?.multas_acumuladas ?? 0,
        nodo_perfil: 1,
        nodo_acceso: a ? 4 : null,
      }
    })

    res.json({
      ok: true,
      total: usuarios.length,
      usuarios,
      errores,
    })
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: 'Error al consultar usuarios distribuidos',
      detail: err.message,
    })
  }
})

// POST /api/consulta-zahid/usuarios
// Alta distribuida: inserta en UsuarioPerfil (Nodo 1) y UsuarioAcceso (Nodo 4).
router.post('/usuarios', async (req, res) => {
  try {
    const { nombre, apellidos, telefono, direccion, email, idSucursalRegistro, multas } = normalizeUsuario(req.body)

    if (!nombre || !apellidos || !email || !Number.isFinite(idSucursalRegistro)) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan campos obligatorios: nombre, apellidos, email, id_sucursal_registro',
      })
    }

    const perfilInsert = await queryNodo(
      1,
      `INSERT INTO UsuarioPerfil (nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro)
       VALUES (?, ?, ?, ?, ?, CURDATE())`,
      [nombre, apellidos, telefono, direccion, idSucursalRegistro]
    )

    const idUsuario = perfilInsert.insertId

    try {
      await queryNodo(
        4,
        `INSERT INTO UsuarioAcceso (id_usuario, email, multas_acumuladas)
         VALUES (?, ?, ?)`,
        [idUsuario, email, multas]
      )
    } catch (err) {
      await queryNodo(1, 'DELETE FROM UsuarioPerfil WHERE id_usuario = ?', [idUsuario])
      throw err
    }

    res.status(201).json({
      ok: true,
      message: 'Usuario dado de alta correctamente',
      id_usuario: idUsuario,
    })
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: 'Error al dar de alta usuario',
      detail: err.message,
    })
  }
})

// DELETE /api/consulta-zahid/usuarios/:id
// Baja distribuida: elimina primero acceso (Nodo 4) y luego perfil (Nodo 1).
router.delete('/usuarios/:id', async (req, res) => {
  try {
    const idUsuario = Number(req.params.id)
    if (!Number.isFinite(idUsuario)) {
      return res.status(400).json({ ok: false, message: 'id_usuario inválido' })
    }

    const acceso = await queryNodo(4, 'SELECT id_usuario FROM UsuarioAcceso WHERE id_usuario = ?', [idUsuario])
    const perfil = await queryNodo(1, 'SELECT id_usuario FROM UsuarioPerfil WHERE id_usuario = ?', [idUsuario])

    if (perfil.length === 0 && acceso.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' })
    }

    await queryNodo(4, 'DELETE FROM UsuarioAcceso WHERE id_usuario = ?', [idUsuario])
    await queryNodo(1, 'DELETE FROM UsuarioPerfil WHERE id_usuario = ?', [idUsuario])

    res.json({
      ok: true,
      message: 'Usuario dado de baja correctamente',
      id_usuario: idUsuario,
    })
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: 'Error al dar de baja usuario',
      detail: err.message,
    })
  }
})

export default router
