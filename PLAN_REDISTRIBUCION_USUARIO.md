# Redistribución de `Usuario` — Fragmentación Vertical Distribuida en 2 Nodos

> **Propósito:** Mover las tablas `UsuarioPerfil` y `UsuarioAcceso` fuera de la fragmentación horizontal por sucursal (`id_sucursal_registro = N`). En su lugar, concentrar todos los usuarios en 2 nodos: **Nodo 1** (`UsuarioPerfil`) y **Nodo 4** (`UsuarioAcceso`). Cada consulta a la red decide inteligentemente a qué nodo ir según el fragmento que necesita.
>
> **Cambio de arquitectura:**
> ```
> ANTES:  6 nodos, cada uno con Perfil+Acceso de sus 2 usuarios locales
> AHORA:  2 nodos concentran TODOS los usuarios.
>         Nodo 1 → UsuarioPerfil (10 usuarios)
>         Nodo 4 → UsuarioAcceso  (10 usuarios)
>         Nodos 2,3,5,6 → SIN tablas de usuario
> ```
>
> Generado: 2026-06-03

---

## 1. Arquitectura Objetivo

```
┌──────────────────────────────────┐   ┌──────────────────────────────────┐
│         NODO 1                    │   │         NODO 4                    │
│  Mexicali Centro                  │   │  Mexicali Universidad             │
│  100.127.191.53                   │   │  100.67.56.91                      │
│                                   │   │                                    │
│  ┌──────────────────────────────┐ │   │  ┌──────────────────────────────┐ │
│  │ UsuarioPerfil (10 usuarios)  │ │   │  │ UsuarioAcceso (10 usuarios)  │ │
│  │ ┌────┬──────────┬──────────┐ │ │   │  │ ┌────┬──────────┬───────┐   │ │
│  │ │ id │ nombre   │ sucursal │ │ │   │  │ │ id │ email    │multas │   │ │
│  │ ├────┼──────────┼──────────┤ │ │   │  │ ├────┼──────────┼───────┤   │ │
│  │ │ 1  │ María    │    1     │ │ │   │  │ │ 1  │mgo...@.. │ 0.00  │   │ │
│  │ │ 2  │ Carlos   │    2     │ │ │   │  │ │ 2  │cra...@.. │ 25.00 │   │ │
│  │ │ 3  │ Fernanda │    3     │ │ │   │  │ │ 3  │fto...@.. │ 0.00  │   │ │
│  │ │ 4  │ Luis     │    4     │ │ │   │  │ │ 4  │lmo...@.. │ 50.00 │   │ │
│  │ │ 5  │ Ana      │    5     │ │ │   │  │ │ 5  │aca...@.. │ 0.00  │   │ │
│  │ │ 6  │ Roberto  │    6     │ │ │   │  │ │ 6  │rsa...@.. │ 0.00  │   │ │
│  │ │ 7  │ Laura    │    1     │ │ │   │  │ │ 7  │ldi...@.. │ 75.00 │   │ │
│  │ │ 8  │ Miguel   │    2     │ │ │   │  │ │ 8  │mre...@.. │ 0.00  │   │ │
│  │ │ 9  │ Paola    │    4     │ │ │   │  │ │ 9  │pfl...@.. │ 0.00  │   │ │
│  │ │ 10 │ Diego    │    3     │ │ │   │  │ │ 10 │dva...@.. │ 0.00  │   │ │
│  │ └────┴──────────┴──────────┘ │ │   │  │ └────┴──────────┴───────┘   │ │
│  │ + FK a Sucursal              │ │   │  │ SOLO PK (sin FK a Perfil)    │ │
│  │ + Sin CHECK por sucursal     │ │   │  └──────────────────────────────┘ │
│  └──────────────────────────────┘ │   │                                    │
│                                   │   │  + LibroAdmin (ya existente)        │
│  + Prestamo suc=1                │   │  + Prestamo suc=4                   │
│  + Inventario suc=1              │   │  + Inventario suc=4                  │
└──────────────────────────────────┘   └──────────────────────────────────┘

┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   NODO 2    │  │   NODO 3    │  │   NODO 5    │  │   NODO 6    │
│  Tijuana    │  │  Ensenada   │  │  Rosarito   │  │   Tecate    │
│             │  │             │  │             │  │             │
│ SIN tablas  │  │ SIN tablas  │  │ SIN tablas  │  │ SIN tablas  │
│ de Usuario  │  │ de Usuario  │  │ de Usuario  │  │ de Usuario  │
│             │  │             │  │             │  │             │
│ + Prestamo  │  │ + Prestamo  │  │ + Prestamo  │  │ + Prestamo  │
│ + Inventario│  │ + Inventario│  │ + Inventario│  │ + Inventario│
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

### Flujo de consultas por operación

```
                   ┌───────────────────────────────────┐
                   │ ¿Qué necesita el nodo consultante? │
                   └───────────────┬───────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
   │ Solo perfil  │        │ Solo acceso  │        │ Perfil+Acceso│
   │ (existencia) │        │ (update multa)│        │ (usuario     │
   │              │        │               │        │  completo)  │
   └──────┬───────┘        └──────┬────────┘        └──────┬───────┘
          │                       │                        │
          ▼                       ▼                        ▼
   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
   │   NODO 1     │        │   NODO 4     │        │ NODO 1 + 4   │
   │ UsuarioPerfil│        │ UsuarioAcceso│        │ (paralelo,   │
   │              │        │              │        │  merge JS)   │
   └──────────────┘        └──────────────┘        └──────────────┘
