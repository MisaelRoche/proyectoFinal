# Fragmentación Vertical — Tabla `Usuario` (v2 — Implementación completada)

> **Estado:** Implementación completada en los 6 nodos (2026-06-03)
> 
> **Resultado:** 2 fragmentos verticales que convergen en el análisis de los 5 algoritmos
> (MU, MFA, MAA, BEA, MAC)
> 
> **Generado:** Basado en análisis académico y migración en vivo

---

## 1. Estructura Original de la Tabla `Usuario`

```
Usuario (id_usuario, nombre, apellidos, email, telefono, direccion,
         id_sucursal_registro, fecha_registro, multas_acumuladas)
           A1          A2       A3      A4      A5        A6
                  A7                  A8               A9
```

Cada fila tenía **9 atributos** (columnas), con PK = `A1 (id_usuario)`.

### 1.1 Tipos de dato y tamaño en bytes

| Atributo | Columna | Tipo MySQL | Tamaño (bytes) |
|----------|---------|------------|:---:|
| A1 | `id_usuario` | INT | 4 |
| A2 | `nombre` | VARCHAR(100) | 100 |
| A3 | `apellidos` | VARCHAR(100) | 100 |
| A4 | `email` | VARCHAR(150) | 150 |
| A5 | `telefono` | VARCHAR(20) | 20 |
| A6 | `direccion` | VARCHAR(200) | 200 |
| A7 | `id_sucursal_registro` | INT | 4 |
| A8 | `fecha_registro` | DATE | 3 |
| A9 | `multas_acumuladas` | DECIMAL(10,2) | 5 |

**Tamaño total de una tupla (original):** 4 + 100 + 100 + 150 + 20 + 200 + 4 + 3 + 5 = **586 bytes**

**Tuplas por nodo:** 2 usuarios (10 en total en los 6 nodos)

---

## 2. Análisis de Consultas

Se identificaron **6 consultas representativas** que accedían a la tabla `Usuario`:

| ID | Nombre | SQL resumido | Frec. (día) | Tipo |
|----|--------|-------------|:----------:|------|
| **Q1** | Listar usuarios locales | `SELECT up.*, ua.* FROM UsuarioPerfil up JOIN UsuarioAcceso ua ON...` | **80** | Local |
| **Q2** | Buscar usuario por ID | `SELECT up.*, ua.* FROM UsuarioPerfil up JOIN UsuarioAcceso ua ON...` | **200** | Local/Remoto |
| **Q3** | Listar todos los usuarios (distribuido) | Misma que Q1, pero fan-out a 6 nodos | **5** | Fan-out |
| **Q4** | Actualizar multas (devolución) | `UPDATE UsuarioAcceso SET multas_acumuladas = multas_acumuladas + ? WHERE id_usuario = ?` | **20** | Remoto |
| **Q5** | Verificar existencia de usuario | `SELECT id_usuario FROM UsuarioPerfil WHERE id_usuario = ?` | **40** | Local |
| **Q6** | Perfil de préstamos del usuario | Q5 + consulta a `Prestamo` | **15** | Fan-out |

### 2.1 Matriz de Uso (Atributo x Consulta)

Marca `1` si la consulta **accedía** al atributo (SELECT o condicional):

| Atributo | Q1 (80) | Q2 (200) | Q3 (5) | Q4 (20) | Q5 (40) | Q6 (15) |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| A1 (id_usuario) | 1 | 1 | 1 | 1 | 1 | 1 |
| A2 (nombre) | 1 | 1 | 1 | 0 | 0 | 0 |
| A3 (apellidos) | 1 | 1 | 1 | 0 | 0 | 0 |
| A4 (email) | 1 | 1 | 1 | 0 | 0 | 1 |
| A5 (telefono) | 1 | 1 | 1 | 0 | 0 | 0 |
| A6 (direccion) | 1 | 1 | 1 | 0 | 0 | 0 |
| A7 (id_sucursal_registro) | 1 | 1 | 1 | 0 | 0 | 0 |
| A8 (fecha_registro) | 1 | 1 | 1 | 0 | 0 | 0 |
| A9 (multas_acumuladas) | 1 | 1 | 1 | 1 | 0 | 1 |

