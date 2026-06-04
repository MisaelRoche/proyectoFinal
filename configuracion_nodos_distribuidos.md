# Configuración de Nodos Distribuidos — Biblioteca BC

Guía para levantar los 6 nodos MySQL conectados por VPN (Tailscale).

---

## Índice

1. [VPN recomendada: Tailscale](#1-vpn-recomendada-tailscale)
2. [Instalar MySQL en cada PC](#2-instalar-mysql-en-cada-pc)
3. [Permitir conexiones remotas en MySQL](#3-permitir-conexiones-remotas-en-mysql)
4. [Crear las bases de datos por nodo](#4-crear-las-bases-de-datos-por-nodo)
5. [Verificar conexión entre nodos](#5-verificar-conexión-entre-nodos)
6. [Tabla resumen de nodos](#6-tabla-resumen-de-nodos)
7. [Conectar la UI al nodo real](#7-conectar-la-ui-al-nodo-real)

---

## 1. VPN recomendada: Tailscale

### ¿Por qué Tailscale y no Hamachi?

| | Tailscale | Hamachi (gratis) |
|---|---|---|
| Nodos gratuitos | 100 dispositivos | **5 máximo** |
| Protocolo | WireGuard (moderno) | Propio (más lento) |
| Estabilidad | Alta | Media |
| Configuración | Automática | Manual |
| Requiere servidor central | No (mesh) | Sí (servidor de LogMeIn) |

Para 6 integrantes, Hamachi gratuito **no alcanza**. Tailscale es la opción correcta.

### Instalación de Tailscale (todos los integrantes)

1. Ir a [tailscale.com](https://tailscale.com) y crear una cuenta (con Google o GitHub)
2. Descargar e instalar según el sistema operativo:
   - **Windows**: instalador `.exe` desde el sitio
   - **macOS**: App Store o `.pkg` desde el sitio
   - **Linux**: ver sección siguiente
3. Iniciar sesión en la aplicación de Tailscale
4. El **integrante admin** va a `login.tailscale.com/admin` y verifica que todos aparecen en la red

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

### Obtener la IP de Tailscale

Cada integrante ejecuta este comando y comparte su IP con el grupo:

```bash
tailscale ip
# Ejemplo de salida: 100.64.0.1
```

Las IPs de Tailscale siempre son del rango `100.x.x.x` y **no cambian** aunque cambies de red WiFi.

### Verificar que los nodos se ven entre sí

Desde cualquier nodo, hacer ping a los demás:

```bash
ping 100.64.0.2   # debe responder si el nodo 2 está conectado
ping 100.64.0.3
# ...etc
```

---

## 2. Instalar MySQL en cada PC

### Windows

1. Descargar **MySQL Community Server 8.x** desde [dev.mysql.com/downloads](https://dev.mysql.com/downloads/mysql/)
2. Ejecutar el instalador → elegir **"Developer Default"**
3. Puerto: `3306` (dejar el default)
4. Establecer contraseña de root (anótala, la necesitarás)
5. Verificar que el servicio `MySQL80` esté corriendo en Servicios de Windows

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install mysql-server -y
sudo systemctl start mysql
sudo systemctl enable mysql   # inicia automáticamente al encender la PC

# Asegurar la instalación
sudo mysql_secure_installation
```

### macOS (Homebrew)

```bash
brew install mysql
brew services start mysql

# Conectar por primera vez
mysql -u root
```

---

## 3. Permitir conexiones remotas en MySQL

Por defecto MySQL **solo acepta conexiones locales**. Cada nodo debe hacer los siguientes pasos.

### 3a. Editar el archivo de configuración

| Sistema | Ruta del archivo |
|---------|-----------------|
| Windows | `C:\ProgramData\MySQL\MySQL Server 8.0\my.ini` |
| Linux | `/etc/mysql/mysql.conf.d/mysqld.cnf` |
| macOS (Homebrew) | `/opt/homebrew/etc/my.cnf` |

Buscar la línea `bind-address` y modificarla:

```ini
# ANTES (solo local):
bind-address = 127.0.0.1

# DESPUÉS (acepta la VPN de Tailscale):
bind-address = 0.0.0.0
```

Reiniciar MySQL para aplicar los cambios:

```bash
# Linux
sudo systemctl restart mysql

# Windows (PowerShell como administrador)
net stop MySQL80
net start MySQL80

# macOS
brew services restart mysql
```

### 3b. Crear usuario con acceso remoto

Conectarse a MySQL como root y ejecutar:

```sql
-- Crear usuario 'biblioteca' accesible desde cualquier IP de la VPN
CREATE USER 'biblioteca'@'%' IDENTIFIED BY 'password123';

-- Dar permisos sobre la base de datos del proyecto
GRANT ALL PRIVILEGES ON biblioteca.* TO 'biblioteca'@'%';
FLUSH PRIVILEGES;

-- Verificar que el usuario fue creado
SELECT user, host FROM mysql.user WHERE user = 'biblioteca';
```

> Reemplaza `password123` por una contraseña segura. **Todos los nodos deben usar la misma contraseña** para facilitar las conexiones cruzadas.

### 3c. Abrir el puerto 3306 en el firewall

**Windows — Firewall:**
```
Panel de control
→ Sistema y seguridad
→ Firewall de Windows Defender
→ Configuración avanzada
→ Reglas de entrada → Nueva regla
→ Tipo: Puerto → TCP → Puerto específico: 3306
→ Permitir la conexión → Aplicar a todos los perfiles
→ Nombre: "MySQL Biblioteca"
```

**Linux (ufw):**
```bash
sudo ufw allow 3306/tcp
sudo ufw reload
sudo ufw status   # verificar que aparece 3306
```

**macOS:**
```bash
# macOS generalmente no bloquea puertos entrantes por defecto
# Si hay problemas, revisar en:
# Preferencias del Sistema → Seguridad y privacidad → Firewall → Opciones
```

---

## 4. Crear las bases de datos por nodo

### Script base — TODOS los nodos lo ejecutan primero

```sql
CREATE DATABASE IF NOT EXISTS biblioteca
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE biblioteca;

-- ─── Tablas maestras (replicadas en todos los nodos) ──────────────────────

CREATE TABLE Categoria (
  id_categoria INT PRIMARY KEY,
  nombre       VARCHAR(50)  NOT NULL,
  descripcion  TEXT
);

CREATE TABLE Sucursal (
  id_sucursal INT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  direccion   VARCHAR(200),
  ciudad      VARCHAR(100),
  telefono    VARCHAR(20),
  responsable VARCHAR(100)
);

CREATE TABLE Libro (
  id_libro     INT PRIMARY KEY,
  isbn         VARCHAR(20),
  titulo       VARCHAR(200) NOT NULL,
  autor        VARCHAR(200),
  editorial    VARCHAR(100),
  anio         INT,
  id_categoria INT,
  paginas      INT,
  idioma       VARCHAR(30) DEFAULT 'Español',
  FOREIGN KEY (id_categoria) REFERENCES Categoria(id_categoria)
);

CREATE TABLE Usuario (
  id_usuario           INT PRIMARY KEY,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  email                VARCHAR(150),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT,
  fecha_registro       DATE,
  multas_acumuladas    DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

CREATE TABLE Inventario (
  id_inventario      INT PRIMARY KEY,
  id_libro           INT,
  id_sucursal        INT,
  copias_totales     INT DEFAULT 0,
  copias_disponibles INT DEFAULT 0,
  ubicacion_fisica   VARCHAR(100),
  FOREIGN KEY (id_libro)     REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal)  REFERENCES Sucursal(id_sucursal)
);

-- ─── Insertar datos maestros (igual en todos los nodos) ───────────────────

INSERT INTO Categoria VALUES
  (1, 'Literatura',     'Novelas, cuentos y poesía'),
  (2, 'Ciencias',       'Biología, física, química'),
  (3, 'Historia',       'Historia universal y de México'),
  (4, 'Tecnología',     'Computación e ingeniería'),
  (5, 'Derecho',        'Leyes y jurisprudencia'),
  (6, 'Arte y Cultura', 'Pintura, música y arquitectura');

INSERT INTO Sucursal VALUES
  (1, 'Mexicali Centro',      'Av. Obregón 120',        'Mexicali',  '686-555-0101', 'Lic. Carmen Robles'),
  (2, 'Tijuana',               'Blvd. Agua Caliente 88', 'Tijuana',   '664-555-0202', 'Lic. Jorge Mendoza'),
  (3, 'Ensenada',              'Av. Ruiz 450',           'Ensenada',  '646-555-0303', 'Lic. Patricia Soto'),
  (4, 'Mexicali Universidad',  'Calzada UABC 200',       'Mexicali',  '686-555-0404', 'Dr. Ramón Castillo'),
  (5, 'Rosarito',              'Blvd. Benito Juárez 33', 'Rosarito',  '661-555-0505', 'Lic. Sofía Guerrero'),
  (6, 'Tecate',                'Calle Principal 77',     'Tecate',    '665-555-0606', 'Lic. Héctor Vázquez');

INSERT INTO Libro (id_libro, isbn, titulo, autor, editorial, anio, id_categoria, paginas) VALUES
  (1,  '978-607-01-0001-1', 'Pedro Páramo',                       'Juan Rulfo',              'RM Editorial',       1955, 1, 124),
  (2,  '978-607-01-0002-2', 'Cien años de soledad',               'Gabriel García Márquez',  'Alfaguara',          1967, 1, 471),
  (3,  '978-607-01-0003-3', 'Biología Celular',                   'Bruce Alberts',           'Médica Panamericana',2015, 2, 850),
  (4,  '978-607-01-0004-4', 'Física Universitaria Vol. 1',        'Sears & Zemansky',        'Pearson',            2018, 2, 700),
  (5,  '978-607-01-0005-5', 'Historia de México',                 'Enrique Krauze',          'Tusquets',           2010, 3, 340),
  (6,  '978-607-01-0006-6', 'La Conquista de México',             'Hugh Thomas',             'Planeta',            1994, 3, 912),
  (7,  '978-607-01-0007-7', 'El Lenguaje de Programación C',      'Kernighan & Ritchie',     'Prentice Hall',      1988, 4, 288),
  (8,  '978-607-01-0008-8', 'Algoritmos y Estructuras de Datos',  'Thomas Cormen',           'MIT Press',          2009, 4, 1292),
  (9,  '978-607-01-0009-9', 'Derecho Constitucional Mexicano',    'Felipe Tena Ramírez',     'Porrúa',             2016, 5, 620),
  (10, '978-607-01-0010-0', 'Teoría General del Derecho',         'Norberto Bobbio',         'Debate',             2012, 5, 290),
  (11, '978-607-01-0011-1', 'El Arte de México',                  'Teresa del Conde',        'FCE',                2008, 6, 410),
  (12, '978-607-01-0012-2', 'Arquitectura Prehispánica',          'Paul Gendrop',            'Trillas',            2001, 6, 220);
```

---

### Fragmentación horizontal — Tabla Prestamo

Cada nodo crea la tabla `Prestamo` restringida a **su propio `id_sucursal`**.
Solo cambia el número en `DEFAULT` y en el `CHECK`.

**Nodo 1 — Mexicali Centro:**
```sql
USE biblioteca;
CREATE TABLE Prestamo (
  id_prestamo              INT PRIMARY KEY AUTO_INCREMENT,
  id_usuario               INT NOT NULL,
  id_libro                 INT NOT NULL,
  id_sucursal              INT NOT NULL DEFAULT 1,
  fecha_prestamo           DATE NOT NULL,
  fecha_devolucion_esperada DATE NOT NULL,
  fecha_devolucion_real    DATE,
  estatus                  ENUM('activo','devuelto','vencido') DEFAULT 'activo',
  multa                    DECIMAL(10,2) DEFAULT 0.00,
  CONSTRAINT chk_sucursal  CHECK (id_sucursal = 1),
  FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario),
  FOREIGN KEY (id_libro)   REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
);
```

**Nodos 2 al 6:** copiar el script anterior cambiando `DEFAULT 1` → `DEFAULT N` y `CHECK (id_sucursal = N)` donde N es el número del nodo.

---

### Fragmentación vertical — Tabla Libro (solo Nodo 4)

El **Nodo 4 (Mexicali Universidad)** agrega los campos administrativos que los demás nodos no tienen:

```sql
-- Ejecutar SOLO en Nodo 4
USE biblioteca;
ALTER TABLE Libro
  ADD COLUMN costo            DECIMAL(10,2),
  ADD COLUMN proveedor        VARCHAR(200),
  ADD COLUMN fecha_adquisicion DATE;
```

---

## 5. Verificar conexión entre nodos

### Desde línea de comandos

```bash
# Desde Nodo 1, conectarse a Nodo 2 (sustituir IP real de Tailscale)
mysql -h 100.64.0.2 -u biblioteca -p biblioteca

# Si conecta correctamente, verás el prompt:
# mysql>
```

### Consulta de prueba distribuida

```sql
-- En Nodo 1: ver préstamos locales
SELECT COUNT(*) AS prestamos_locales FROM Prestamo;

-- En Nodo 1: consultar inventario de Nodo 3 desde el backend
-- (el backend de Node.js hace la conexión con la IP del nodo 3)
```

### Posibles errores y soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `Connection refused` | Puerto 3306 bloqueado | Revisar firewall (paso 3c) |
| `Host not allowed` | `bind-address` sigue en `127.0.0.1` | Editar `my.ini` / `mysqld.cnf` y reiniciar |
| `Access denied for user` | Usuario sin permisos remotos | Ejecutar el `GRANT` del paso 3b |
| `Can't reach host` | Tailscale no conectado | Verificar que Tailscale está activo en ambas PCs |

---

## 6. Tabla resumen de nodos

| Nodo | Integrante | IP Tailscale | Sucursal | Fragmento Horizontal | Fragmento Vertical |
|------|-----------|-------------|----------|---------------------|--------------------|
| 1 | — | `tailscale ip` | Mexicali Centro | `Prestamo` donde `id_sucursal = 1` | Catálogo público |
| 2 | — | `tailscale ip` | Tijuana | `Prestamo` donde `id_sucursal = 2` | Catálogo público |
| 3 | — | `tailscale ip` | Ensenada | `Prestamo` donde `id_sucursal = 3` | Catálogo público |
| 4 | — | `tailscale ip` | Mexicali Universidad | `Prestamo` donde `id_sucursal = 4` | Catálogo **+ campos admin** (costo, proveedor) |
| 5 | — | `tailscale ip` | Rosarito | `Prestamo` donde `id_sucursal = 5` | Catálogo público |
| 6 | — | `tailscale ip` | Tecate | `Prestamo` donde `id_sucursal = 6` | Catálogo público |

> Llenar la columna "IP Tailscale" una vez que todos instalen Tailscale y compartan su IP.

---

## 7. Conectar la UI al nodo real

Una vez que MySQL esté configurado en cada PC, se puede reemplazar el mock data por conexiones reales.

### Instalar el driver de MySQL para Node.js

```bash
cd backend
npm install mysql2
```

### Crear archivo de configuración de conexiones

Crear el archivo `backend/config/nodos.js` con las IPs reales de Tailscale:

```js
// backend/config/nodos.js
export const nodos = {
  1: { host: '100.64.0.1', nombre: 'Mexicali Centro' },
  2: { host: '100.64.0.2', nombre: 'Tijuana' },
  3: { host: '100.64.0.3', nombre: 'Ensenada' },
  4: { host: '100.64.0.4', nombre: 'Mexicali Universidad' },
  5: { host: '100.64.0.5', nombre: 'Rosarito' },
  6: { host: '100.64.0.6', nombre: 'Tecate' },
}

// Credenciales comunes para todos los nodos
export const credenciales = {
  user:     'biblioteca',
  password: 'password123',
  database: 'biblioteca',
}
```

### Ejemplo de conexión a un nodo específico

```js
import mysql from 'mysql2/promise'
import { nodos, credenciales } from './config/nodos.js'

// Conectar al nodo 1 (nodo local de quien ejecuta el backend)
async function conectarNodo(idNodo) {
  return mysql.createConnection({
    host:     nodos[idNodo].host,
    user:     credenciales.user,
    password: credenciales.password,
    database: credenciales.database,
  })
}

// Consultar préstamos del nodo 2 desde cualquier nodo
async function getPrestamosNodo(idNodo) {
  const conn = await conectarNodo(idNodo)
  const [rows] = await conn.execute('SELECT * FROM Prestamo')
  await conn.end()
  return rows
}
```

### Ejemplo de consulta distribuida (préstamos de todos los nodos)

```js
import mysql from 'mysql2/promise'
import { nodos, credenciales } from './config/nodos.js'

async function getPrestamosDistribuidos() {
  const resultados = []

  for (const [idNodo, info] of Object.entries(nodos)) {
    try {
      const conn = await mysql.createConnection({
        host: info.host,
        ...credenciales,
        connectTimeout: 3000,
      })
      const [rows] = await conn.execute('SELECT * FROM Prestamo WHERE estatus = "activo"')
      resultados.push(...rows)
      await conn.end()
    } catch (err) {
      console.warn(`Nodo ${idNodo} (${info.nombre}) no disponible:`, err.message)
    }
  }

  return resultados
}
```

---

## Checklist de configuración por integrante

```
[ ] Instalar Tailscale y unirse a la red del equipo
[ ] Anotar y compartir la IP de Tailscale (tailscale ip)
[ ] Instalar MySQL 8.x
[ ] Editar bind-address = 0.0.0.0 en my.ini / mysqld.cnf
[ ] Reiniciar el servicio de MySQL
[ ] Crear usuario 'biblioteca'@'%' con contraseña acordada
[ ] Abrir puerto 3306 en el firewall
[ ] Ejecutar el script base (tablas maestras + datos)
[ ] Ejecutar el script de Prestamo con su id_sucursal correspondiente
[ ] (Solo Nodo 4) Ejecutar el ALTER TABLE para campos admin
[ ] Verificar que otro nodo puede conectarse con: mysql -h <tu_ip> -u biblioteca -p
```
