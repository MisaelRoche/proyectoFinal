import { useEffect, useState } from 'react'
import { get, put, del } from '../api/client'

export default function Catalogo() {
  const [libros, setLibros]           = useState([])
  const [categorias, setCategorias]   = useState([])
  const [filtros, setFiltros]         = useState({ titulo: '', autor: '', id_categoria: '' })
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)
  const [disponibilidad, setDisp]     = useState([])
  const [loadingDisp, setLoadingDisp] = useState(false)
  const [editandoInv, setEditandoInv] = useState(null)   // { id_sucursal, copias_totales, copias_disponibles, ubicacion_fisica }
  const [savingInv, setSavingInv]     = useState(false)
  const [invMsg, setInvMsg]           = useState(null)
  const [showForm, setShowForm]       = useState(false)
  const [formMsg, setFormMsg]         = useState(null)
  const [saving, setSaving]           = useState(false)
  const [nuevoLibro, setNuevoLibro]   = useState({
    titulo: '', autor: '', editorial: '', anio: '',
    id_categoria: '', paginas: '', idioma: 'Español',
    isbn: '', costo: '', proveedor: '', fecha_adquisicion: '',
    copias_totales: '3', copias_disponibles: '3', ubicacion_fisica: '',
  })

  useEffect(() => {
    Promise.all([
      get('/libros'),
      get('/libros/categorias'),
    ]).then(([l, c]) => {
      setLibros(l)
      setCategorias(c)
    }).finally(() => setLoading(false))
  }, [])

  function buscar() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtros.titulo)       params.set('titulo', filtros.titulo)
    if (filtros.autor)        params.set('autor', filtros.autor)
    if (filtros.id_categoria) params.set('id_categoria', filtros.id_categoria)
    get(`/libros?${params}`)
      .then(setLibros)
      .finally(() => setLoading(false))
  }

  function verDisponibilidad(libro) {
    setSelected(libro)
    setLoadingDisp(true)
    get(`/libros/${libro.id_libro}/disponibilidad`)
      .then(setDisp)
      .finally(() => setLoadingDisp(false))
  }

  function limpiar() {
    setFiltros({ titulo: '', autor: '', id_categoria: '' })
    setLoading(true)
    get('/libros').then(setLibros).finally(() => setLoading(false))
  }

  function iniciarEdicionInv(d) {
    setInvMsg(null)
    setEditandoInv({
      id_sucursal:        d.id_sucursal,
      copias_totales:     d.copias_totales,
      copias_disponibles: d.copias_disponibles,
      ubicacion_fisica:   d.ubicacion_fisica ?? '',
    })
  }

  function guardarInv() {
    if (!editandoInv || !selected) return
    setSavingInv(true)
    setInvMsg(null)
    put(`/libros/${selected.id_libro}/inventario/${editandoInv.id_sucursal}`, {
      copias_totales:     Number(editandoInv.copias_totales),
      copias_disponibles: Number(editandoInv.copias_disponibles),
      ubicacion_fisica:   editandoInv.ubicacion_fisica,
    })
      .then(r => {
        setInvMsg({ type: 'success', text: `Inventario actualizado en Nodo ${r.id_nodo} (sucursal ${r.id_sucursal})` })
        setEditandoInv(null)
        verDisponibilidad(selected)   // recargar datos del panel
      })
      .catch(e => setInvMsg({ type: 'error', text: e.message }))
      .finally(() => setSavingInv(false))
  }

  function crearLibro(e) {
    e.preventDefault()
    setSaving(true)
    setFormMsg(null)
    post('/libros', {
      titulo: nuevoLibro.titulo,
      autor: nuevoLibro.autor || null,
      editorial: nuevoLibro.editorial || null,
      anio: nuevoLibro.anio ? Number(nuevoLibro.anio) : null,
      id_categoria: Number(nuevoLibro.id_categoria),
      paginas: nuevoLibro.paginas ? Number(nuevoLibro.paginas) : null,
      idioma: nuevoLibro.idioma || null,
      isbn: nuevoLibro.isbn || null,
      costo: nuevoLibro.costo ? Number(nuevoLibro.costo) : null,
      proveedor: nuevoLibro.proveedor || null,
      fecha_adquisicion: nuevoLibro.fecha_adquisicion || null,
      copias_totales: Number(nuevoLibro.copias_totales) || 0,
      copias_disponibles: Number(nuevoLibro.copias_disponibles) || 0,
      ubicacion_fisica: nuevoLibro.ubicacion_fisica || null,
    })
      .then(r => {
        setFormMsg({ type: 'success', text: `Libro #${r.id_libro} creado en ${r.nodos_ok}/${r.nodos_total} nodos` })
        setShowForm(false)
        setNuevoLibro({ titulo: '', autor: '', editorial: '', anio: '', id_categoria: '', paginas: '', idioma: 'Español', isbn: '', costo: '', proveedor: '', fecha_adquisicion: '', copias_totales: '3', copias_disponibles: '3', ubicacion_fisica: '' })
        setLoading(true)
        get('/libros').then(setLibros).finally(() => setLoading(false))
      })
      .catch(e => setFormMsg({ type: 'error', text: e.message }))
      .finally(() => setSaving(false))
  }

  function eliminarLibro(libro) {
    if (!window.confirm(`¿Eliminar "${libro.titulo}" de todas las sucursales?\n\nEsta acción no se puede deshacer.`)) return
    setFormMsg(null)
    del(`/libros/${libro.id_libro}`)
      .then(() => {
        setFormMsg({ type: 'success', text: `Libro "${libro.titulo}" eliminado de todas las sucursales` })
        setLoading(true)
        get('/libros').then(setLibros).finally(() => setLoading(false))
      })
      .catch(e => setFormMsg({ type: 'error', text: e.message }))
  }

  return (
    <div>
      <h1 className="page-title">Catálogo de Libros</h1>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setFormMsg(null) }}>
          {showForm ? 'Cancelar' : '+ Nuevo Libro'}
        </button>
      </div>

      {formMsg && (
        <div className={`alert alert-${formMsg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
          {formMsg.text}
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Registrar Nuevo Libro</h3>
          <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
            Se replicará en los 6 nodos. Inventario inicial solo en Nodo 5 (Rosarito).
          </p>
          <form onSubmit={crearLibro}>
            <div className="form-row">
              <div className="form-group">
                <label>Título *</label>
                <input value={nuevoLibro.titulo} onChange={e => setNuevoLibro(f => ({ ...f, titulo: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Autor</label>
                <input value={nuevoLibro.autor} onChange={e => setNuevoLibro(f => ({ ...f, autor: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Editorial</label>
                <input value={nuevoLibro.editorial} onChange={e => setNuevoLibro(f => ({ ...f, editorial: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Año</label>
                <input type="number" value={nuevoLibro.anio} onChange={e => setNuevoLibro(f => ({ ...f, anio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Categoría *</label>
                <select value={nuevoLibro.id_categoria} onChange={e => setNuevoLibro(f => ({ ...f, id_categoria: e.target.value }))} required>
                  <option value="">Seleccionar...</option>
                  {categorias.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>ISBN</label>
                <input value={nuevoLibro.isbn} onChange={e => setNuevoLibro(f => ({ ...f, isbn: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Páginas</label>
                <input type="number" value={nuevoLibro.paginas} onChange={e => setNuevoLibro(f => ({ ...f, paginas: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Idioma</label>
                <input value={nuevoLibro.idioma} onChange={e => setNuevoLibro(f => ({ ...f, idioma: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Costo ($)</label>
                <input type="number" min="0" step="0.01" value={nuevoLibro.costo} onChange={e => setNuevoLibro(f => ({ ...f, costo: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Proveedor</label>
                <input value={nuevoLibro.proveedor} onChange={e => setNuevoLibro(f => ({ ...f, proveedor: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Fecha adquisición</label>
                <input type="date" value={nuevoLibro.fecha_adquisicion} onChange={e => setNuevoLibro(f => ({ ...f, fecha_adquisicion: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Copias totales</label>
                <input type="number" min="0" value={nuevoLibro.copias_totales} onChange={e => setNuevoLibro(f => ({ ...f, copias_totales: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Copias disponibles</label>
                <input type="number" min="0" value={nuevoLibro.copias_disponibles} onChange={e => setNuevoLibro(f => ({ ...f, copias_disponibles: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Ubicación física</label>
                <input value={nuevoLibro.ubicacion_fisica} onChange={e => setNuevoLibro(f => ({ ...f, ubicacion_fisica: e.target.value }))} placeholder="Ej: Estante D, Nivel 2" />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Creando en los 6 nodos...' : 'Crear Libro'}
            </button>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label>Título</label>
            <input
              value={filtros.titulo}
              onChange={e => setFiltros(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Buscar por título..."
              onKeyDown={e => e.key === 'Enter' && buscar()}
            />
          </div>
          <div className="form-group">
            <label>Autor</label>
            <input
              value={filtros.autor}
              onChange={e => setFiltros(f => ({ ...f, autor: e.target.value }))}
              placeholder="Buscar por autor..."
              onKeyDown={e => e.key === 'Enter' && buscar()}
            />
          </div>
          <div className="form-group">
            <label>Categoría</label>
            <select
              value={filtros.id_categoria}
              onChange={e => setFiltros(f => ({ ...f, id_categoria: e.target.value }))}
            >
              <option value="">Todas</option>
              {categorias.map(c => (
                <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={buscar}>Buscar</button>
            <button className="btn-secondary" onClick={limpiar}>Limpiar</button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="loading-msg">Cargando libros...</p>
      ) : libros.length === 0 ? (
        <p className="empty-msg">No se encontraron libros.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Título</th>
                <th>Autor</th>
                <th>Editorial</th>
                <th>Año</th>
                <th>Categoría</th>
                <th>Páginas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {libros.map(l => (
                <tr key={l.id_libro} style={{ cursor: 'pointer' }}>
                  <td className="text-muted">{l.id_libro}</td>
                  <td style={{ fontWeight: 500 }}>{l.titulo}</td>
                  <td>{l.autor}</td>
                  <td>{l.editorial}</td>
                  <td>{l.anio}</td>
                  <td><span className="badge badge-gray">{l.categoria}</span></td>
                  <td>{l.paginas}</td>
                  <td>
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => verDisponibilidad(l)}
                    >
                      Disponibilidad
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => eliminarLibro(l)}
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

      {/* Panel de disponibilidad */}
      {selected && (
        <div className="side-panel">
          <div className="panel-header">
            <h3>Disponibilidad: {selected.titulo}</h3>
            <button className="btn-secondary btn-sm" onClick={() => { setSelected(null); setEditandoInv(null); setInvMsg(null) }}>Cerrar</button>
          </div>
          {invMsg && (
            <div className={`alert alert-${invMsg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '0.75rem' }}>
              {invMsg.text}
            </div>
          )}
          {loadingDisp ? (
            <p className="loading-msg">Cargando...</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Sucursal</th>
                    <th>Ciudad</th>
                    <th>Disponibles</th>
                    <th>Total</th>
                    <th>Ubicación</th>
                <th></th>
                <th></th>
                  </tr>
                </thead>
                <tbody>
                  {disponibilidad.map(d => {
                    const editando = editandoInv?.id_sucursal === d.id_sucursal
                    return (
                      <tr key={d.id_sucursal}>
                        <td>{d.sucursal}</td>
                        <td>{d.ciudad}</td>
                        <td>
                          {editando ? (
                            <input
                              type="number" min="0"
                              value={editandoInv.copias_disponibles}
                              onChange={e => setEditandoInv(v => ({ ...v, copias_disponibles: e.target.value }))}
                              style={{ width: 60 }}
                            />
                          ) : (
                            <span className={`badge ${d.copias_disponibles > 0 ? 'badge-green' : 'badge-red'}`}>
                              {d.copias_disponibles}
                            </span>
                          )}
                        </td>
                        <td>
                          {editando ? (
                            <input
                              type="number" min="0"
                              value={editandoInv.copias_totales}
                              onChange={e => setEditandoInv(v => ({ ...v, copias_totales: e.target.value }))}
                              style={{ width: 60 }}
                            />
                          ) : d.copias_totales}
                        </td>
                        <td>
                          {editando ? (
                            <input
                              type="text"
                              value={editandoInv.ubicacion_fisica}
                              onChange={e => setEditandoInv(v => ({ ...v, ubicacion_fisica: e.target.value }))}
                              style={{ width: 100 }}
                            />
                          ) : (
                            <span className="text-muted">{d.ubicacion_fisica}</span>
                          )}
                        </td>
                        <td>
                          {editando ? (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button className="btn-success btn-sm" onClick={guardarInv} disabled={savingInv}>
                                {savingInv ? '...' : 'Guardar'}
                              </button>
                              <button className="btn-secondary btn-sm" onClick={() => { setEditandoInv(null); setInvMsg(null) }}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button className="btn-primary btn-sm" onClick={() => iniciarEdicionInv(d)}>
                              Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
