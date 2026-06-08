import { useEffect, useState } from 'react'
import { get, post, put, del } from '../api/client'

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
        <button className={`tab-btn ${tab === 'federados'? 'active' : ''}`} onClick={() => setTab('federados')}>nodo2 y nodo 3</button>
      </div>

      {tab === 'activos'   && <TabActivos />}
      {tab === 'nuevo'     && <TabNuevo />}
      {tab === 'historial' && <TabHistorial />}
      {tab === 'todos'     && <TabTodosNodos />}
      {tab === 'federados' && <TabFederados />}
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
                  <td className="text-muted">{p.fecha_prestamo}</td>
                  <td className={new Date(p.fecha_devolucion_esperada) < new Date() ? 'text-danger' : 'text-muted'}>
                    {p.fecha_devolucion_esperada}
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
        setMsg({ type: 'success', text: `Préstamo #${p.id_prestamo} creado. Devolución esperada: ${p.fecha_devolucion_esperada}` })
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
              <td className="text-muted">{p.fecha_prestamo}</td>
              <td className="text-muted">{p.fecha_devolucion_esperada}</td>
              <td className="text-muted">{p.fecha_devolucion_real}</td>
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

  function formatDate(dateString) {
    if (!dateString) return '—'
    return dateString.split('T')[0]
  }

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

/* ─── Tab 5: nodo2 y nodo3 (Federated) ─────────────── */
function TabFederados() {
  const [prestamos, setPrestamos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [libros, setLibros]       = useState([])
  const [msg, setMsg]             = useState(null)
  const [loadingForm, setLoadingForm] = useState(false)
  const [form, setForm] = useState({ id_sucursal: '2', id_libro: '', id_usuario: '' })
  const [filtro, setFiltro] = useState('todos')

  function cargar(suc) {
    setLoading(true)
    setPrestamos([])
    const query = suc || filtro
    let path = '/prestamos/activos/tijuana-ensenada'
    if (query === '2') path += '?id_sucursal=2'
    if (query === '3') path += '?id_sucursal=3'
    get(path)
      .then(setPrestamos)
      .catch(() => setPrestamos([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
    get('/libros').then(setLibros).catch(() => {})
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.id_usuario || !form.id_libro) {
      setMsg({ type: 'error', text: 'Selecciona libro y usuario.' })
      return
    }
    setLoadingForm(true)
    setMsg(null)
    post('/prestamos/federado', {
      id_usuario:  Number(form.id_usuario),
      id_libro:    Number(form.id_libro),
      id_sucursal: Number(form.id_sucursal),
    })
      .then(p => {
        setMsg({ type: 'success', text: `Préstamo #${p.id_prestamo} creado en ${form.id_sucursal === '2' ? 'Tijuana' : 'Ensenada'}.` })
        setForm(f => ({ ...f, id_libro: '', id_usuario: '' }))
        cargar()
      })
      .catch(e => setMsg({ type: 'error', text: e.message }))
      .finally(() => setLoadingForm(false))
  }

  function eliminar(idPrestamo, idSucursal) {
    setMsg(null)
    del(`/prestamos/federado/${idSucursal}/${idPrestamo}`)
      .then(() => {
        setMsg({ type: 'success', text: `Préstamo #${idPrestamo} eliminado de ${idSucursal === 2 ? 'Tijuana' : 'Ensenada'}.` })
        cargar()
      })
      .catch(e => setMsg({ type: 'error', text: e.message }))
  }

  function formatDate(dateString) {
    if (!dateString) return '—'
    return dateString.split('T')[0]
  }

  function nodoNombre(idSucursal) {
    const nombres = { 2: 'Tijuana', 3: 'Ensenada' }
    return nombres[idSucursal] || `Suc ${idSucursal}`
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem', background: 'var(--primary-light)', border: '1px solid var(--primary)' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          Consulta federada — <strong>Nodo 2 (Yair)</strong> y <strong>Nodo 3 (Zahid)</strong> vía tablas FEDERATED de MySQL.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Nuevo Préstamo Federado</h3>
        {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Sucursal</label>
            <select value={form.id_sucursal} onChange={e => setForm(f => ({ ...f, id_sucursal: e.target.value }))}>
              <option value="2">Yair (Nodo 2)</option>
              <option value="3">Zahid (Nodo 3)</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Libro</label>
            <select value={form.id_libro} onChange={e => setForm(f => ({ ...f, id_libro: e.target.value }))} required>
              <option value="">Seleccionar libro...</option>
              {libros.map(l => (
                <option key={l.id_libro} value={l.id_libro}>{l.titulo} — {l.autor}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Usuario ID</label>
            <input type="number" placeholder="ID del usuario" value={form.id_usuario}
              onChange={e => setForm(f => ({ ...f, id_usuario: e.target.value }))}
              style={{ width: '110px' }} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loadingForm}>
            {loadingForm ? 'Creando...' : 'Crear Préstamo'}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={`tab-btn ${filtro === 'todos' ? 'active' : ''}`}
            onClick={() => { setFiltro('todos'); cargar('todos') }}>Todos</button>
          <button className={`tab-btn ${filtro === '2' ? 'active' : ''}`}
            onClick={() => { setFiltro('2'); cargar('2') }}>Yair (Nodo 2)</button>
          <button className={`tab-btn ${filtro === '3' ? 'active' : ''}`}
            onClick={() => { setFiltro('3'); cargar('3') }}>Zahid (Nodo 3)</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, color: 'var(--primary)' }}>Resultados</h3>
        <button className="btn-secondary btn-sm" onClick={cargar} disabled={loading}>
          {loading ? 'Cargando...' : 'Refrescar'}
        </button>
        {!loading && (
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>
            Préstamos activos: <strong>{prestamos.length}</strong>
          </span>
        )}
      </div>

      {loading ? (
        <p className="loading-msg">Consultando préstamos en Tijuana y Ensenada...</p>
      ) : prestamos.length === 0 ? (
        <p className="empty-msg">Sin préstamos activos en Tijuana o Ensenada. Verifica que los nodos estén conectados.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Sucursal</th>
                <th>Usuario ID</th>
                <th>Libro</th>
                <th>Préstamo</th>
                <th>Dev. Esperada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prestamos.map(p => (
                <tr key={`fed-${p.id_prestamo}`}>
                  <td className="text-muted">{p.id_prestamo}</td>
                  <td>
                    <span className="badge badge-blue">{nodoNombre(p.id_sucursal)}</span>
                  </td>
                  <td className="text-muted">{p.id_usuario}</td>
                  <td style={{ fontWeight: 500 }}>{p.libro}</td>
                  <td className="text-muted">{formatDate(p.fecha_prestamo)}</td>
                  <td className="text-muted">{formatDate(p.fecha_devolucion_esperada)}</td>
                  <td>
                    <button className="btn-danger btn-sm" onClick={() => eliminar(p.id_prestamo, p.id_sucursal)}>
                      Eliminar
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