```

### Mapeo operación → nodos

| Operación | Endpoint | Nodo 1 (Perfil) | Nodo 4 (Acceso) | Merge JS |
|-----------|----------|:---:|:---:|:---:|
| Listar usuarios | `GET /api/usuarios` | ✅ JOIN Sucursal | ✅ | Por id_usuario |
| Buscar por ID | `GET /api/usuarios/:id` | ✅ | ✅ | Spread |
| Verificar existencia (Q5) | `GET /api/usuarios/:id/prestamos` | ✅ | ❌ | — |
| Actualizar multa (Q4) | `PUT /api/prestamos/:id/devolver` | ❌ | ✅ | — |
| Crear préstamo (validar) | `POST /api/prestamos` | ✅ | ✅ | Spread |

---

## 2. SQL — Nuevos scripts

### 2.1 `sql/usuarios_nodo1_perfil.sql`

**Ejecutar SOLO en Nodo 1**, después de `nodo1.sql`. Contiene los 10 usuarios de toda la red.

```sql
-- =============================================================
-- NODO 1 — Fragmento Vertical: UsuarioPerfil (TODOS los usuarios)
-- Ejecutar SOLO en Nodo 1 (Mexicali Centro, 100.127.191.53)
-- Después de 00_base_todos_los_nodos.sql
-- =============================================================

USE biblioteca_nodo1;

-- Eliminar tablas anteriores si existen (migración desde esquema viejo)
DROP TABLE IF EXISTS UsuarioAcceso;
DROP TABLE IF EXISTS UsuarioPerfil;

-- UsuarioPerfil: identidad + ubicación (SIN CHECK por sucursal)
CREATE TABLE IF NOT EXISTS UsuarioPerfil (
  id_usuario           INT          PRIMARY KEY AUTO_INCREMENT,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL,
  fecha_registro       DATE,
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

-- Los 10 usuarios de toda la red
INSERT INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro) VALUES
  ( 1, 'María',    'González Herrera',  '686-111-0001', 'Calle 1a #100, Mexicali',       1, '2023-01-15'),
  ( 2, 'Carlos',   'Ramírez López',     '664-111-0002', 'Av. Revolución #200, Tijuana',  2, '2023-03-22'),
  ( 3, 'Fernanda', 'Torres Ávila',      '646-111-0003', 'Calle 2a #300, Ensenada',        3, '2023-05-10'),
  ( 4, 'Luis',     'Morales Fuentes',   '686-111-0004', 'Blvd. UABC #400, Mexicali',      4, '2023-06-01'),
  ( 5, 'Ana',      'Castillo Vega',     '661-111-0005', 'Calle 3a #500, Rosarito',        5, '2023-07-14'),
  ( 6, 'Roberto',  'Sánchez Mendoza',   '665-111-0006', 'Av. Juárez #600, Tecate',        6, '2023-08-30'),
  ( 7, 'Laura',    'Díaz Contreras',    '686-111-0007', 'Calle 4a #700, Mexicali',        1, '2023-09-05'),
  ( 8, 'Miguel',   'Reyes Espinoza',    '664-111-0008', 'Blvd. Díaz Ordaz #800, Tijuana', 2, '2023-10-18'),
  ( 9, 'Paola',    'Flores Gutiérrez',  '686-111-0009', 'Calzada UABC #900, Mexicali',    4, '2024-01-07'),
  (10, 'Diego',    'Vargas Ontiveros',  '646-111-0010', 'Calle 5a #1000, Ensenada',       3, '2024-02-20');

ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;
```

### 2.2 `sql/usuarios_nodo4_acceso.sql`

**Ejecutar SOLO en Nodo 4**, después de `nodo4.sql`.

```sql
-- =============================================================
-- NODO 4 — Fragmento Vertical: UsuarioAcceso (TODOS los usuarios)
-- Ejecutar SOLO en Nodo 4 (Mexicali Universidad, 100.67.56.91)
-- Después de 00_base_todos_los_nodos.sql
-- =============================================================

USE biblioteca_nodo4;

-- Eliminar tablas anteriores si existen (migración desde esquema viejo)
DROP TABLE IF EXISTS UsuarioAcceso;
DROP TABLE IF EXISTS UsuarioPerfil;

-- UsuarioAcceso: email + multas — cluster de alto acceso
-- NOTA: NO tiene FK a UsuarioPerfil porque está en otro nodo.
--       La integridad se garantiza a nivel de aplicación.
CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00
);

-- Los 10 usuarios de toda la red
INSERT INTO UsuarioAcceso (id_usuario, email, multas_acumuladas) VALUES
  ( 1, 'mgonzalez@email.com',   0.00),
  ( 2, 'cramirez@email.com',   25.00),
  ( 3, 'ftorres@email.com',     0.00),
  ( 4, 'lmorales@email.com',   50.00),
  ( 5, 'acastillo@email.com',   0.00),
  ( 6, 'rsanchez@email.com',    0.00),
  ( 7, 'ldiaz@email.com',      75.00),
  ( 8, 'mreyes@email.com',      0.00),
  ( 9, 'pflores@email.com',     0.00),
  (10, 'dvargas@email.com',     0.00);
```

### 2.3 `sql/remove_usuarios_otros_nodos.sql`

**Ejecutar en Nodos 2, 3, 5, 6.** Elimina las tablas de usuario que ya no deben existir.

```sql
-- =============================================================
-- LIMPIEZA — Eliminar tablas de Usuario de este nodo
-- Ejecutar en Nodos 2, 3, 5 y 6
-- Los usuarios ahora viven en Nodo 1 (Perfil) y Nodo 4 (Acceso)
-- =============================================================

-- Ajustar USE según el nodo:
-- Nodo 2: USE biblioteca_nodo2;
-- Nodo 3: USE biblioteca_nodo3;
-- Nodo 5: USE biblioteca_nodo5;
-- Nodo 6: USE biblioteca_nodo6;

DROP TABLE IF EXISTS UsuarioAcceso;
DROP TABLE IF EXISTS UsuarioPerfil;

