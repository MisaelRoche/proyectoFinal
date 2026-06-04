import { useEffect, useState } from 'react'
import { get } from '../api/client'

export default function Usuarios() {
  const [usuarios, setUsuarios]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(null)
  const [prestamos, setPrestamos]       = useState([])
  const [loadingPrest, setLoadingPrest] = useState(false)

  useEffect(() => {
    get('/usuarios').then(setUsuarios).finally(() => setLoading(false))
  }, [])

  function verUsuario(u) {
    setSelected(u)
    setLoadingPrest(true)
    get(`/usuarios/${u.id_usuario}/prestamos`)
      .then(setPrestamos)
      .finally(() => setLoadingPrest(false))
  }

  function estatusBadge(estatus) {
    if (estatus === 'activo')   return <span className="badge badge-green">Activo</span>
    if (estatus === 'vencido')  return <span className="badge badge-red">Vencido</span>
    return <span className="badge badge-gray">Devuelto</span>
  }

  return (
    <div>
      <h1 className="page-title">Usuarios</h1>

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
                  <td className="text-muted">{u.fecha_registro}</td>
                  <td>
                    {u.multas_acumuladas > 0
                      ? <span className="text-danger">${u.multas_acumuladas.toFixed(2)}</span>
                      : <span className="text-muted">$0.00</span>
                    }
                  </td>
                  <td>
                    <button className="btn-primary btn-sm" onClick={() => verUsuario(u)}>
                      Ver préstamos
                    </button>
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
                Multas acumuladas: ${selected.multas_acumuladas.toFixed(2)}
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
