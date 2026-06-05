# Fragmentación Horizontal en el Sistema de Biblioteca Distribuida BC

> **Contexto:** Sistema de 6 sucursales en Baja California, cada una con su propia instancia MySQL y backend Node.js, conectadas vía VPN Tailscale.
>
> Este documento describe el diseño, implementación y operación de la fragmentación horizontal en el sistema.

---

## 1. ¿Qué es la fragmentación horizontal?

La fragmentación horizontal divide una tabla en subconjuntos de **filas** (tuplas), donde cada fragmento contiene un subconjunto disjunto de los registros. La unión de todos los fragmentos reconstruye la tabla original:

```
R = F1 ∪ F2 ∪ ... ∪ Fn
Fi ∩ Fj = ∅  (para todo i ≠ j)
```

Cada fragmento se define mediante un **predicado de selección** que actúa como criterio de partición. En este sistema, el criterio es la **sucursal** donde ocurre la operación.

---

## 2. Tablas con fragmentación horizontal

| Tabla | Criterio de partición | Predicado | # Fragmentos |
|-------|----------------------|-----------|:---:|
| **Prestamo** | `id_sucursal` | `σ(id_sucursal = N)` | 6 |
| **Inventario** | `id_sucursal` | `σ(id_sucursal = N)` | 6 |

> **Nota importante sobre `Usuario`:** A partir de la redistribución (junio 2026), las tablas `UsuarioPerfil` y `UsuarioAcceso` **ya NO están fragmentadas horizontalmente**. Fueron movidas a 2 nodos fijos (Nodo 1 para Perfil, Nodo 4 para Acceso) mediante fragmentación vertical distribuida. Ver `PLAN_REDISTRIBUCION_USUARIO.md`.

---

## 3. Algoritmo COM-MIN aplicado a `Prestamo`

El diseño sigue el algoritmo **COM-MIN** (Complete and Minimal) para garantizar que los fragmentos sean:

- **Completos (Complete):** cada tupla de la tabla original pertenece a algún fragmento
- **Mínimos (Minimal):** ningún predicado es redundante; todos aportan a la correctitud

### 3.1 Predicados simples propuestos

```
p1:  id_sucursal = 1        p4:  id_sucursal = 4        p7:  estatus = 'activo'
p2:  id_sucursal = 2        p5:  id_sucursal = 5        p8:  estatus = 'devuelto'
p3:  id_sucursal = 3        p6:  id_sucursal = 6        p9:  multa > 0
```

Estos 9 predicados se agrupan en dos categorías:

| Categoría | Predicados | Propósito |
|-----------|-----------|-----------|
| **Localidad** | p1–p6 | Partición primaria por sucursal |
| **Atributo** | p7–p9 | Refinamiento por estado del préstamo y multas |

### 3.2 Aplicación del algoritmo

**Paso 1 — Construir la matriz de afinidad de predicados:**

Se evalúa cada predicado contra cada consulta frecuente. Los predicados p1–p6 tienen afinidad 1 con consultas locales a su sucursal y 0 con las demás. Los predicados p7–p9 refinan dentro de cada sucursal pero no son necesarios para la partición geográfica.

**Paso 2 — COM-MIN determina el conjunto completo y mínimo:**

El análisis de relevancia muestra que p7, p8, p9 son **redundantes** para la partición horizontal porque no determinan la localidad del dato. Una misma sucursal puede tener préstamos activos, devueltos y con multa. Por tanto:

- **Conjunto mínimo:** {p1, p2, p3, p4, p5, p6}
- Los predicados p7–p9 se usan para consultas de filtrado a nivel aplicación, no para fragmentación

**Paso 3 — Minterms:**

Con 6 predicados independientes (partición por sucursal), se generan los minterms:

```
m1:  p1 ∧ ¬p2 ∧ ¬p3 ∧ ¬p4 ∧ ¬p5 ∧ ¬p6  →  id_sucursal = 1
m2: ¬p1 ∧  p2 ∧ ¬p3 ∧ ¬p4 ∧ ¬p5 ∧ ¬p6  →  id_sucursal = 2
m3: ¬p1 ∧ ¬p2 ∧  p3 ∧ ¬p4 ∧ ¬p5 ∧ ¬p6  →  id_sucursal = 3
m4: ¬p1 ∧ ¬p2 ∧ ¬p3 ∧  p4 ∧ ¬p5 ∧ ¬p6  →  id_sucursal = 4
m5: ¬p1 ∧ ¬p2 ∧ ¬p3 ∧ ¬p4 ∧  p5 ∧ ¬p6  →  id_sucursal = 5
m6: ¬p1 ∧ ¬p2 ∧ ¬p3 ∧ ¬p4 ∧ ¬p5 ∧  p6  →  id_sucursal = 6
```