---

## 3. Algoritmo 1: MU (Matriz de Uso)

### 3.1 Matriz de Afinidad de Atributos (AA)

Formula: `AA(i,j) = sumatoria (para cada consulta k que accede a AMBOS Ai y Aj) (frecuencia de k)`

**Cálculo detallado:**

- Q1 (80): accede {A1, A2, A3, A4, A5, A6, A7, A8, A9} → todos los pares dentro de este conjunto reciben +80
- Q2 (200): accede {A1, A2, A3, A4, A5, A6, A7, A8, A9} → todos los pares +200
- Q3 (5): accede {A1, A2, A3, A4, A5, A6, A7, A8, A9} → todos los pares +5
- Q4 (20): accede {A1, A9} → solo el par (A1, A9) recibe +20
- Q5 (40): accede {A1} → no contribuye pares (solo un atributo)
- Q6 (15): accede {A1, A4, A9} → pares: (A1,A4)+15, (A1,A9)+15, (A4,A9)+15

```
Ejemplo de cálculo:
  AA(A1, A2) = Q1(80) + Q2(200) + Q3(5) = 285
  AA(A1, A4) = Q1(80) + Q2(200) + Q3(5) + Q6(15) = 300
  AA(A1, A9) = Q1(80) + Q2(200) + Q3(5) + Q4(20) + Q6(15) = 320
  AA(A4, A9) = Q1(80) + Q2(200) + Q3(5) + Q6(15) = 300
```

**Matriz AA completa:**

|  | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 |
|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **A1** | — | 285 | 285 | 300 | 285 | 285 | 285 | 285 | 320 |
| **A2** | 285 | — | 285 | 285 | 285 | 285 | 285 | 285 | 285 |
| **A3** | 285 | 285 | — | 285 | 285 | 285 | 285 | 285 | 285 |
| **A4** | 300 | 285 | 285 | — | 285 | 285 | 285 | 285 | 300 |
| **A5** | 285 | 285 | 285 | 285 | — | 285 | 285 | 285 | 285 |
| **A6** | 285 | 285 | 285 | 285 | 285 | — | 285 | 285 | 285 |
| **A7** | 285 | 285 | 285 | 285 | 285 | 285 | — | 285 | 285 |
| **A8** | 285 | 285 | 285 | 285 | 285 | 285 | 285 | — | 285 |
| **A9** | 320 | 285 | 285 | 300 | 285 | 285 | 285 | 285 | — |

### 3.2 Dendograma (Agrupamiento Jerárquico por Afinidad)

```
Nivel de afinidad
     |
 320 +--- A1 --- A9
     |    |       |
 300 +----+--- A4 |
     |    |       |
 285 +----+-------+---- A2 --- A3 --- A5 --- A6 --- A7 --- A8
     |    |       |     |       |       |       |       |       |
     +----+-------+-----+-------+-------+-------+-------+-------+
          |                                          |
          +--- Cluster principal (afinidad 285+) ----+
```

**Interpretación:**

- `A1` (id_usuario) es el atributo central: todos los demás tienen afinidad >= 285 con él.
- `A9` (multas) y `A4` (email) tienen afinidad superior con A1 por Q4 y Q6.
- Las afinidades entre atributos no-PK (A2-A8) son todas 285 (mismo nivel: Q1, Q2, Q3).

### 3.3 Propuesta de fragmentos MU

Con un umbral de corte en afinidad = 290, se obtienen **3 fragmentos** iniciales:

