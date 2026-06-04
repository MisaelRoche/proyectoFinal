# Fragmentacion Vertical — Tabla `Usuario`

> Desarrollo completo de los 5 algoritmos (MU, MFA, MAA, BEA, MAC) sobre la tabla `Usuario`
> del sistema de Biblioteca Distribuida BC.
> Generado: 2026-06-03

---

## 1. Estructura de la Tabla `Usuario`

```
Usuario (id_usuario, nombre, apellidos, email, telefono, direccion,
         id_sucursal_registro, fecha_registro, multas_acumuladas)
           A1          A2       A3      A4      A5        A6
                  A7                  A8               A9
```

Cada fila tiene **9 atributos** (columnas), con PK = `A1 (id_usuario)`.

### 1.1 Tipos de dato y tamano en bytes

| Atributo | Columna | Tipo MySQL | Tamano (bytes) |
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

**Tamano total de una tupla:** 4 + 100 + 100 + 150 + 20 + 200 + 4 + 3 + 5 = **586 bytes**

**Tuplas por nodo:** 2 usuarios (10 en total en los 6 nodos)

---

## 2. Analisis de Consultas

Se identificaron **6 consultas representativas** que acceden a la tabla `Usuario`:

| ID | Nombre | SQL resumido | Frec. (dia) | Tipo |
|----|--------|-------------|:----------:|------|
| **Q1** | Listar usuarios locales | `SELECT u.*, s.nombre FROM Usuario u JOIN Sucursal s ON u.id_sucursal_registro = s.id_sucursal ORDER BY u.id_usuario` | **80** | Local |
| **Q2** | Buscar usuario por ID | `SELECT * FROM Usuario WHERE id_usuario = ?` | **200** | Local/Remoto |
| **Q3** | Listar todos los usuarios (distribuido) | Misma que Q1, pero fan-out a 6 nodos | **5** | Fan-out |
| **Q4** | Actualizar multas (devolucion) | `UPDATE Usuario SET multas_acumuladas = multas_acumuladas + ? WHERE id_usuario = ?` | **20** | Remoto |
| **Q5** | Verificar existencia de usuario | `SELECT id_usuario FROM Usuario WHERE id_usuario = ?` | **40** | Local |
| **Q6** | Perfil de prestamos del usuario | Q5 + consulta a `Prestamo` | **15** | Fan-out |

> **Nota:** Q6 usa `id_usuario` para validar existencia y luego consulta `Prestamo` (otra tabla). En el frontend muestra `email`, `multas_acumuladas` y `sucursal_nombre` en el panel de perfil.

### 2.1 Matriz de Uso (Atributo x Consulta)

Marca `1` si la consulta **accede** al atributo (SELECT o condicional):

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

**Calculo detallado:**

- Q1 (80): accede {A1, A2, A3, A4, A5, A6, A7, A8, A9} → todos los pares dentro de este conjunto reciben +80
- Q2 (200): accede {A1, A2, A3, A4, A5, A6, A7, A8, A9} → todos los pares +200
- Q3 (5): accede {A1, A2, A3, A4, A5, A6, A7, A8, A9} → todos los pares +5
- Q4 (20): accede {A1, A9} → solo el par (A1, A9) recibe +20
- Q5 (40): accede {A1} → no contribuye pares (solo un atributo)
- Q6 (15): accede {A1, A4, A9} → pares: (A1,A4)+15, (A1,A9)+15, (A4,A9)+15

