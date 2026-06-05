// backend/db/pool.js
// Helpers de conexión distribuida — un pool por nodo, creado perezosamente.
// Cada nodo usa sus propias credenciales MySQL definidas en config/nodos.js.

import mysql from 'mysql2/promise'
import { nodos, DB, MI_NODO, NODO_PERFIL, NODO_ACCESO, nodoDeSucursal } from '../config/nodos.js'

// Cache de pools: Map<idNodo, Pool>
const pools = new Map()

/**
 * Devuelve (o crea) el pool de conexiones al nodo indicado.
 * Usa el usuario/contraseña propios de ese nodo.
 */
function getPool(idNodo) {
  if (!pools.has(idNodo)) {
    const nodo = nodos[idNodo]
    if (!nodo) throw new Error(`Nodo ${idNodo} no definido en config/nodos.js`)
    pools.set(
      idNodo,
      mysql.createPool({
        host:     nodo.host,
        user:     nodo.user,
        password: nodo.password,
        database: nodo.database,   // cada nodo tiene su propia BD con nombre distinto
        port:     DB.port,
        charset:  'utf8mb4',       // forzar utf8mb4 para acentos y ñ
        waitForConnections: true,
        connectionLimit:    5,
        connectTimeout:     4000,
      })
    )
  }
  return pools.get(idNodo)
}

/**
 * Ejecuta una consulta en un nodo específico.
 * @param {number} idNodo   - 1..6
 * @param {string} sql      - sentencia SQL con ?
 * @param {Array}  params   - parámetros
 * @returns {Array} filas resultantes
 */
export async function queryNodo(idNodo, sql, params = []) {
  const pool = getPool(idNodo)
  const [rows] = await pool.execute(sql, params)
  return rows
}

/**
 * Ejecuta una consulta en el nodo LOCAL (esta máquina).
 */
export async function queryLocal(sql, params = []) {
  return queryNodo(MI_NODO, sql, params)
}

/**
 * Fan-out: ejecuta la misma consulta en los 6 nodos en paralelo.
 * Los nodos que no respondan se omiten con warning en consola.
 * @returns {Array} resultados concatenados de todos los nodos disponibles
 */
export async function queryTodos(sql, params = []) {
  const resultados = await Promise.all(
    Object.keys(nodos).map(async (idStr) => {
      const idNodo = Number(idStr)
      try {
        const filas = await queryNodo(idNodo, sql, params)
        return filas.map(f => ({ ...f, _nodo: idNodo }))
      } catch (err) {
        console.warn(`[pool] Nodo ${idNodo} (${nodos[idNodo].nombre}) no disponible: ${err.message}`)
        return []
      }
    })
  )
  return resultados.flat()
}

// ─── Helpers para fragmentos verticales distribuidos ─────────────────────────

/**
 * Consulta el fragmento UsuarioPerfil en el Nodo 1.
 */
export async function queryPerfil(sql, params = []) {
  return queryNodo(NODO_PERFIL, sql, params)
}

/**
 * Consulta el fragmento UsuarioAcceso en el Nodo 4.
 */
export async function queryAcceso(sql, params = []) {
  return queryNodo(NODO_ACCESO, sql, params)
}

/**
 * Busca solo el perfil de un usuario en Nodo 1.
 * Útil para Q5 (verificar existencia) sin consultar Nodo 4.
 */
export async function buscarPerfil(idUsuario) {
  try {
    const rows = await queryPerfil(
      'SELECT id_usuario, nombre, apellidos, id_sucursal_registro FROM UsuarioPerfil WHERE id_usuario = ?',
      [idUsuario]
    )
    return rows[0] || null
  } catch (_) {
    return null
  }
}

/**
 * Busca un usuario completo reconstruyendo desde los 2 fragmentos
 * en nodos distintos (Perfil en Nodo 1, Acceso en Nodo 4).
 *
 * Las 2 queries se ejecutan EN PARALELO.
 * Si Nodo 4 no responde, el usuario se devuelve sin email/multas
 *   (degradación elegante — el perfil básico sigue disponible).
 *
 * Devuelve { usuario, idNodoAcceso } o null si el perfil no existe.
 */
export async function buscarUsuario(idUsuario) {
  const [perfilRes, accesoRes] = await Promise.allSettled([
    queryPerfil(
      `SELECT id_usuario, nombre, apellidos, telefono, direccion,
              id_sucursal_registro, fecha_registro
       FROM UsuarioPerfil
       WHERE id_usuario = ?`,
      [idUsuario]
    ),
    queryAcceso(
      'SELECT id_usuario, email, multas_acumuladas FROM UsuarioAcceso WHERE id_usuario = ?',
      [idUsuario]
    ),
  ])

  const perfil = perfilRes.status === 'fulfilled' ? perfilRes.value[0] : null
  const acceso = accesoRes.status === 'fulfilled' ? accesoRes.value[0] : null

  if (!perfil) return null

  return {
    usuario: {
      ...perfil,
      email:             acceso?.email             ?? '',
      multas_acumuladas: acceso?.multas_acumuladas ?? 0,
    },
    idNodoAcceso: NODO_ACCESO,   // para updates de multa
  }
}

/**
 * Fan-out de ESCRITURA: ejecuta la misma sentencia (UPDATE/INSERT/DELETE)
 * en los 6 nodos en paralelo. Usar para tablas REPLICADAS (Sucursal, Categoria, Libro).
 * No aborta si un nodo está caído — devuelve el estado por nodo (Promise.allSettled).
 * @param {string} sql    - sentencia SQL con ?
 * @param {Array}  params - parámetros
 * @returns {Array<{idNodo, nombre, ok, affectedRows?, error?}>}
 */
export async function escribirEnTodos(sql, params = []) {
  const resultados = await Promise.allSettled(
    Object.keys(nodos).map(async (idStr) => {
      const idNodo = Number(idStr)
      const r = await queryNodo(idNodo, sql, params)
      return { idNodo, affectedRows: r.affectedRows }
    })
  )
  return Object.keys(nodos).map((idStr, i) => {
    const idNodo = Number(idStr)
    const res = resultados[i]
    return res.status === 'fulfilled'
      ? { idNodo, nombre: nodos[idNodo].nombre, ok: true,  affectedRows: res.value.affectedRows }
      : { idNodo, nombre: nodos[idNodo].nombre, ok: false, error: res.reason?.message }
  })
}

export { nodoDeSucursal, MI_NODO, nodos, NODO_PERFIL, NODO_ACCESO }
