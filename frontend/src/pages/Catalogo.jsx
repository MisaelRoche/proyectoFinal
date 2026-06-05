import { useEffect, useState } from 'react'
import { get, put } from '../api/client'

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

  return (
    <div>
      <h1 className="page-title">Catálogo de Libros</h1>

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