Los demás minterms (donde más de un predicado es verdadero o ninguno lo es) son **no viables** porque `id_sucursal` solo puede tener un valor.

### 3.3 Fragmentos resultantes

```
F1 = σ(id_sucursal = 1)(Prestamo)   →  Nodo 1 (Mexicali Centro)
F2 = σ(id_sucursal = 2)(Prestamo)   →  Nodo 2 (Tijuana)
F3 = σ(id_sucursal = 3)(Prestamo)   →  Nodo 3 (Ensenada)
F4 = σ(id_sucursal = 4)(Prestamo)   →  Nodo 4 (Mexicali Universidad)
F5 = σ(id_sucursal = 5)(Prestamo)   →  Nodo 5 (Rosarito)
F6 = σ(id_sucursal = 6)(Prestamo)   →  Nodo 6 (Tecate)
```

**Propiedades verificadas:**
- **Disyunción:** `Fi ∩ Fj = ∅` para `i ≠ j` (un préstamo solo ocurre en una sucursal)
- **Reconstrucción:** `Prestamo = F1 ∪ F2 ∪ F3 ∪ F4 ∪ F5 ∪ F6`

---

## 4. Fragmentación horizontal de `Inventario`

La tabla `Inventario` sigue el mismo patrón por derivación: cada nodo almacena el inventario de su sucursal.

```
G1 = σ(id_sucursal = 1)(Inventario)  →  Nodo 1
G2 = σ(id_sucursal = 2)(Inventario)  →  Nodo 2
...
G6 = σ(id_sucursal = 6)(Inventario)  →  Nodo 6
```

Cada fragmento contiene **12 filas exactas** (una por cada uno de los 12 libros del catálogo), con sus copias totales y disponibles en esa sucursal.

---

## 5. Implementación en MySQL: CHECK Constraints

Cada fragmento se garantiza a nivel de base de datos con una restricción `CHECK`:

**Prestamo en Nodo 1 (`sql/nodo1.sql:160`):**
```sql
CREATE TABLE Prestamo (
  ...
  id_sucursal INT NOT NULL DEFAULT 1,
  CONSTRAINT chk_prestamo_sucursal CHECK (id_sucursal = 1),
  ...
);
```

**Inventario en Nodo 1 (`sql/nodo1.sql:125`):**
```sql
CREATE TABLE Inventario (
  ...
  id_sucursal INT NOT NULL DEFAULT 1,
  CONSTRAINT chk_inventario_sucursal CHECK (id_sucursal = 1),
  ...
);
```

Estas restricciones aseguran que:
1. Un `INSERT` con `id_sucursal` incorrecto es rechazado por MySQL
2. Los datos no pueden migrar accidentalmente al nodo equivocado
3. La integridad de la fragmentación se mantiene incluso si hay errores en la aplicación

Cada nodo (2 a 6) tiene su propio `CHECK` con el valor de sucursal correspondiente.

---

## 6. Asignación a nodos

La relación `id_sucursal ↔ id_nodo` es **1:1**:

| Nodo | Sucursal | IP Tailscale | Fragmento Prestamo | Fragmento Inventario |
|:---:|---------|-------------|:---:|:---:|
| 1 | Mexicali Centro | 100.127.191.53 | `σ(suc=1)` | `σ(suc=1)` |
| 2 | Tijuana | 100.88.250.105 | `σ(suc=2)` | `σ(suc=2)` |
| 3 | Ensenada | 100.121.240.118 | `σ(suc=3)` | `σ(suc=3)` |
| 4 | Mexicali Universidad | 100.67.56.91 | `σ(suc=4)` | `σ(suc=4)` |
| 5 | Rosarito | 100.95.94.48 | `σ(suc=5)` | `σ(suc=5)` |
| 6 | Tecate | 100.114.254.124 | `σ(suc=6)` | `σ(suc=6)` |

Esta asignación se implementa en el backend (`backend/config/nodos.js`):

```js
export const nodos = {
  1: { host: '100.127.191.53',  id_sucursal: 1, ... },
  2: { host: '100.88.250.105',  id_sucursal: 2, ... },
  ...
};

export function nodoDeSucursal(idSucursal) {
  return Number(idSucursal);  // 1:1 directo
}
```

