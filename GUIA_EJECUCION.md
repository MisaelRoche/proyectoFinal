# GUÍA DE EJECUCIÓN — Sistema de Biblioteca Distribuida BC

> Documento de contexto completo para levantar los 6 nodos y demostrar el sistema distribuido.
> Generado el 2026-06-03.

---

## 1. Resumen del sistema

Sistema de biblioteca distribuida en **6 sucursales del estado de Baja California**. Cada integrante administra un nodo (una sucursal) con su propia instancia de MySQL. Los 6 nodos se conectan mediante la VPN **Tailscale** (equivalente funcional a Hamachi, justificado porque Hamachi gratuito topa en 5 nodos).

**Stack tecnológico:**
- Base de datos: **MySQL 8.x** (uno por PC)
- Red VPN: **Tailscale** — IPs del rango `100.x.x.x`, no cambian aunque cambies de WiFi
- Backend: **Node.js + Express** (v18+), puerto 3001
- Frontend: **React + Vite**, puerto 5173
- Driver MySQL: **mysql2** (paquete npm)

---

## 2. Tabla maestra de nodos

| Nodo | IP Tailscale | Sucursal | Usuario MySQL | Contraseña | id_sucursal |
|------|-------------|----------|---------------|------------|-------------|
| **1** | `100.127.191.53`  | Mexicali Centro     | `biblioteca`       | `Biblioteca123!` | 1 |
| **2** | `100.88.250.105`  | Tijuana             | `bibliotecaNodo2`  | `nodo2.`         | 2 |
| **3** | `100.121.240.118` | Ensenada            | `bibliotecaNodo3`  | `nodo3.`         | 3 |
| **4** | `100.67.56.91`    | Mexicali Universidad| `biblioteca_nodo4` | `Biblioteca123!` | 4 |
| **5** | `100.95.94.48`    | Rosarito            | `bibliotecaNodo5`  | `nodo5.`         | 5 |
| **6** | `100.114.254.124` | Tecate              | `bibliotecaNodo6`  | `nodo6.`         | 6 |

> **Nota de seguridad:** las credenciales están en `backend/config/nodos.js` (cada backend necesita conocer las de los 6 nodos para poder conectarse remotamente).

---

## 3. Diseño de fragmentación

### 3.1 Tabla de distribución por nodo

| Tabla | Tipo | En qué nodos | Predicado |
|-------|------|-------------|-----------|
| `Categoria` | **Replicada** | Los 6 | — (6 filas, referencia) |
| `Sucursal` | **Replicada** | Los 6 | — (6 filas, referencia) |
| `Libro` (catálogo público) | **Vertical Replicado** | Los 6 | Columnas: isbn, titulo, autor, editorial, anio, id_categoria, paginas, idioma |
| `LibroAdmin` (costo, proveedor, fecha) | **Vertical Exclusivo** | Solo Nodo 4 | Columnas: costo, proveedor, fecha_adquisicion |
| `Usuario` | **Horizontal** | Cada nodo = 1 fragmento | `id_sucursal_registro = N` |
| `Inventario` | **Horizontal** | Cada nodo = 1 fragmento | `id_sucursal = N` |
| `Prestamo` | **Horizontal** | Cada nodo = 1 fragmento | `id_sucursal = N` |

### 3.2 Regla de integridad distribuida (clave para la defensa)

`Prestamo` **NO tiene FK física a `Usuario`** porque el prestatario puede estar registrado en un nodo distinto al que registra el préstamo (préstamo inter-sucursal). La integridad se valida a nivel de aplicación: `buscarUsuario(idUsuario)` en `backend/db/pool.js` busca al usuario en todos los nodos antes de registrar el préstamo.

Ejemplo en el sistema: El Nodo 6 (Tecate) tiene préstamos de los usuarios 2 (Tijuana) y 5 (Rosarito).

### 3.3 Fragmentación Horizontal — Algoritmo COM-MIN sobre `Prestamo`

Predicados simples:
```
p1: id_sucursal = 1   p2: id_sucursal = 2   p3: id_sucursal = 3
p4: id_sucursal = 4   p5: id_sucursal = 5   p6: id_sucursal = 6
p7: estatus = 'activo'   p8: estatus = 'devuelto'   p9: multa > 0
```
Fragmentos resultantes:
- F1 = σ(id_sucursal=1)(Prestamo) → Nodo 1
- F2 = σ(id_sucursal=2)(Prestamo) → Nodo 2
- …
- F6 = σ(id_sucursal=6)(Prestamo) → Nodo 6

