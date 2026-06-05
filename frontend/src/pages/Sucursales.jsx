import { useEffect, useState } from 'react'
import { get, put } from '../api/client'

export default function Sucursales() {
  const [sucursales, setSucursales] = useState([])
  const [loading, setLoading]       = useState(true)
  const [editando, setEditando]     = useState(null)   // sucursal en edición
  const [editForm, setEditForm]     = useState({})
  const [saving, setSaving]         = useState(false)
  const [editMsg, setEditMsg]       = useState(null)

  function cargar() {
    setLoading(true)
    get('/sucursales').then(setSucursales).finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  function iniciarEdicion(s) {
    setEditMsg(null)
    setEditForm({
      nombre:      s.nombre,
      direccion:   s.direccion   ?? '',
      ciudad:      s.ciudad      ?? '',
      telefono:    s.telefono    ?? '',
      responsable: s.responsable ?? '',
    })
    setEditando(s)
  }

  function guardar(e) {
    e.preventDefault()
    setSaving(true)
    setEditMsg(null)
    put(`/sucursales/${editando.id_sucursal}`, {
      nombre:      editForm.nombre,
      direccion:   editForm.direccion,
      ciudad:      editForm.ciudad,
      telefono:    editForm.telefono,
      responsable: editForm.responsable,
    })
      .then(r => {
        // r.resultados = [{ idNodo, nombre, ok, affectedRows?, error? }]
        const detalles = r.resultados
          .map(n => `${n.ok ? '✓' : '✗'} Nodo ${n.idNodo} (${n.nombre})`)
          .join('  ·  ')
        setEditMsg({ type: r.ok ? 'success' : 'warning', text: `Actualizado — ${detalles}` })
        setEditando(null)
        cargar()
      })
      .catch(err => setEditMsg({ type: 'error', text: err.message }))
      .finally(() => setSaving(false))
  }

  return (
    <div>
      <h1 className="page-title">Sucursales</h1>

      {/* <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
        Tabla <strong>replicada</strong> — al guardar, el cambio se propaga a los 6 nodos en paralelo.
        Los demás usuarios lo verán al recargar la página.
      </p> */}

      {editMsg && (
        <div
          className={`alert alert-${editMsg.type === 'success' ? 'success' : 'error'}`}
          style={{ marginBottom: '1rem' }}
        >
          {editMsg.text}
        </div>
      )}

      {/* Formulario de edición */}
      {editando && (
        <div className="card" style={{ maxWidth: 660, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--primary)', margin: 0 }}>
              Editar sucursal #{editando.id_sucursal}
            </h3>
            <button
              className="btn-secondary btn-sm"
              onClick={() => { setEditando(null); setEditMsg(null) }}
            >
              Cancelar
            </button>
          </div>
          <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
            El nombre se propagará a los 6 nodos (Nodos 1–6) en paralelo.
          </p>
          <form onSubmit={guardar}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Nombre *</label>
              <input
                value={editForm.nombre}
                onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Ciudad</label>
                <input
                  value={editForm.ciudad}
                  onChange={e => setEditForm(f => ({ ...f, ciudad: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input
                  value={editForm.telefono}
                  onChange={e => setEditForm(f => ({ ...f, telefono: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Dirección</label>
              <input
                value={editForm.direccion}
                onChange={e => setEditForm(f => ({ ...f, direccion: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Responsable</label>
              <input
                value={editForm.responsable}
                onChange={e => setEditForm(f => ({ ...f, responsable: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Propagando a los 6 nodos...' : 'Guardar cambios'}
            </button>
          </form>
        </div>
      )}

      {/* Tabla de sucursales */}
      {loading ? (
        <p className="loading-msg">Cargando sucursales...</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Ciudad</th>
                <th>Dirección</th>
                <th>Teléfono</th>
                <th>Responsable</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sucursales.map(s => (
                <tr key={s.id_sucursal}>
                  <td className="text-muted">{s.id_sucursal}</td>
                  <td style={{ fontWeight: 500 }}>{s.nombre}</td>
                  <td>{s.ciudad}</td>
                  <td className="text-muted">{s.direccion}</td>
                  <td>{s.telefono}</td>
                  <td>{s.responsable}</td>
                  <td>
                    <button className="btn-secondary btn-sm" onClick={() => iniciarEdicion(s)}>
                      Editar
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
