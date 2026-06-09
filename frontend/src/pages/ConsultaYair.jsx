import { useEffect, useState } from 'react'
import { get, post, del } from '../api/client'

export default function ConsultaYair() {
  const [datos, setDatos]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [libros, setLibros]     = useState([])
  const [msg, setMsg]           = useState(null)
  const [form, setForm]         = useState({ id_usuario: '', id_libro: '' })
  const [saving, setSaving]     = useState(false)

  function cargar() {
    setLoading(true)
    get('/consultas/yair/prestamos-activos')
      .then(setDatos)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    Promise.all([
      cargar(),
      get('/usuarios'),
      get('/libros'),
    ]).then(([, u, l]) => {
      setUsuarios(u)
      setLibros(l)
    }).catch(() => {})
  }, [])

  function eliminar(id) {
    if (!window.confirm(`Eliminar prestamo #${id}?`)) return
    setMsg(null)
    del(`/consultas/yair/prestamos/${id}`)
      .then(() => {
        setMsg({ type: 'success', text: `Prestamo #${id} eliminado` })
        cargar()
      })
      .catch(e => setMsg({ type: 'error', text: e.message }))
  }

  function crearPrestamo(e) {
    e.preventDefault()
    if (!form.id_usuario || !form.id_libro) {
      setMsg({ type: 'error', text: 'Selecciona usuario y libro' })
      return
    }
    setSaving(true)
    setMsg(null)
    post('/consultas/yair/prestamos', {
      id_usuario: Number(form.id_usuario),
      id_libro:   Number(form.id_libro),
    })
      .then(p => {
        setMsg({ type: 'success', text: `Prestamo #${p.id_prestamo} creado en sucursal 4` })
        setForm({ id_usuario: '', id_libro: '' })
        cargar()
      })
      .catch(e => setMsg({ type: 'error', text: e.message }))
      .finally(() => setSaving(false))
  }

  function estatusBadge(estatus) {
    if (estatus === 'activo')  return <span className="badge badge-green">Activo</span>
    if (estatus === 'vencido') return <span className="badge badge-red">Vencido</span>
    return <span className="badge badge-gray">Devuelto</span>
  }

  return (
    <div>
      <h1 className="page-title">Consulta Yair — Nodo 2 (Tijuana)</h1>
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Nodo 2 (Tijuana) → Nodo 4 (Prestamo JOIN Libro, subconsulta) — Sucursal 4, Categoria 2 (Ciencias)
      </p>

      {msg && (
        <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
          {msg.text}
        </div>
      )}

      {error && <p className="empty-msg" style={{ color: 'var(--danger)' }}>{error}</p>}

      {loading ? (
        <p className="loading-msg">Consultando Nodo 4...</p>
      ) : (
        <>
          <p className="text-muted" style={{ marginBottom: '0.5rem' }}>
            {datos.length} prestamo(s) activo(s)
          </p>
          <div className="table-wrapper" style={{ marginBottom: '2rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Préstamo</th>
                  <th>Usuario</th>
                  <th>Libro</th>
                  <th>Fecha</th>
                  <th>Estatus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {datos.length === 0 ? (
                  <tr><td colSpan={6} className="text-muted">No hay prestamos activos</td></tr>
                ) : (
                  datos.map(p => (
                    <tr key={p.id_prestamo}>
                      <td>{p.id_prestamo}</td>
                      <td>{p.id_usuario}</td>
                      <td style={{ fontWeight: 500 }}>{p.libro}</td>
                      <td className="text-muted">{p.fecha_prestamo}</td>
                      <td>{estatusBadge(p.estatus)}</td>
                      <td>
                        <button className="btn-danger btn-sm" onClick={() => eliminar(p.id_prestamo)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="card" style={{ maxWidth: 600 }}>
        <h3 style={{ marginBottom: '1.2rem', color: 'var(--primary)' }}>Nuevo Préstamo en Sucursal 4</h3>
        <form onSubmit={crearPrestamo}>
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
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
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
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creando...' : 'Crear préstamo'}
          </button>
        </form>
      </div>
    </div>
  )
}
