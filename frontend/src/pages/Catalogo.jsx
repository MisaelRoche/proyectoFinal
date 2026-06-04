import { useEffect, useState } from 'react'
import { get } from '../api/client'

export default function Catalogo() {
  const [libros, setLibros]           = useState([])
  const [categorias, setCategorias]   = useState([])
  const [filtros, setFiltros]         = useState({ titulo: '', autor: '', id_categoria: '' })
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)
  const [disponibilidad, setDisp]     = useState([])
  const [loadingDisp, setLoadingDisp] = useState(false)

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
            <button className="btn-secondary btn-sm" onClick={() => setSelected(null)}>Cerrar</button>
          </div>
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
                  </tr>
                </thead>
                <tbody>
                  {disponibilidad.map(d => (
                    <tr key={d.id_sucursal}>
                      <td>{d.sucursal}</td>
                      <td>{d.ciudad}</td>
                      <td>
                        <span className={`badge ${d.copias_disponibles > 0 ? 'badge-green' : 'badge-red'}`}>
                          {d.copias_disponibles}
                        </span>
                      </td>
                      <td>{d.copias_totales}</td>
                      <td className="text-muted">{d.ubicacion_fisica}</td>
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
