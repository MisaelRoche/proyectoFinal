// backend/config/nodos.js
// Mapa de nodos distribuidos — Biblioteca BC
// Red VPN: Tailscale (100.x.x.x)
// IMPORTANTE: Cada nodo tiene su propia base de datos con nombre distinto

export const nodos = {
  1: { host: '100.127.191.53',  nombre: 'Mexicali Centro',     id_sucursal: 1, database: 'biblioteca_nodo1', user: 'biblioteca',       password: 'Biblioteca123!' },
  2: { host: '100.88.250.105',  nombre: 'Tijuana',              id_sucursal: 2, database: 'biblioteca_nodo2', user: 'bibliotecaNodo2',  password: 'nodo2.'         },
  3: { host: '100.121.240.118', nombre: 'Ensenada',             id_sucursal: 3, database: 'biblioteca_nodo3', user: 'bibliotecaNodo3',  password: 'nodo3.'         },
  4: { host: '100.67.56.91',    nombre: 'Mexicali Universidad', id_sucursal: 4, database: 'biblioteca_nodo4', user: 'biblioteca_nodo4', password: 'Biblioteca123!' },
  5: { host: '100.95.94.48',    nombre: 'Rosarito',             id_sucursal: 5, database: 'biblioteca_nodo5', user: 'bibliotecaNodo5',  password: 'nodo5.'         },
  6: { host: '100.114.254.124', nombre: 'Tecate',               id_sucursal: 6, database: 'biblioteca_nodo6', user: 'bibliotecaNodo6',  password: 'nodo6.'         },
}

// Parámetros comunes de conexión (solo puerto, BD es por nodo)
export const DB = { port: 3306 }

// El número de nodo de esta máquina — se configura en backend/.env
export const MI_NODO = Number(process.env.MI_NODO || 1)

// Nodos que almacenan los fragmentos verticales distribuidos de Usuario
export const NODO_PERFIL = 1   // UsuarioPerfil — identidad + ubicación
export const NODO_ACCESO = 4   // UsuarioAcceso — email + multas

// Dado un id_sucursal, devuelve el número de nodo que lo aloja.
// En este diseño: id_sucursal === id_nodo (relación 1:1).
export function nodoDeSucursal(idSucursal) {
  return Number(idSucursal)
}