-- Verificación: no debe mostrar tablas de Usuario
SHOW TABLES LIKE 'Usuario%';
```

---

## 3. SQL — Actualización de scripts de nodo

### 3.1 `sql/nodo1.sql` — REEMPLAZAR sección Usuario (líneas 77-113)

Reemplazar todo el bloque desde `-- FRAGMENTACIÓN VERTICAL de Usuario` hasta antes de `-- FRAGMENTO HORIZONTAL: Inventario`:

```sql
-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO VERTICAL DISTRIBUIDO: UsuarioPerfil (TODOS los usuarios)
-- Nodo 1 almacena el fragmento Perfil de los 10 usuarios.
-- El fragmento Acceso (email + multas) está en Nodo 4.
-- Reconstrucción: app-side merge {Perfil Nodo1} + {Acceso Nodo4}
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS UsuarioPerfil (
  id_usuario           INT          PRIMARY KEY AUTO_INCREMENT,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL,
  fecha_registro       DATE,
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

INSERT INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro) VALUES
  ( 1, 'María',    'González Herrera',  '686-111-0001', 'Calle 1a #100, Mexicali',       1, '2023-01-15'),
  ( 2, 'Carlos',   'Ramírez López',     '664-111-0002', 'Av. Revolución #200, Tijuana',  2, '2023-03-22'),
  ( 3, 'Fernanda', 'Torres Ávila',      '646-111-0003', 'Calle 2a #300, Ensenada',        3, '2023-05-10'),
  ( 4, 'Luis',     'Morales Fuentes',   '686-111-0004', 'Blvd. UABC #400, Mexicali',      4, '2023-06-01'),
  ( 5, 'Ana',      'Castillo Vega',     '661-111-0005', 'Calle 3a #500, Rosarito',        5, '2023-07-14'),
  ( 6, 'Roberto',  'Sánchez Mendoza',   '665-111-0006', 'Av. Juárez #600, Tecate',        6, '2023-08-30'),
  ( 7, 'Laura',    'Díaz Contreras',    '686-111-0007', 'Calle 4a #700, Mexicali',        1, '2023-09-05'),
  ( 8, 'Miguel',   'Reyes Espinoza',    '664-111-0008', 'Blvd. Díaz Ordaz #800, Tijuana', 2, '2023-10-18'),
  ( 9, 'Paola',    'Flores Gutiérrez',  '686-111-0009', 'Calzada UABC #900, Mexicali',    4, '2024-01-07'),
  (10, 'Diego',    'Vargas Ontiveros',  '646-111-0010', 'Calle 5a #1000, Ensenada',       3, '2024-02-20');

ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;
```

### 3.2 `sql/nodo4.sql` — REEMPLAZAR sección Usuario (líneas 15-49)

```sql
-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO VERTICAL DISTRIBUIDO: UsuarioAcceso (TODOS los usuarios)
-- Nodo 4 almacena el fragmento Acceso de los 10 usuarios.
-- El fragmento Perfil (nombre, dirección, sucursal) está en Nodo 1.
-- Reconstrucción: app-side merge {Perfil Nodo1} + {Acceso Nodo4}
-- NOTA: Sin FK a UsuarioPerfil (tabla en otro nodo). Integridad vía app.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00
);

INSERT INTO UsuarioAcceso (id_usuario, email, multas_acumuladas) VALUES
  ( 1, 'mgonzalez@email.com',   0.00),
  ( 2, 'cramirez@email.com',   25.00),
  ( 3, 'ftorres@email.com',     0.00),
  ( 4, 'lmorales@email.com',   50.00),
  ( 5, 'acastillo@email.com',   0.00),
  ( 6, 'rsanchez@email.com',    0.00),
  ( 7, 'ldiaz@email.com',      75.00),
  ( 8, 'mreyes@email.com',      0.00),
  ( 9, 'pflores@email.com',     0.00),
  (10, 'dvargas@email.com',     0.00);
```

### 3.3 `sql/nodo2.sql`, `sql/nodo3.sql`, `sql/nodo5.sql`, `sql/nodo6.sql` — ELIMINAR sección Usuario

En cada uno de estos archivos, eliminar **todo el bloque** desde la línea `-- FRAGMENTACIÓN VERTICAL de Usuario` hasta justo antes de `-- FRAGMENTO HORIZONTAL: Inventario`. Es decir, borrar todo lo que esté entre las secciones de tablas replicadas e Inventario.

Ejemplo para `nodo2.sql`: borrar líneas 13 a 48 (las líneas de `UsuarioPerfil`, `UsuarioAcceso`, INSERTs y ALTER TABLE).

---

## 4. Backend — Cambios completos

### 4.1 `backend/config/nodos.js`

**ANTES:**
```js
export const MI_NODO = Number(process.env.MI_NODO || 1)

export function nodoDeSucursal(idSucursal) {
  return Number(idSucursal)
}
```

**DESPUÉS:**
```js
export const MI_NODO = Number(process.env.MI_NODO || 1)

// Nodos que almacenan los fragmentos verticales de Usuario
export const NODO_PERFIL = 1   // UsuarioPerfil — identidad + ubicación
export const NODO_ACCESO = 4   // UsuarioAcceso — email + multas

export function nodoDeSucursal(idSucursal) {
  return Number(idSucursal)
}
```

(El resto del archivo — el objeto `nodos` y `DB` — no cambia.)

---

### 4.2 `backend/db/pool.js`

**ANTES** (función `buscarUsuario` — líneas 93-116):

```js
export async function buscarUsuario(idUsuario) {
  const sqlReconstruir = `
    SELECT up.id_usuario, up.nombre, up.apellidos, up.telefono, up.direccion,
           up.id_sucursal_registro, up.fecha_registro,
           ua.email, ua.multas_acumuladas
    FROM UsuarioPerfil up
    JOIN UsuarioAcceso ua ON up.id_usuario = ua.id_usuario
    WHERE up.id_usuario = ?
  `

  try {
    const rows = await queryLocal(sqlReconstruir, [idUsuario])
    if (rows.length > 0) return { usuario: rows[0], idNodo: MI_NODO }
  } catch (_) { }

  const otrosNodos = Object.keys(nodos).map(Number).filter(n => n !== MI_NODO)
  for (const idNodo of otrosNodos) {
    try {
      const rows = await queryNodo(idNodo, sqlReconstruir, [idUsuario])
      if (rows.length > 0) return { usuario: rows[0], idNodo }
    } catch (_) { }
  }
  return null
}
```

**DESPUÉS** (reemplazar la función completa + agregar helpers):

```js
// ─── Nuevas funciones para fragmentos verticales distribuidos ─────────────

/**
 * Consulta el fragmento UsuarioPerfil en el Nodo 1.
 * @param {string} sql    — sentencia con ?
 * @param {Array}  params
 * @returns {Array} filas
 */
export async function queryPerfil(sql, params = []) {
  return queryNodo(NODO_PERFIL, sql, params)
}

