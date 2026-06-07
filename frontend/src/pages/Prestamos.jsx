import { useEffect, useState } from 'react'
import { get, post, put } from '../api/client'

function formatDate(iso) {
  if (!iso) return '—'
  return iso.split('T')[0]
}

export default function Prestamos() {
  const [tab, setTab] = useState('activos')

  return (
    <div>
      <h1 className="page-title">Gestión de Préstamos</h1>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'activos'  ? 'active' : ''}`} onClick={() => setTab('activos')}>Activos / Vencidos</button>
        <button className={`tab-btn ${tab === 'nuevo'    ? 'active' : ''}`} onClick={() => setTab('nuevo')}>Nuevo Préstamo</button>
        <button className={`tab-btn ${tab === 'historial'? 'active' : ''}`} onClick={() => setTab('historial')}>Historial</button>
        <button className={`tab-btn ${tab === 'todos'    ? 'active' : ''}`} onClick={() => setTab('todos')}>Todos los Nodos</button>
        <button className={`tab-btn ${tab === 'federado' ? 'active' : ''}`} onClick={() => setTab('federado')}>Nodo 1 + 2</button>
      </div>

      {tab === 'activos'   && <TabActivos />}
      {tab === 'nuevo'     && <TabNuevo />}
      {tab === 'historial' && <TabHistorial />}
      {tab === 'todos'     && <TabTodosNodos />}
      {tab === 'federado'  && <TabFederado />}
    </div>
  )
}

/* ─── Tab 1: Activos / Vencidos ─────────────────────────── */
function TabActivos() {
  const [prestamos, setPrestamos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [msg, setMsg]             = useState(null)

  function cargar() {
    setLoading(true)
    Promise.all([
      get('/prestamos?estatus=activo'),
      get('/prestamos?estatus=vencido'),
    ]).then(([a, v]) => setPrestamos([...a, ...v]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  function devolver(id) {
    setMsg(null)
    put(`/prestamos/${id}/devolver`)
      .then(p => {
        const multa = p.multa > 0 ? ` Multa aplicada: $${p.multa}` : ''
        setMsg({ type: 'success', text: `Devolución registrada.${multa}` })
        cargar()
      })
      .catch(e => setMsg({ type: 'error', text: e.message }))
  }

  function estatusBadge(p) {
    if (p.estatus === 'activo') return <span className="badge badge-green">Activo</span>
    return <span className="badge badge-red">Vencido</span>
  }

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}
      {loading ? (
        <p className="loading-msg">Cargando...</p>
      ) : prestamos.length === 0 ? (
        <p className="empty-msg">No hay préstamos activos o vencidos.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Usuario</th>
                <th>Libro</th>
                <th>Sucursal</th>
                <th>Préstamo</th>
                <th>Dev. Esperada</th>
                <th>Estatus</th>
                <th>Multa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prestamos.map(p => (
                <tr key={p.id_prestamo}>
                  <td className="text-muted">{p.id_prestamo}</td>
                  <td style={{ fontWeight: 500 }}>{p.usuario_nombre}</td>
                  <td>{p.libro_titulo}</td>
                  <td>{p.sucursal_nombre}</td>
                  <td className="text-muted">{formatDate(p.fecha_prestamo)}</td>
                  <td className={new Date(p.fecha_devolucion_esperada) < new Date() ? 'text-danger' : 'text-muted'}>
                    {formatDate(p.fecha_devolucion_esperada)}
                  </td>
                  <td>{estatusBadge(p)}</td>
                  <td>{p.multa > 0 ? <span className="text-danger">${p.multa}</span> : '—'}</td>
                  <td>
                    <button className="btn-success btn-sm" onClick={() => devolver(p.id_prestamo)}>
                      Devolver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ─── Tab 2: Nuevo Préstamo ─────────────────────────────── */
function TabNuevo() {
  const [usuarios,   setUsuarios]   = useState([])
  const [libros,     setLibros]     = useState([])
  const [sucursales, setSucursales] = useState([])
  const [form, setForm]             = useState({ id_usuario: '', id_libro: '', id_sucursal: '' })
  const [msg, setMsg]               = useState(null)
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    Promise.all([
      get('/usuarios'),
      get('/libros'),
      get('/sucursales'),
    ]).then(([u, l, s]) => {
      setUsuarios(u)
      setLibros(l)
      setSucursales(s)
    })
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.id_usuario || !form.id_libro || !form.id_sucursal) {
      setMsg({ type: 'error', text: 'Selecciona usuario, libro y sucursal.' })
      return
    }
    setLoading(true)
    setMsg(null)
    post('/prestamos', {
      id_usuario:  Number(form.id_usuario),
      id_libro:    Number(form.id_libro),
      id_sucursal: Number(form.id_sucursal),
    })
      .then(p => {
        setMsg({ type: 'success', text: `Préstamo #${p.id_prestamo} creado. Devolución esperada: ${formatDate(p.fecha_devolucion_esperada)}` })
        setForm({ id_usuario: '', id_libro: '', id_sucursal: '' })
      })
      .catch(e => setMsg({ type: 'error', text: e.message }))
      .finally(() => setLoading(false))
  }

  return (
    <div className="card" style={{ maxWidth: 600 }}>
      <h3 style={{ marginBottom: '1.2rem', color: 'var(--primary)' }}>Registrar Nuevo Préstamo</h3>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Usuario</label>
          <select value={form.id_usuario} onChange={e => setForm(f => ({ ...f, id_usuario: e.target.value }))} required>
            <option value="">Seleccionar usuario...</option>
            {usuarios.map(u => (
              <option key={u.id_usuario} value={u.id_usuario}>
                {u.nombre} {u.apellidos} — {u.sucursal_nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Libro</label>
          <select value={form.id_libro} onChange={e => setForm(f => ({ ...f, id_libro: e.target.value }))} required>
            <option value="">Seleccionar libro...</option>
            {libros.map(l => (
              <option key={l.id_libro} value={l.id_libro}>
                {l.titulo} — {l.autor}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label>Sucursal</label>
          <select value={form.id_sucursal} onChange={e => setForm(f => ({ ...f, id_sucursal: e.target.value }))} required>
            <option value="">Seleccionar sucursal...</option>
            {sucursales.map(s => (
              <option key={s.id_sucursal} value={s.id_sucursal}>
                {s.nombre} — {s.ciudad}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creando...' : 'Crear Préstamo'}
        </button>
      </form>
    </div>
  )
}

/* ─── Tab 3: Historial ──────────────────────────────────── */
function TabHistorial() {
  const [prestamos, setPrestamos] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    get('/prestamos?estatus=devuelto')
      .then(setPrestamos)
      .finally(() => setLoading(false))
  }, [])

  return loading ? (
    <p className="loading-msg">Cargando historial...</p>
  ) : prestamos.length === 0 ? (
    <p className="empty-msg">Sin devoluciones registradas.</p>
  ) : (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Usuario</th>
            <th>Libro</th>
            <th>Sucursal</th>
            <th>Préstamo</th>
            <th>Dev. Esperada</th>
            <th>Devuelto</th>
            <th>Multa</th>
          </tr>
        </thead>
        <tbody>
          {prestamos.map(p => (
            <tr key={p.id_prestamo}>
              <td className="text-muted">{p.id_prestamo}</td>
              <td style={{ fontWeight: 500 }}>{p.usuario_nombre}</td>
              <td>{p.libro_titulo}</td>
              <td>{p.sucursal_nombre}</td>
              <td className="text-muted">{formatDate(p.fecha_prestamo)}</td>
              <td className="text-muted">{formatDate(p.fecha_devolucion_esperada)}</td>
              <td className="text-muted">{formatDate(p.fecha_devolucion_real)}</td>
              <td>{p.multa > 0 ? <span className="text-danger">${p.multa}</span> : <span className="badge badge-green">Sin multa</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Tab 4: Todos los Nodos ────────────────────────────── */
function TabTodosNodos() {
  const [prestamos, setPrestamos] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    get('/prestamos?distribuido=1')
      .then(setPrestamos)
      .finally(() => setLoading(false))
  }, [])

  function estatusBadge(estatus) {
    if (estatus === 'activo') return <span className="badge badge-green">Activo</span>
    if (estatus === 'vencido') return <span className="badge badge-red">Vencido</span>
    return <span className="badge badge-gray">Devuelto</span>
  }

  return loading ? (
    <p className="loading-msg">Cargando préstamos de todos los nodos...</p>
  ) : prestamos.length === 0 ? (
    <p className="empty-msg">Sin préstamos registrados en los 6 nodos.</p>
  ) : (
    <div>
      <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
        Total de préstamos: <strong>{prestamos.length}</strong> (de todos los nodos)
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nodo</th>
              <th>#</th>
              <th>Usuario</th>
              <th>Libro</th>
              <th>Sucursal</th>
              <th>Préstamo</th>
              <th>Dev. Esperada</th>
              <th>Devuelto</th>
              <th>Estatus</th>
              <th>Multa</th>
            </tr>
          </thead>
          <tbody>
            {prestamos.map(p => (
              <tr key={`${p._nodo}-${p.id_prestamo}`}>
                <td className="text-muted" style={{ fontWeight: 500 }}>Nodo {p._nodo}</td>
                <td className="text-muted">{p.id_prestamo}</td>
                <td style={{ fontWeight: 500 }}>{p.usuario_nombre}</td>
                <td>{p.libro_titulo}</td>
                <td>{p.sucursal_nombre}</td>
                <td className="text-muted">{formatDate(p.fecha_prestamo)}</td>
                <td className={new Date(p.fecha_devolucion_esperada) < new Date() ? 'text-danger' : 'text-muted'}>
                  {formatDate(p.fecha_devolucion_esperada)}
                </td>
                <td className="text-muted">{formatDate(p.fecha_devolucion_real)}</td>
                <td>{estatusBadge(p.estatus)}</td>
                <td>{p.multa > 0 ? <span className="text-danger">${p.multa}</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Tab 5: Nodo 1 + 2 (FEDERATED) ───────────────────── */
function TabFederado() {
  const [datos, setDatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    get('/prestamos/nodo2')
      .then(r => setDatos(r.datos))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function formatDate(dateString) {
    if (!dateString) return '—'
    return dateString.split('T')[0]
  }

  function estatusBadge(estatus) {
    if (estatus === 'activo') return <span className="badge badge-green">Activo</span>
    if (estatus === 'vencido') return <span className="badge badge-red">Vencido</span>
    return <span className="badge badge-gray">Devuelto</span>
  }

  if (loading) return <p className="loading-msg">Consultando Nodo 1 + Nodo 2 (FEDERATED)...</p>
  if (error) return <div className="alert alert-error">{error}</div>
  if (datos.length === 0) return <p className="empty-msg">Sin resultados del JOIN federado.</p>

  return (
    <div>
      {/* <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
        JOIN federado: <strong>UsuarioPerfil (Nodo 1)</strong> + <strong>Prestamo (Nodo 2)</strong> — {datos.length} préstamos en Tijuana
      </p> */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Usuario</th>
              <th>Libro</th>
              <th>Préstamo</th>
              <th>Dev. Esperada</th>
              <th>Estatus</th>
              <th>Multa</th>
            </tr>
          </thead>
          <tbody>
            {datos.map(p => (
              <tr key={p.id_prestamo}>
                <td className="text-muted">{p.id_prestamo}</td>
                <td style={{ fontWeight: 500 }}>{p.nombre} {p.apellidos}</td>
                <td>{p.libro_titulo}</td>
                <td className="text-muted">{formatDate(p.fecha_prestamo)}</td>
                <td className={new Date(p.fecha_devolucion_esperada) < new Date() ? 'text-danger' : 'text-muted'}>
                  {formatDate(p.fecha_devolucion_esperada)}
                </td>
                <td>{estatusBadge(p.estatus)}</td>
                <td>{p.multa > 0 ? <span className="text-danger">${p.multa}</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
