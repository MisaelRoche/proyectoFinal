# Implementación de Fragmentación Vertical — Guía por Nodo

> **Situación:** Cada nodo ya tiene datos cargados en la tabla `Usuario` (9 columnas).
> Esta guía migra esos datos a los 2 fragmentos verticales sin recrear la BD.
>
> **Fragmentos resultantes:**
> - `UsuarioPerfil` — identidad + ubicación (sin email ni multas)
> - `UsuarioAcceso` — email + multas (cluster de alto acceso, convergencia BEA/MAC/MFA/MAA)

---

## Proceso general (igual en todos los nodos)

1. Conectarse al nodo vía MySQL
2. Crear `UsuarioPerfil` y `UsuarioAcceso`
3. Migrar datos desde `Usuario` (INSERT … SELECT)
4. Verificar que los counts coincidan
5. Eliminar la tabla original (`DROP TABLE Usuario`)

---

## Nodo 1 — Mexicali Centro (`biblioteca_nodo1`)

**Usuarios:** María González (id=1), Laura Díaz (id=7)

```sql
USE biblioteca_nodo1;

-- Paso 1: Crear fragmentos
CREATE TABLE IF NOT EXISTS UsuarioPerfil (
  id_usuario           INT          PRIMARY KEY AUTO_INCREMENT,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL DEFAULT 1,
  fecha_registro       DATE,
  CONSTRAINT chk_uperfil_sucursal CHECK (id_sucursal_registro = 1),
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

-- Paso 2: Migrar datos (orden: padre antes que hijo)
INSERT INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro)
  SELECT id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro
  FROM Usuario;

INSERT INTO UsuarioAcceso (id_usuario, email, multas_acumuladas)
  SELECT id_usuario, email, multas_acumuladas
  FROM Usuario;

-- Paso 3: Verificar (los 3 deben dar el mismo número)
SELECT 'Usuario'       AS tabla, COUNT(*) AS total FROM Usuario
UNION ALL
SELECT 'UsuarioPerfil' AS tabla, COUNT(*) AS total FROM UsuarioPerfil
UNION ALL
SELECT 'UsuarioAcceso' AS tabla, COUNT(*) AS total FROM UsuarioAcceso;

-- Paso 4: Eliminar tabla original (solo si el paso 3 confirmó counts iguales)
DROP TABLE Usuario;

-- Ajustar AUTO_INCREMENT para futuros inserts
ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;
```

---

## Nodo 2 — Tijuana (`biblioteca_nodo2`)

**Usuarios:** Carlos Ramírez (id=2), Miguel Reyes (id=8)

```sql
USE biblioteca_nodo2;

-- Paso 1: Crear fragmentos
CREATE TABLE IF NOT EXISTS UsuarioPerfil (
  id_usuario           INT          PRIMARY KEY AUTO_INCREMENT,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL DEFAULT 2,
  fecha_registro       DATE,
  CONSTRAINT chk_uperfil_sucursal CHECK (id_sucursal_registro = 2),
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

-- Paso 2: Migrar datos
INSERT INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro)
  SELECT id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro
  FROM Usuario;

INSERT INTO UsuarioAcceso (id_usuario, email, multas_acumuladas)
  SELECT id_usuario, email, multas_acumuladas
  FROM Usuario;

-- Paso 3: Verificar
SELECT 'Usuario'       AS tabla, COUNT(*) AS total FROM Usuario
UNION ALL
SELECT 'UsuarioPerfil' AS tabla, COUNT(*) AS total FROM UsuarioPerfil
UNION ALL
SELECT 'UsuarioAcceso' AS tabla, COUNT(*) AS total FROM UsuarioAcceso;

-- Paso 4: Eliminar tabla original
DROP TABLE Usuario;

ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;
```

---

## Nodo 3 — Ensenada (`biblioteca_nodo3`)

**Usuarios:** Fernanda Torres (id=3), Diego Vargas (id=10)

```sql
USE biblioteca_nodo3;

-- Paso 1: Crear fragmentos
CREATE TABLE IF NOT EXISTS UsuarioPerfil (
  id_usuario           INT          PRIMARY KEY AUTO_INCREMENT,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL DEFAULT 3,
  fecha_registro       DATE,
  CONSTRAINT chk_uperfil_sucursal CHECK (id_sucursal_registro = 3),
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

-- Paso 2: Migrar datos
INSERT INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro)
  SELECT id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro
  FROM Usuario;

INSERT INTO UsuarioAcceso (id_usuario, email, multas_acumuladas)
  SELECT id_usuario, email, multas_acumuladas
  FROM Usuario;

-- Paso 3: Verificar
SELECT 'Usuario'       AS tabla, COUNT(*) AS total FROM Usuario
UNION ALL
SELECT 'UsuarioPerfil' AS tabla, COUNT(*) AS total FROM UsuarioPerfil
UNION ALL
SELECT 'UsuarioAcceso' AS tabla, COUNT(*) AS total FROM UsuarioAcceso;

-- Paso 4: Eliminar tabla original
DROP TABLE Usuario;

ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;
```

---

## Nodo 4 — Mexicali Universidad (`biblioteca_nodo4`)

**Usuarios:** Luis Morales (id=4), Paola Flores (id=9)

