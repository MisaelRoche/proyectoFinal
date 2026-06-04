// backend/db/pool.js
// Helpers de conexión distribuida — un pool por nodo, creado perezosamente.
// Cada nodo usa sus propias credenciales MySQL definidas en config/nodos.js.

import mysql from 'mysql2/promise'
import { nodos, DB, MI_NODO, nodoDeSucursal } from '../config/nodos.js'

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

/**
 * Busca un usuario por id_usuario en todos los nodos (local primero).
 * Devuelve { usuario, idNodo } o null si no se encuentra.
 */
export async function buscarUsuario(idUsuario) {
  // Intentar local primero (caso más frecuente)
  try {
    const rows = await queryLocal('SELECT * FROM Usuario WHERE id_usuario = ?', [idUsuario])
    if (rows.length > 0) return { usuario: rows[0], idNodo: MI_NODO }
  } catch (_) { /* nodo local caído — poco probable */ }

  // Si no está local, buscar en los otros nodos
  const otrosNodos = Object.keys(nodos)
    .map(Number)
    .filter(n => n !== MI_NODO)

  for (const idNodo of otrosNodos) {
    try {
      const rows = await queryNodo(idNodo, 'SELECT * FROM Usuario WHERE id_usuario = ?', [idUsuario])
      if (rows.length > 0) return { usuario: rows[0], idNodo }
    } catch (_) {
      console.warn(`[pool] No se pudo consultar Usuario en Nodo ${idNodo}`)
    }
  }
  return null
}

export { nodoDeSucursal, MI_NODO, nodos }