/**
 * Consulta el fragmento UsuarioAcceso en el Nodo 4.
 * @param {string} sql    — sentencia con ?
 * @param {Array}  params
 * @returns {Array} filas
 */
export async function queryAcceso(sql, params = []) {
  return queryNodo(NODO_ACCESO, sql, params)
}

/**
 * Busca solo el perfil de un usuario en Nodo 1.
 * Útil para Q5 (verificar existencia) sin consultar Nodo 4.
 */
export async function buscarPerfil(idUsuario) {
  try {
    const [row] = await queryPerfil(
      'SELECT id_usuario, nombre, apellidos, id_sucursal_registro FROM UsuarioPerfil WHERE id_usuario = ?',
      [idUsuario]
    )
    return row || null
  } catch (_) {
    return null
  }
}

/**
 * Busca un usuario completo reconstruyendo desde los 2 fragmentos
 * en nodos distintos (Perfil en Nodo 1, Acceso en Nodo 4).
 *
 * Las 2 queries se ejecutan EN PARALELO.
 * Si Nodo 4 no responde, el usuario se devuelve sin email/multas
 *   (degradación elegante — el perfil básico sigue disponible).
 *
 * @returns {{ usuario: object, idNodoAcceso: number }} | null
 */
export async function buscarUsuario(idUsuario) {
  const [perfilRows, accesoRows] = await Promise.allSettled([
    queryPerfil(
      `SELECT up.id_usuario, up.nombre, up.apellidos, up.telefono, up.direccion,
              up.id_sucursal_registro, up.fecha_registro
       FROM UsuarioPerfil up
       WHERE up.id_usuario = ?`,
      [idUsuario]
    ),
    queryAcceso(
      'SELECT id_usuario, email, multas_acumuladas FROM UsuarioAcceso WHERE id_usuario = ?',
      [idUsuario]
    ),
  ])

  const perfil = perfilRows.status === 'fulfilled' ? perfilRows.value[0] : null
  const acceso = accesoRows.status === 'fulfilled' ? accesoRows.value[0] : null

  if (!perfil) return null

  return {
    usuario: {
      ...perfil,
      email:              acceso?.email              ?? '',
      multas_acumuladas:  acceso?.multas_acumuladas  ?? 0,
    },
    idNodoAcceso: NODO_ACCESO,   // para updates de multa
  }
}

// ─── Actualizar el export ─────────────────────────────────────────────────

export { nodoDeSucursal, MI_NODO, nodos, NODO_PERFIL, NODO_ACCESO }
```

---

### 4.3 `backend/routes/usuarios.js`

**Archivo completo reescrito:**

```js
import { Router } from 'express'
import { queryTodos, queryPerfil, queryAcceso, buscarUsuario, buscarPerfil, NODO_PERFIL, NODO_ACCESO } from '../db/pool.js'

const router = Router()

function enrich(u) {
  return {
    ...u,
    sucursal_nombre:    u.sucursal_nombre || '',
    multas_acumuladas:  Number(u.multas_acumuladas) || 0,
  }
}

/**
 * Reconstruye un usuario completo desde los 2 fragmentos verticales
 * ubicados en Nodo 1 (Perfil + Sucursal) y Nodo 4 (Acceso).
 * Las queries se ejecutan en paralelo.
 */
async function reconstruirUsuario(idUsuario = null) {
  const whereClause = idUsuario ? 'WHERE up.id_usuario = ?' : ''
  const params       = idUsuario ? [idUsuario] : []

  const [perfilRows, accesoRows] = await Promise.allSettled([
    queryPerfil(
      `SELECT up.id_usuario, up.nombre, up.apellidos, up.telefono, up.direccion,
              up.id_sucursal_registro, up.fecha_registro,
              s.nombre AS sucursal_nombre
       FROM UsuarioPerfil up
       JOIN Sucursal s ON up.id_sucursal_registro = s.id_sucursal
       ${whereClause}
       ORDER BY up.id_usuario`,
      params
    ),
    queryAcceso(
      `SELECT id_usuario, email, multas_acumuladas FROM UsuarioAcceso ${whereClause}`,
      params
    ),
  ])

  const perfiles = perfilRows.status === 'fulfilled' ? perfilRows.value : []
  const accesos  = accesoRows.status === 'fulfilled' ? accesoRows.value : []

  // Merge por id_usuario
  const accesoMap = new Map(accesos.map(a => [a.id_usuario, a]))
  return perfiles.map(p => enrich({
    ...p,
    email:             accesoMap.get(p.id_usuario)?.email             ?? '',
    multas_acumuladas: accesoMap.get(p.id_usuario)?.multas_acumuladas ?? 0,
  }))
}

// ─── GET /api/usuarios ─────────────────────────────────────────────────────
// Consulta Nodo 1 (Perfil + Sucursal) y Nodo 4 (Acceso) en paralelo.
// El merge se hace en JavaScript por id_usuario.
router.get('/', async (req, res) => {
  try {
    const usuarios = await reconstruirUsuario()
    res.json(usuarios)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuarios', detail: err.message })
  }
})

// ─── GET /api/usuarios/:id ──────────────────────────────────────────────────
// Busca en Nodo 1 (Perfil) y Nodo 4 (Acceso) en paralelo.
router.get('/:id', async (req, res) => {
  try {
    const [u] = await reconstruirUsuario(Number(req.params.id))
    if (!u) return res.status(404).json({ message: 'Usuario no encontrado' })
    res.json(enrich(u))
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuario', detail: err.message })
  }
})