```
Ejemplo de calculo:
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

### 3.2 Dendograma (Agrupamiento Jerarquico por Afinidad)

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

**Interpretacion:**

- `A1` (id_usuario) es el atributo central: todos los demas tienen afinidad >= 285 con el.
- `A9` (multas) y `A4` (email) tienen afinidad superior con A1 por Q4 y Q6.
- Las afinidades entre atributos no-PK (A2-A8) son todas 285 (mismo nivel: Q1, Q2, Q3).

### 3.3 Propuesta de fragmentos MU

Con un umbral de corte en afinidad = 290, se obtienen **3 fragmentos**:

| Fragmento | Atributos | Columnas incluidas |
|-----------|-----------|--------------------|
| **UsuarioCore** | A1, A2, A3, A4, A7 | id_usuario, nombre, apellidos, email, id_sucursal_registro |
| **UsuarioDatos** | A1, A5, A6, A8 | id_usuario, telefono, direccion, fecha_registro |
| **UsuarioMultas** | A1, A9 | id_usuario, multas_acumuladas |

**Ubicacion propuesta:**

- `UsuarioCore`: **Fragmentacion horizontal** (cada nodo tiene sus usuarios). Acceso en todas las consultas.
- `UsuarioDatos`: **Local por nodo**. Solo Q1-Q3 lo necesitan.
- `UsuarioMultas`: **Local por nodo**. Q1-Q4 y Q6 lo acceden; Q4 escribe en el exclusivamente.

---

## 4. Algoritmo 2: MFA (Matriz de Factor de Afinidad)

### 4.1 Matriz de Co-ocurrencia

Cuenta en **cuantas consultas** dos atributos se acceden juntos (sin ponderar por frecuencia):

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

- `(A1, A9)` = 5 consultas juntas: Q1, Q2, Q3, Q4, Q6
- `(A1, A4)` = 4 consultas juntas: Q1, Q2, Q3, Q6
- `(A4, A9)` = 4 consultas juntas: Q1, Q2, Q3, Q6
- `(A2, A3)` = 3 consultas juntas: Q1, Q2, Q3
- El resto de pares: 3 (todos aparecen en Q1, Q2, Q3)

### 4.2 Grafo de Afinidad (Umbral lambda = 4)

Solo las aristas con co-ocurrencia >= 4 se consideran:

```
        A1 --------- A9
        |\           |
        | \          |
        |  \         |
        |   \        |
        |    \       |
        A4 --------- A9
        |
        | (sin aristas a >=4 con A2-A3-A5-A6-A7-A8)
        |
   A2---A3---A5---A6---A7---A8
   +--------------------------+
   Subgrafo con aristas <= 3 (fuera del umbral)
```

### 4.3 Fragmentos MFA

**Umbral lambda = 4:**

| Fragmento | Atributos | Co-ocurrencia interna >=4 |
|-----------|-----------|--------------------------|
| **F1_MFA** | A1, A4, A9 | id_usuario, email, multas_acumuladas |
| **F2_MFA** | A1, A2, A3, A5, A6, A7, A8 | id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro |

**Umbral lambda = 3 (mas granularidad):**

| Fragmento | Atributos | Justificacion |
|-----------|-----------|---------------|
| **F1** | A1, A4, A9 | id, email, multas (accedidos en Q4 y Q6 ademas de Q1-Q3) |
| **F2** | A1, A2, A3, A5, A6, A7, A8 | Resto del perfil |
| **F3** | A1, A2, A3, A7 | Sub-fragmento de F2: datos personales + sucursal (JOIN frecuente) |

---

## 5. Algoritmo 3: MAA (Matriz de Afinidad de Atributos ponderada)

### 5.1 Matriz Ponderada (frecuencia x afinidad binaria)

Cada consulta contribuye con su frecuencia diaria cuando ambos atributos se acceden:

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

(Es identica a la matriz AA de MU, ya que ambos usan frecuencia de consultas.)

### 5.2 Agrupamiento con umbral lambda = 300

**Bloques formados:**

```
Bloque 1 (afinidad >= 300):
  {A1, A4, A9}  --  id_usuario, email, multas_acumuladas
                    Se acceden en Q4 y Q6 (ademas de Q1-Q3)

Bloque 2 (afinidad <= 285):
  {A2, A3, A5, A6, A7, A8}  --  nombre, apellidos, telefono, direccion,
                                 id_sucursal_registro, fecha_registro
