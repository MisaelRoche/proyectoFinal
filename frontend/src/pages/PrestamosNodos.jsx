import { useState, useRef } from 'react'
import { get, post, put, del } from '../api/client'

const NODOS = [
  { id: 2, nombre: 'Tijuana' },
  { id: 4, nombre: 'Mex. Universidad' },
]

function badgeEstatus(estatus) {
  const map = { activo: 'badge-green', vencido: 'badge-red', devuelto: 'badge-gray' }
  return map[estatus] || 'badge-gray'
}

function fmtFecha(f) {
  if (!f) return <span className="text-muted">—</span>
  return f.split('T')[0]
}

// ─── Componente: selector de nodos tipo chip (multi) ────────────────────────
function NodosChips({ seleccionados, onChange }) {
  function toggle(id) {
    onChange(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id].sort((a, b) => a - b)
    )
  }
  return (
    <div>
      {NODOS.map(n => (
        <button
          key={n.id}
          type="button"
          className={seleccionados.includes(n.id) ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
          style={{ marginRight: '0.5rem', marginBottom: '0.25rem', cursor: 'pointer' }}
          onClick={() => toggle(n.id)}
        >
          {n.id} · {n.nombre}
        </button>
      ))}
    </div>
  )
}

// ─── Componente: campo de texto/número reutilizable ──────────────────────────
function Campo({ label, value, onChange, type = 'text', placeholder, style }) {
  return (
    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-soft)', ...style }}>
      {label}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ display: 'block', marginTop: '0.2rem', width: '100%', maxWidth: '200px', fontSize: '0.9rem', padding: '0.3rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border)', background: 'var(--surface)' }}
      />
    </label>
  )
}

// ─── Componente: banner de operación ────────────────────────────────────────
function BannerOp({ op, onClose }) {
  if (!op) return null
  const esOk = op.tipo === 'ok'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', borderRadius: '0.4rem', marginBottom: '1rem', fontSize: '0.9rem', background: esOk ? '#d1fae5' : '#fee2e2', color: esOk ? '#065f46' : '#991b1b', border: `1px solid ${esOk ? '#6ee7b7' : '#fca5a5'}` }}>
      <span>{op.mensaje}</span>
      <button className="btn-secondary btn-sm" onClick={onClose} style={{ marginLeft: '1rem' }}>✕</button>
    </div>
  )
}