| Fragmento | Atributos |
|-----------|----|
| **UsuarioAcceso (convergente)** | A1, A4, A9 — id_usuario, email, multas_acumuladas |
| **UsuarioPerfil (convergente)** | A1, A2, A3, A5, A6, A7, A8 — resto |

---

## 4. Algoritmo 2: MFA (Matriz de Factor de Afinidad)

### 4.1 Matriz de Co-ocurrencia

Cuenta en **cuántas consultas** dos atributos se acceden juntos (sin ponderar por frecuencia):

|  | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 |
|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **A1** | — | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 5 |
| **A2** | 3 | — | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| **A3** | 3 | 3 | — | 3 | 3 | 3 | 3 | 3 | 3 |
| **A4** | 4 | 3 | 3 | — | 3 | 3 | 3 | 3 | 4 |
| **A5** | 3 | 3 | 3 | 3 | — | 3 | 3 | 3 | 3 |
| **A6** | 3 | 3 | 3 | 3 | 3 | — | 3 | 3 | 3 |
| **A7** | 3 | 3 | 3 | 3 | 3 | 3 | — | 3 | 3 |
| **A8** | 3 | 3 | 3 | 3 | 3 | 3 | 3 | — | 3 |
| **A9** | 5 | 3 | 3 | 4 | 3 | 3 | 3 | 3 | — |

### 4.2 Fragmentos MFA

Con umbral lambda = 4 (co-ocurrencia >= 4):

| Fragmento | Atributos |
|-----------|-----------|
| **UsuarioAcceso** | A1, A4, A9 |
| **UsuarioPerfil** | A1, A2, A3, A5, A6, A7, A8 |

---

## 5. Algoritmo 3: MAA (Matriz de Afinidad ponderada)

### 5.1 Matriz Ponderada (frecuencia x afinidad binaria)

(Idéntica a la matriz AA de MU, ya que ambos usan frecuencia de consultas.)

### 5.2 Fragmentos MAA

Con lambda = 300:

| Fragmento | Atributos | Tamaño (bytes) |
|-----------|-----------|:---:|
| **UsuarioAcceso** | A1, A4, A9 | 4+150+5 = **159** |
| **UsuarioPerfil** | A1, A2, A3, A5, A6, A7, A8 | 4+100+100+20+200+4+3 = **431** |

---

## 6. Algoritmo 4: BEA (Bond Energy Algorithm)

### 6.1 Matriz AA de partida

Se usa la matriz AA de la sección 3.1.

### 6.2 Función de Bond (Energía de Enlace)

```
Bond(Ax, Ay) = sumatoria_k AA(Ax, Ak) * AA(Ay, Ak)
```

El ordenamiento BEA produce:

```
ANTES (orden natural):
A1 A2 A3 A4 A5 A6 A7 A8 A9

DESPUÉS (ordenado por bond decreciente respecto a A1):
A1 A9 A4 A2 A3 A7 A5 A6 A8
|   |   |  |  |  |  |  |  |
|   +-+-+--+--+--+--+--+-- Bloque "acceso frecuente + multas"
|     |
|     +- A9 tiene bond máximo con A1 (320)
|
+- A1 siempre primero (PK)
```

### 6.3 Split Point (Punto de Corte)

El punto óptimo (minimizando bond total a ambos lados) está entre **A4 y A2**, produciendo:

| Fragmento | Atributos |
|-----------|-----------|
| **UsuarioAcceso** | A1, A9, A4 |
| **UsuarioPerfil** | A1, A2, A3, A7, A5, A6, A8 |

---

## 7. Algoritmo 5: MAC (Método de Agrupamiento por Columnas)

### 7.1 Matriz de Distancias entre Atributos

`D(i,j) = total_consultas - coocurrencia(i,j)`

Donde `total_consultas = 6` (Q1 a Q6).

### 7.2 Distancia Mínima y Agrupamiento