```

### 5.3 Fragmentos MAA

Con lambda = 300:

| Fragmento | Atributos | Tamano (bytes) | Acceso principal |
|-----------|-----------|:---:|------------------|
| **UsuarioAltoAcceso** | A1, A4, A9 | 4+150+5 = **159** | Q1-Q6 (todas) |
| **UsuarioBajoAcceso** | A1, A2, A3, A5, A6, A7, A8 | 4+100+100+20+200+4+3 = **431** | Q1-Q3 unicamente |

Con lambda = 285 (mas fragmentos):

| Fragmento | Atributos |
|-----------|-----------|
| **UsuarioOperativo** | A1, A2, A3, A4, A7, A9 |
| **UsuarioComplemento** | A1, A5, A6, A8 |

---

## 6. Algoritmo 4: BEA (Bond Energy Algorithm)

### 6.1 Matriz AA de partida

Se usa la matriz AA de la seccion 3.1.

### 6.2 Funcion de Bond (Energia de Enlace)

```
Bond(Ax, Ay) = sumatoria_k AA(Ax, Ak) * AA(Ay, Ak)
```

**Calculo del bond entre columnas adyacentes en el orden optimo:**

El orden inicial de columnas (definicion de la tabla):
```
A1 - A2 - A3 - A4 - A5 - A6 - A7 - A8 - A9
```

**Paso 1:** Colocar primera columna A1 (PK, siempre va primero).

**Paso 2:** Para cada columna restante, se calcula la contribucion al bond en cada posicion posible y se coloca donde maximice la energia.

Bond(Ax, Ay) mide cuanto se parecen dos columnas en terminos de co-acceso. A mayor bond, mas juntas deben estar.

**Calculo de bond con A1:**

```
Bond(A1, A9) = 285*285 + 285*285 + 300*300 + 285*285 + 285*285 + 285*285 + 285*285 + 320*0
             = 81,225 + 81,225 + 90,000 + 81,225 + 81,225 + 81,225 + 81,225 + 0
             = 577,350  (domina A4*300 + terminos de 285)

Bond(A1, A4) = 285*285 + 285*285 + 300*300 + 285*285 + 285*285 + 285*285 + 285*285 + 285*285
             = 81,225 + 81,225 + 90,000 + 81,225 + 81,225 + 81,225 + 81,225 + 81,225
             = 658,575

Bond(A1, A2) = todos 285*285 = 8 * 81,225 = 649,800
```

El ordenamiento BEA produce:

```
ANTES (orden natural):
A1 A2 A3 A4 A5 A6 A7 A8 A9

DESPUES (ordenado por bond decreciente respecto a A1):
A1 A9 A4 A2 A3 A7 A5 A6 A8
|   |   |  |  |  |  |  |  |
|   +-+-+--+--+--+--+--+-- Bloque "acceso frecuente + multas"
|     |
|     +- A9 tiene bond maximo con A1 (320)
|
+- A1 siempre primero (PK)
```

### 6.3 Split Point (Punto de Corte)

Se recorre la secuencia ordenada calculando el bond acumulado a la izquierda y derecha de cada punto de corte. El punto optimo es donde se **minimiza el bond total a ambos lados** (menor comunicacion entre fragmentos).

```
Secuencia ordenada:  A1 - A9 - A4 - A2 - A3 - A7 - A5 - A6 - A8

Bonds entre adyacentes:
A1-A9: 320 (alto -- Q4 y Q6 unen multas con id)
A9-A4: 300 (alto -- email y multas juntos en Q6)
A4-A2: 285 (medio -- email con nombre en Q1-Q3)
A2-A3: 285 (alto -- nombre y apellidos siempre juntos)
A3-A7: 285 (medio -- apellidos con sucursal en Q1-Q3)
A7-A5: 285 (medio)
A5-A6: 285 (medio)
A6-A8: 285 (medio)
```

**Calculo de bond acumulado a cada lado:**

```
Corte entre A4 y A2:
  Bond izquierda (A1-A9-A4): 320 + 300 = 620
  Bond derecha (A2-A3-A7-A5-A6-A8): 285x5 = 1425
  Total: 2045

Corte entre A9 y A4:
  Bond izquierda (A1-A9): 320
  Bond derecha (A4-A2-A3-A7-A5-A6-A8): 300 + 285x5 = 1725
  Total: 2045

Corte entre A1 y A9:
  Bond izquierda (A1): 0
  Bond derecha (A9-A4-A2-A3-A7-A5-A6-A8): 320 + 300 + 285x5 = 2045
  Total: 2045  [No valido: PK debe ir en todos los fragmentos]