// ─── GET /api/usuarios/:id/prestamos ────────────────────────────────────────
// Q5: Verifica existencia del usuario SOLO en Nodo 1 (Perfil).
// Luego fan-out a 6 nodos para los préstamos (Prestamo sigue fragmentado H).
router.get('/:id/prestamos', async (req, res) => {
  try {
    const idUsuario = Number(req.params.id)

    // Q5: solo consulta UsuarioPerfil en Nodo 1 (no necesita email ni multas)
    const perfil = await buscarPerfil(idUsuario)
    if (!perfil) return res.status(404).json({ message: 'Usuario no encontrado' })

    // Fan-out a 6 nodos: el usuario pudo haber prestado en cualquier sucursal
    const prestamos = await queryTodos(
      `SELECT p.*, l.titulo AS libro_titulo, s.nombre AS sucursal_nombre
       FROM Prestamo p
       JOIN Libro   l ON p.id_libro    = l.id_libro
       JOIN Sucursal s ON p.id_sucursal = s.id_sucursal
       WHERE p.id_usuario = ?
       ORDER BY p.fecha_prestamo DESC`,
      [idUsuario]
    )

    res.json(prestamos)
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener préstamos del usuario', detail: err.message })
  }
})

export default router
```

---

### 4.4 `backend/routes/prestamos.js`

**Cambio puntual en `PUT /:id/devolver`** — actualización de multa:

Donde dice:
```js
await queryNodo(
  resultadoUsuario.idNodo,
  'UPDATE UsuarioAcceso SET multas_acumuladas = multas_acumuladas + ? WHERE id_usuario = ?',
  [multa, p.id_usuario]
)
```

Reemplazar `resultadoUsuario.idNodo` por `resultadoUsuario.idNodoAcceso`:
```js
await queryNodo(
  resultadoUsuario.idNodoAcceso,   // siempre será Nodo 4 (NODO_ACCESO)
  'UPDATE UsuarioAcceso SET multas_acumuladas = multas_acumuladas + ? WHERE id_usuario = ?',
  [multa, p.id_usuario]
)
```

El resto de `prestamos.js` no cambia — `buscarUsuario()` ya funciona con la nueva lógica de 2 nodos.

---

## 5. Consultas representativas por nodo (actualizadas)

Con la nueva arquitectura, las consultas de cada nodo cambian porque los datos de usuario ahora son remotos para los nodos 2, 3, 5, 6.

### Nodo 1 — Mexicali Centro

**Consulta:** Listar todos los usuarios de la red con su sucursal

```sql
-- Se ejecuta en Nodo 1 (Perfil + Sucursal) y Nodo 4 (Acceso) en paralelo
-- Nodo 1:
SELECT up.id_usuario, up.nombre, up.apellidos, up.telefono, up.direccion,
       up.id_sucursal_registro, up.fecha_registro,
       s.nombre AS sucursal_nombre
FROM UsuarioPerfil up
JOIN Sucursal s ON up.id_sucursal_registro = s.id_sucursal
ORDER BY up.id_usuario;

-- Nodo 4 (paralelo):
SELECT id_usuario, email, multas_acumuladas FROM UsuarioAcceso;

-- Merge JS por id_usuario
```

**Árbol de consulta:**
```
                 π(all attributes)
                      |
          ┌───────────┼───────────┐ (merge JS)
          │           │           │
     π(perfil+suc)  │     π(acceso)
          │         │           │
     ⋈(id_sucursal)│     UsuarioAcceso
          │         │      (Nodo 4)
    ┌─────┴─────┐   │
UsuarioPerfil  Sucursal
  (Nodo 1)    (Nodo 1)
```

**Cálculo de bytes:**

| Componente | Cálculo | Bytes |
|------------|---------|:-----:|
| UsuarioPerfil (10 tuplas × 431 bytes) | 10 × 431 | 4,310 |
| Sucursal JOIN | (incluido en Nodo 1) | — |
| UsuarioAcceso (10 tuplas × 159 bytes) | 10 × 159 | 1,590 |
| **Total transferido** | | **5,900** |

---

### Nodo 2 — Tijuana

**Consulta:** Buscar un usuario por ID (remoto — ni Perfil ni Acceso están en Nodo 2)

```sql
-- Nodo 2 consulta remotamente:
-- A Nodo 1:
SELECT up.*, s.nombre AS sucursal_nombre
FROM UsuarioPerfil up
JOIN Sucursal s ON up.id_sucursal_registro = s.id_sucursal
WHERE up.id_usuario = ?;

-- A Nodo 4 (paralelo):
SELECT * FROM UsuarioAcceso WHERE id_usuario = ?;

-- Merge JS
```

**Árbol de consulta:**
```
           π(nombre, apellidos, email, multas, sucursal)
                          │
              ┌───────────┼───────────┐ (merge JS app-side)
              │           │           │
         σ(id=?)     σ(id=?)
              │           │
       ⋈(id_sucursal)  UsuarioAcceso
              │         (Nodo 4)
    ┌─────┴─────┐
UsuarioPerfil  Sucursal
  (Nodo 1)    (Nodo 1)
```

**Cálculo de bytes:**

| Componente | Cálculo | Bytes |
|------------|---------|:-----:|
| Perfil + Sucursal (1 tupla) → red desde Nodo 1 | 431 + 50 (sucursal) | 481 |
| Acceso (1 tupla) → red desde Nodo 4 | 159 | 159 |
| **Total transferido** | | **640** |

**Comparación con diseño anterior (usuario local):**
- Antes: 590 bytes (JOIN local de Perfil + Acceso)
- Ahora: 640 bytes (+8.5% — overhead de 2 conexiones remotas)

---

### Nodo 3 — Ensenada

**Consulta:** Usuarios con más de 3 préstamos vencidos en Ensenada

```sql
-- Paso 1 (local): contar préstamos vencidos en sucursal 3
SELECT id_usuario, COUNT(*) AS vencidos
FROM Prestamo
WHERE id_sucursal = 3 AND estatus = 'vencido'
GROUP BY id_usuario
HAVING COUNT(*) > 3;

-- Paso 2 (remoto): para cada id_usuario con >3 vencidos,
-- consultar Nodo 1 para obtener nombre
SELECT up.nombre, up.apellidos
FROM UsuarioPerfil up
WHERE up.id_usuario = ?;
```

**Árbol de consulta:**
```
       π(nombre, apellidos, vencidos)
                    │
          ⋈ (app-side loop)
                    │
     ┌──────────────┼──────────────┐
     │              │              │
  γ(COUNT>3)    σ(id=?)      σ(id=?)
   id_usuario       │              │
     │         UsuarioPerfil  UsuarioPerfil
  σ(suc=3,      (Nodo 1)      (Nodo 1)
   vencido)
     │
  Prestamo
  (Nodo 3 — local)