```sql
USE biblioteca_nodo4;

-- Paso 1: Crear fragmentos
CREATE TABLE IF NOT EXISTS UsuarioPerfil (
  id_usuario           INT          PRIMARY KEY AUTO_INCREMENT,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL DEFAULT 4,
  fecha_registro       DATE,
  CONSTRAINT chk_uperfil_sucursal CHECK (id_sucursal_registro = 4),
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

-- Paso 2: Migrar datos
INSERT INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro)
  SELECT id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro
  FROM Usuario;

INSERT INTO UsuarioAcceso (id_usuario, email, multas_acumuladas)
  SELECT id_usuario, email, multas_acumuladas
  FROM Usuario;

-- Paso 3: Verificar
SELECT 'Usuario'       AS tabla, COUNT(*) AS total FROM Usuario
UNION ALL
SELECT 'UsuarioPerfil' AS tabla, COUNT(*) AS total FROM UsuarioPerfil
UNION ALL
SELECT 'UsuarioAcceso' AS tabla, COUNT(*) AS total FROM UsuarioAcceso;

-- Paso 4: Eliminar tabla original
DROP TABLE Usuario;

ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;
```

---

## Nodo 5 — Rosarito (`biblioteca_nodo5`)

**Usuarios:** Ana Castillo (id=5)

```sql
USE biblioteca_nodo5;

-- Paso 1: Crear fragmentos
CREATE TABLE IF NOT EXISTS UsuarioPerfil (
  id_usuario           INT          PRIMARY KEY AUTO_INCREMENT,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL DEFAULT 5,
  fecha_registro       DATE,
  CONSTRAINT chk_uperfil_sucursal CHECK (id_sucursal_registro = 5),
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

-- Paso 2: Migrar datos
INSERT INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro)
  SELECT id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro
  FROM Usuario;

INSERT INTO UsuarioAcceso (id_usuario, email, multas_acumuladas)
  SELECT id_usuario, email, multas_acumuladas
  FROM Usuario;

-- Paso 3: Verificar
SELECT 'Usuario'       AS tabla, COUNT(*) AS total FROM Usuario
UNION ALL
SELECT 'UsuarioPerfil' AS tabla, COUNT(*) AS total FROM UsuarioPerfil
UNION ALL
SELECT 'UsuarioAcceso' AS tabla, COUNT(*) AS total FROM UsuarioAcceso;

-- Paso 4: Eliminar tabla original
DROP TABLE Usuario;

ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;
```

---

## Nodo 6 — Tecate (`biblioteca_nodo6`)

**Usuarios:** Roberto Sánchez (id=6)

```sql
USE biblioteca_nodo6;

-- Paso 1: Crear fragmentos
CREATE TABLE IF NOT EXISTS UsuarioPerfil (
  id_usuario           INT          PRIMARY KEY AUTO_INCREMENT,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL DEFAULT 6,
  fecha_registro       DATE,
  CONSTRAINT chk_uperfil_sucursal CHECK (id_sucursal_registro = 6),
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

-- Paso 2: Migrar datos
INSERT INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro)
  SELECT id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro
  FROM Usuario;

INSERT INTO UsuarioAcceso (id_usuario, email, multas_acumuladas)
  SELECT id_usuario, email, multas_acumuladas
  FROM Usuario;

-- Paso 3: Verificar
SELECT 'Usuario'       AS tabla, COUNT(*) AS total FROM Usuario
UNION ALL
SELECT 'UsuarioPerfil' AS tabla, COUNT(*) AS total FROM UsuarioPerfil
UNION ALL
SELECT 'UsuarioAcceso' AS tabla, COUNT(*) AS total FROM UsuarioAcceso;

-- Paso 4: Eliminar tabla original
DROP TABLE Usuario;

ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;
```

---

## Verificación final (ejecutar en cualquier nodo después de migrar)

```sql
-- Reconstrucción completa — equivale a SELECT * FROM Usuario original
SELECT up.id_usuario,
       up.nombre,
       up.apellidos,
       up.telefono,
       up.direccion,
       up.id_sucursal_registro,
       up.fecha_registro,
       ua.email,
       ua.multas_acumuladas,
       s.nombre AS sucursal_nombre
FROM UsuarioPerfil up
JOIN UsuarioAcceso ua ON up.id_usuario = ua.id_usuario
JOIN Sucursal s ON up.id_sucursal_registro = s.id_sucursal
ORDER BY up.id_usuario;

-- Confirmar que Usuario ya no existe
SHOW TABLES LIKE 'Usuario';   -- debe devolver 0 filas

-- Confirmar que los 2 fragmentos existen
SHOW TABLES LIKE 'Usuario%';  -- debe mostrar UsuarioAcceso y UsuarioPerfil
```

---

## Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `Cannot add foreign key constraint` al crear `UsuarioAcceso` | `UsuarioPerfil` no existe o está vacía | Verificar que el INSERT a `UsuarioPerfil` se ejecutó antes |
| `Check constraint 'chk_uperfil_sucursal' is violated` | Hay usuarios con `id_sucursal_registro` distinto al nodo | No debería ocurrir si la fragmentación horizontal está bien cargada; revisar los datos |
| `Table 'Usuario' doesn't exist` al hacer el INSERT … SELECT | Ya se hizo el DROP en una corrida anterior | Omitir los pasos 1-4 y ejecutar solo la verificación final |
| `Table 'UsuarioPerfil' already exists` | El script se ejecutó parcialmente antes | Verificar con `SHOW TABLES LIKE 'Usuario%'`; si los fragmentos tienen datos correctos, solo ejecutar el DROP TABLE Usuario |