```

El minimo practico (con PK en ambos lados) esta en **A9-A4** (320 vs 1725).

### 6.4 Fragmentos BEA

| Fragmento | Atributos | Bond interno | Justificacion |
|-----------|-----------|:---:|---------------|
| **F1_BEA** | A1, A9, A4 | 620 | Alta afinidad: id, multas, email |
| **F2_BEA** | A1, A2, A3, A7, A5, A6, A8 | 1425 | Perfil completo: nombre a fecha_registro |

---

## 7. Algoritmo 5: MAC (Metodo de Agrupamiento por Columnas)

### 7.1 Matriz de Distancias entre Atributos

`D(i,j) = total_consultas - coocurrencia(i,j)`

Donde `total_consultas = 6` (Q1 a Q6).

|  | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 |
|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **A1** | — | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 1 |
| **A2** | 3 | — | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| **A3** | 3 | 3 | — | 3 | 3 | 3 | 3 | 3 | 3 |
| **A4** | 2 | 3 | 3 | — | 3 | 3 | 3 | 3 | 2 |
| **A5** | 3 | 3 | 3 | 3 | — | 3 | 3 | 3 | 3 |
| **A6** | 3 | 3 | 3 | 3 | 3 | — | 3 | 3 | 3 |
| **A7** | 3 | 3 | 3 | 3 | 3 | 3 | — | 3 | 3 |
| **A8** | 3 | 3 | 3 | 3 | 3 | 3 | 3 | — | 3 |
| **A9** | 1 | 3 | 3 | 2 | 3 | 3 | 3 | 3 | — |

- **Distancia 1:** (A1, A9) — solo fallan en coincidir en 1 consulta (Q5 solo usa A1)
- **Distancia 2:** (A1, A4), (A4, A9) — fallan en Q4 y Q5
- **Distancia 3:** todos los demas pares — solo coinciden en Q1, Q2, Q3

### 7.2 Agrupamiento Jerarquico Aglomerativo (Enlace Completo)

Se unen primero los pares con menor distancia:

```
Paso 1 (distancia = 1):
  Cluster C1 = {A1, A9}      +- distancia minima

Paso 2 (distancia = 2):
  C1 se expande: C1 = {A1, A9, A4}   +- A4 distancia 2 a ambos

Paso 3 (distancia = 3):
  C2 = {A2, A3, A5, A6, A7, A8}     +- todos a distancia 3 de C1 y entre si

Paso 4 (distancia maxima entre clusters = 3):
  Union final: C1 U C2 = todos los atributos (tabla completa)
```

### 7.3 Dendograma MAC

```
Distancia
    |
  0 +-- A1---A9
    |   |
  1 +---+
    |   |
  2 +---+--- A4
    |   |
  3 +---+---+--- A2 --- A3 --- A5 --- A6 --- A7 --- A8
    |   |   |    |       |       |       |       |       |
    +---+---+----+-------+-------+-------+-------+-------+
        +-- C1 -++-------------- C2 ----------------------+
