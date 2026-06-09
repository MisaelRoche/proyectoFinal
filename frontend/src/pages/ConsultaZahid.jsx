import { useEffect, useState } from 'react'
import { del, get, post } from '../api/client'

const emptyForm = {
  nombre: '',
  apellidos: '',
  telefono: '',
  direccion: '',
  email: '',
  id_sucursal_registro: '2',
  multas_acumuladas: '0',
}

export default function ConsultaZahid() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [msg, setMsg] = useState(null)

  function cargar() {
    setLoading(true)
    setError(null)
    get('/consulta-zahid/usuarios')
      .then(data => {
        setUsuarios(data.usuarios || [])
        if (data.errores?.length) {
          setError(`Consulta parcial: ${data.errores.map(e => `Nodo ${e.nodo}`).join(', ')} no respondió`)
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
  }, [])

  function onChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function crearUsuario(e) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      await post('/consulta-zahid/usuarios', {
        nombre: form.nombre,
        apellidos: form.apellidos,
        telefono: form.telefono,
        direccion: form.direccion,
        email: form.email,
        id_sucursal_registro: Number(form.id_sucursal_registro),
        multas_acumuladas: Number(form.multas_acumuladas || 0),
      })
      setForm(emptyForm)
      setMsg({ type: 'success', text: 'Usuario dado de alta correctamente.' })
      cargar()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  async function bajaUsuario(idUsuario) {
    const ok = window.confirm(`¿Dar de baja al usuario #${idUsuario}?`)
    if (!ok) return

    setDeletingId(idUsuario)
    setMsg(null)
    try {
      await del(`/consulta-zahid/usuarios/${idUsuario}`)
      setMsg({ type: 'success', text: `Usuario #${idUsuario} dado de baja correctamente.` })
      cargar()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <h1 className="page-title">Consulta Zahid</h1>
      <p className="text-muted" style={{ marginBottom: '1rem' }}>
        Join lógico entre <strong>UsuarioPerfil</strong> (Nodo 1) y <strong>UsuarioAcceso</strong> (Nodo 4) por <code>id_usuario</code>.
      </p>
      <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
        Join distribuido: Nodo 1 + Nodo 4. Filtro aplicado: <code>id_sucursal_registro = 2</code>.
      </p>

      {msg && (
        <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
          {msg.text}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem', borderTop: '4px solid var(--accent)' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Alta de usuario</h3>
        <form onSubmit={crearUsuario}>
          <div className="form-row">
            <div className="form-group">
              <label>Nombre</label>
              <input value={form.nombre} onChange={e => onChange('nombre', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Apellidos</label>
              <input value={form.apellidos} onChange={e => onChange('apellidos', e.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Teléfono</label>
              <input value={form.telefono} onChange={e => onChange('telefono', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => onChange('email', e.target.value)} required />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Dirección</label>
            <input value={form.direccion} onChange={e => onChange('direccion', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Sucursal registro</label>
              <input type="number" min="1" max="6" value={form.id_sucursal_registro} onChange={e => onChange('id_sucursal_registro', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Multas acumuladas</label>
              <input type="number" min="0" step="0.01" value={form.multas_acumuladas} onChange={e => onChange('multas_acumuladas', e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Dar de alta'}
          </button>
        </form>
      </div>

      {loading && <p className="loading-msg">Cargando usuarios distribuidos...</p>}
      {error && <p className="empty-msg" style={{ color: 'var(--danger)' }}>Aviso: {error}</p>}

      {!loading && (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <div className="stat-row" style={{ marginBottom: 0 }}>
            <div className="stat-card success">
              <div className="stat-value">{usuarios.length}</div>
              <div className="stat-label">Usuarios unidos</div>
            </div>
          </div>

          <JoinedUsersTable rows={usuarios} onDelete={bajaUsuario} deletingId={deletingId} />
        </div>
      )}
    </div>
  )
}

function JoinedUsersTable({ rows, onDelete, deletingId }) {
  return (
    <div className="card" style={{ borderTop: '4px solid var(--accent)' }}>
      <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Usuarios consolidados</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre completo</th>
              <th>Teléfono</th>
              <th>Dirección</th>
              <th>Sucursal registro</th>
              <th>Email</th>
              <th>Multas acumuladas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id_usuario}>
                <td>{s.id_usuario}</td>
                <td style={{ fontWeight: 600 }}>{s.nombre_completo}</td>
                <td>{s.telefono}</td>
                <td className="text-muted">{s.direccion}</td>
                <td>{s.id_sucursal_registro}</td>
                <td>{s.email}</td>
                <td>{Number(s.multas_acumuladas || 0).toFixed(2)}</td>
                <td>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => onDelete(s.id_usuario)}
                    disabled={deletingId === s.id_usuario}
                  >
                    {deletingId === s.id_usuario ? 'Eliminando...' : 'Baja'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
