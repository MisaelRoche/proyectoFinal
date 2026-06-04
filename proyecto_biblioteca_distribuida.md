# Proyecto Final — Base de Datos Distribuidas

## Sistema de Biblioteca Distribuida (6 sucursales)

> Documento de planeación y propuesta de proyecto basado en los requerimientos entregados por el profesor.

---

## 1. Concepto general

El sistema modela una red de **6 sucursales** de una biblioteca municipal/universitaria, cada una en una ciudad o zona distinta. Cada nodo (alumno) administra los datos de **su sucursal**: sus libros físicos, sus préstamos y sus usuarios locales. A través de la red distribuida, los nodos pueden consultar el catálogo de otras sucursales, ver disponibilidad de un libro en cualquier punto de la red y realizar préstamos inter-sucursales.

Este dominio justifica de forma natural todos los puntos que pide el documento de requerimientos:

- **Fragmentación Horizontal** por `id_sucursal` sobre las tablas con muchos registros (Préstamo, Inventario).
- **Fragmentación Vertical** sobre Libro (atributos públicos del catálogo vs. atributos administrativos).
- Una consulta representativa por nodo que justifica su fragmento asignado.
- CRUD funcional con conexión entre nodos para insertar, modificar y consultar datos remotos.

---

## 2. Nota importante sobre la red (Hamachi)

LogMeIn descontinuó el plan gratuito de Hamachi y la red gratis está limitada a **5 miembros**. Con 6 nodos hay tres caminos posibles:

1. Que un integrante tenga cuenta de pago de Hamachi.
2. Crear **dos redes Hamachi enlazadas**.
3. Usar una alternativa equivalente como **ZeroTier** (gratis hasta 25 nodos) o **Tailscale**.

Si el profesor es estricto con "Hamachi", confirmar en clase. Si acepta equivalentes funcionales, ZeroTier es la opción más sencilla.

---

## 3. Modelo Entidad-Relación

### Tablas propuestas

| # | Tabla | Propósito |
|---|-------|-----------|
| 1 | **Sucursal** | Catálogo de las 6 sucursales |
| 2 | **Libro** | Catálogo global de libros (datos públicos + administrativos) |
| 3 | **Inventario** | Copias disponibles de cada libro en cada sucursal |
| 4 | **Usuario** | Lectores registrados |
| 5 | **Prestamo** | Registro de préstamos y devoluciones |
| 6 | **Categoria** | Clasificación de libros |
| 7 | **Empleado** | Personal que registra préstamos (opcional) |

### Atributos por tabla

**Sucursal**
- `id_sucursal` (PK), `nombre`, `direccion`, `ciudad`, `telefono`, `responsable`

**Libro**
- `id_libro` (PK), `isbn`, `titulo`, `autor`, `editorial`, `año`, `id_categoria` (FK), `paginas`, `idioma`, `costo`, `proveedor`, `fecha_adquisicion`

**Inventario**
- `id_inventario` (PK), `id_libro` (FK), `id_sucursal` (FK), `copias_totales`, `copias_disponibles`, `ubicacion_fisica`

**Usuario**
- `id_usuario` (PK), `nombre`, `apellidos`, `email`, `telefono`, `direccion`, `id_sucursal_registro` (FK), `fecha_registro`, `multas_acumuladas`

**Prestamo**
- `id_prestamo` (PK), `id_usuario` (FK), `id_libro` (FK), `id_sucursal` (FK), `fecha_prestamo`, `fecha_devolucion_esperada`, `fecha_devolucion_real`, `estatus`, `multa`

**Categoria**
- `id_categoria` (PK), `nombre`, `descripcion`

**Empleado** (opcional)
- `id_empleado` (PK), `nombre`, `id_sucursal` (FK), `puesto`

### Sobre la 4FN

Con el diseño anterior se cumple naturalmente hasta 3FN/BCNF. Para forzar y demostrar explícitamente 4FN, se puede introducir una tabla puente:

- **Libro_Autor** — `id_libro` (FK), `id_autor` (FK)
- **Autor** — `id_autor` (PK), `nombre`, `nacionalidad`

Esto resuelve la dependencia multivaluada "un libro puede tener varios autores y un autor varios libros", lo cual encaja perfecto para justificar el paso a 4FN.

---

## 4. Aplicación de algoritmos

### 4.1 Fragmentación Horizontal — COM-MIN sobre `Prestamo`