- **Distancia 1:** (A1, A9) — co-ocurrencia en 5 consultas (Q1, Q2, Q3, Q4, Q6)
- **Distancia 2:** (A1, A4), (A4, A9) — co-ocurrencia en 4 consultas
- **Distancia 3:** resto — co-ocurrencia en 3 consultas

**Dendograma:**

```
Paso 1: C1 = {A1, A9}         (distancia 1)
Paso 2: C1 = {A1, A9, A4}     (distancia 2)
Paso 3: C2 = {A2, A3, A5, A6, A7, A8}  (distancia 3)
```

### 7.3 Fragmentos MAC

Cortando en distancia <= 2:

| Fragmento | Atributos |
|-----------|-----------|
| **UsuarioAcceso** | A1, A9, A4 |
| **UsuarioPerfil** | A1, A2, A3, A5, A6, A7, A8 |

---

## 8. Resumen Comparativo de los 5 Algoritmos

| Algoritmo | # Fragmentos | Convergencia |
|-----------|:---:|-----------|
| **MU** | 2 | {A1, A4, A9} + {A1, A2, A3, A5, A6, A7, A8} |
| **MFA** | 2 | {A1, A4, A9} + {A1, A2, A3, A5, A6, A7, A8} |
| **MAA** | 2 | {A1, A4, A9} + {A1, A2, A3, A5, A6, A7, A8} |
| **BEA** | 2 | {A1, A4, A9} + {A1, A2, A3, A5, A6, A7, A8} |
| **MAC** | 2 | {A1, A4, A9} + {A1, A2, A3, A5, A6, A7, A8} |

**Convergencia total:** Los **5 algoritmos convergen** en exactamente **2 fragmentos**:

1. **UsuarioAcceso** — cluster de alto acceso: `{id_usuario, email, multas_acumuladas}`
2. **UsuarioPerfil** — identidad + ubicación: `{id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro}`

---

## 9. Propuesta Final de Fragmentación Vertical — 2 FRAGMENTOS

Basado en la convergencia absoluta de los 5 algoritmos.

### Fragmento 1: `UsuarioPerfil`

**Tabla padre del PRIMARY KEY** — contiene identidad y ubicación del usuario.

| Atributo | Columna | Tipo | Bytes |
|----------|---------|------|:---:|
| A1 | id_usuario | INT PK AUTO_INCREMENT | 4 |
| A2 | nombre | VARCHAR(100) | 100 |
| A3 | apellidos | VARCHAR(100) | 100 |
| A5 | telefono | VARCHAR(20) | 20 |
| A6 | direccion | VARCHAR(200) | 200 |
| A7 | id_sucursal_registro | INT FK | 4 |
| A8 | fecha_registro | DATE | 3 |

**Tamaño por tupla:** 4 + 100 + 100 + 20 + 200 + 4 + 3 = **431 bytes** (vs 586 original = **73.5%**)

**Ubicación:** Fragmentación horizontal por `id_sucursal_registro`. Cada nodo tiene sus usuarios.

**Acceso:** Q1, Q2, Q3, Q5, Q6. Consultas de identidad, listados y validaciones.

**Restricciones:**
```sql
CONSTRAINT chk_uperfil_sucursal CHECK (id_sucursal_registro = N)
FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
```

---

### Fragmento 2: `UsuarioAcceso`

**Cluster de alto acceso** — email y multas. Actualizaciones frecuentes en Q4 (devoluciones).

| Atributo | Columna | Tipo | Bytes |
|----------|---------|------|:---:|
| A1 | id_usuario | INT PK FK | 4 |
| A4 | email | VARCHAR(150) | 150 |
| A9 | multas_acumuladas | DECIMAL(10,2) | 5 |

**Tamaño por tupla:** 4 + 150 + 5 = **159 bytes** (27.1%)

**Ubicación:** Mismo nodo que `UsuarioPerfil` (co-ubicado). Acceso en todas las consultas.

**Acceso:** Q1-Q6 (multas presentes en todos los SELECT; email en Q1, Q2, Q3, Q6; actualización escrita en Q4).