### 3.4 Fragmentación Vertical — sobre `Libro`

La tabla original `Libro` se parte en dos proyecciones que comparten la PK `id_libro`:

- **Fragmento público** (π catálogo): replicado en los 6 nodos como tabla `Libro`
- **Fragmento admin** (π costos): exclusivo del Nodo 4, tabla `LibroAdmin`
- **Reconstrucción**: `Libro JOIN LibroAdmin ON id_libro` = tabla original completa

---

## 4. Estructura de archivos clave

```
proyectoFinal/
├── sql/
│   ├── 00_base_todos_los_nodos.sql   ← Tablas replicadas (los 6 lo ejecutan)
│   ├── nodo1.sql                      ← Fragmentos de Mexicali Centro
│   ├── nodo2.sql                      ← Fragmentos de Tijuana
│   ├── nodo3.sql                      ← Fragmentos de Ensenada
│   ├── nodo4.sql                      ← Fragmentos de Mexicali Universidad
│   ├── nodo4_libro_admin.sql          ← Fragmento vertical (SOLO Nodo 4)
│   ├── nodo5.sql                      ← Fragmentos de Rosarito
│   └── nodo6.sql                      ← Fragmentos de Tecate + inter-sucursales
├── backend/
│   ├── config/
│   │   └── nodos.js    ← IPs + credenciales de los 6 nodos + MI_NODO
│   ├── db/
│   │   └── pool.js     ← queryLocal / queryNodo / queryTodos / buscarUsuario
│   ├── routes/
│   │   ├── sucursales.js   ← Dashboard distribuido (fan-out)
│   │   ├── libros.js       ← Catálogo local; disponibilidad fan-out; admin Nodo 4
│   │   ├── prestamos.js    ← CRUD distribuido; validación usuario remota
│   │   └── usuarios.js     ← Fragmento local; búsqueda distribuida
│   ├── .env.example    ← Copiar a .env y poner MI_NODO
│   └── server.js
└── frontend/
    └── src/
        └── api/client.js   ← Consume /api del backend local
```

---

## 5. Setup por nodo — Checklist

Cada integrante realiza estos pasos **en su propia PC**, en orden:

### 5.1 Red VPN
```
[ ] Instalar Tailscale (tailscale.com)
[ ] Iniciar sesión y unirse a la red del equipo
[ ] Verificar que tu IP sea la correcta (ver tabla sección 2)
[ ] Hacer ping a los otros nodos: ping 100.127.191.53  (etc.)
```

### 5.2 MySQL
```
[ ] Instalar MySQL 8.x
[ ] Editar bind-address = 0.0.0.0 en my.ini / mysqld.cnf
[ ] Reiniciar el servicio MySQL
[ ] Abrir puerto 3306 en el firewall (Windows: regla de entrada TCP 3306)
[ ] Ejecutar el CREATE USER + GRANT de tu nodo (sección 3b del configuracion_nodos_distribuidos.md)
```

### 5.3 Cargar los scripts SQL (en orden)
```
[ ] Ejecutar: sql/00_base_todos_los_nodos.sql
[ ] Ejecutar: sql/nodoN.sql  (N = tu número de nodo)
[ ] SOLO Nodo 4: Ejecutar sql/nodo4_libro_admin.sql
[ ] Verificar: SELECT COUNT(*) FROM Prestamo;  (debe traer solo los de tu sucursal)
```

### 5.4 Backend
```
[ ] Copiar backend/.env.example → backend/.env
[ ] Editar .env: poner MI_NODO=N (tu número)
[ ] cd backend && npm install      (instala mysql2, dotenv, etc.)
[ ] npm run dev
[ ] Verificar en consola: "Nodo N — <nombre sucursal> (IP)"
```

### 5.5 Frontend
```
[ ] cd frontend && npm install
[ ] npm run dev
[ ] Abrir http://localhost:5173
```

---

## 6. Orden de scripts SQL por nodo