export default function PrestamosNodos() {
  // ── Estado del query ──────────────────────────────────────────────────────
  const [nodosSeleccionados, setNodosSeleccionados] = useState([])
  const [estatus, setEstatus]                       = useState('')
  const [data, setData]                             = useState(null)
  const [loading, setLoading]                       = useState(false)
  const [error, setError]                           = useState(null)

  // ── Estado de operaciones (banner) ────────────────────────────────────────
  const [opMsg, setOpMsg] = useState(null)   // { tipo: 'ok'|'error', mensaje: string }

  // ── Estado edición inline de multa ────────────────────────────────────────
  const [editId,    setEditId]    = useState(null)   // id_prestamo en edición
  const [editMulta, setEditMulta] = useState('')

  // ── Estado formulario crear ───────────────────────────────────────────────
  const [crNodos,     setCrNodos]     = useState([])
  const [crIdUsuario, setCrIdUsuario] = useState('')
  const [crIdLibro,   setCrIdLibro]   = useState('')
  const [crLoading,   setCrLoading]   = useState(false)

  // ── Estado formulario modificar multa ─────────────────────────────────────
  const [modNodos,   setModNodos]   = useState([])
  const [modIdPrest, setModIdPrest] = useState('')
  const [modMulta,   setModMulta]   = useState('')
  const [modLoading, setModLoading] = useState(false)

  // ── Estado formulario eliminar ────────────────────────────────────────────
  const [elNodo,    setElNodo]    = useState('')
  const [elIdPrest, setElIdPrest] = useState('')
  const [elLoading, setElLoading] = useState(false)

  // Ref para ejecutar() — sirve para que recargar() siempre llame a la versión actual
  const ejecutarRef = useRef(null)

  // ── Helpers de nodo ───────────────────────────────────────────────────────
  function toggleNodo(id) {
    setNodosSeleccionados(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id].sort((a, b) => a - b)
    )
  }
  const nombreNodo = id => NODOS.find(n => n.id === id)?.nombre ?? `Nodo ${id}`

  // ── Query principal ───────────────────────────────────────────────────────
  function ejecutar(nodos = nodosSeleccionados, est = estatus) {
    if (nodos.length === 0) return
    const path = '/prestamos-nodos/' + nodos.join(',') + (est ? '?estatus=' + est : '')
    setLoading(true)
    setError(null)
    setData(null)
    setEditId(null)

    get(path)
      .then(resp => setData(resp))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }
  ejecutarRef.current = ejecutar

  function recargar() {
    ejecutarRef.current(nodosSeleccionados, estatus)
  }

  // ── Crear préstamo ────────────────────────────────────────────────────────
  async function crear() {
    if (crNodos.length === 0) {
      setOpMsg({ tipo: 'error', mensaje: 'Selecciona al menos un nodo para crear el préstamo.' })
      return
    }
    if (!crIdUsuario || !crIdLibro) {
      setOpMsg({ tipo: 'error', mensaje: 'Completa todos los campos: ID Usuario e ID Libro.' })
      return
    }
    setCrLoading(true)
    setOpMsg(null)
    try {
      const d = await post('/prestamos-nodos', {
        nodos:      crNodos,
        id_usuario: Number(crIdUsuario),
        id_libro:   Number(crIdLibro),
      })
      const lineas = d.resultados.map(r =>
        r.ok
          ? `Nodo ${r.nodo}: préstamo #${r.data.id_prestamo} creado`
          : `Nodo ${r.nodo}: error — ${r.error}`
      ).join(' · ')
      const tipo = d.total_ok > 0 ? 'ok' : 'error'
      setOpMsg({ tipo, mensaje: lineas })
      setCrIdUsuario(''); setCrIdLibro('')
      // Agregar los nodos creados al selector del query y recargar
      const nodosNuevos = [...new Set([...nodosSeleccionados, ...crNodos])].sort((a, b) => a - b)
      setNodosSeleccionados(nodosNuevos)
      ejecutarRef.current(nodosNuevos, estatus)
    } catch (err) {
      setOpMsg({ tipo: 'error', mensaje: `Error al crear: ${err.message}` })
    } finally {
      setCrLoading(false)
    }
  }

  // ── Modificar multa (formulario standalone) ───────────────────────────────
  async function modificarMulta() {
    if (modNodos.length === 0) {
      setOpMsg({ tipo: 'error', mensaje: 'Selecciona al menos un nodo para modificar la multa.' })
      return
    }
    if (!modIdPrest || modMulta === '') {
      setOpMsg({ tipo: 'error', mensaje: 'Completa todos los campos: ID préstamo y nueva multa.' })
      return
    }
    if (Number(modMulta) < 0) {
      setOpMsg({ tipo: 'error', mensaje: 'La multa no puede ser negativa.' })
      return
    }
    setModLoading(true)
    setOpMsg(null)
    try {
      const d = await put(`/prestamos-nodos/${modIdPrest}/multa`, { nodos: modNodos, multa: Number(modMulta) })
      const lineas = d.resultados.map(r =>
        r.ok
          ? `Nodo ${r.nodo}: actualizado (${r.affectedRows} fila${r.affectedRows !== 1 ? 's' : ''})`
          : `Nodo ${r.nodo}: ${r.error ?? 'error desconocido'}`
      ).join(' · ')
      // Éxito solo si al menos una fila fue realmente modificada
      const filasAfectadas = d.resultados.reduce((s, r) => s + (r.affectedRows ?? 0), 0)
      const tipo = filasAfectadas > 0 ? 'ok' : 'error'
      setOpMsg({ tipo, mensaje: `Préstamo #${modIdPrest} — ${lineas}` })
      setModIdPrest(''); setModMulta('')
      recargar()
    } catch (err) {
      setOpMsg({ tipo: 'error', mensaje: `Error al modificar multa: ${err.message}` })
    } finally {
      setModLoading(false)
    }
  }

  // ── Eliminar préstamo (formulario standalone) ─────────────────────────────
  async function eliminarForm() {
    if (!elNodo || !elIdPrest) {
      setOpMsg({ tipo: 'error', mensaje: 'Selecciona el nodo e ingresa el ID del préstamo.' })
      return
    }
    if (!window.confirm(`¿Eliminar el préstamo #${elIdPrest} del Nodo ${elNodo}?`)) return
    setElLoading(true)
    setOpMsg(null)
    try {
      await del(`/prestamos-nodos/${elIdPrest}?nodo=${elNodo}`)
      setOpMsg({ tipo: 'ok', mensaje: `Préstamo #${elIdPrest} eliminado del Nodo ${elNodo}` })
      setElIdPrest('')
      recargar()
    } catch (err) {
      setOpMsg({ tipo: 'error', mensaje: `Error al eliminar: ${err.message}` })
    } finally {
      setElLoading(false)
    }
  }

  // ── Guardar multa inline ──────────────────────────────────────────────────
  async function guardarMulta(idPrestamo, nodo) {
    if (editMulta === '') return
    setOpMsg(null)
    try {
      const d = await put(`/prestamos-nodos/${idPrestamo}/multa`, { nodo, multa: Number(editMulta) })
      const res = d.resultados?.[0]
      if (res?.ok && (res.affectedRows ?? 0) > 0) {
        setOpMsg({ tipo: 'ok', mensaje: `Multa del préstamo #${idPrestamo} actualizada a $${Number(editMulta).toFixed(2)}` })
      } else {
        setOpMsg({ tipo: 'error', mensaje: res?.error ?? `Préstamo #${idPrestamo} no encontrado en el nodo ${nodo}` })
      }
      setEditId(null)
      recargar()
    } catch (err) {
      setOpMsg({ tipo: 'error', mensaje: `Error al modificar multa: ${err.message}` })
    }
  }

  // ── Eliminar préstamo ─────────────────────────────────────────────────────
  async function eliminar(idPrestamo, nodo) {
    if (!window.confirm(`¿Eliminar el préstamo #${idPrestamo} del Nodo ${nodo}?`)) return
    setOpMsg(null)
    try {
      await del(`/prestamos-nodos/${idPrestamo}?nodo=${nodo}`)
      setOpMsg({ tipo: 'ok', mensaje: `Préstamo #${idPrestamo} eliminado del Nodo ${nodo}` })
      recargar()
    } catch (err) {
      setOpMsg({ tipo: 'error', mensaje: `Error al eliminar: ${err.message}` })
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <h1 className="page-title">Préstamos — Nodos 2 y 4</h1>

      {/* ── Banner de operaciones ─────────────────────────────────────────── */}
      <BannerOp op={opMsg} onClose={() => setOpMsg(null)} />

      {/* ══ Sección: Crear préstamo ══════════════════════════════════════════ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.9rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Crear préstamo
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-soft)', marginRight: '0.75rem' }}>NODOS:</span>
          <NodosChips seleccionados={crNodos} onChange={setCrNodos} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <Campo label="ID Usuario" value={crIdUsuario} onChange={setCrIdUsuario} type="number" placeholder="1" />
          <Campo label="ID Libro"   value={crIdLibro}   onChange={setCrIdLibro}   type="number" placeholder="1" />
          <button
            className="btn-primary"
            disabled={crLoading}
            onClick={crear}
            style={{ alignSelf: 'flex-end', cursor: crLoading ? 'not-allowed' : 'pointer', opacity: crLoading ? 0.7 : 1 }}
          >
            {crLoading ? 'Creando…' : '▶ Crear'}
          </button>
        </div>
      </div>

      {/* ══ Sección: Modificar multa ═════════════════════════════════════════ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.9rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Modificar multa
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-soft)', marginRight: '0.75rem' }}>NODOS:</span>
          <NodosChips seleccionados={modNodos} onChange={setModNodos} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <Campo label="ID Préstamo"    value={modIdPrest} onChange={setModIdPrest} type="number" placeholder="10" />
          <Campo label="Nueva multa ($)" value={modMulta}   onChange={setModMulta}   type="number" placeholder="0.00" />
          <button
            className="btn-primary"
            disabled={modLoading}
            onClick={modificarMulta}
            style={{ alignSelf: 'flex-end', cursor: modLoading ? 'not-allowed' : 'pointer', opacity: modLoading ? 0.7 : 1 }}
          >
            {modLoading ? 'Guardando…' : '▶ Guardar'}
          </button>
        </div>
      </div>

      {/* ══ Sección: Eliminar préstamo ════════════════════════════════════════ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.9rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Eliminar préstamo
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-soft)' }}>
            NODO:&nbsp;
            <select
              value={elNodo}
              onChange={e => setElNodo(e.target.value)}
              style={{ fontSize: '0.9rem', padding: '0.25rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border)' }}
            >
              <option value="">— selecciona —</option>
              {NODOS.map(n => (
                <option key={n.id} value={n.id}>{n.id} · {n.nombre}</option>
              ))}
            </select>
          </label>
          <Campo label="ID Préstamo" value={elIdPrest} onChange={setElIdPrest} type="number" placeholder="10" />
          <button
            className="btn-secondary"
            disabled={elLoading}
            onClick={eliminarForm}
            style={{ alignSelf: 'flex-end', cursor: elLoading ? 'not-allowed' : 'pointer', opacity: elLoading ? 0.7 : 1, color: 'var(--danger, #dc2626)', borderColor: 'var(--danger, #dc2626)' }}
          >
            {elLoading ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>

      {/* ══ Sección: Consultar por nodos ═════════════════════════════════════ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Selector de nodos tipo chip */}
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, marginRight: '0.75rem', color: 'var(--text-soft)' }}>
            NODOS:
          </span>
          {NODOS.map(n => (
            <button
              key={n.id}
              className={nodosSeleccionados.includes(n.id) ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              style={{ marginRight: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer' }}
              onClick={() => toggleNodo(n.id)}
            >
              {n.id} · {n.nombre}
            </button>
          ))}
        </div>

        {/* Filtro estatus + botón ejecutar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-soft)' }}>
            ESTATUS:&nbsp;
            <select
              value={estatus}
              onChange={e => setEstatus(e.target.value)}
              style={{ fontSize: '0.9rem', padding: '0.25rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border)' }}
            >
              <option value="">todos</option>
              <option value="activo">activo</option>
              <option value="vencido">vencido</option>
              <option value="devuelto">devuelto</option>
            </select>
          </label>

          <button
            className="btn-primary"
            style={{ cursor: nodosSeleccionados.length === 0 ? 'not-allowed' : 'pointer', opacity: nodosSeleccionados.length === 0 ? 0.5 : 1 }}
            disabled={nodosSeleccionados.length === 0 || loading}
            onClick={() => ejecutar()}
          >
            {loading ? 'Consultando…' : '▶ Ejecutar query'}
          </button>

          {nodosSeleccionados.length === 0 && (
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>Selecciona al menos un nodo</span>
          )}
        </div>
      </div>

      {/* ── Estados: cargando / error ──────────────────────────────────────── */}
      {loading && (
        <p className="loading-msg">
          Consultando nodos {nodosSeleccionados.join(', ')}…
        </p>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          Error al consultar los nodos: {error}
          <button className="btn-primary btn-sm" onClick={() => ejecutar()} style={{ marginLeft: '1rem' }}>
            Reintentar
          </button>
        </div>
      )}

      {/* ── Resumen por nodo ─────────────────────────────────────────────── */}
      {data && (
        <>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {data.resumen.map(r => (
              <div
                key={r.nodo}
                className={'stat-card' + (r.ok ? '' : ' danger')}
                style={{ minWidth: '160px', flex: '1 1 160px' }}
              >
                <div className="stat-value" style={{ fontSize: '1.6rem' }}>
                  {r.total}
                </div>
                <div className="stat-label">
                  <span className={'badge ' + (r.ok ? 'badge-green' : 'badge-red')} style={{ marginRight: '0.4rem' }}>
                    {r.ok ? 'OK' : 'ERROR'}
                  </span>
                  Nodo {r.nodo} · {nombreNodo(r.nodo)}
                </div>
                {r.error && (
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.3rem', wordBreak: 'break-all' }}>
                    {r.error}
                  </div>
                )}
              </div>
            ))}

            {/* Total global */}
            <div className="stat-card" style={{ minWidth: '120px', flex: '0 1 120px', borderLeftColor: 'var(--accent)' }}>
              <div className="stat-value" style={{ fontSize: '1.6rem' }}>{data.total}</div>
              <div className="stat-label">Total préstamos</div>
            </div>
          </div>

          {/* ── Tabla de resultados ──────────────────────────────────────── */}
          {data.resultados.length === 0 ? (
            <p className="empty-msg">No se encontraron préstamos con ese filtro.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nodo</th>
                    <th>ID</th>
                    <th>Libro</th>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Suc.</th>
                    <th>Estatus</th>
                    <th>Multa</th>
                    <th>Préstamo</th>
                    <th>Dev. esperada</th>
                    <th>Dev. real</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.resultados.map((r, i) => (
                    <tr key={i}>
                      {/* Nodo */}
                      <td>
                        <span className="badge badge-orange" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {r._nodo_origen}
                        </span>
                        <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                          {nombreNodo(r._nodo_origen)}
                        </div>
                      </td>
                      {/* ID */}
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>#{r.id_prestamo}</td>
                      {/* Libro */}
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.titulo}</div>
                        <div className="text-muted" style={{ fontSize: '0.8rem' }}>{r.autor}</div>
                      </td>
                      {/* Usuario */}
                      <td className="text-muted">#{r.id_usuario}</td>
                      {/* Correo */}
                      <td className="text-muted">{r.email || <span style={{ opacity: 0.4 }}>—</span>}</td>
                      {/* Sucursal */}
                      <td className="text-muted">{r.id_sucursal}</td>
                      {/* Estatus */}
                      <td>
                        <span className={'badge ' + badgeEstatus(r.estatus)}>{r.estatus}</span>
                      </td>
                      {/* Multa — edición inline */}
                      <td>
                        {editId === r.id_prestamo ? (
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editMulta}
                              onChange={e => setEditMulta(e.target.value)}
                              autoFocus
                              style={{ width: '72px', fontSize: '0.85rem', padding: '0.2rem 0.35rem', borderRadius: '0.25rem', border: '1px solid var(--border)' }}
                            />
                            <button className="btn-primary btn-sm" onClick={() => guardarMulta(r.id_prestamo, r._nodo_origen)}>✓</button>
                            <button className="btn-secondary btn-sm" onClick={() => setEditId(null)}>✕</button>
                          </div>
                        ) : (
                          Number(r.multa) > 0
                            ? <span className="text-danger">${Number(r.multa).toFixed(2)}</span>
                            : <span className="text-muted">—</span>
                        )}
                      </td>
                      {/* Fechas */}
                      <td className="text-muted">{fmtFecha(r.fecha_prestamo)}</td>
                      <td className="text-muted">{fmtFecha(r.fecha_devolucion_esperada)}</td>
                      <td className="text-muted">{fmtFecha(r.fecha_devolucion_real)}</td>
                      {/* Acciones */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn-secondary btn-sm"
                          title="Modificar multa"
                          onClick={() => { setEditId(r.id_prestamo); setEditMulta(Number(r.multa) || 0) }}
                          style={{ marginRight: '0.35rem', cursor: 'pointer' }}
                        >
                          Multa
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          title="Eliminar préstamo"
                          onClick={() => eliminar(r.id_prestamo, r._nodo_origen)}
                          style={{ cursor: 'pointer', color: 'var(--danger, #dc2626)', borderColor: 'var(--danger, #dc2626)' }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