---

## 7. Datos semilla por fragmento

### 7.1 Préstamos por nodo

| Nodo | id_prestamo | id_usuario | id_libro | Estatus | Nota |
|------|:---:|:---:|:---:|---------|------|
| 1 | 1 | 1 | 2 (Cien años de soledad) | activo | — |
| 1 | 10 | 7 | 6 (Conquista de México) | vencido | multa $75 |
| 1 | 13 | 1 | 5 (Historia de México) | devuelto | — |
| 2 | 4 | 8 | 11 (El Arte de México) | activo | — |
| 2 | 9 | 2 | 4 (Física Universitaria) | vencido | multa $50 |
| 2 | 12 | 2 | 12 (Arquitectura Prehispánica) | vencido | multa $25 |
| 3 | 2 | 3 | 5 (Historia de México) | activo | — |
| 3 | 7 | 10 | 1 (Pedro Páramo) | activo | — |
| 3 | 14 | 3 | 7 (Lenguaje de Prog. C) | devuelto | — |
| 4 | 5 | 9 | 3 (Biología Celular) | activo | — |
| 4 | 8 | 4 | 8 (Algoritmos) | activo | — |
| 4 | 11 | 4 | 10 (Teoría Gral. del Derecho) | vencido | multa $50 |
| 5 | 3 | 5 | 7 (Lenguaje de Prog. C) | activo | — |
| 5 | 15 | 5 | 2 (Cien años de soledad) | devuelto | — |
| 6 | 6 | 6 | 9 (Derecho Constitucional) | activo | local |
| 6 | 16 | **2** | 3 (Biología Celular) | activo | **inter-sucursal** |
| 6 | 17 | **5** | 11 (El Arte de México) | activo | **inter-sucursal** |

### 7.2 Inventario por nodo

Cada nodo tiene **12 filas** (una por libro). Las copias prestadas se calculan con la fórmula `(id_libro + id_sucursal) % 3 === 0` → 1 copia menos disponible.

---

## 8. Consultas sobre datos fragmentados horizontalmente

El backend (`backend/db/pool.js`) implementa tres patrones de consulta:

### 8.1 Consulta local (`queryLocal`)

Solo consulta el fragmento del nodo actual. Se usa para operaciones locales.

```js
export async function queryLocal(sql, params = []) {
  return queryNodo(MI_NODO, sql, params)
}
```

**Endpoint de ejemplo:** `GET /api/prestamos` → solo préstamos de la sucursal local.

### 8.2 Consulta a nodo específico (`queryNodo`)

Consulta un fragmento remoto por su `id_sucursal`.

```js
export async function queryNodo(idNodo, sql, params = []) {
  const pool = getPool(idNodo)
  const [rows] = await pool.execute(sql, params)
  return rows
}
```

**Endpoint de ejemplo:** `GET /api/prestamos?id_sucursal=3` → préstamos de Ensenada desde cualquier nodo.

### 8.3 Fan-out a todos los nodos (`queryTodos`)

Ejecuta la misma consulta en los 6 nodos en paralelo, concatena resultados. Implementa la **reconstrucción** de la tabla fragmentada.

```js
export async function queryTodos(sql, params = []) {
  const resultados = await Promise.all(
    Object.keys(nodos).map(async (idStr) => {
      try {
        const filas = await queryNodo(Number(idStr), sql, params)
        return filas.map(f => ({ ...f, _nodo: Number(idStr) }))
      } catch (err) {
        console.warn(`[pool] Nodo ${idStr} no disponible: ${err.message}`)
        return []
      }
    })
  )
  return resultados.flat()
}
```

**Endpoints de ejemplo:**
- `GET /api/prestamos?distribuido=1` → todos los préstamos de la red (F1 ∪ ... ∪ F6)
- `GET /api/libros/:id/disponibilidad` → inventario de un libro en las 6 sucursales

### 8.4 Tolerancia a fallos

Si un nodo no responde, `queryTodos` lo omite con un `console.warn` en lugar de fallar. Esto permite que el sistema funcione en modo degradado:

```
Con los 6 nodos arriba:  F1 + F2 + F3 + F4 + F5 + F6 = tabla completa
Con Nodo 3 caído:        F1 + F2 +      F4 + F5 + F6 = 5/6 de los datos
```

---

## 9. Préstamos inter-sucursales: el caso especial