| Paso | Nodo 1 | Nodo 2 | Nodo 3 | Nodo 4 | Nodo 5 | Nodo 6 |
|------|--------|--------|--------|--------|--------|--------|
| 1 (base) | `00_base_todos_los_nodos.sql` | ← misma | ← misma | ← misma | ← misma | ← misma |
| 2 (fragmento) | `nodo1.sql` | `nodo2.sql` | `nodo3.sql` | `nodo4.sql` | `nodo5.sql` | `nodo6.sql` |
| 3 (admin) | — | — | — | `nodo4_libro_admin.sql` | — | — |

---

## 7. Endpoints del API y su naturaleza distribuida

| Método | Ruta | Tipo de consulta | Qué demuestra |
|--------|------|-----------------|---------------|
| GET | `/api/sucursales` | Local (`queryLocal`) | Tabla replicada |
| GET | `/api/sucursales/dashboard` | Fan-out (`queryTodos`) | Stats de toda la red |
| GET | `/api/libros` | Local (`queryLocal`) | Catálogo replicado |
| GET | `/api/libros/:id/disponibilidad` | **Fan-out 6 nodos** | Inventario fragmentado — consulta distribuida estrella |
| GET | `/api/libros/:id/admin` | **Nodo 4** (`queryNodo(4)`) | Fragmento vertical exclusivo |
| GET | `/api/libros/admin/costos` | **Nodo 4** (`queryNodo(4)`) | Reporte administrativo remoto |
| GET | `/api/prestamos` | Local | Préstamos de mi sucursal |
| GET | `/api/prestamos?distribuido=1` | **Fan-out 6 nodos** | Todos los préstamos de la red |
| GET | `/api/prestamos?id_sucursal=N` | Nodo N específico | Préstamos de sucursal remota |
| POST | `/api/prestamos` | Local + validación remota | Nuevo préstamo; valida usuario en su nodo (inter-sucursal) |
| PUT | `/api/prestamos/:id/devolver` | Local + escritura remota | Devolución; actualiza multa en nodo del usuario |
| GET | `/api/usuarios` | Local | Usuarios de mi sucursal |
| GET | `/api/usuarios?distribuido=1` | **Fan-out 6 nodos** | Todos los usuarios de la red |
| GET | `/api/usuarios/:id` | Local → fan-out si no está | Busca usuario en todos los nodos |
| GET | `/api/usuarios/:id/prestamos` | **Fan-out 6 nodos** | Historial completo (préstamos en cualquier sucursal) |

---

## 8. Datos semilla por nodo

### Usuarios por nodo

| Nodo | id_usuario | Nombre | Email |
|------|-----------|--------|-------|
| 1 | 1 | María González Herrera | mgonzalez@email.com |
| 1 | 7 | Laura Díaz Contreras | ldiaz@email.com |
| 2 | 2 | Carlos Ramírez López | cramirez@email.com |
| 2 | 8 | Miguel Reyes Espinoza | mreyes@email.com |
| 3 | 3 | Fernanda Torres Ávila | ftorres@email.com |
| 3 | 10 | Diego Vargas Ontiveros | dvargas@email.com |
| 4 | 4 | Luis Morales Fuentes | lmorales@email.com |
| 4 | 9 | Paola Flores Gutiérrez | pflores@email.com |
| 5 | 5 | Ana Castillo Vega | acastillo@email.com |
| 6 | 6 | Roberto Sánchez Mendoza | rsanchez@email.com |

### Préstamos por nodo

| Nodo | id_prestamo | id_usuario | id_libro | Estatus | Nota |
|------|------------|------------|----------|---------|------|
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
| 6 | 16 | **2** | 3 (Biología Celular) | activo | **inter-sucursal** (usuario Tijuana) |
| 6 | 17 | **5** | 11 (El Arte de México) | activo | **inter-sucursal** (usuario Rosarito) |

### Inventario por nodo
Cada nodo tiene **12 filas** (una por libro). Las copias prestadas se calculan según `(id_libro + id_sucursal) % 3 === 0` → 1 copia menos disponible.

---

## 9. Consultas representativas por nodo

Estas consultas satisfacen el **Requerimiento A.7** (una consulta por nodo con árbol, álgebra y cálculo de bytes en la documentación Word).