```

### 7.4 Fragmentos MAC

Cortando en distancia = 2, se obtienen **2 fragmentos**:

| Fragmento | Atributos | Incluye |
|-----------|-----------|--------|
| **F1_MAC** | A1, A9, A4 | id_usuario, multas_acumuladas, email |
| **F2_MAC** | A1, A2, A3, A5, A6, A7, A8 | id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro |

Cortando en distancia = 3 -> **tabla completa** (1 solo fragmento, no hay fragmentacion vertical).

---

## 8. Resumen Comparativo de los 5 Algoritmos

| Algoritmo | # Fragmentos | Corte | Fragmentos |
|-----------|:---:|-------|-----------|
| **MU** | 3 | Afinidad >= 290 | Core(id,nombre,apellidos,email,sucursal) + Datos(telefono,direccion,fecha) + Multas |
| **MFA** | 2 | lambda=4 co-ocurrencia | (id,email,multas) + (id,nombre,apellidos,telefono,direccion,sucursal,fecha) |
| **MAA** | 2 | lambda=300 ponderado | AltoAcceso(id,email,multas) + BajoAcceso(resto) |
| **BEA** | 2 | Minimo bond en A9-A4 | (id,multas,email) + (id,resto perfil) |
| **MAC** | 2 | Distancia <=2 | (id,multas,email) + (id,resto perfil) |

**Convergencia notable:** Los 5 algoritmos coinciden en que **A9 (multas_acumuladas)** debe separarse del resto del perfil, junto con **A4 (email)** por su patron de acceso diferenciado (Q4 y Q6).

---

## 9. Propuesta Final de Fragmentacion Vertical

Basado en la convergencia de los 5 algoritmos, se proponen **3 fragmentos verticales** para la tabla `Usuario`:

### Fragmento 1: `UsuarioPerfil`
| Atributo | Columna | Tipo | Bytes |
|----------|---------|------|:---:|
| A1 | id_usuario | INT PK | 4 |
| A2 | nombre | VARCHAR(100) | 100 |
| A3 | apellidos | VARCHAR(100) | 100 |
| A7 | id_sucursal_registro | INT FK | 4 |

**Tamano por tupla:** 4 + 100 + 100 + 4 = **208 bytes** (vs 586 original = **35.5%**)

**Ubicacion:** Fragmentacion horizontal por `id_sucursal_registro` (ya implementada). Cada nodo tiene sus 2 usuarios.

**Acceso:** Q1, Q2, Q3, Q6. Es la tabla que se consulta para listados, busquedas por nombre/ID y para JOIN con `Sucursal`.

---

### Fragmento 2: `UsuarioContacto`
| Atributo | Columna | Tipo | Bytes |
|----------|---------|------|:---:|
| A1 | id_usuario | INT PK | 4 |
| A4 | email | VARCHAR(150) | 150 |
| A5 | telefono | VARCHAR(20) | 20 |
| A6 | direccion | VARCHAR(200) | 200 |
| A8 | fecha_registro | DATE | 3 |

**Tamano por tupla:** 4 + 150 + 20 + 200 + 3 = **377 bytes** (64.3%)

**Ubicacion:** Mismo nodo que `UsuarioPerfil`. Acceso solo en consultas que necesitan el perfil completo (Q1, Q3) o datos de contacto.

**Acceso:** Q1, Q2, Q3. Baja frecuencia relativa de uso de `direccion` y `telefono`.

---

### Fragmento 3: `UsuarioMultas`
| Atributo | Columna | Tipo | Bytes |
|----------|---------|------|:---:|
| A1 | id_usuario | INT PK | 4 |
| A9 | multas_acumuladas | DECIMAL(10,2) | 5 |

**Tamano por tupla:** 4 + 5 = **9 bytes** (1.5%)

**Ubicacion:** Mismo nodo que los otros fragmentos (local al usuario).

**Acceso:** **Todas las consultas** (Q1-Q6) acceden a este fragmento. Especialmente Q4 (UPDATE de multas en devolucion).

**Justificacion de separacion:** Aunque es pequeno (9 bytes), separarlo permite:
- Q4 (UPDATE multa) no bloquee lecturas de `UsuarioPerfil`
- Reportes de multas no necesitan cargar datos personales
- La reconstruccion completa (`UsuarioPerfil JOIN UsuarioContacto JOIN UsuarioMultas`) solo ocurre en Q1, Q2 y Q3

---

## 10. Evaluacion en Bytes (Requisito A.9)

### 10.1 Tabla sin fragmentar

**Tupla completa:** 586 bytes
**Tuplas por nodo:** 2
**Tamano por nodo:** 2 x 586 = **1,172 bytes**
**Tamano total (6 nodos):** 6 x 1,172 = **7,032 bytes**

### 10.2 Con fragmentacion vertical (3 fragmentos)

| Fragmento | Bytes/tupla | x2 tuplas | x6 nodos | Total red |
|-----------|:---:|:---:|:---:|:---:|
| UsuarioPerfil | 208 | 416 | 2,496 | 2,496 |
| UsuarioContacto | 377 | 754 | 4,524 | 4,524 |
| UsuarioMultas | 9 | 18 | 108 | 108 |
| **Total** | **594** | **1,188** | **7,128** | **7,128** |

> El overhead de replicar la PK en los 3 fragmentos suma: (4 bytes x 3 fragmentos x 2 tuplas x 6 nodos) = **144 bytes** adicionales respecto a la tabla original (7,128 vs 7,032).

### 10.3 Evaluacion de consultas (costos de transferencia)

#### Q1: Listar usuarios locales (80/dia)

**Sin fragmentar:**
- Transfiere: 586 bytes x 2 tuplas = **1,172 bytes** por ejecucion
- Costo diario: 80 x 1,172 = **93,760 bytes/dia**

**Con fragmentacion (si solo necesita Perfil + Multas, sin direccion ni telefono):**
- Transfiere: 208 + 9 = **217 bytes** x 2 tuplas = 434 bytes por ejecucion
- Costo diario: 80 x 434 = **34,720 bytes/dia**
- **Reduccion: 63.0%**

#### Q2: Buscar usuario por ID (200/dia)

**Sin fragmentar:** 586 bytes x 1 tupla = **586 bytes**

**Con fragmentacion (necesita todos los datos, JOIN de 3 fragmentos):**
594 bytes x 1 tupla = **594 bytes** (ligeramente mayor por PK replicada)
- **Aumento: 1.4%** — aceptable porque Q2 es de solo lectura en su mayoria

#### Q4: Actualizar multa (20/dia)

**Sin fragmentar:** SELECT (586 bytes) + UPDATE sobre tabla completa de 586 bytes

**Con fragmentacion:** Solo accede `UsuarioMultas` → **9 bytes** (SELECT) + UPDATE atomico sobre 9 bytes
- **Reduccion: 586 -> 9 bytes = 98.5%**

#### Q5: Verificar existencia (40/dia)

**Sin fragmentar:** `SELECT id_usuario` pero sobre tabla de 586 bytes (el motor escanea la tupla completa sin indice)

**Con fragmentacion:** `SELECT id_usuario FROM UsuarioPerfil` → 208 bytes x 1 tupla escaneada
- **Reduccion: 586 -> 208 bytes = 64.5% en escaneo**

### 10.4 Tabla comparativa de costos diarios

| Consulta | Frec/dia | Sin fragmentar (bytes) | Con fragmentos (bytes) | Ahorro |
|----------|:---:|:---:|:---:|:---:|
| Q1 (listar locales) | 80 | 93,760 | 34,720 | **63.0%** |
| Q2 (buscar por ID) | 200 | 117,200 | 118,800 | -1.4% |
| Q3 (distribuido) | 5 | 5,860 | 5,940 | -1.4% |
| Q4 (update multa) | 20 | 11,720 | 180 | **98.5%** |
| Q5 (verificar) | 40 | 23,440 | 8,320 | **64.5%** |
| Q6 (perfil prestamos) | 15 | 8,790 | 3,255 | **63.0%** |
| **Total diario** | **360** | **260,770** | **171,215** | **34.3%** |

> **Conclusion:** La fragmentacion vertical de `Usuario` reduce el trafico total diario en **34.3%** (~89.5 KB ahorrados por dia), con ahorros especialmente significativos en Q4 (98.5%) y en consultas de listado sin datos de contacto.

---

## 11. Plan de Accion — Implementacion

### Paso 1: Reparar codificacion UTF-8 (bug existente)

**Problema:** Los datos con acentos y enie se guardaron como `?` porque la conexion MySQL uso `cp850` en vez de `utf8mb4`.

**Acciones:**
- [ ] Agregar `charset: 'utf8mb4'` al `mysql.createPool()` en `backend/db/pool.js`
- [ ] Re-ejecutar la carga de datos con `--default-character-set=utf8mb4`
- [ ] Re-ejecutar scripts SQL usando `cmd /c` con el flag de charset

### Paso 2: Corregir bug del frontend (multas_acumuladas.toFixed)

**Problema:** `mysql2` devuelve `DECIMAL` como string; `.toFixed()` solo funciona en numeros.

**Acciones:**
- [ ] En `frontend/src/pages/Usuarios.jsx` linea 61: cambiar `u.multas_acumuladas.toFixed(2)` por `Number(u.multas_acumuladas).toFixed(2)`
- [ ] Misma correccion en linea 88: `selected.multas_acumuladas.toFixed(2)`
- [ ] Agregar conversion en el `enrich()` del backend (`backend/routes/usuarios.js` lineas 6-11 ya tiene `Number()` — verificar que funcione)

### Paso 3: Crear scripts SQL para la fragmentacion vertical de `Usuario`

Se necesita modificar los scripts `sql/nodoN.sql` (N = 1..6) para implementar los 3 fragmentos verticales.

**Nuevo script `sql/fragmentos_verticales_usuario.sql`:**

```sql
-- Fragmentacion Vertical de Usuario
-- Este script reemplaza la tabla Usuario original por 3 fragmentos verticales