```

**Cálculo de bytes (con 2 usuarios con >3 vencidos):**

| Componente | Cálculo | Bytes |
|------------|---------|:-----:|
| Agregación local en Nodo 3 | ~50 | 50 |
| 2 × Perfil remoto desde Nodo 1 | 2 × 431 | 862 |
| **Total transferido** | | **912** |
| **Ahorro vs diseño anterior** (antes: Acceso también consultado) | No se usa Acceso en esta consulta | **-25%** |

---

### Nodo 4 — Mexicali Universidad

**Consulta:** Costo total de adquisiciones por categoría + usuarios con multas

```sql
-- Local (LibroAdmin + Libro):
SELECT c.nombre AS categoria, SUM(la.costo) AS costo_total
FROM LibroAdmin la
JOIN Libro l ON la.id_libro = l.id_libro
JOIN Categoria c ON l.id_categoria = c.id_categoria
GROUP BY c.nombre;

-- Local (UsuarioAcceso — Nodo 4):
SELECT * FROM UsuarioAcceso WHERE multas_acumuladas > 0;
```

**Árbol de consulta (reporte de multas):**
```
     π(nombre, email, multas)
              │
     σ(multas > 0)
              │
       UsuarioAcceso       ← LOCAL en Nodo 4
         (Nodo 4)             ¡Sin consultar Nodo 1!
```

**Cálculo de bytes (consulta de multas — Q4):**

| Componente | Cálculo | Bytes |
|------------|---------|:-----:|
| UPDATE multa (1 tupla Acceso) | 159 | 159 |
| **Total** | | **159** |

**Comparación con diseño anterior:**
- Antes: el UPDATE de multa ya iba a `UsuarioAcceso` local → 159 bytes (no cambia para Nodo 4)
- Para nodos 2,3,5,6: antes iba a su propio `UsuarioAcceso` local (159 bytes). Ahora va remoto a Nodo 4 (159 bytes + overhead de red). El overhead es mínimo por ser una sola tupla de 159 bytes.

---

### Nodo 5 — Rosarito

**Consulta:** Disponibilidad de un libro en todas las sucursales (fan-out a 6 nodos)

```sql
-- Fan-out a los 6 nodos para Inventario + Sucursal:
SELECT i.id_sucursal, s.nombre AS sucursal_nombre, s.ciudad,
       i.copias_totales, i.copias_disponibles, i.ubicacion_fisica
FROM Inventario i
JOIN Sucursal s ON i.id_sucursal = s.id_sucursal
WHERE i.id_libro = ?;

-- Si además se necesita el usuario que tiene el libro prestado:
-- Se consulta Nodo 1 para Perfil (solo si es necesario mostrar nombre)
```

**Árbol de consulta:**
```
              π(sucursal, copias, ubicacion)
                          │
                   ⋈ (fan-out 6 nodos)
                          │
              ┌───────────┼───────────┬───┬───┐
              │           │           │   │   │
         σ(libro=?)  σ(libro=?)  ...  N5  N6
              │           │
         Inventario   Inventario
          (Nodo 1)     (Nodo 2)
```

**Cálculo de bytes (sin usuario):**

| Componente | Cálculo | Bytes |
|------------|---------|:-----:|
| 6 × (Inventario + Sucursal) | 6 × (50 + 50) | 600 |
| **Total transferido** | | **600** |

Esta consulta no cambia respecto al diseño anterior (Inventario y Sucursal no se movieron).

---

### Nodo 6 — Tecate

**Consulta:** Préstamos inter-sucursales en Tecate con nombres de usuarios remotos

```sql
-- Paso 1 (local): préstamos de Tecate
SELECT * FROM Prestamo WHERE id_sucursal = 6;

-- Paso 2 (remoto): para cada préstamo, obtener nombre del usuario
-- desde Nodo 1 (Perfil), porque el usuario puede ser de otra sucursal.
-- Si además se necesita email/multas → consultar Nodo 4.
-- Si solo se necesita nombre → solo Nodo 1.
SELECT up.nombre, up.apellidos, up.id_sucursal_registro
FROM UsuarioPerfil up
WHERE up.id_usuario = ?;
```

**Árbol de consulta:**
```
       π(prestamo.*, usuario_nombre)
                    │
          ⋈ (app-side loop por id_usuario)
                    │
     ┌──────────────┼──────────────┐
     │              │              │
  σ(suc=6)     σ(id=2)        σ(id=5)
     │              │              │
  Prestamo    UsuarioPerfil   UsuarioPerfil
  (Nodo 6)      (Nodo 1)       (Nodo 1)