| Nodo | Consulta representativa | Tipo | Endpoint / SQL |
|------|------------------------|------|----------------|
| **1** | Préstamos activos de la sucursal con datos del libro y usuario | Local | `GET /api/prestamos?estatus=activo` |
| **2** | Top libros más prestados en Tijuana el último mes | Local | `SELECT id_libro, COUNT(*) FROM Prestamo WHERE id_sucursal=2 AND fecha_prestamo >= DATE_SUB(NOW(),INTERVAL 1 MONTH) GROUP BY id_libro ORDER BY COUNT(*) DESC LIMIT 10` |
| **3** | Usuarios con más de 3 préstamos vencidos en Ensenada | Local | `SELECT id_usuario, COUNT(*) FROM Prestamo WHERE id_sucursal=3 AND estatus='vencido' GROUP BY id_usuario HAVING COUNT(*) > 3` |
| **4** | Costo total de adquisiciones por categoría (datos admin exclusivos) | **Nodo 4** | `GET /api/libros/admin/costos` |
| **5** | Disponibilidad de un libro en **todas las sucursales** | **Fan-out 6** | `GET /api/libros/:id/disponibilidad` |
| **6** | Préstamos inter-sucursales (usuario de otra ciudad prestando en Tecate) | Local | `SELECT p.*, u.id_sucursal_registro FROM Prestamo p WHERE p.id_sucursal=6 AND p.id_usuario NOT IN (SELECT id_usuario FROM Usuario)` |

---

## 10. Verificación end-to-end

### 10.1 Verificar fragmentos SQL (en cada nodo)
```sql
-- Verificar que solo tienes tus datos
SELECT COUNT(*) AS mis_prestamos   FROM Prestamo;    -- debe coincidir con tu nodo
SELECT COUNT(*) AS mis_usuarios    FROM Usuario;
SELECT COUNT(*) AS mi_inventario   FROM Inventario;  -- debe ser 12

-- Solo Nodo 4:
SELECT COUNT(*) AS libros_admin FROM LibroAdmin;     -- debe ser 12
```

### 10.2 Verificar conexión cruzada entre nodos
```bash
# Desde cualquier nodo, conectarse a otro con el usuario de ESE nodo:
mysql -h 100.127.191.53  -u biblioteca       -pBiblioteca123! biblioteca   # Nodo 1
mysql -h 100.88.250.105  -u bibliotecaNodo2  -pnodo2.        biblioteca   # Nodo 2
mysql -h 100.121.240.118 -u bibliotecaNodo3  -pnodo3.        biblioteca   # Nodo 3
mysql -h 100.67.56.91    -u biblioteca_nodo4 -pBiblioteca123! biblioteca  # Nodo 4
mysql -h 100.95.94.48    -u bibliotecaNodo5  -pnodo5.        biblioteca   # Nodo 5
mysql -h 100.114.254.124 -u bibliotecaNodo6  -pnodo6.        biblioteca   # Nodo 6
```
Si conecta correctamente verás el prompt `mysql>`.

### 10.3 Verificar endpoints del API
Con el backend arriba (`npm run dev`), usar el navegador o curl:
```bash
# Catálogo replicado (local)
curl http://localhost:3001/api/libros

# Disponibilidad distribuida (fan-out a los 6 nodos)
curl http://localhost:3001/api/libros/2/disponibilidad

# Préstamos locales
curl http://localhost:3001/api/prestamos

# Todos los préstamos de la red
curl "http://localhost:3001/api/prestamos?distribuido=1"

# Datos admin (solo responde si Nodo 4 está arriba)
curl http://localhost:3001/api/libros/1/admin

# Dashboard distribuido
curl http://localhost:3001/api/sucursales/dashboard
```

### 10.4 Probar tolerancia a fallo
1. Pedir `GET /api/libros/2/disponibilidad` con todos los nodos arriba → 6 filas.
2. Apagar un nodo (o desconectar Tailscale de una PC).
3. Repetir → responde con las filas de los 5 nodos disponibles y muestra `0` copias en el nodo caído (el backend advierte en consola pero no truena).

### 10.5 Probar préstamo inter-sucursal
Desde el Nodo 6 (o cualquier nodo), hacer GET de usuarios del Nodo 6:
```bash
curl http://localhost:3001/api/usuarios              # solo Roberto (suc 6)
curl "http://localhost:3001/api/usuarios?distribuido=1"  # los 10 usuarios de la red
```
Ver que los préstamos 16 y 17 del Nodo 6 tienen usuarios de otros nodos (id_usuario 2 y 5).

---

## 11. Troubleshooting

