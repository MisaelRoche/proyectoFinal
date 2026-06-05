import { useEffect, useState } from 'react'
import { get, put } from '../api/client'

export default function Usuarios() {
  const [usuarios, setUsuarios]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(null)
  const [prestamos, setPrestamos]       = useState([])
  const [loadingPrest, setLoadingPrest] = useState(false)
  const [editando, setEditando]         = useState(null)   // usuario en edición
  const [editForm, setEditForm]         = useState({})
  const [saving, setSaving]             = useState(false)
  const [editMsg, setEditMsg]           = useState(null)

  useEffect(() => {
    get('/usuarios').then(setUsuarios).finally(() => setLoading(false))
  }, [])

  function verUsuario(u) {
    setEditando(null)
    setEditMsg(null)
    setSelected(u)
    setLoadingPrest(true)
    get(`/usuarios/${u.id_usuario}/prestamos`)
      .then(setPrestamos)
      .finally(() => setLoadingPrest(false))
  }

  function iniciarEdicion(u) {
    setSelected(null)
    setEditMsg(null)
    setEditForm({
      nombre:             u.nombre,
      apellidos:          u.apellidos,
      telefono:           u.telefono ?? '',
      direccion:          u.direccion ?? '',
      email:              u.email ?? '',
      multas_acumuladas:  u.multas_acumuladas ?? 0,
    })
    setEditando(u)
  }

  function guardarUsuario(e) {
    e.preventDefault()
    setSaving(true)
    setEditMsg(null)
    put(`/usuarios/${editando.id_usuario}`, {
      nombre:             editForm.nombre,
      apellidos:          editForm.apellidos,
      telefono:           editForm.telefono,
      direccion:          editForm.direccion,
      email:              editForm.email,
      multas_acumuladas:  Number(editForm.multas_acumuladas),
    })
      .then(r => {
        const detalles = [
          r.perfil_actualizado ? '✓ Perfil (Nodo 1)' : '✗ Perfil (Nodo 1 sin respuesta)',
          r.acceso_actualizado ? '✓ Acceso (Nodo 4)' : '✗ Acceso (Nodo 4 sin respuesta)',
        ].join('  ·  ')
        setEditMsg({ type: 'success', text: `Usuario actualizado — ${detalles}` })
        setEditando(null)
        // Recargar lista de usuarios con los datos frescos
        setLoading(true)
        get('/usuarios').then(setUsuarios).finally(() => setLoading(false))
      })
      .catch(e => setEditMsg({ type: 'error', text: e.message }))
      .finally(() => setSaving(false))
  }

  function formatDate(iso) {
    if (!iso) return '—'
    return iso.split('T')[0]
  }

  function estatusBadge(estatus) {
    if (estatus === 'activo')   return <span className="badge badge-green">Activo</span>
    if (estatus === 'vencido')  return <span className="badge badge-red">Vencido</span>
    return <span className="badge badge-gray">Devuelto</span>
  }

  return (
    <div>
      <h1 className="page-title">Usuarios</h1>

      {editMsg && (
        <div className={`alert alert-${editMsg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
          {editMsg.text}
        </div>
      )}

      {/* Formulario de edición de usuario */}
      {editando && (
        <div className="card" style={{ maxWidth: 620, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--primary)', margin: 0 }}>
              Editar usuario #{editando.id_usuario} — {editando.nombre} {editando.apellidos}
            </h3>
            <button className="btn-secondary btn-sm" onClick={() => { setEditando(null); setEditMsg(null) }}>Cancelar</button>
          </div>
          <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
            Perfil → Nodo 1 (Mexicali Centro) &nbsp;·&nbsp; Acceso → Nodo 4 (Mexicali Universidad)
          </p>
          <form onSubmit={guardarUsuario}>
            <div className="form-row">
              <div className="form-group">
                <label>Nombre</label>
                <input value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Apellidos</label>
                <input value={editForm.apellidos} onChange={e => setEditForm(f => ({ ...f, apellidos: e.target.value }))} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Teléfono</label>
                <input value={editForm.telefono} onChange={e => setEditForm(f => ({ ...f, telefono: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Dirección</label>
              <input value={editForm.direccion} onChange={e => setEditForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Multas acumuladas ($)</label>
              <input type="number" min="0" step="0.01" value={editForm.multas_acumuladas}
                onChange={e => setEditForm(f => ({ ...f, multas_acumuladas: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando en los nodos...' : 'Guardar cambios'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p className="loading-msg">Cargando usuarios...</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Sucursal</th>
                <th>Registro</th>
                <th>Multas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id_usuario}>
                  <td className="text-muted">{u.id_usuario}</td>
                  <td style={{ fontWeight: 500 }}>{u.nombre} {u.apellidos}</td>
                  <td className="text-muted">{u.email}</td>
                  <td>{u.telefono}</td>
                  <td>{u.sucursal_nombre}</td>
                  <td className="text-muted">{formatDate(u.fecha_registro)}</td>
                  <td>
                    {u.multas_acumuladas > 0
                      ? <span className="text-danger">${Number(u.multas_acumuladas).toFixed(2)}</span>
                      : <span className="text-muted">$0.00</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn-primary btn-sm" onClick={() => verUsuario(u)}>
                        Ver préstamos
                      </button>
                      <button className="btn-secondary btn-sm" onClick={() => iniciarEdicion(u)}>
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Panel de préstamos del usuario */}
      {selected && (
        <div className="side-panel">
          <div className="panel-header">
            <h3>Préstamos de {selected.nombre} {selected.apellidos}</h3>
            <button className="btn-secondary btn-sm" onClick={() => setSelected(null)}>Cerrar</button>
          </div>
          <div style={{ marginBottom: '0.75rem' }} className="text-muted">
            {selected.email} · {selected.sucursal_nombre}
            {selected.multas_acumuladas > 0 &&
              <span style={{ marginLeft: '1rem' }} className="text-danger">
                Multas acumuladas: ${Number(selected.multas_acumuladas).toFixed(2)}
              </span>
            }
          </div>
          {loadingPrest ? (
            <p className="loading-msg">Cargando...</p>
          ) : prestamos.length === 0 ? (
            <p className="empty-msg">Sin préstamos registrados.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Libro</th>
                    <th>Sucursal</th>
                    <th>Préstamo</th>
                    <th>Devolución esp.</th>
                    <th>Devuelto</th>
                    <th>Estatus</th>
                    <th>Multa</th>
                  </tr>
                </thead>
                <tbody>
                  {prestamos.map(p => (
                    <tr key={p.id_prestamo}>
                      <td className="text-muted">{p.id_prestamo}</td>
                      <td style={{ fontWeight: 500 }}>{p.libro_titulo}</td>
                      <td>{p.sucursal_nombre}</td>
                      <td className="text-muted">{p.fecha_prestamo}</td>
                      <td className="text-muted">{p.fecha_devolucion_esperada}</td>
                      <td className="text-muted">{p.fecha_devolucion_real ?? '—'}</td>
                      <td>{estatusBadge(p.estatus)}</td>
                      <td>{p.multa > 0 ? <span className="text-danger">${p.multa}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