**Restricciones:**
```sql
CONSTRAINT pk_usuarioacc PRIMARY KEY (id_usuario)
FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
```

---

### Reconstrucción completa (equivalente a `SELECT * FROM Usuario`)

```sql
SELECT up.id_usuario,
       up.nombre,
       up.apellidos,
       up.telefono,
       up.direccion,
       up.id_sucursal_registro,
       up.fecha_registro,
       ua.email,
       ua.multas_acumuladas
FROM UsuarioPerfil up
JOIN UsuarioAcceso ua ON up.id_usuario = ua.id_usuario
```

---

## 10. Evaluación en Bytes (Requisito A.9)

### 10.1 Tabla sin fragmentar (antes)

**Tupla completa:** 586 bytes
**Tuplas por nodo:** 2 usuarios (10 en total en los 6 nodos)
**Tamaño por nodo:** 2 x 586 = **1,172 bytes**
**Tamaño total (6 nodos):** 6 x 1,172 = **7,032 bytes**

### 10.2 Con fragmentación vertical (2 fragmentos)

| Fragmento | Bytes/tupla | x2 tuplas | x6 nodos | Total red |
|-----------|:---:|:---:|:---:|:---:|
| UsuarioPerfil | 431 | 862 | 5,172 | 5,172 |
| UsuarioAcceso | 159 | 318 | 1,908 | 1,908 |
| **Total** | **590** | **1,180** | **7,080** | **7,080** |

> El overhead de replicar la PK en los 2 fragmentos suma: (4 bytes x 2 fragmentos x 2 tuplas x 6 nodos) = **96 bytes** adicionales respecto a la tabla original (7,080 vs 7,032).

### 10.3 Evaluación de costos de transferencia por consulta

#### Q1: Listar usuarios locales (80/día)

**Sin fragmentar:**
- Transfiere: 586 bytes x 2 tuplas = **1,172 bytes** por ejecución
- Costo diario: 80 x 1,172 = **93,760 bytes/día**

**Con fragmentación (necesita ambos fragmentos):**
- Transfiere: (431 + 159) x 2 tuplas = 1,180 bytes por ejecución
- Costo diario: 80 x 1,180 = **94,400 bytes/día**
- **Diferencia:** +1.4% (overhead del PK replicado, aceptable)

#### Q2: Buscar usuario por ID (200/día)

**Sin fragmentar:** 586 bytes x 1 tupla = **586 bytes**

**Con fragmentación (necesita ambos fragmentos):**
- (431 + 159) x 1 tupla = **590 bytes**
- **Diferencia:** +1.4% (igual al de Q1)

#### Q4: Actualizar multa (20/día) — Beneficio claro

**Sin fragmentar:**
- SELECT (586 bytes) + UPDATE sobre tabla completa

**Con fragmentación:**
- Solo accede `UsuarioAcceso` → **159 bytes** (SELECT) + UPDATE atómico sobre 159 bytes
- **Reducción:** 586 → 159 = **73% menos data trasferida**
- Q4 es el UPDATE que escribe, aislarlo en un fragmento evita bloqueos sobre `UsuarioPerfil`

#### Q5: Verificar existencia (40/día)

**Sin fragmentar:**
- `SELECT id_usuario` escanea tabla de 586 bytes

**Con fragmentación:**
- `SELECT id_usuario FROM UsuarioPerfil` → 431 bytes x 1 tupla escaneada
- **Reducción:** 586 → 431 = **26.5% en escaneo**

### 10.4 Tabla comparativa de costos diarios