| Error | Causa probable | Solución |
|-------|---------------|----------|
| `ECONNREFUSED 100.x.x.x:3306` | Puerto 3306 bloqueado o MySQL no escucha en 0.0.0.0 | Revisar `bind-address = 0.0.0.0` en `my.ini/mysqld.cnf` y firewall |
| `Access denied for user 'X'@'Y'` | El usuario no existe o no tiene GRANT | Ejecutar `CREATE USER ... GRANT ALL ...` del nodo correspondiente |
| `Host '...' is not allowed` | `bind-address` sigue en `127.0.0.1` | Editar y reiniciar MySQL |
| `Can't reach host` | Tailscale desconectado | Verificar que Tailscale está activo en ambas PCs (`ping 100.x.x.x`) |
| `ER_NO_SUCH_TABLE: Table 'biblioteca.LibroAdmin'` | Endpoint `/admin` desde nodo ≠ 4 | Normal si el Nodo 4 no está disponible; solo ese nodo tiene `LibroAdmin` |
| `Nodo X no disponible` en consola | Nodo apagado o sin Tailscale | No es error fatal: el fan-out lo omite y reporta en console.warn |
| `id_sucursal` no coincide con CHECK constraint | Script SQL del nodo incorrecto | Verificar que cargaste `nodoN.sql` correcto para tu número |

---

## 12. Cobertura de `requerimientos.md`

### Parte de Aplicación/Desarrollo (lo que cubre este sistema)

| Requisito | Estado | Cómo |
|-----------|--------|------|
| D.1 Funcional en MySQL | ✅ | MySQL 8.x en cada nodo |
| D.2 Conexión tipo Hamachi | ✅ | Tailscale (equivalente, justificado: Hamachi gratis = 5 nodos máx.) |
| D.3 Conectarse entre nodos y correr consultas | ✅ | `queryNodo` / `queryTodos` sobre VPN Tailscale |
| D.4 Insertar, modificar, consultar entre nodos | ✅ | POST préstamo (insert local + validación remota), PUT devolución (update multa en nodo remoto), disponibilidad (6 nodos) |

### Parte de Análisis y Diseño (documentación Word — entregable aparte)

| Requisito | Qué ya está listo | Qué falta redactar en Word |
|-----------|-------------------|---------------------------|
| A.1 Introducción | Contexto en `proyecto_biblioteca_distribuida.md` | Escribir en formato Word |
| A.2 ER + mapeo + 4FN | Diseño en `proyecto_biblioteca_distribuida.md` | Diagrama ER + Libro_Autor (4FN) en Word |
| A.3 Modelo relacional | Scripts SQL = el modelo relacional final | Transcribir las tablas en Word |
| A.4 COM-MIN F.Horizontal | Predicados en `proyecto_biblioteca_distribuida.md` | Aplicar el algoritmo paso a paso en Word |
| A.5 F.Vertical (MU/MFA/MAA/BEA/MAC) | Resultado implementado en Nodo 4 (`LibroAdmin`) | Aplicar los 6 algoritmos con matrices en Word |
| A.6 Asignación a nodos | Tabla maestra sección 2 de esta guía | Incluir tabla en Word con justificación |
| A.7 Una consulta por nodo | Tabla sección 9 de esta guía + código en rutas | Mostrar árboles de consulta inicial y óptimo |
| A.8 Optimización (árboles, álgebra) | Las consultas existen en el código | Dibujar árboles equivalentes y aplicar reglas |
| A.9 Evaluación en bytes | — | Calcular tamaño de cada alternativa usando fórmulas de clase |

---

## 13. Referencia rápida de archivos y funciones

| Qué buscar | Dónde está |
|-----------|-----------|
| IPs y credenciales de todos los nodos | `backend/config/nodos.js` |
| Helpers de conexión distribuida | `backend/db/pool.js` → `queryLocal`, `queryNodo`, `queryTodos`, `buscarUsuario` |
| Script base (replicadas) | `sql/00_base_todos_los_nodos.sql` |
| Script de fragmentos de cada nodo | `sql/nodoN.sql` (N = 1..6) |
| Datos administrativos (Nodo 4) | `sql/nodo4_libro_admin.sql` |
| Configuración de Tailscale + MySQL remoto | `configuracion_nodos_distribuidos.md` |
| Diseño conceptual y algoritmos | `proyecto_biblioteca_distribuida.md` |
| Requerimientos del profesor | `requerimientos.md` |