`Prestamo` **NO tiene FK a `Usuario`** (ni a `UsuarioPerfil` ni a `UsuarioAcceso`). Motivo: un usuario registrado en Tijuana (Nodo 2, `id_sucursal_registro = 2`) puede pedir un libro prestado en Tecate (Nodo 6, `id_sucursal = 6`).

```
Ejemplo real en datos semilla:
┌────────────────────────────────────────────────┐
│ Préstamo 16: usuario=2 (Carlos, Tijuana)       │
│              libro=3   (Biología Celular)       │
│              sucursal=6 (Tecate)   ← INTER      │
│                                                │
│ Préstamo 17: usuario=5 (Ana, Rosarito)          │
│              libro=11  (El Arte de México)      │
│              sucursal=6 (Tecate)   ← INTER      │
└────────────────────────────────────────────────┘
```

La integridad referencial se valida a nivel de aplicación: `buscarUsuario(id)` consulta los nodos de usuario (Nodo 1 y Nodo 4) antes de registrar el préstamo.

---

## 10. Tabla de distribución completa del sistema

| Tabla | Tipo de fragmentación | Dónde está | Predicado |
|-------|----------------------|-----------|-----------|
| `Categoria` | Replicada | Los 6 nodos | — |
| `Sucursal` | Replicada | Los 6 nodos | — |
| `Libro` | Vertical (público) + Replicado | Los 6 nodos | — |
| `LibroAdmin` | Vertical (admin) | Solo Nodo 4 | — |
| `UsuarioPerfil` | Vertical distribuido | Solo Nodo 1 | — |
| `UsuarioAcceso` | Vertical distribuido | Solo Nodo 4 | — |
| **`Inventario`** | **Horizontal** | **1 fragmento por nodo** | **`σ(id_sucursal = N)`** |
| **`Prestamo`** | **Horizontal (COM-MIN)** | **1 fragmento por nodo** | **`σ(id_sucursal = N)`** |

---

## 11. Ventajas de la fragmentación horizontal aplicada

| Ventaja | Cómo se logra |
|---------|--------------|
| **Localidad de datos** | El 90% de las consultas de préstamos son locales a la sucursal → sin tráfico de red |
| **Escalabilidad** | Cada nodo maneja ~16% de los préstamos; añadir una sucursal nueva no afecta a las existentes |
| **Disponibilidad** | Si un nodo cae, las otras 5 sucursales siguen operando sus préstamos normalmente |
| **Consultas distribuidas** | `queryTodos` reconstruye la tabla completa bajo demanda (fan-out paralelo) |
| **Integridad por CHECK** | MySQL rechaza inserts con `id_sucursal` incorrecto — la fragmentación es forzada a nivel BD |

---

## 12. Resumen gráfico

```
                PRESTAMO (tabla lógica completa)
                          │
        ┌─────────┬───────┼───────┬─────────┬─────────┐
        ▼         ▼       ▼       ▼         ▼         ▼
    σ(suc=1)  σ(suc=2) σ(suc=3) σ(suc=4) σ(suc=5) σ(suc=6)
        │         │       │       │         │         │
    ┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌───┴───┐
    │Nodo 1 │ │Nodo 2 │ │Nodo 3 │ │Nodo 4 │ │Nodo 5 │ │Nodo 6 │
    │Prest. │ │Prest. │ │Prest. │ │Prest. │ │Prest. │ │Prest. │
    │suc=1  │ │suc=2  │ │suc=3  │ │suc=4  │ │suc=5  │ │suc=6  │
    │       │ │       │ │       │ │       │ │       │ │       │
    │ 3     │ │ 3     │ │ 3     │ │ 3     │ │ 2     │ │ 3     │
    │filas  │ │filas  │ │filas  │ │filas  │ │filas  │ │filas  │
    └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘
    
    Reconstrucción: queryTodos → 3+3+3+3+2+3 = 17 préstamos totales
```

---

## 13. Referencias de código

| Componente | Archivo | Líneas clave |
|-----------|---------|-------------|
| CHECK constraint Prestamo | `sql/nodo1.sql` | 160 |
| CHECK constraint Inventario | `sql/nodo1.sql` | 125 |
| COM-MIN predicados | `proyecto_biblioteca_distribuida.md` | 85-107 |
| queryLocal | `backend/db/pool.js` | 53-55 |
| queryNodo | `backend/db/pool.js` | 44-48 |
| queryTodos (fan-out) | `backend/db/pool.js` | 62-76 |
| nodoDeSucursal | `backend/config/nodos.js` | 27-29 |
| Fan-out de préstamos | `backend/routes/prestamos.js` | 63-65 |