-- Fragmento 1: Perfil (acceso frecuente, JOIN con Sucursal)
CREATE TABLE IF NOT EXISTS UsuarioPerfil (
  id_usuario           INT PRIMARY KEY,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  id_sucursal_registro INT NOT NULL DEFAULT 2,
  CONSTRAINT chk_up_sucursal CHECK (id_sucursal_registro = 2),
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

-- Fragmento 2: Contacto (datos personales poco accedidos)
CREATE TABLE IF NOT EXISTS UsuarioContacto (
  id_usuario           INT PRIMARY KEY,
  email                VARCHAR(150),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  fecha_registro       DATE,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

-- Fragmento 3: Multas (acceso en devoluciones, actualizaciones frecuentes)
CREATE TABLE IF NOT EXISTS UsuarioMultas (
  id_usuario           INT PRIMARY KEY,
  multas_acumuladas    DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

-- Migrar datos existentes (si hay Usuario original)
-- INSERT INTO UsuarioPerfil SELECT id_usuario, nombre, apellidos, id_sucursal_registro FROM Usuario;
-- INSERT INTO UsuarioContacto SELECT id_usuario, email, telefono, direccion, fecha_registro FROM Usuario;
-- INSERT INTO UsuarioMultas SELECT id_usuario, multas_acumuladas FROM Usuario;
-- DROP TABLE Usuario;
```

### Paso 4: Adaptar el backend (`backend/routes/usuarios.js`)

**Cambios necesarios en cada endpoint:**

#### GET /api/usuarios (listar)
```js
// ANTES:
const sql = `SELECT u.*, s.nombre AS sucursal_nombre FROM Usuario u
             JOIN Sucursal s ON u.id_sucursal_registro = s.id_sucursal ORDER BY u.id_usuario`

// DESPUES (JOIN de los 3 fragmentos):
const sql = `SELECT up.id_usuario, up.nombre, up.apellidos, up.id_sucursal_registro,
                    uc.email, uc.telefono, uc.direccion, uc.fecha_registro,
                    um.multas_acumuladas, s.nombre AS sucursal_nombre
             FROM UsuarioPerfil up
             JOIN UsuarioContacto uc ON up.id_usuario = uc.id_usuario
             JOIN UsuarioMultas um ON up.id_usuario = um.id_usuario
             JOIN Sucursal s ON up.id_sucursal_registro = s.id_sucursal
             ORDER BY up.id_usuario`
```

#### GET /api/usuarios/:id (buscar por ID)
- Similar al anterior con `WHERE up.id_usuario = ?`

#### buscarUsuario() en `backend/db/pool.js`
```js
// ANTES:
const rows = await queryLocal('SELECT * FROM Usuario WHERE id_usuario = ?', [idUsuario])

// DESPUES (reconstruir desde los 3 fragmentos):
const rows = await queryLocal(
  `SELECT up.*, uc.email, uc.telefono, uc.direccion, uc.fecha_registro,
          um.multas_acumuladas
   FROM UsuarioPerfil up
   JOIN UsuarioContacto uc ON up.id_usuario = uc.id_usuario
   JOIN UsuarioMultas um ON up.id_usuario = um.id_usuario
   WHERE up.id_usuario = ?`, [idUsuario]
)
```

### Paso 5: Actualizar `backend/routes/prestamos.js` (Q4: UPDATE multa)

```js
// ANTES:
await queryNodo(resultadoUsuario.idNodo,
  'UPDATE Usuario SET multas_acumuladas = multas_acumuladas + ? WHERE id_usuario = ?',
  [multa, p.id_usuario]
)

// DESPUES:
await queryNodo(resultadoUsuario.idNodo,
  'UPDATE UsuarioMultas SET multas_acumuladas = multas_acumuladas + ? WHERE id_usuario = ?',
  [multa, p.id_usuario]
)
```
> Solo se actualiza `UsuarioMultas` (9 bytes por tupla), sin tocar `UsuarioPerfil` ni `UsuarioContacto`.

### Paso 6: Verificar Q5 (verificar existencia)

```js
// ANTES:
const sqlUsuario = 'SELECT id_usuario FROM Usuario WHERE id_usuario = ?'

// DESPUES:
const sqlUsuario = 'SELECT id_usuario FROM UsuarioPerfil WHERE id_usuario = ?'
```
> Solo escanea `UsuarioPerfil` (208 bytes/tupla) en vez de la tabla completa (586 bytes/tupla).

### Paso 7: Verificar endpoints adicionales

| Endpoint | Cambio necesario |
|----------|-----------------|
| `GET /api/sucursales/dashboard` | No usa `Usuario` directamente — sin cambios |
| `GET /api/prestamos` con `enrich()` | Usa `buscarUsuario()` — ya actualizado en Paso 4 |
| `POST /api/prestamos` | Usa `buscarUsuario()` — ya actualizado en Paso 4 |
| `PUT /api/prestamos/:id/devolver` | Actualizar multa — Paso 5 |

### Paso 8: Probar end-to-end

- [ ] Levantar backend con los nuevos fragmentos
- [ ] `GET /api/usuarios` — debe devolver los 2 usuarios del Nodo 2
- [ ] `GET /api/usuarios/2` — debe devolver Carlos Ramirez Lopez
- [ ] `GET /api/usuarios/8/prestamos` — prestamos de Miguel
- [ ] `POST /api/prestamos` — crear prestamo con validacion de usuario remoto
- [ ] `PUT /api/prestamos/:id/devolver` — devolver y verificar que multa se actualiza en `UsuarioMultas`

### Paso 9: Documentar para el Word (A.5, A.8, A.9)

- [ ] Incluir las 5 matrices completas en el documento Word
- [ ] Arboles de consulta iniciales (sin fragmentar) vs optimos (con fragmentos)
- [ ] Calculo de bytes como en la seccion 10 de este documento
- [ ] Diagrama de arquitectura con los 3 fragmentos verticales + fragmentacion horizontal

---

## 12. Resumen de Archivos a Modificar

| Archivo | Cambio | Prioridad |
|---------|--------|:---:|
| `backend/db/pool.js` | Agregar `charset: 'utf8mb4'` + actualizar `buscarUsuario()` | **Alta** |
| `backend/routes/usuarios.js` | JOIN de 3 fragmentos en Q1, Q2, Q3 | **Alta** |
| `backend/routes/prestamos.js` | UPDATE sobre `UsuarioMultas` en Q4 | **Alta** |
| `frontend/src/pages/Usuarios.jsx` | `Number(multas_acumuladas).toFixed(2)` | **Alta** |
| `sql/nodo1.sql` a `sql/nodo6.sql` | Reemplazar tabla `Usuario` por 3 fragmentos | **Alta** |
| `sql/fragmentos_verticales_usuario.sql` | **(NUEVO)** Script de migracion | **Alta** |
| `sql/00_base_todos_los_nodos.sql` | Hacerlo generico (no solo `biblioteca_nodo1`) | Media |
| Documento Word | Secciones A.5, A.8, A.9 | **Alta** |

---

## 13. Diagrama de Reconstruccion

```
                UsuarioPerfil (208 bytes)         +-- Q1-Q6
                +-----------------------+
                | id_usuario (PK)        |+---------------+
                | nombre                  |               |
                | apellidos               |               |
                | id_sucursal_registro     |               |
                +-----------+-------------+               |
                           | JOIN ON id_usuario            |
              +------------+----------+                   |
              |            |          |                   |
              v            v          v                   |
   UsuarioContacto    UsuarioMultas  Sucursal             |
   +--------------+  +----------+  +----------+          |
   | id_usuario   |  |id_usuario|  |id_sucursal|          |
   | email        |  |multas_ac |  |nombre     |          |
   | telefono     |  |          |  |ciudad     |          |
   | direccion    |  |          |  +----------+          |
   | fecha_reg    |  |          |                         |
   +--------------+  +----------+                         |
                                                         |
   Reconstruccion completa:                              |
   SELECT up.*, uc.*, um.*, s.nombre AS suc_nombre       |
   FROM UsuarioPerfil up                                  |
   JOIN UsuarioContacto uc ON up.id_usuario = uc.id_usuario
   JOIN UsuarioMultas um ON up.id_usuario = um.id_usuario
   JOIN Sucursal s ON up.id_sucursal_registro = s.id_sucursal
```

---

## 14. Notas para la Defensa

1. **Por que fragmentar verticalmente una tabla tan pequena (10 usuarios totales)?**
   - Es un ejercicio academico que demuestra la aplicacion de los 5 algoritmos. En produccion, con miles de usuarios, la reduccion de bytes (34.3% diario) es significativa.

2. **Por que 3 fragmentos y no 2?**
   - `UsuarioMultas` (A9) se separa porque Q4 (UPDATE) es la unica consulta que escribe. Aislar las multas en un fragmento separado evita bloqueos de escritura sobre `UsuarioPerfil` (datos de lectura frecuente).

3. **Como se mantiene la integridad referencial?**
   - Las FK entre fragmentos (`UsuarioContacto.id_usuario -> UsuarioPerfil.id_usuario`) garantizan que no haya datos huerfanos.

4. **Que pasa si un nodo se cae?**
   - Los fragmentos estan en el mismo nodo que el usuario (fragmentacion horizontal). Si un nodo cae, ese fragmento no esta disponible, igual que con la tabla original.
