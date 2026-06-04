import { useEffect, useState } from 'react'
import { get } from '../api/client'

export default function Dashboard() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    get('/sucursales/dashboard')
      .then(setBranches)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="loading-msg">Cargando datos...</p>
  if (error)   return <p className="empty-msg" style={{ color: 'var(--danger)' }}>Error: {error}</p>

  const totalLibros   = branches.reduce((s, b) => s + b.total_libros, 0)
  const totalActivos  = branches.reduce((s, b) => s + b.prestamos_activos, 0)
  const totalVencidos = branches.reduce((s, b) => s + b.prestamos_vencidos, 0)

  return (
    <div>
      <h1 className="page-title">Dashboard de Sucursales</h1>

      {/* Resumen global */}
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-value">{branches.length}</div>
          <div className="stat-label">Sucursales</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalLibros}</div>
          <div className="stat-label">Copias en Red</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{totalActivos}</div>
          <div className="stat-label">Préstamos Activos</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{totalVencidos}</div>
          <div className="stat-label">Préstamos Vencidos</div>
        </div>
      </div>

      {/* Grid de sucursales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
        {branches.map(b => (
          <div key={b.id_sucursal} className="card" style={{ borderTop: '4px solid var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>{b.nombre}</div>
                <div className="text-muted">{b.ciudad} · {b.responsable}</div>
                <div className="text-muted" style={{ fontSize: '0.8rem' }}>{b.direccion}</div>
              </div>
              <div style={{
                background: 'var(--primary)',
                color: 'white',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.95rem',
                flexShrink: 0,
              }}>
                {b.id_sucursal}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <MiniStat label="Copias" value={b.total_libros} color="var(--accent)" />
              <MiniStat label="Activos" value={b.prestamos_activos} color="var(--success)" />
              <MiniStat label="Vencidos" value={b.prestamos_vencidos} color={b.prestamos_vencidos > 0 ? 'var(--danger)' : 'var(--success)'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '0.5rem 0.7rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )
}