```

**Cálculo de bytes (3 préstamos, 2 usuarios remotos):**

| Componente | Cálculo | Bytes |
|------------|---------|:-----:|
| Prestamo local (Nodo 6) | 3 × ~80 | 240 |
| 2 × Perfil remoto (Nodo 1) | 2 × 431 | 862 |
| **Total transferido (red)** | | **862** |
| **Ahorro vs diseño anterior** | No se consulta Acceso | **-27% vs consultar ambos fragmentos** |

---

### Tabla resumen de costos por consulta

| Nodo | Consulta | Bytes antes | Bytes ahora | Diferencia |
|------|----------|:---:|:---:|:---:|
| 1 | Listar usuarios | 5,900 (local) | 5,900 (local) | Sin cambio |
| 2 | Buscar usuario por ID | 590 (local) | 640 (2 nodos remotos) | +8.5% |
| 3 | Usuarios con >3 vencidos | 1,772 (local) | 912 (solo Perfil remoto) | **-48.5%** |
| 4 | Update multa (Q4) | 159 (local) | 159 (local) | Sin cambio |
| 5 | Disponibilidad libro | 600 (fan-out) | 600 (fan-out) | Sin cambio |
| 6 | Préstamos inter-sucursal | 1,180 (local ambos) | 862 (solo Perfil remoto) | **-27%** |

> **Conclusión:** La separación física de fragmentos permite que consultas que solo necesitan perfil (Nodos 3, 6) ahorren entre 27% y 48% al no consultar `UsuarioAcceso`. El overhead en Nodo 2 (+8.5%) es mínimo porque la consulta necesita ambos fragmentos.

---

## 6. Costo de transferencia diario total

| Consulta | Frec/día | Bytes antes | Bytes ahora | Ahorro/Costo |
|----------|:---:|:---:|:---:|:---:|
| Q1 (listar locales) | 80 | 94,400 | 94,400 | Sin cambio |
| Q2 (buscar por ID) | 200 | 118,000 | 128,000 | +8.5% (overhead 2 conexiones) |
| Q3 (distribuido) | 5 | 5,900 | 5,900 | Sin cambio |
| Q4 (update multa) | 20 | 3,180 | 3,180 | Sin cambio |
| Q5 (verificar) | 40 | 17,240 | **8,620** | **-50%** (solo Nodo 1) |
| Q6 (perfil préstamos) | 15 | 8,850 | 8,850 | Sin cambio |
| **Total diario** | **360** | **247,570** | **248,950** | **+0.56%** |

> El costo diario total es prácticamente idéntico (+0.56%), pero con un beneficio arquitectónico significativo: los fragmentos están físicamente separados, demostrando fragmentación vertical distribuida real. Además, Q5 (verificación de existencia) se beneficia directamente al consultar solo 1 nodo en vez de 2 fragmentos locales.

---

## 7. Manual de implementación por tipo de nodo

---

### TIPO A: Nodo 1 (Mexicali Centro) — Almacena `UsuarioPerfil`

**Precondiciones:**
- Tailscale activo: `tailscale ip` debe mostrar `100.127.191.53`
- MySQL corriendo, usuario `biblioteca` creado con GRANT remoto
- Puerto 3306 abierto en firewall

**Paso 1: Cargar el nuevo fragmento Perfil**

```bash
# Desde la carpeta raíz del proyecto
mysql -u root -p < sql/usuarios_nodo1_perfil.sql
```

**Paso 2: Verificar**

```bash
mysql -u root -p -e "USE biblioteca_nodo1; SELECT COUNT(*) FROM UsuarioPerfil;"
# Debe mostrar: 10
```

**Paso 3: Actualizar backend**

Editar `backend/.env`:
```
MI_NODO=1
```

Verificar que `backend/config/nodos.js` tenga:
```js
export const NODO_PERFIL = 1
export const NODO_ACCESO = 4
```

**Paso 4: Reiniciar backend**

```bash
cd backend
npm install   # si no lo has hecho
npm run dev
# Debe mostrar: Nodo 1 — Mexicali Centro (100.127.191.53)
```

**Paso 5: Probar endpoints**

```bash
curl http://localhost:3001/api/usuarios              # los 10 usuarios
curl http://localhost:3001/api/usuarios/2            # Carlos Ramírez
curl http://localhost:3001/api/usuarios/8/prestamos  # préstamos de Miguel
```

**Verificación de integridad:**

```sql
-- En Nodo 1: confirmar que hay 10 perfiles y que cubren las 6 sucursales
USE biblioteca_nodo1;
SELECT id_sucursal_registro, COUNT(*) FROM UsuarioPerfil GROUP BY id_sucursal_registro;
-- Debe mostrar: suc 1→2, suc 2→2, suc 3→2, suc 4→2, suc 5→1, suc 6→1
```

---

### TIPO B: Nodo 4 (Mexicali Universidad) — Almacena `UsuarioAcceso`

**Precondiciones:**
- Tailscale activo: `tailscale ip` debe mostrar `100.67.56.91`
- MySQL corriendo, usuario `biblioteca_nodo4` creado
- Puerto 3306 abierto

**Paso 1: Cargar el nuevo fragmento Acceso**

```bash
mysql -u root -p < sql/usuarios_nodo4_acceso.sql
```

**Paso 2: Cargar LibroAdmin (si no lo habías hecho)**

```bash
mysql -u root -p < sql/nodo4_libro_admin.sql
```

**Paso 3: Verificar**

```bash
mysql -u root -p -e "USE biblioteca_nodo4; SELECT COUNT(*) FROM UsuarioAcceso; SELECT COUNT(*) FROM LibroAdmin;"
# Debe mostrar: 10 y 12
```

**Paso 4: Actualizar backend**

Editar `backend/.env`:
```
MI_NODO=4
```

Verificar `backend/config/nodos.js`:
```js
export const NODO_PERFIL = 1
export const NODO_ACCESO = 4
```

**Paso 5: Reiniciar backend**

```bash
cd backend
npm install
npm run dev
# Debe mostrar: Nodo 4 — Mexicali Universidad (100.67.56.91)
```

**Paso 6: Probar endpoint de multas**

```bash
# Ver usuarios completos (consulta Nodo 1 + Nodo 4)
curl http://localhost:3001/api/usuarios

# Ver un usuario con multa
curl http://localhost:3001/api/usuarios/7
# Debe mostrar: Laura Díaz Contreras, multas: 75.00
```

**Verificación de integridad:**

```sql
-- Confirmar que los 10 ids de UsuarioAcceso coinciden con los de Nodo 1
-- (comparar manualmente o vía backend)
USE biblioteca_nodo4;
SELECT id_usuario, email, multas_acumuladas FROM UsuarioAcceso ORDER BY id_usuario;
```

---

### TIPO C: Nodos 2, 3, 5, 6 — SIN tablas de Usuario

**Precondiciones:**
- Tailscale activo
- MySQL corriendo
- Tener las tablas replicadas (Categoria, Sucursal, Libro) + fragmentos locales (Inventario, Prestamo)

**Paso 1: Eliminar tablas de Usuario locales**

```bash
# Ajustar USE según tu nodo. Ejemplo para Nodo 2:
mysql -u root -p -e "
  USE biblioteca_nodo2;
  DROP TABLE IF EXISTS UsuarioAcceso;
  DROP TABLE IF EXISTS UsuarioPerfil;
  SHOW TABLES LIKE 'Usuario%';