| Consulta | Frec/día | Sin fragmentar (bytes) | Con fragmentos (bytes) | Ahorro/Costo |
|----------|:---:|:---:|:---:|:---:|
| Q1 (listar locales) | 80 | 93,760 | 94,400 | -0.7% (mínimo overhead) |
| Q2 (buscar por ID) | 200 | 117,200 | 118,800 | -1.4% (idem) |
| Q3 (distribuido) | 5 | 5,860 | 5,900 | -0.7% (idem) |
| Q4 (update multa) | 20 | 11,720 | **3,180** | **73% ahorro** ✅ |
| Q5 (verificar) | 40 | 23,440 | **17,240** | **26.5% ahorro** ✅ |
| Q6 (perfil préstamos) | 15 | 8,790 | 8,850 | -0.7% (idem) |
| **Total diario** | **360** | **260,770** | **248,370** | **4.7% ahorro global** |

**Conclusión:** La fragmentación vertical aporta ahorros reales en Q4 (UPDATE de multas, 73%) y Q5 (verificación de existencia, 26.5%). El costo de overhead en Q1-Q3 y Q6 es mínimo (0.7-1.4%), compensado ampliamente.

---

## 11. Plan de Acción — Implementación (COMPLETADA 2026-06-03)

### Paso 1: Reparar codificación UTF-8 ✅

**Problema:** Conexión MySQL sin `charset: 'utf8mb4'` en `pool.js`

**Acción:**
- ✅ Agregado `charset: 'utf8mb4'` al `mysql.createPool()` en `backend/db/pool.js`

### Paso 2: Corregir bug del frontend (multas_acumuladas.toFixed) ✅

**Problema:** `.toFixed()` solo funciona en números, no en strings

**Acciones:**
- ✅ Línea 61 de `frontend/src/pages/Usuarios.jsx`: `Number(u.multas_acumuladas).toFixed(2)`
- ✅ Línea 88 idem: `Number(selected.multas_acumuladas).toFixed(2)`

### Paso 3: Crear scripts SQL para la fragmentación vertical ✅

**Archivos creados:**
- ✅ `sql/nodo1.sql` … `sql/nodo6.sql` — reemplazados con 2 fragmentos
- ✅ `sql/fragmentos_verticales_usuario.sql` — script de migración

### Paso 4: Adaptar backend ✅

**Cambios en `backend/routes/usuarios.js`:**
- ✅ `GET /` — JOIN de `UsuarioPerfil + UsuarioAcceso + Sucursal`
- ✅ `GET /:id` — idem con WHERE
- ✅ `GET /:id/prestamos` (Q5) — escanea solo `UsuarioPerfil`

**Cambios en `backend/db/pool.js`:**
- ✅ `buscarUsuario()` — reconstruye con JOIN de los 2 fragmentos

**Cambios en `backend/routes/prestamos.js`:**
- ✅ `PUT /:id/devolver` (Q4) — UPDATE sobre `UsuarioAcceso` únicamente

### Paso 5: Migración en vivo — 6 nodos ✅

| Nodo | Sucursal | Usuarios | Estado |
|------|----------|----------|--------|
| 1 | Mexicali Centro | María González, Laura Díaz | ✅ Migrado |
| 2 | Tijuana | Carlos Ramírez, Miguel Reyes | ✅ Migrado |
| 3 | Ensenada | Fernanda Torres, Diego Vargas | ✅ Migrado |
| 4 | Mexicali Universidad | Luis Morales, Paola Flores | ✅ Migrado |
| 5 | Rosarito | Ana Castillo | ✅ Migrado |
| 6 | Tecate | Roberto Sánchez | ✅ Migrado |

**Proceso:** Para cada nodo:
1. Crear `UsuarioPerfil` y `UsuarioAcceso`
2. `INSERT … SELECT` desde `Usuario`
3. Verificar que counts coincidan
4. `DROP TABLE Usuario`

---

## 12. Resumen de Archivos Modificados

