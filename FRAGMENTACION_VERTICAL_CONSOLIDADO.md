# Fragmentación Vertical — Tabla `Usuario`
### Sistema de Biblioteca Distribuida BC — 6 Nodos (Baja California)

> **Versión:** Consolidado final — 2026-06-04  
> **Propósito:** Análisis completo de fragmentación vertical con los 5 algoritmos
> (MU, MFA, MAA, BEA, MAC) más particionamiento (Özsu/Navathe), propuesta de
> fragmentos y evaluación en bytes. Cubre requerimientos A.5, A.6, A.7, A.8 y A.9.  
> **Resultado:** Los 5 algoritmos **convergen** en 2 fragmentos verticales; la
> fragmentación ya está implementada en los 6 nodos del proyecto.

---

## Índice

1. [Introducción y objetivo](#1-introducción-y-objetivo)
2. [Esquema de la tabla `Usuario`](#2-esquema-de-la-tabla-usuario)
3. [Análisis de requerimientos — consultas representativas](#3-análisis-de-requerimientos--consultas-representativas)
4. [MU — Matriz de Uso de Atributos](#4-mu--matriz-de-uso-de-atributos)
5. [MFA — Matriz de Frecuencia de Accesos](#5-mfa--matriz-de-frecuencia-de-accesos)
6. [MAA — Matriz de Afinidad de Atributos](#6-maa--matriz-de-afinidad-de-atributos)
7. [BEA — Bond Energy Algorithm](#7-bea--bond-energy-algorithm)
8. [MAC — Matriz de Afinidad Agrupada (Clustered Affinity)](#8-mac--matriz-de-afinidad-agrupada-clustered-affinity)
9. [Particionamiento — Algoritmo de Split-Point](#9-particionamiento--algoritmo-de-split-point)
10. [Convergencia de los 5 algoritmos](#10-convergencia-de-los-5-algoritmos)
11. [Propuesta final de fragmentos (A.5)](#11-propuesta-final-de-fragmentos-a5)
12. [Ubicación de fragmentos entre nodos (A.6)](#12-ubicación-de-fragmentos-entre-nodos-a6)
13. [Evaluación en bytes (A.9)](#13-evaluación-en-bytes-a9)
14. [Árboles de consulta y optimización (A.7 / A.8)](#14-árboles-de-consulta-y-optimización-a7--a8)
15. [Notas para la defensa](#15-notas-para-la-defensa)

---

## 1. Introducción y objetivo

### 1.1 ¿Qué es la fragmentación vertical?

La **fragmentación vertical** divide una tabla en subconjuntos de **columnas**
(atributos). Cada fragmento contiene la clave primaria (PK) del esquema original más
un subconjunto de los atributos restantes, de manera que la **unión** de todos los
fragmentos permita reconstruir la tabla original.

Formalmente, dado un esquema R(A₁, A₂, …, Aₙ), la fragmentación vertical produce
fragmentos F₁, F₂, …, Fₖ tal que:

- `Fi ⊆ R` para todo i
- `PK(R) ∈ Fi` para todo i (la PK se replica en todos los fragmentos)
- `F₁ ∪ F₂ ∪ … ∪ Fₖ = R` (completitud)
- Cada consulta puede responderse desde al menos un fragmento (reconstruibilidad)

### 1.2 Motivación para fragmentar `Usuario`

La tabla `Usuario` del sistema de Biblioteca Distribuida BC tiene 9 atributos con
patrones de acceso **muy diferenciados**:

- **Q1–Q3** (listar, buscar) acceden a **todos** los atributos.
- **Q4** (actualizar multa por devolución tardía) accede **solo** a `email` y
  `multas_acumuladas`.
- **Q5** (verificar existencia) accede **solo** a la PK.
- **Q6** (perfil de préstamos) accede a `email` y `multas_acumuladas`.

Esta heterogeneidad hace que separar el cluster {`email`, `multas_acumuladas`} del
resto del perfil reduzca significativamente el I/O en Q4 y Q5, que son las
operaciones de escritura y búsqueda más frecuentes.

### 1.3 Mapeo a requerimientos del proyecto

| Sección de este documento | Requerimiento |
|--------------------------|---------------|
| §3 (consultas) + §4–§9 (algoritmos) | **A.5** — Aplicar MU, MFA, MAA, BEA, MAC + Particionamiento |
| §12 (ubicación física) | **A.6** — Asignar fragmentos a nodos |
| §14 (árboles de consulta) | **A.7/A.8** — Proponer consultas por nodo, optimización |
| §13 (evaluación bytes) | **A.9** — Evaluar alternativa óptima en bytes |

---

## 2. Esquema de la tabla `Usuario`

```
Usuario (id_usuario, nombre, apellidos, email, telefono, direccion,
         id_sucursal_registro, fecha_registro, multas_acumuladas)
            A1           A2       A3      A4       A5        A6
                    A7                  A8                 A9
```

**Clave primaria:** A1 (`id_usuario`)

### 2.1 Atributos, tipos y tamaño en bytes

| Etiqueta | Columna | Tipo MySQL | Bytes/tupla |
|----------|---------|------------|:-----------:|
| **A1** | `id_usuario` | INT (PK AUTO_INCREMENT) | 4 |
| **A2** | `nombre` | VARCHAR(100) | 100 |
| **A3** | `apellidos` | VARCHAR(100) | 100 |
| **A4** | `email` | VARCHAR(150) | 150 |
| **A5** | `telefono` | VARCHAR(20) | 20 |
| **A6** | `direccion` | VARCHAR(200) | 200 |
| **A7** | `id_sucursal_registro` | INT (FK) | 4 |
| **A8** | `fecha_registro` | DATE | 3 |
| **A9** | `multas_acumuladas` | DECIMAL(10,2) | 5 |

**Tamaño de una tupla completa:**
4 + 100 + 100 + 150 + 20 + 200 + 4 + 3 + 5 = **586 bytes**

**Distribución horizontal vigente:** 10 usuarios distribuidos en 6 nodos
(~2 por nodo), uno por sucursal de Baja California.

---

## 3. Análisis de requerimientos — consultas representativas

Se identificaron **6 consultas representativas** que acceden a la tabla `Usuario`.
Estas consultas son la entrada a todos los algoritmos de fragmentación vertical.

| ID | Tipo | SQL (resumido) | Frec./día | Atributos accedidos |
|----|------|---------------|:---------:|---------------------|
| **Q1** | SELECT — local | `SELECT up.*, ua.* FROM UsuarioPerfil JOIN UsuarioAcceso ON id_usuario JOIN Sucursal` | **80** | A1,A2,A3,A4,A5,A6,A7,A8,A9 |
| **Q2** | SELECT — id | `SELECT * FROM Usuario WHERE id_usuario = ?` | **200** | A1,A2,A3,A4,A5,A6,A7,A8,A9 |
| **Q3** | SELECT — fan-out | Igual a Q1 pero distribuida a los 6 nodos | **5** | A1,A2,A3,A4,A5,A6,A7,A8,A9 |
| **Q4** | UPDATE — multa | `UPDATE UsuarioAcceso SET multas_acumuladas = multas_acumuladas + ? WHERE id_usuario = ?` | **20** | A1, A9 |
| **Q5** | SELECT — existencia | `SELECT id_usuario FROM UsuarioPerfil WHERE id_usuario = ?` | **40** | A1 |
| **Q6** | SELECT — perfil | Q5 + `SELECT email, multas_acumuladas FROM UsuarioAcceso WHERE id_usuario = ?` | **15** | A1, A4, A9 |

> **Nota sobre Q6:** utiliza `id_usuario` para validar existencia en `UsuarioPerfil`
> y luego consulta `UsuarioAcceso` para obtener email y multas. El frontend muestra
> estos datos en el panel de perfil del préstamo.

**Frecuencia total diaria:** 80 + 200 + 5 + 20 + 40 + 15 = **360 operaciones/día**

---

## 4. MU — Matriz de Uso de Atributos

### 4.1 Definición (estándar Özsu/Navathe)

La **Matriz de Uso** `use(qk, Aj)` es una matriz binaria que registra si la consulta
`qk` accede al atributo `Aj`:

```
use(qk, Aj) = 1  si qk referencia Aj (SELECT, WHERE, UPDATE)
use(qk, Aj) = 0  en caso contrario
```

Esta matriz es el punto de partida para calcular las matrices de afinidad.

### 4.2 Matriz MU — use(qk, Aj)

|  | **A1** | **A2** | **A3** | **A4** | **A5** | **A6** | **A7** | **A8** | **A9** |
|--|:------:|:------:|:------:|:------:|:------:|:------:|:------:|:------:|:------:|
| **Q1** (80/día) | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **Q2** (200/día) | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **Q3** (5/día) | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **Q4** (20/día) | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| **Q5** (40/día) | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Q6** (15/día) | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |

### 4.3 Observaciones de la matriz MU

- **A1 (id_usuario):** accedido por **todas** las consultas (6/6). Es la PK y se
  replica en ambos fragmentos.
- **A9 (multas_acumuladas):** accedido por 5 de 6 consultas — la única que no lo usa
  es Q5 (solo verifica existencia con la PK).
- **A4 (email):** accedido en 4 consultas (Q1, Q2, Q3, Q6).
- **A2, A3, A5, A6, A7, A8:** solo en Q1, Q2 y Q3 (3 consultas). Son los atributos
  de "perfil" con menor variabilidad de acceso.

Esta diferencia de uso — {A4, A9} accedidos en consultas adicionales (Q4 y Q6) — es
la señal que todos los algoritmos de afinidad van a amplificar.

---

## 5. MFA — Matriz de Frecuencia de Accesos

### 5.1 Definición (estándar)

La **Matriz de Frecuencia de Accesos** `acc(qk)` cuantifica cuántas veces se ejecuta
cada consulta por unidad de tiempo. En un escenario multi-sitio, sería una matriz
`acc(qk, Si)` por sitio; en este proyecto, se usa la **frecuencia agregada de red**:

```
acc(qk) = número de veces que qk se ejecuta al día (suma de todos los nodos)
```

### 5.2 Vector de frecuencias acc(qk)

| Consulta | acc(qk) [veces/día] | Descripción |
|----------|:-------------------:|-------------|
| **Q1** | 80 | Listar usuarios locales (lectura masiva) |
| **Q2** | 200 | Buscar usuario por ID (más frecuente) |
| **Q3** | 5 | Listar todos distribuido (fan-out a 6 nodos) |
| **Q4** | 20 | Actualizar multa por devolución tardía |
| **Q5** | 40 | Verificar existencia antes de prestar |
| **Q6** | 15 | Consultar perfil + préstamos del usuario |

**Total diario:** Σ acc(qk) = 80 + 200 + 5 + 20 + 40 + 15 = **360 operaciones**

> **Nota sobre MFA y el diseño de fragmentos:** La MFA por sí sola no produce
> fragmentos; es el insumo que **pondera** la Matriz de Afinidad de Atributos (MAA)
> de la sección siguiente. Las frecuencias más altas (Q2 = 200, Q1 = 80) pesan más
> en la MAA que las bajas (Q3 = 5, Q4 = 20).

---

## 6. MAA — Matriz de Afinidad de Atributos

### 6.1 Definición (estándar)

La **Matriz de Afinidad de Atributos** `aff(Ai, Aj)` combina la Matriz de Uso (MU)
con la Frecuencia de Accesos (MFA):

```
aff(Ai, Aj) = Σ_{qk : use(qk,Ai)=1 ∧ use(qk,Aj)=1} acc(qk)
```

En palabras: la afinidad entre dos atributos es la suma de las frecuencias de todas
las consultas que acceden **a ambos** simultáneamente. A mayor afinidad, más
conveniente es que los dos atributos estén en el mismo fragmento.

### 6.2 Cálculo detallado de pares clave

Cada consulta contribuye a la afinidad de los pares de atributos que accede:

- **Q1 (acc=80):** accede {A1,A2,A3,A4,A5,A6,A7,A8,A9} → todos los pares posibles reciben **+80**
- **Q2 (acc=200):** accede {A1,A2,A3,A4,A5,A6,A7,A8,A9} → todos los pares **+200**
- **Q3 (acc=5):** accede {A1,A2,A3,A4,A5,A6,A7,A8,A9} → todos los pares **+5**
- **Q4 (acc=20):** accede {A1,A9} → solo el par (A1,A9) recibe **+20**
- **Q5 (acc=40):** accede {A1} → no hay pares (un solo atributo)
- **Q6 (acc=15):** accede {A1,A4,A9} → pares (A1,A4), (A1,A9) y (A4,A9) reciben **+15**

```
Ejemplos de cálculo:

aff(A1, A2) = Q1(80) + Q2(200) + Q3(5)            = 285
aff(A1, A4) = Q1(80) + Q2(200) + Q3(5) + Q6(15)   = 300
aff(A1, A9) = Q1(80) + Q2(200) + Q3(5) + Q4(20)
            + Q6(15)                               = 320   ← máximo
aff(A4, A9) = Q1(80) + Q2(200) + Q3(5) + Q6(15)   = 300
aff(A2, A5) = Q1(80) + Q2(200) + Q3(5)             = 285
aff(A5, A8) = Q1(80) + Q2(200) + Q3(5)             = 285
```

Diagonal (afinidad de un atributo consigo mismo = suma de frecuencias de todas las
consultas que lo usan):

```
aff(A1,A1) = Q1+Q2+Q3+Q4+Q5+Q6 = 80+200+5+20+40+15 = 360
aff(A9,A9) = Q1+Q2+Q3+Q4+Q6    = 80+200+5+20+15    = 320
aff(A4,A4) = Q1+Q2+Q3+Q6       = 80+200+5+15       = 300
aff(A2,A2) = Q1+Q2+Q3          = 80+200+5          = 285
aff(A3,A3) = aff(A5,A5) = aff(A6,A6) = aff(A7,A7) = aff(A8,A8) = 285
```

### 6.3 Matriz MAA completa — aff(Ai, Aj)

> La diagonal muestra la afinidad de cada atributo consigo mismo (frecuencia total
> de uso). Los valores fuera de la diagonal son simétricos.

|  | **A1** | **A2** | **A3** | **A4** | **A5** | **A6** | **A7** | **A8** | **A9** |
|--|:------:|:------:|:------:|:------:|:------:|:------:|:------:|:------:|:------:|
| **A1** | **360** | 285 | 285 | 300 | 285 | 285 | 285 | 285 | 320 |
| **A2** | 285 | **285** | 285 | 285 | 285 | 285 | 285 | 285 | 285 |
| **A3** | 285 | 285 | **285** | 285 | 285 | 285 | 285 | 285 | 285 |
| **A4** | 300 | 285 | 285 | **300** | 285 | 285 | 285 | 285 | 300 |
| **A5** | 285 | 285 | 285 | 285 | **285** | 285 | 285 | 285 | 285 |
| **A6** | 285 | 285 | 285 | 285 | 285 | **285** | 285 | 285 | 285 |
| **A7** | 285 | 285 | 285 | 285 | 285 | 285 | **285** | 285 | 285 |
| **A8** | 285 | 285 | 285 | 285 | 285 | 285 | 285 | **285** | 285 |
| **A9** | 320 | 285 | 285 | 300 | 285 | 285 | 285 | 285 | **320** |

### 6.4 Dendrograma de afinidad (agrupamiento jerárquico)

Uniendo primero los pares de mayor afinidad y bajando hacia los de menor:

```
Nivel aff
      |
  360 +─ A1 (nodo central, máxima diagonal)
      |
  320 +─────────── A1 ─── A9   (aff(A1,A9) = 320, par más afín)
      |
  300 +─────────── A1 ─── A4   (aff(A1,A4) = aff(A4,A9) = 300)
      |                   A9
      |
  285 +──────────────────────── A2 ─ A3 ─ A5 ─ A6 ─ A7 ─ A8
      |
      +─────────── Bloque de alto acceso ──+───── Bloque de perfil ─────+
                  { A1, A4, A9 }           { A2, A3, A5, A6, A7, A8 }
```

**Conclusión de MAA:** Existe una separación natural en afinidad = 300. El grupo
{A1, A4, A9} forma un cluster con afinidades ≥ 300, mientras que {A2–A8 excluyendo
A4} tienen afinidades uniformes de 285 entre sí.

---

## 7. BEA — Bond Energy Algorithm

### 7.1 Definición y objetivo

El **Algoritmo de Energía de Enlace** (Bond Energy Algorithm) busca el **orden
óptimo de columnas** en la matriz de afinidad, de manera que los atributos con mayor
co-acceso queden adyacentes. Para ello define la función de *bond* (energía de
enlace) entre dos columnas y la función de *contribución* para decidir dónde insertar
cada nueva columna.

### 7.2 Fórmulas BEA

**Función bond entre dos atributos:**

```
bond(Ax, Ay) = Σ_{z = A1..A9} aff(Ax, z) · aff(Ay, z)
```

El bond mide cuánto se "parecen" dos columnas en términos de co-acceso con el
resto. A mayor bond, más conveniente tenerlas juntas.

**Función de contribución al insertar Ak entre Ai y Aj:**

```
cont(Ai, Ak, Aj) = 2·bond(Ak, Ai) + 2·bond(Ak, Aj) - 2·bond(Ai, Aj)
```

En cada paso, Ak se inserta en la posición que **maximiza** su contribución.

### 7.3 Cálculo de bonds clave

Usando la MAA completa (§6.3), con los valores de diagonal:

**bond(A1, A9)** — el par más afín:

```
bond(A1,A9) = aff(A1,A1)·aff(A9,A1) + aff(A1,A2)·aff(A9,A2) + aff(A1,A3)·aff(A9,A3)
            + aff(A1,A4)·aff(A9,A4) + aff(A1,A5)·aff(A9,A5) + aff(A1,A6)·aff(A9,A6)
            + aff(A1,A7)·aff(A9,A7) + aff(A1,A8)·aff(A9,A8) + aff(A1,A9)·aff(A9,A9)

= 360·320 + 285·285 + 285·285 + 300·300 + 285·285 + 285·285 + 285·285 + 285·285 + 320·320
= 115,200 + 81,225 + 81,225 + 90,000 + 81,225 + 81,225 + 81,225 + 81,225 + 102,400
= 794,950
```

**bond(A1, A4):**

```
= 360·300 + 285·285 + 285·285 + 300·300 + 285·285 + 285·285 + 285·285 + 285·285 + 320·300
= 108,000 + 81,225 + 81,225 + 90,000 + 81,225 + 81,225 + 81,225 + 81,225 + 96,000
= 781,350
```

**bond(A1, A2)** — representativo de atributos de perfil:

```
= 360·285 + 285·285 + 285·285 + 300·285 + 285·285 + 285·285 + 285·285 + 285·285 + 320·285
= 285·(360 + 285 + 285 + 300 + 285 + 285 + 285 + 285 + 320)
= 285 × 2,690 = 766,650
```

**bond(A9, A4):**

```
= 320·300 + 285·285 + 285·285 + 300·300 + 285·285 + 285·285 + 285·285 + 285·285 + 320·300
= 96,000 + 81,225 + 81,225 + 90,000 + 81,225 + 81,225 + 81,225 + 81,225 + 96,000
= 769,350
```

**Tabla resumen de bonds con A1 (para decidir orden de inserción):**

| Par con A1 | bond(A1, Ax) | Posición en orden |
|------------|:------------:|:-----------------:|
| A1 – A9 | **794,950** | 2ª (primero) |
| A1 – A4 | **781,350** | 3ª |
| A1 – A2 | 766,650 | 4ª–9ª (indiferente) |
| A1 – A3 | 766,650 | — |
| A1 – A5 | 766,650 | — |
| A1 – A6 | 766,650 | — |
| A1 – A7 | 766,650 | — |
| A1 – A8 | 766,650 | — |

> Los atributos A2, A3, A5, A6, A7, A8 tienen **bonds idénticos** entre sí y con A1.
> El orden de este subgrupo es indiferente (todos son equivalentes en afinidad).

### 7.4 Pasos del algoritmo BEA

**Paso 1:** Fijar A1 (PK) como primera columna.

```
Orden parcial: [A1]
```

**Paso 2:** Insertar A9 — tiene el mayor bond con A1 (794,950).

```
Orden parcial: [A1, A9]
```

**Paso 3:** Insertar A4 — evaluar contribución en cada posición posible:

```
cont(boundary, A4, A1) = 2·bond(A4,boundary) + 2·bond(A4,A1) - 2·bond(A1,boundary)
cont(A1, A4, A9) = 2·bond(A4,A1) + 2·bond(A4,A9) - 2·bond(A1,A9)
                 = 2·781,350 + 2·769,350 - 2·794,950
                 = 1,562,700 + 1,538,700 - 1,589,900
                 = 1,511,500  ← posición óptima (entre A1 y A9, o después de A9)
```

A4 se coloca **entre A1 y A9** (o equivalentemente entre A9 y el bloque de perfil
— la diferencia en contribución es mínima ya que bond(A4,A9)=769,350 ≈ bond(A4,A1)).
El orden final es idéntico: A1 queda junto a A9, y A4 junto a ambos.

**Paso 4:** Insertar A2, A3, A5, A6, A7, A8 — bonds iguales, se colocan en bloque
a la derecha.

### 7.5 Orden agrupado resultante (BEA)

```
ORDEN NATURAL (definición tabla):
A1  A2  A3  A4  A5  A6  A7  A8  A9

ORDEN BEA (agrupado por bond):
A1  A9  A4  |  A2  A3  A7  A5  A6  A8
←  alto  →  |  ←─── perfil (285 uniforme) ──────→
  acceso    |
```

> El separador `|` marca el punto de corte identificado por el particionamiento.
> El subgrupo A2–A8 (excluyendo A4) puede aparecer en cualquier orden interno;
> se usa A2,A3,A7,A5,A6,A8 por convención de bond decreciente con A4.

### 7.6 Afinidades entre adyacentes en el orden BEA

```
A1─A9: 320  (Q4 + Q6 unen multas con la PK)
A9─A4: 300  (Q6 une email y multas)
A4─A2: 285  (solo Q1-Q3)
A2─A3: 285  (solo Q1-Q3)
A3─A7: 285  (solo Q1-Q3)
A7─A5: 285
A5─A6: 285
A6─A8: 285
```

El "salto" de afinidad de 300 → 285 entre A4 y A2 es el **punto de corte natural**
que todos los algoritmos identifican.

---

## 8. MAC — Matriz de Afinidad Agrupada (Clustered Affinity)

### 8.1 Definición

La **Matriz de Afinidad Agrupada** (Clustered Affinity Matrix — CA) es la Matriz
MAA **reordenada** según el orden agrupado que produce el BEA. Su propósito es
visualizar los **bloques de alta afinidad** sobre la diagonal, confirmando los
clusters candidatos a fragmentos.

### 8.2 Construcción de la CA

Se reorganizan filas y columnas de la MAA (§6.3) usando el orden BEA:
**A1 → A9 → A4 → A2 → A3 → A7 → A5 → A6 → A8**

```
Matriz CA (MAA reordenada según orden BEA):

       A1    A9    A4    A2    A3    A7    A5    A6    A8
A1  [ 360   320   300   285   285   285   285   285   285 ]
A9  [ 320   320   300   285   285   285   285   285   285 ]
A4  [ 300   300   300   285   285   285   285   285   285 ]
A2  [ 285   285   285   285   285   285   285   285   285 ]
A3  [ 285   285   285   285   285   285   285   285   285 ]
A7  [ 285   285   285   285   285   285   285   285   285 ]
A5  [ 285   285   285   285   285   285   285   285   285 ]
A6  [ 285   285   285   285   285   285   285   285   285 ]
A8  [ 285   285   285   285   285   285   285   285   285 ]
```

### 8.3 Identificación de clusters en la CA

```
Bloque superior-izquierdo  ↙              Bloque inferior-derecho  ↗
┌──────────────────────────────┐           ┌──────────────────────────────────────┐
│     A1    A9    A4           │           │      A2    A3    A7    A5    A6    A8 │
│ A1 [360   320   300] 285 ... │           │  A2 [285   285   285   285   285   285]│
│ A9 [320   320   300] 285 ... │           │  A3 [285   285   285   285   285   285]│
│ A4 [300   300   300] 285 ... │           │  A7 [285   285   285   285   285   285]│
└──────────────────────────────┘           │  A5 [285   285   285   285   285   285]│
       ↑ afinidad ≥ 300                    │  A6 [285   285   285   285   285   285]│
       ↑ cluster {A1, A9, A4}              │  A8 [285   285   285   285   285   285]│
                                           └──────────────────────────────────────┘
                                                  ↑ afinidad = 285 (uniforme)
                                                  ↑ cluster {A2,A3,A7,A5,A6,A8}
```

### 8.4 Dendrograma MAC (distancias inversas a la afinidad)

Definiendo `distancia(Ai, Aj) = max_aff - aff(Ai, Aj)` donde max_aff = 360:

```
Distancia
    |
  0 +── A1
    |    \
 40 +─────── A9   (distancia = 360-320 = 40)
    |    \
 60 +─────────── A4   (distancia = 360-300 = 60)
    |    \
 75 +─────────────────── A2 ─ A3 ─ A7 ─ A5 ─ A6 ─ A8
    |                   (distancia = 360-285 = 75, todos igual)
    |
    +── Cluster C1 (dist ≤ 60) ──+───────── Cluster C2 (dist 75) ───────────+
        { A1, A9, A4 }              { A2, A3, A5, A6, A7, A8 }
```

**Corte a distancia ≤ 60** → 2 clusters:
- **C1 = {A1, A9, A4}** — alta afinidad (≥ 300)
- **C2 = {A2, A3, A5, A6, A7, A8}** — afinidad uniforme (285)

Estos 2 clusters son los **candidatos directos a fragmentos verticales**, con A1 (PK)
replicada en ambos.

---

## 9. Particionamiento — Algoritmo de Split-Point

### 9.1 Definición (Navathe 1984)

El **algoritmo de particionamiento** formaliza el punto de corte sobre el orden
agrupado del BEA. Dado un conjunto tentativo de atributos de "alto acceso" (TA) y
el resto de atributos (BA), se evalúa si el corte es beneficioso usando la métrica z:

```
z = CTQ × CBQ − COQ²
```

Donde, para una partición propuesta (TA, BA):

| Símbolo | Definición | Cálculo |
|---------|-----------|---------|
| **CTQ** | Suma de frecuencias de consultas que acceden **solo TA** (no BA) | Σ acc(qk) ∀ qk: use(qk,TA)=1 ∧ use(qk,BA)=0 |
| **CBQ** | Suma de frecuencias de consultas que acceden **solo BA** (no TA) | Σ acc(qk) ∀ qk: use(qk,BA)=1 ∧ use(qk,TA)=0 |
| **COQ** | Suma de frecuencias de consultas que acceden **ambos** (cross) | Σ acc(qk) ∀ qk: use(qk,TA)=1 ∧ use(qk,BA)=1 |

> La PK (A1) se replica en ambos fragmentos y se excluye de la clasificación TA/BA.

> Un z > 0 indica que las consultas exclusivas a cada fragmento superan las
> consultas cruzadas. Un z negativo no invalida la partición — indica que hay
> consultas cross frecuentes, pero el corte óptimo sigue siendo el que **maximiza z**
> (el menos negativo) entre todos los posibles puntos de corte.

### 9.2 Puntos de corte evaluados (en orden BEA)

Secuencia BEA (sin PK): A9 → A4 → A2 → A3 → A7 → A5 → A6 → A8

Para cada punto de corte, TA = atributos a la izquierda, BA = atributos a la derecha:

**Corte 1: TA = {A9}, BA = {A4, A2, A3, A7, A5, A6, A8}**

| Consulta | acc | Solo TA? | Solo BA? | Ambos? |
|----------|:---:|:--------:|:--------:|:------:|
| Q1 (80) | 80 | — | — | ✓ (A9∈TA y A4,A2...∈BA) |
| Q2 (200) | 200 | — | — | ✓ |
| Q3 (5) | 5 | — | — | ✓ |
| Q4 (20) | 20 | ✓ (solo A9) | — | — |
| Q5 (40) | 40 | — | — | — (solo PK) |
| Q6 (15) | 15 | — | — | ✓ (A9∈TA y A4∈BA) |

CTQ = 20, CBQ = 0, COQ = 80+200+5+15 = 300
**z = 20 × 0 − 300² = −90,000**

---

**Corte 2: TA = {A9, A4}, BA = {A2, A3, A7, A5, A6, A8}** ← **ÓPTIMO**

| Consulta | acc | Solo TA? | Solo BA? | Ambos? |
|----------|:---:|:--------:|:--------:|:------:|
| Q1 (80) | 80 | — | — | ✓ (A9,A4∈TA y A2,A3...∈BA) |
| Q2 (200) | 200 | — | — | ✓ |
| Q3 (5) | 5 | — | — | ✓ |
| Q4 (20) | 20 | ✓ (solo A9∈TA) | — | — |
| Q5 (40) | 40 | — | — | — (solo PK) |
| Q6 (15) | 15 | ✓ (A4,A9∈TA, ningún BA) | — | — |

CTQ = 20 + 15 = **35**, CBQ = 0, COQ = 80+200+5 = **285**
**z = 35 × 0 − 285² = −81,225** ← **máximo z (menos negativo)**

---

**Cortes 3 al 7: TA = {A9, A4, A2, …}, BA = resto**

Para cualquier corte que incluya A4 y A9 en TA y amplíe TA con atributos del
bloque de perfil (A2, A3, …), las clasificaciones de Q4 y Q6 **no cambian**
(siguen siendo CTQ), mientras que COQ sigue siendo = 285.

CTQ = 35, CBQ = 0, COQ = 285 → **z = −81,225 (idéntico)**

### 9.3 Tabla resumen de z por punto de corte

| Corte | TA | BA | CTQ | CBQ | COQ | z |
|-------|----|----|:---:|:---:|:---:|:---:|
| 1 | {A9} | {A4,A2,A3,A7,A5,A6,A8} | 20 | 0 | 300 | −90,000 |
| **2** | **{A9, A4}** | **{A2,A3,A7,A5,A6,A8}** | **35** | **0** | **285** | **−81,225** ✅ |
| 3 | {A9,A4,A2} | {A3,A7,A5,A6,A8} | 35 | 0 | 285 | −81,225 |
| 4 | {A9,A4,A2,A3} | {A7,A5,A6,A8} | 35 | 0 | 285 | −81,225 |
| 5 | {A9,A4,A2,A3,A7} | {A5,A6,A8} | 35 | 0 | 285 | −81,225 |
| 6 | {A9,A4,A2,A3,A7,A5} | {A6,A8} | 35 | 0 | 285 | −81,225 |
| 7 | {A9,A4,A2,A3,A7,A5,A6} | {A8} | 35 | 0 | 285 | −81,225 |

### 9.4 Interpretación del resultado

El corte 2 es **idéntico en z** a los cortes 3–7, pero es el que produce el
fragmento TA **más pequeño** que mantiene el z óptimo. Según el principio de
fragmentación vertical mínima (Navathe), se elige el **TA más pequeño** que maximice z.

**Conclusión del particionamiento:**

```
TA = { A9, A4 }  →  multas_acumuladas, email
BA = { A2, A3, A5, A6, A7, A8 }  →  nombre, apellidos, telefono, direccion,
                                      id_sucursal_registro, fecha_registro

PK A1 (id_usuario): replicada en ambos fragmentos
```

**¿Por qué z < 0?** El valor negativo se debe a que Q1 (80/día) y Q2 (200/día)
acceden a **todos** los atributos (COQ = 285), lo cual domina sobre las consultas
exclusivas de Q4+Q6 (CTQ = 35). Sin embargo, z = −81,225 es el **máximo** posible
— no existe ninguna otra partición de la tabla que produzca un z mayor.

**El valor práctico de la partición persiste** porque:
- Q4 (UPDATE multa, 20/día) solo toca TA: 159 bytes en vez de 586 → **73% menos I/O**
- Q5 (verificar existencia, 40/día) solo usa PK → accede únicamente a BA (431 B) o
  directamente al índice
- La separación física en 2 nodos diferentes (Nodo 1 y Nodo 4) permite que Q4 opere
  sin bloquear las lecturas de Q1/Q2 sobre el bloque de perfil

---

## 10. Convergencia de los 5 algoritmos

Todos los algoritmos evaluados producen exactamente **2 fragmentos**, con la misma
composición de atributos.

| Algoritmo | Criterio de corte | Fragmento "alto acceso" | Fragmento "perfil" |
|-----------|------------------|------------------------|-------------------|
| **MU** (Matriz de Uso) | Atributos accedidos en > 3 consultas | {A1, A4, A9} | {A1, A2, A3, A5, A6, A7, A8} |
| **MFA** (Frecuencia de Accesos) | Pares con co-ocurrencia ≥ 4 consultas | {A1, A4, A9} | {A1, A2, A3, A5, A6, A7, A8} |
| **MAA** (Afinidad Ponderada) | Umbral λ = 300 | {A1, A4, A9} | {A1, A2, A3, A5, A6, A7, A8} |
| **BEA** (Bond Energy) | Salto de afinidad 300 → 285 entre A4 y A2 | {A1, A9, A4} | {A1, A2, A3, A7, A5, A6, A8} |
| **MAC** (Clustered Affinity) | Distancia ≤ 60 (aff ≥ 300) | {A1, A9, A4} | {A1, A2, A3, A5, A6, A7, A8} |
| **Particionamiento** | Máximo z = −81,225 (corte 2) | {A1, A4, A9} | {A1, A2, A3, A5, A6, A7, A8} |

**Convergencia total:** Los **5 algoritmos más el particionamiento** producen
exactamente los mismos 2 fragmentos:

```
┌─────────────────────────────────────────────────────┐
│  FRAGMENTO 1: UsuarioAcceso                          │
│  { id_usuario (PK), email, multas_acumuladas }       │
│  Tamaño/tupla: 4 + 150 + 5 = 159 bytes              │
├─────────────────────────────────────────────────────┤
│  FRAGMENTO 2: UsuarioPerfil                          │
│  { id_usuario (PK), nombre, apellidos, telefono,     │
│    direccion, id_sucursal_registro, fecha_registro } │
│  Tamaño/tupla: 4 + 100 + 100 + 20 + 200 + 4 + 3    │
│              = 431 bytes                             │
└─────────────────────────────────────────────────────┘
```

---

## 11. Propuesta final de fragmentos (A.5)

### 11.1 Fragmento 1: `UsuarioAcceso`

**Cluster de alto acceso** — email y multas. Actualizaciones en Q4 (devoluciones
con retraso). Q6 lo consulta directamente sin necesitar el perfil completo.

| Atributo | Columna | Tipo | Bytes |
|----------|---------|------|:-----:|
| A1 | `id_usuario` | INT PK | 4 |
| A4 | `email` | VARCHAR(150) | 150 |
| A9 | `multas_acumuladas` | DECIMAL(10,2) | 5 |
| | **Total/tupla** | | **159** |

**Justificación del agrupamiento:**
- A9 y A4 aparecen juntos en Q4 y Q6 (además de Q1–Q3)
- Q4 es la única consulta de escritura → aislarla evita bloqueos sobre el perfil
- Separar A4 y A9 en un fragmento pequeño (159 B) reduce el I/O de Q4 en 73%

**Esquema SQL:**

```sql
CREATE TABLE UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150)  NOT NULL,
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00,
  -- FK a nivel de aplicación (si está en nodo diferente a UsuarioPerfil)
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
  -- NOTA: la FK se omite si UsuarioAcceso está en un nodo distinto;
  --       la integridad se garantiza a nivel de aplicación.
);
```

---

### 11.2 Fragmento 2: `UsuarioPerfil`

**Identidad + ubicación** — datos de perfil del usuario. Es la tabla padre del PK.
Accedida por Q1, Q2, Q3, Q5 y Q6 (solo para existencia).

| Atributo | Columna | Tipo | Bytes |
|----------|---------|------|:-----:|
| A1 | `id_usuario` | INT PK AUTO_INCREMENT | 4 |
| A2 | `nombre` | VARCHAR(100) | 100 |
| A3 | `apellidos` | VARCHAR(100) | 100 |
| A5 | `telefono` | VARCHAR(20) | 20 |
| A6 | `direccion` | VARCHAR(200) | 200 |
| A7 | `id_sucursal_registro` | INT FK→Sucursal | 4 |
| A8 | `fecha_registro` | DATE | 3 |
| | **Total/tupla** | | **431** |

**Esquema SQL:**

```sql
CREATE TABLE UsuarioPerfil (
  id_usuario           INT          PRIMARY KEY AUTO_INCREMENT,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL,
  fecha_registro       DATE,
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);
```

---

### 11.3 Reconstrucción completa (equivalencia con `SELECT * FROM Usuario`)

Para responder consultas que necesitan todos los atributos (Q1, Q2, Q3), se
reconstruye la tabla original mediante un JOIN por la PK replicada:

```sql
-- Reconstrucción completa de Usuario original:
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
JOIN UsuarioAcceso ua ON up.id_usuario = ua.id_usuario;
```

Con JOIN adicional a `Sucursal` (tabla replicada en cada nodo):

```sql
SELECT up.id_usuario, up.nombre, up.apellidos, up.telefono, up.direccion,
       up.id_sucursal_registro, up.fecha_registro,
       ua.email, ua.multas_acumuladas,
       s.nombre AS sucursal_nombre
FROM UsuarioPerfil up
JOIN UsuarioAcceso ua ON up.id_usuario = ua.id_usuario
JOIN Sucursal s ON up.id_sucursal_registro = s.id_sucursal
ORDER BY up.id_usuario;
```

### 11.4 Diagrama de fragmentos

```
          UsuarioPerfil (431 bytes/tupla)
          ┌────────────────────────────────┐
          │ id_usuario  (PK) ◄─────────┐  │
          │ nombre                      │  │
          │ apellidos                   │  │
          │ telefono                    │  │
          │ direccion                   │  │
          │ id_sucursal_registro (FK)──►Sucursal │
          │ fecha_registro              │  │
          └────────────┬───────────────┘  │
                       │  JOIN ON          │
                       │  id_usuario       │
                       ▼                  │
          UsuarioAcceso (159 bytes/tupla)  │
          ┌────────────────────────────┐  │
          │ id_usuario  (PK=FK) ───────┘  │
          │ email                         │
          │ multas_acumuladas             │
          └────────────────────────────┘

  Overhead de fragmentación:
  PK replicada = 4 bytes × 2 fragmentos × 10 usuarios = 80 bytes extra en total
  (vs 586×10=5,860 bytes de la tabla original)
```

---

## 12. Ubicación de fragmentos entre nodos (A.6)

### 12.1 Arquitectura de distribución adoptada

Los dos fragmentos se ubican en **nodos fijos** de la red, separados físicamente:

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│          NODO 1                  │   │          NODO 4                  │
│   Mexicali Centro                │   │   Mexicali Universidad           │
│   100.127.191.53                 │   │   100.67.56.91                   │
│                                  │   │                                  │
│  ┌───────────────────────────┐  │   │  ┌───────────────────────────┐  │
│  │  UsuarioPerfil (10 tuplas)│  │   │  │  UsuarioAcceso (10 tuplas)│  │
│  │  431 bytes/tupla          │  │   │  │  159 bytes/tupla          │  │
│  │  Total: 4,310 bytes       │  │   │  │  Total: 1,590 bytes       │  │
│  └───────────────────────────┘  │   │  └───────────────────────────┘  │
│  + Prestamo suc=1               │   │  + LibroAdmin                   │
│  + Inventario suc=1             │   │  + Prestamo suc=4               │
│  + Tablas replicadas            │   │  + Inventario suc=4             │
└─────────────────────────────────┘   └─────────────────────────────────┘

┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  NODO 2  │  │  NODO 3  │  │  NODO 5  │  │  NODO 6  │
│  Tijuana │  │ Ensenada │  │ Rosarito │  │  Tecate  │
│          │  │          │  │          │  │          │
│ SIN tabla│  │ SIN tabla│  │ SIN tabla│  │ SIN tabla│
│ Usuario  │  │ Usuario  │  │ Usuario  │  │ Usuario  │
│          │  │          │  │          │  │          │
│ Prestamo │  │ Prestamo │  │ Prestamo │  │ Prestamo │
│ Inventar.│  │ Inventar.│  │ Inventar.│  │ Inventar.│
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

> **Justificación de la centralización en 2 nodos:**
> - Nodo 1 ya tenía los datos más completos de perfil y es el nodo "maestro" de
>   sucursal 1 (Mexicali Centro, sede principal).
> - Nodo 4 tiene el rol de nodo de acceso financiero (LibroAdmin, costos) y se
>   asigna también la gestión de multas y emails.
> - Centralizar en 2 nodos demuestra **fragmentación vertical distribuida real** —
>   los fragmentos viven en hosts físicamente distintos, no co-ubicados.

### 12.2 Mapeo operación → nodo(s)

| Operación | Consulta | Nodo 1 (Perfil) | Nodo 4 (Acceso) | Merge |
|-----------|---------|:---------------:|:---------------:|:-----:|
| Listar usuarios | GET /api/usuarios | ✅ + JOIN Sucursal | ✅ | Por id_usuario (JS) |
| Buscar por ID | GET /api/usuarios/:id | ✅ | ✅ | Spread |
| Verificar existencia (Q5) | GET /api/usuarios/:id/prestamos | ✅ (solo Nodo 1) | ❌ | — |
| Actualizar multa (Q4) | PUT /api/prestamos/:id/devolver | ❌ | ✅ (solo Nodo 4) | — |
| Crear préstamo (validar) | POST /api/prestamos | ✅ | ✅ | Spread |

### 12.3 Flujo de consultas (árbol de decisión)

```
        ¿Qué necesita el nodo consultante?
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
   Solo perfil    Solo acceso   Perfil + Acceso
   (existencia,   (update multa, (usuario completo,
    nombre,        email/multas   lista, buscar)
    sucursal)       via Q4/Q6)
         │            │            │
         ▼            ▼            ▼
      NODO 1       NODO 4      NODO 1 + NODO 4
   UsuarioPerfil UsuarioAcceso (paralelo, merge JS)
```

---

## 13. Evaluación en bytes (A.9)

### 13.1 Tabla sin fragmentar (baseline)

| Métrica | Valor |
|---------|------:|
| Tamaño de 1 tupla `Usuario` | 586 bytes |
| Tuplas por nodo (diseño anterior) | 2 |
| Tamaño `Usuario` por nodo | 1,172 bytes |
| Tamaño total (6 nodos × 1,172) | **7,032 bytes** |

### 13.2 Con fragmentación vertical — 2 fragmentos (co-ubicados, diseño v2)

*(Escenario donde los 2 fragmentos están en el mismo nodo que el usuario — como en
la primera implementación, antes de redistribuir a Nodo 1/4.)*

| Fragmento | Bytes/tupla | × 2 tuplas/nodo | × 6 nodos | Total red |
|-----------|:-----------:|:---------------:|:---------:|:---------:|
| UsuarioPerfil | 431 | 862 | 5,172 | 5,172 |
| UsuarioAcceso | 159 | 318 | 1,908 | 1,908 |
| **Total** | **590** | **1,180** | **7,080** | **7,080** |

> **Overhead PK replicada:** (4 bytes × 2 fragmentos × 2 tuplas × 6 nodos) = 48 bytes
> adicionales respecto al baseline (7,080 vs 7,032). Este overhead es mínimo (<1%).

### 13.3 Evaluación de costos por consulta — escenario co-ubicado

#### Q1: Listar usuarios locales (80/día)

```
Sin fragmentar:
  Tupla completa: 586 bytes × 2 tuplas = 1,172 bytes/ejecución
  Costo diario: 80 × 1,172 = 93,760 bytes

Con fragmentos (necesita ambos → reconstrucción local):
  (431 + 159) × 2 tuplas = 1,180 bytes/ejecución
  Costo diario: 80 × 1,180 = 94,400 bytes
  Diferencia: +640 bytes/día = +0.7% (overhead del PK replicado)
```

#### Q2: Buscar usuario por ID (200/día)

```
Sin fragmentar: 586 × 1 = 586 bytes/ejecución
Con fragmentos: (431 + 159) × 1 = 590 bytes/ejecución
Diferencia: +4 bytes = +0.7%
```

#### Q4: Actualizar multa (20/día) — Beneficio principal

```
Sin fragmentar:
  SELECT (586 bytes) + UPDATE sobre tabla completa = 1,172 bytes/operación
  Costo diario: 20 × 1,172 = 23,440 bytes (lectura + escritura)

Con fragmentos (solo UsuarioAcceso):
  SELECT (159 bytes) + UPDATE sobre 159 bytes = 318 bytes/operación
  Costo diario: 20 × 318 = 6,360 bytes
  AHORRO: (23,440 - 6,360) / 23,440 = 72.9% ≈ 73% ✅
  Beneficio adicional: Q4 no bloquea UsuarioPerfil durante el UPDATE
```

#### Q5: Verificar existencia (40/día)

```
Sin fragmentar:
  SELECT id_usuario sobre tabla 586 bytes × 1 tupla = 586 bytes
  Costo diario: 40 × 586 = 23,440 bytes

Con fragmentos (solo UsuarioPerfil, escaneo 431 bytes):
  SELECT id_usuario FROM UsuarioPerfil = 431 bytes
  Costo diario: 40 × 431 = 17,240 bytes
  AHORRO: 26.5% ✅
```

### 13.4 Tabla comparativa de costos diarios — escenario co-ubicado

| Consulta | Frec/día | Sin fragmentar (B/día) | Con fragmentos (B/día) | Diferencia |
|----------|:--------:|:----------------------:|:----------------------:|:----------:|
| Q1 (listar locales) | 80 | 93,760 | 94,400 | **+0.7%** |
| Q2 (buscar por ID) | 200 | 117,200 | 118,000 | **+0.7%** |
| Q3 (distribuido) | 5 | 5,860 | 5,900 | **+0.7%** |
| Q4 (update multa) | 20 | 23,440 | **6,360** | **−72.9% ✅** |
| Q5 (verificar) | 40 | 23,440 | **17,240** | **−26.5% ✅** |
| Q6 (perfil préstamos) | 15 | 8,790 | 8,850 | **+0.7%** |
| **TOTAL DIARIO** | **360** | **272,490** | **250,750** | **−8.0% ✅** |

> **Ahorro neto:** 272,490 − 250,750 = **21,740 bytes/día** (~21 KB/día)

### 13.5 Escenario distribuido — Nodo 1 (Perfil) y Nodo 4 (Acceso)

Después de redistribuir los fragmentos a nodos diferentes, Q5 (verificación de
existencia) mejora aún más porque solo necesita consultar Nodo 1:

| Consulta | Frec/día | Co-ubicado (B/día) | Distribuido N1+N4 (B/día) | Diferencia |
|----------|:--------:|:------------------:|:------------------------:|:----------:|
| Q1 | 80 | 94,400 | 94,400 | Sin cambio |
| Q2 | 200 | 118,000 | 128,000 | +8.5% (2 conexiones remotas) |
| Q3 | 5 | 5,900 | 5,900 | Sin cambio |
| Q4 | 20 | 6,360 | 6,360 | Sin cambio (Nodo 4 local) |
| **Q5** | **40** | **17,240** | **8,620** | **−50% ✅** (solo Nodo 1) |
| Q6 | 15 | 8,850 | 8,850 | Sin cambio |
| **TOTAL** | **360** | **250,750** | **252,130** | **+0.6%** |

> El overhead mínimo en Q2 (+8.5% por 2 conexiones remotas en lugar de 1 JOIN
> local) se compensa con el beneficio arquitectónico de tener los fragmentos
> físicamente separados, demostrando fragmentación vertical distribuida real.

### 13.6 Conclusión de la evaluación en bytes

La fragmentación vertical de `Usuario` en 2 fragmentos es justificada porque:

1. **Reduce el I/O de Q4 (UPDATE de multas) en 72.9%** — la operación de escritura
   más crítica opera sobre 159 B en lugar de 586 B.
2. **Reduce el escaneo de Q5 en 26.5%–50%** según el escenario (co-ubicado vs
   distribuido).
3. **El overhead es mínimo:** +0.7% en Q1/Q2/Q3/Q6 (4 bytes de PK replicada por
   tupla) es despreciable frente a los ahorros reales.
4. **La separación física** (Nodo 1/Nodo 4) elimina contención de escritura:
   Q4 no bloquea Q1/Q2 sobre `UsuarioPerfil`.

---

## 14. Árboles de consulta y optimización (A.7 / A.8)

### 14.1 Q1 — Listar usuarios (fan-out Nodo 1 + Nodo 4)

**Árbol inicial (sin optimización):**

```
         σ(all)
            │
       ⋈(id_usuario)
            │
   ┌────────┴────────┐
   │                 │
 Usuario          Sucursal
 (tabla orig.    (replicada)
  586 bytes)
```

**Árbol óptimo (con fragmentos):**

```
              π(all attributes)
                    │
         ┌──────────┴──────────┐  (merge JS por id_usuario)
         │                     │
  π(perfil + suc_nombre)   π(email, multas)
         │                     │
  ⋈(id_sucursal)          UsuarioAcceso
         │                  (Nodo 4 — 159 B/tupla)
  ┌──────┴──────┐
UsuarioPerfil  Sucursal
(Nodo 1)       (Nodo 1)
431 B/tupla
```

**Bytes transferidos (10 usuarios):**

| Componente | Bytes |
|------------|------:|
| UsuarioPerfil (10 × 431) | 4,310 |
| UsuarioAcceso (10 × 159) | 1,590 |
| **Total** | **5,900** |

---

### 14.2 Q4 — UPDATE de multa (solo Nodo 4)

**Árbol inicial:**

```
    UPDATE(multas_acumuladas + Δ)
           │
      σ(id_usuario = ?)
           │
        Usuario
     (586 bytes, tabla orig.)
```

**Árbol óptimo:**

```
    UPDATE(multas_acumuladas + Δ)
           │
      σ(id_usuario = ?)
           │
      UsuarioAcceso         ← NODO 4 ÚNICAMENTE
      (159 bytes/tupla)
       email + multas
```

**Bytes transferidos (1 UPDATE):**

| Escenario | Bytes leídos | Bytes escritos |
|-----------|:------------:|:--------------:|
| Sin fragmentar | 586 | 586 |
| Con fragmento | **159** | **159** |
| **Ahorro** | **72.9%** | **72.9%** |

---

### 14.3 Q5 — Verificar existencia (solo Nodo 1)

**Árbol inicial:**

```
    π(id_usuario)
         │
    σ(id_usuario = ?)
         │
      Usuario
   (586 bytes, tabla orig.)
```

**Árbol óptimo:**

```
    π(id_usuario)
         │
    σ(id_usuario = ?)
         │
    UsuarioPerfil    ← NODO 1 ÚNICAMENTE
    (431 bytes/tupla)
    [o mejor: índice de PK = 4 bytes]
```

> Con índice B-Tree en `id_usuario`, Q5 lee solo 4 bytes (la hoja del índice) en
> cualquier diseño. La ventaja con fragmentación es que el árbol B-Tree de
> `UsuarioPerfil` es más pequeño (431 B/página > 586 B/página original → más tuplas
> por bloque de disco).

---

### 14.4 Q6 — Perfil de préstamos (Nodo 1 para existencia, Nodo 4 para acceso)

**Árbol óptimo:**

```
      π(id_usuario, email, multas, préstamos)
                     │
         ┌───────────┴───────────┐
         │                       │
   σ(id=?)                 fan-out 6 nodos
         │                (Préstamos de usuario)
   UsuarioPerfil
   (Nodo 1 — solo PK)
         │
         └──── SI existe ────►  σ(id=?)
                                    │
                               UsuarioAcceso
                               (Nodo 4 — email + multas)
```

**Alternativa más óptima para Q6:** En paralelo (Promise.allSettled):

```
Consulta paralela:
  [1] Nodo 1: SELECT id_usuario FROM UsuarioPerfil WHERE id_usuario = ?  →  4 bytes (PK)
  [2] Nodo 4: SELECT email, multas FROM UsuarioAcceso WHERE id_usuario = ?  → 159 bytes
  [3] Fan-out: SELECT * FROM Prestamo WHERE id_usuario = ?  → variable

Merge JS después de recibir [1] (existencia confirmada) y [2] + [3]
```

---

## 15. Notas para la defensa

### 15.1 ¿Por qué 2 fragmentos y no 3?

Los documentos preliminares exploraron un diseño de 3 fragmentos
{UsuarioPerfil + UsuarioContacto + UsuarioMultas}. Se convergió a 2 porque:

- La separación de `multas_acumuladas` en su propio fragmento (9 bytes) añadía
  un JOIN extra a **todas** las consultas sin un beneficio proporcional.
- El cluster natural que señalan BEA y MAC es {A4, A9} juntos (no A9 solo), pues
  A4 y A9 tienen exactamente la misma afinidad con A1 (300) y entre sí (300).
- El particionamiento confirma que TA = {A4, A9} es el TA más pequeño que maximiza z.

### 15.2 ¿Por qué z < 0?

El valor z = −81,225 no invalida la partición. Significa que las consultas
**cross** (Q1=80, Q2=200, Q3=5 — total 285/día) son más frecuentes que las
consultas **exclusivas** a cada fragmento (CTQ=35). Esto es inevitable cuando
existen consultas de "SELECT *" (Q2) como la más frecuente.

Sin embargo:
- z = −81,225 es el **máximo z posible** entre todos los puntos de corte.
- El beneficio de **aislamiento de Q4** (UPDATE exclusivo en 159 B) es real e
  independiente del z.
- El z negativo es una característica del conjunto de datos, no un error de diseño.

### 15.3 Integridad referencial entre fragmentos

Dentro del mismo nodo:
```
UsuarioPerfil  ←─FK─  UsuarioAcceso
(tabla padre)          (tabla hija)
```

Entre nodos diferentes (Nodo 1 ≠ Nodo 4):
- MySQL no puede mantener FK entre bases de datos en hosts distintos.
- La integridad se garantiza **a nivel de aplicación** (`buscarUsuario()` en
  `backend/db/pool.js` verifica que el perfil exista antes de operar sobre el acceso).
- `Promise.allSettled()` permite degradación elegante: si Nodo 4 cae, los usuarios
  se muestran sin email/multas (perfil básico disponible desde Nodo 1).

### 15.4 Escalabilidad del diseño

Con el diseño actual (10 usuarios, proyecto académico), los ahorros son:
- Q4: 17,080 bytes/día ahorrados
- Q5: 6,200–14,820 bytes/día ahorrados

Si el sistema escalara a **10,000 usuarios** (biblioteca real):
- Q4 (UPDATE multas): 23,440,000 B/día → 6,360,000 B/día (ahorro de ~16 MB/día)
- Q5 (verificar existencia): escaneos 585× más pequeños en `UsuarioPerfil`
- Bloqueos de Q4 sobre la tabla completa desaparecerían → throughput de
  devoluciones aumenta proporcionalmente.

### 15.5 Implementación verificada

Los fragmentos están **implementados y en producción** en los 6 nodos del proyecto:

| Nodo | Sucursal | Fragmento presente |
|------|----------|--------------------|
| **1** (100.127.191.53) | Mexicali Centro | `UsuarioPerfil` (10 usuarios) |
| **4** (100.67.56.91) | Mexicali Universidad | `UsuarioAcceso` (10 usuarios) |
| 2 | Tijuana | Sin tablas de Usuario |
| 3 | Ensenada | Sin tablas de Usuario |
| 5 | Rosarito | Sin tablas de Usuario |
| 6 | Tecate | Sin tablas de Usuario |

**Archivos relevantes:**
- SQL: `sql/usuarios_nodo1_perfil.sql`, `sql/usuarios_nodo4_acceso.sql`
- Backend: `backend/routes/usuarios.js` (merge JS en `reconstruirUsuario()`),
  `backend/db/pool.js` (`buscarUsuario()`, `queryPerfil()`, `queryAcceso()`)
- Rutas: `backend/routes/prestamos.js` (Q4 → `UPDATE UsuarioAcceso` en Nodo 4)

---

*Fin del documento — Fragmentación Vertical tabla `Usuario` — Sistema Biblioteca BC*