"
# Debe devolver: Empty set (no hay tablas de Usuario)
```

**Paso 2: Verificar que las otras tablas siguen intactas**

```bash
mysql -u root -p -e "USE biblioteca_nodo2; SHOW TABLES;"
# Debe mostrar: Categoria, Sucursal, Libro, Inventario, Prestamo
# NO debe mostrar: UsuarioPerfil, UsuarioAcceso
```

**Paso 3: Actualizar backend**

Editar `backend/.env` con tu número de nodo:
```
MI_NODO=2   # o 3, 5, 6 según corresponda
```

**Paso 4: Reiniciar backend**

```bash
cd backend
npm install
npm run dev
```

**Paso 5: Probar que las consultas de usuario funcionan remotamente**

```bash
# Listar todos los usuarios (va a Nodo 1 + Nodo 4)
curl http://localhost:3001/api/usuarios

# Buscar un usuario específico (remoto)
curl http://localhost:3001/api/usuarios/5
# Debe mostrar: Ana Castillo Vega, Rosarito

# Verificar existencia (Q5 — solo Nodo 1)
curl http://localhost:3001/api/usuarios/5/prestamos
```

**Paso 6: Probar creación de préstamo (validación remota de usuario)**

```bash
curl -X POST http://localhost:3001/api/prestamos \
  -H "Content-Type: application/json" \
  -d '{"id_usuario": 8, "id_libro": 2, "id_sucursal": 2}'
# Debe validar que Miguel Reyes (id=8) existe consultando Nodo 1
```

**Paso 7: Probar tolerancia a fallo**

```bash
# Si Nodo 4 está caído, la lista de usuarios debe seguir funcionando
# (sin email ni multas — degradación elegante)
```

---

## 8. Testing end-to-end

### 8.1 Verificación de fragmentos distribuidos

```bash
# Desde Nodo 1: verificar Perfil local
curl http://localhost:3001/api/usuarios | jq 'length'         # 10

# Desde Nodo 4: verificar Acceso local
mysql -u root -p -e "USE biblioteca_nodo4; SELECT COUNT(*) FROM UsuarioAcceso;"  # 10

# Desde Nodo 2 (sin tablas Usuario): verificar que funciona remoto
curl http://localhost:3001/api/usuarios | jq 'length'         # 10
```

### 8.2 Verificación de Q4 (update multa en Nodo 4)

```bash
# Devolver un préstamo vencido (genera multa)
curl -X PUT http://localhost:3001/api/prestamos/9/devolver

# Verificar que la multa se actualizó en Nodo 4
curl http://localhost:3001/api/usuarios/2
# multas_acumuladas debe haber aumentado
```

### 8.3 Verificación de Q5 (solo Nodo 1)

```bash
# Consultar préstamos de un usuario
curl http://localhost:3001/api/usuarios/6/prestamos
# Debe funcionar aunque Nodo 4 esté caído (no necesita Acceso)
```

### 8.4 Verificación de merge JS

```bash
curl http://localhost:3001/api/usuarios/1 | jq '{nombre, email, multas}'
# {
#   "nombre": "María",
#   "email": "mgonzalez@email.com",    ← viene de Nodo 4
#   "multas_acumuladas": 0             ← viene de Nodo 4
# }
```

---

## 9. Plan de rollback

Si algo falla, volver al diseño anterior:

```bash
# En cada nodo (1-6): volver a cargar el script original
mysql -u root -p < sql/nodo1.sql   # (o el número correspondiente)
```

Los scripts `nodo1.sql` a `nodo6.sql` se preservan sin modificar hasta confirmar que la nueva arquitectura funciona.

---

## 10. Resumen de archivos del plan

| Archivo | Acción | Tipo |
|---------|--------|------|
| `sql/usuarios_nodo1_perfil.sql` | CREAR | Nuevo |
| `sql/usuarios_nodo4_acceso.sql` | CREAR | Nuevo |
| `sql/remove_usuarios_otros_nodos.sql` | CREAR | Nuevo |
| `sql/nodo1.sql` | MODIFICAR | Sección Usuario |
| `sql/nodo4.sql` | MODIFICAR | Sección Usuario |
| `sql/nodo2.sql` | MODIFICAR | Eliminar sección Usuario |
| `sql/nodo3.sql` | MODIFICAR | Eliminar sección Usuario |
| `sql/nodo5.sql` | MODIFICAR | Eliminar sección Usuario |
| `sql/nodo6.sql` | MODIFICAR | Eliminar sección Usuario |
| `backend/config/nodos.js` | MODIFICAR | Agregar NODO_PERFIL, NODO_ACCESO |
| `backend/db/pool.js` | MODIFICAR | Rewrite buscarUsuario + nuevos helpers |
| `backend/routes/usuarios.js` | MODIFICAR | Rewrite completo |
| `backend/routes/prestamos.js` | MODIFICAR | 1 línea (idNodoAcceso) |
| `configuracion_nodos_distribuidos.md` | MODIFICAR | Actualizar tabla de distribución |

---

## 11. Checklist por integrante

```
Nodo 1 (Mexicali Centro):
[ ] Ejecutar sql/usuarios_nodo1_perfil.sql
[ ] Verificar: SELECT COUNT(*) FROM UsuarioPerfil → 10
[ ] Editar backend/.env → MI_NODO=1
[ ] Verificar backend/config/nodos.js → NODO_PERFIL=1, NODO_ACCESO=4
[ ] npm run dev en backend
[ ] curl localhost:3001/api/usuarios → 10 usuarios

Nodo 4 (Mexicali Universidad):
[ ] Ejecutar sql/usuarios_nodo4_acceso.sql
[ ] Verificar: SELECT COUNT(*) FROM UsuarioAcceso → 10
[ ] Editar backend/.env → MI_NODO=4
[ ] npm run dev en backend
[ ] curl localhost:3001/api/usuarios → 10 usuarios

Nodo 2, 3, 5, 6 (cada uno):
[ ] DROP TABLE IF EXISTS UsuarioPerfil, UsuarioAcceso;
[ ] Verificar que SHOW TABLES no muestra Usuario%
[ ] Editar backend/.env → MI_NODO=N
[ ] npm run dev en backend
[ ] curl localhost:3001/api/usuarios → debe funcionar (remoto)
[ ] curl localhost:3001/api/usuarios/:id/prestamos → Q5 funciona sin Nodo 4
```