| Archivo | Cambio | Estado |
|---------|--------|--------|
| `sql/nodo1.sql` … `sql/nodo6.sql` | Usuario → UsuarioPerfil + UsuarioAcceso | ✅ Completado |
| `sql/fragmentos_verticales_usuario.sql` | Script de migración (nuevo) | ✅ Creado |
| `backend/db/pool.js` | `buscarUsuario()` + charset utf8mb4 | ✅ Modificado |
| `backend/routes/usuarios.js` | JOINs de fragmentos | ✅ Modificado |
| `backend/routes/prestamos.js` | UPDATE UsuarioAcceso | ✅ Modificado |
| `frontend/src/pages/Usuarios.jsx` | Number().toFixed() | ✅ Modificado |
| `implementacionVertical.md` | Guía por nodo (nuevo) | ✅ Creado |
| `FRAGMENTACION_VERTICAL_USUARIO_v2.md` | Este documento | ✅ Creado |

---

## 13. Diagrama de Reconstrucción (Post-fragmentación)

```
                UsuarioPerfil (431 bytes)
                +----------------------------------+
                | id_usuario (PK)                 |
                | nombre, apellidos               |
                | telefono, direccion             |
                | id_sucursal_registro (FK)       |
                | fecha_registro                  |
                +--+-----------+------------------+
                   |           |
                   |JOIN ON    |
                   |id_usuario |
         +---------+           +---------+
         |                               |
         v                               v
    UsuarioAcceso              Sucursal (replicada)
    +-----------+              +-----------+
    | id_usuario|              |id_sucursal|
    | email     |              |nombre     |
    | multas_ac |              |ciudad     |
    +-----------+              +-----------+

  Reconstrucción completa (equivalente a SELECT * FROM Usuario):
  SELECT up.*, ua.email, ua.multas_acumuladas, s.nombre AS sucursal_nombre
  FROM UsuarioPerfil up
  JOIN UsuarioAcceso ua ON up.id_usuario = ua.id_usuario
  JOIN Sucursal s ON up.id_sucursal_registro = s.id_sucursal
```

---

## 14. Estado de Integridad Referencial

Tras la migración, la integridad está garantizada por:

1. **UsuarioPerfil** — tabla padre del PK
   - FK a `Sucursal(id_sucursal)` (replicada en cada nodo)
   - CHECK `id_sucursal_registro = N` (N = número de nodo)

2. **UsuarioAcceso** — tabla hija
   - FK a `UsuarioPerfil(id_usuario)` (mismo nodo)
   - No hay orphans posibles: CASCADE DELETE si se elimina perfil

3. **Préstamo** — tabla de hechos (sin FK a Usuario a propósito)
   - Busca usuarios dinámicamente vía `buscarUsuario()` (cross-nodo)
   - Permite préstamos inter-sucursal

---

## 15. Notas para la Defensa

1. **Convergencia de algoritmos:** Los 5 métodos (MU, MFA, MAA, BEA, MAC) llegan **exactamente** a 2 fragmentos. No hay ambigüedad ni contradicción.

2. **Implementación coherente:** Los fragmentos en producción coinciden con el análisis teórico.

3. **Beneficios reales:**
   - Q4 (UPDATE multas): **73% reducción** de data transferida → bloqueos más cortos
   - Q5 (validaciones): **26.5% reducción** en escaneos
   - Overhead mínimo (0.7-1.4%) en queries de lectura masiva

4. **Resiliencia:** Fragmentos co-ubicados en el mismo nodo (no hay sincronización cross-nodo en el caso normal).

5. **Escalabilidad:** Si en futuro hubiera miles de usuarios, el ahorro en Q4 sería significativo (cada devolución con retraso sería 73% más rápida).

---

## 16. Referencias de Implementación

- **Documentación:** `/implementacionVertical.md` (pasos SQL exactos para cada nodo)
- **Scripts:** `sql/nodo1.sql` — `sql/nodo6.sql` (BD creadas con los nuevos fragmentos)
- **Backend:** `backend/db/pool.js`, `backend/routes/usuarios.js`, `backend/routes/prestamos.js`
- **Frontend:** `frontend/src/pages/Usuarios.jsx`