La tabla **Prestamo** es la candidata ideal porque:

- Tiene gran volumen de registros.
- Naturalmente se asocia a una sucursal (`id_sucursal`).
- Genera 6 fragmentos disjuntos, uno por nodo.

**Predicados simples propuestos:**

```
p1: id_sucursal = 1
p2: id_sucursal = 2
p3: id_sucursal = 3
p4: id_sucursal = 4
p5: id_sucursal = 5
p6: id_sucursal = 6
p7: estatus = 'activo'
p8: estatus = 'devuelto'
p9: multa > 0
```

Sobre estos predicados se aplica el algoritmo COM-MIN para obtener un conjunto **completo y mínimo** de predicados, y a partir de ahí los **minterms** que definen los fragmentos horizontales finales.

### 4.2 Fragmentación Vertical sobre `Libro`

La tabla **Libro** es ideal porque tiene atributos que se consultan en grupos diferenciados:

- **Grupo público (catálogo):** `id_libro`, `isbn`, `titulo`, `autor`, `editorial`, `año`, `id_categoria`, `idioma`, `paginas`
- **Grupo administrativo:** `id_libro`, `costo`, `proveedor`, `fecha_adquisicion`

**Algoritmos a aplicar (en orden):**

1. **MU — Matriz de Uso:** define qué atributos usa cada consulta representativa (1 si la consulta usa el atributo, 0 si no).
2. **MFA — Matriz de Frecuencia de Acceso:** frecuencia con que cada nodo ejecuta cada consulta.
3. **MAA — Matriz de Afinidad de Atributos:** suma de frecuencias por pares de atributos.
4. **BEA — Bond Energy Algorithm:** reordena filas/columnas de MAA para agrupar atributos afines.
5. **MAC — Matriz de Afinidad Clusterizada:** resultado del BEA, lista para particionar.
6. **Particionamiento + Z-value:** define el punto de corte óptimo entre TA (Top Application) y BA (Bottom Application).

**Consultas representativas sugeridas (5-7):**

| ID | Consulta | Atributos que toca |
|----|----------|--------------------|
| q1 | Buscar libro por título y autor | titulo, autor |
| q2 | Listar libros por categoría | id_categoria, titulo |
| q3 | Reporte de costos de adquisición por proveedor | costo, proveedor, fecha_adquisicion |
| q4 | Catálogo público para usuarios | titulo, autor, editorial, año, idioma |
| q5 | Auditoría de inventario | id_libro, costo, fecha_adquisicion |
| q6 | Buscar por ISBN | isbn, titulo |
| q7 | Reporte por editorial y año | editorial, año, titulo |

---

## 5. Asignación de fragmentos por nodo

Propuesta inicial (ajustable según el equipo):

| Nodo | Sucursal | Fragmento Horizontal (Prestamo) | Fragmento Vertical (Libro) |
|------|----------|----------------------------------|------------------------------|
| 1 | Mexicali Centro | Préstamos sucursal 1 | Catálogo público (replicado) |
| 2 | Tijuana | Préstamos sucursal 2 | Catálogo público (replicado) |
| 3 | Ensenada | Préstamos sucursal 3 | Catálogo público (replicado) |
| 4 | Mexicali Universidad | Préstamos sucursal 4 | Datos administrativos de Libro |
| 5 | Rosarito | Préstamos sucursal 5 | Catálogo público (replicado) |
| 6 | Tecate | Préstamos sucursal 6 | Catálogo público (replicado) |

El nodo 4 funciona como "central de adquisiciones" guardando los datos administrativos. El resto replica el catálogo público para consultas rápidas locales.

---

## 6. Consultas representativas por nodo

Cada nodo plantea una consulta que justifica su fragmento. Ejemplos:

- **Nodo 1:** Listar préstamos activos de la sucursal con datos del libro y usuario.
- **Nodo 2:** Top 10 libros más prestados en la sucursal en el último mes.
- **Nodo 3:** Usuarios con más de 3 préstamos vencidos en la sucursal.
- **Nodo 4:** Costo total de adquisiciones del año por categoría (consulta administrativa).
- **Nodo 5:** Disponibilidad de un libro específico en todas las sucursales.
- **Nodo 6:** Préstamos inter-sucursales (libros prestados en una sucursal distinta a la de registro del usuario).

Para cada consulta:

1. **Árbol de consulta inicial** (forma directa, sin optimización).
2. **Aplicación de reglas de equivalencia algebraica:** empujar selecciones, reordenar joins, eliminar proyecciones redundantes.
3. **Árbol óptimo** resultante.
4. **Cálculo de bytes** de cada alternativa para demostrar que la elegida es la de menor costo.

---

## 7. Plan de trabajo por fases

| Fase | Semana | Entregable |
|------|--------|------------|
| 1. Análisis y Diseño | 1-2 | Introducción, ER, mapeo, normalización 4FN, esquema relacional final |
| 2. Fragmentación Horizontal | 2 | COM-MIN sobre Prestamo, predicados, minterms, fragmentos |
| 3. Fragmentación Vertical | 3 | MU, MFA, MAA, BEA, MAC, particionamiento sobre Libro |
| 4. Asignación a nodos | 3 | Tabla de asignación justificada |
| 5. Consultas y Optimización | 4 | Una consulta por nodo, árboles, álgebra, cálculo de bytes |
| 6. Implementación CRUD | 4-5 | App funcional en MySQL + lenguaje elegido |
| 7. Red distribuida | 5 | Hamachi/ZeroTier configurado, conexión entre los 6 nodos |
| 8. Pruebas, video y documentación | 6 | PRTSC, video por nodo, Word final, envío por correo |

---

## 8. Recomendaciones de stack para el CRUD

| Opción | Pros | Contras |
|--------|------|---------|
| **Python + Flask + mysql-connector** | Rápido de implementar, UI mínima en HTML | Requiere servidor en cada nodo |
| **C# WinForms + MySQL Connector/NET** | Clásico de clases de BD, fácil de demostrar | Solo Windows |
| **Node.js + Express + EJS** | Familiar si el equipo sabe JS | Overkill para un CRUD de demo |

**Recomendación:** C# WinForms o Python+Flask, según el lenguaje que domine la mayoría del equipo.

---

## 9. Configuración de la red distribuida

### Hamachi / ZeroTier
1. Crear red, invitar a los 6 nodos.
2. Verificar que cada nodo tenga IP en la red virtual.
3. Probar `ping` entre nodos.

### MySQL — habilitar acceso remoto
En `my.cnf` (o `my.ini` en Windows):

```ini
[mysqld]
bind-address = 0.0.0.0
```

Crear usuario remoto:

```sql
CREATE USER 'biblioteca'@'%' IDENTIFIED BY 'password_seguro';
GRANT ALL PRIVILEGES ON biblioteca_db.* TO 'biblioteca'@'%';
FLUSH PRIVILEGES;
```

Abrir puerto 3306 en firewall de cada nodo.

### Probar conexión cruzada
Desde nodo 1 hacia nodo 2:

```bash
mysql -h 25.x.x.x -u biblioteca -p
```

---

## 10. Convenciones del equipo (acordar antes de empezar)

- **Nombres de tablas y columnas idénticos en los 6 nodos** (snake_case sugerido).
- **Script SQL maestro compartido** con esquema y datos semilla.
- **Definir desde el inicio qué se replica y qué se fragmenta:**
  - El catálogo de Libros conviene replicarlo o centralizarlo, no fragmentarlo horizontalmente.
  - Préstamos e Inventario sí se fragmentan por sucursal.
- **Un repositorio compartido** (GitHub) con la documentación, scripts y código de cada nodo.

---

## 11. Entregables finales (según el documento del profesor)

1. **Documentación completa** (Word) con análisis y diseño + PRTSC del sistema funcionando.
2. **Video grabado** mostrando la funcionalidad del sistema.
3. **Carpeta por alumno** con código del nodo, imágenes de acceso e ejecución, video de la función del nodo.
4. **Anexos** que considere necesarios para reforzar la evaluación.
5. Envío por **correo oficial** en la fecha del ordinario.

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Hamachi limitado a 5 nodos | Usar ZeroTier o cuenta de pago |
| Nombres de tablas inconsistentes entre nodos | Script SQL maestro común |
| Un nodo no responde durante demo | Tener respaldo del esquema completo en un solo nodo |
| Firewall bloquea puerto 3306 | Revisar reglas de Windows Defender / UFW antes del día de entrega |
| Diferencias de zona horaria en `fecha_prestamo` | Usar `UTC_TIMESTAMP()` o acordar zona única |

---
