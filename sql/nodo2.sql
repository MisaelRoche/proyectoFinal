-- =============================================================
-- NODO 2 — Tijuana  |  IP Tailscale: 100.88.250.105
-- Fragmento Horizontal: Usuarios suc=2, Inventario suc=2, Préstamos suc=2
CREATE DATABASE IF NOT EXISTS biblioteca_nodo2
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Ejecutar DESPUÉS de 00_base_todos_los_nodos.sql
-- =============================================================

USE biblioteca_nodo2;

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTACIÓN VERTICAL de Usuario — 2 fragmentos
-- Basado en convergencia BEA/MAC/MFA/MAA: cluster {id,email,multas}
-- Fragmento H: id_sucursal_registro = 2
-- ─────────────────────────────────────────────────────────────

-- Fragmento Vertical 1: UsuarioPerfil (identidad + ubicación)
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

-- Fragmento Vertical 2: UsuarioAcceso (email + multas — cluster de alto acceso)
CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

INSERT IGNORE INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, id_sucursal_registro, fecha_registro) VALUES
  (2, 'Carlos', 'Ramírez López',  '664-111-0002', 2, '2023-03-22'),
  (8, 'Miguel', 'Reyes Espinoza', '664-111-0008', 2, '2023-10-18');

INSERT IGNORE INTO UsuarioAcceso (id_usuario, email, multas_acumuladas) VALUES
  (2, 'cramirez@email.com', 25.00),
  (8, 'mreyes@email.com',    0.00);

ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Inventario (id_sucursal = 2)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Inventario (
  id_inventario      INT          PRIMARY KEY,
  id_libro           INT          NOT NULL,
  id_sucursal        INT          NOT NULL DEFAULT 2,
  copias_totales     INT          DEFAULT 0,
  copias_disponibles INT          DEFAULT 0,
  ubicacion_fisica   VARCHAR(100),
  CONSTRAINT chk_inventario_sucursal CHECK (id_sucursal = 2),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
);

-- id_inventario = (id_libro-1)*6 + 2  |  ubicacion = "Estante B <libro>"
INSERT IGNORE INTO Inventario VALUES
--  id   libro  suc  total  disp  ubicacion
  ( 2,   1,     2,   3,     2,    'Estante B 1'),   -- (1+2)%3=0 → 1 prestado
  ( 8,   2,     2,   4,     4,    'Estante B 2'),
  (14,   3,     2,   2,     2,    'Estante B 3'),
  (20,   4,     2,   5,     4,    'Estante B 4'),   -- (4+2)%3=0 → 1 prestado
  (26,   5,     2,   2,     2,    'Estante B 5'),
  (32,   6,     2,   3,     3,    'Estante B 6'),
  (38,   7,     2,   2,     1,    'Estante B 7'),   -- (7+2)%3=0 → 1 prestado
  (44,   8,     2,   3,     3,    'Estante B 8'),
  (50,   9,     2,   4,     4,    'Estante B 9'),
  (56,  10,     2,   2,     1,    'Estante B 10'),  -- (10+2)%3=0 → 1 prestado
  (62,  11,     2,   3,     3,    'Estante B 11'),
  (68,  12,     2,   4,     4,    'Estante B 12');

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Prestamo (id_sucursal = 2)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Prestamo (
  id_prestamo               INT          PRIMARY KEY AUTO_INCREMENT,
  id_usuario                INT          NOT NULL,
  id_libro                  INT          NOT NULL,
  id_sucursal               INT          NOT NULL DEFAULT 2,
  fecha_prestamo            DATE         NOT NULL,
  fecha_devolucion_esperada DATE         NOT NULL,
  fecha_devolucion_real     DATE,
  estatus                   ENUM('activo','devuelto','vencido') DEFAULT 'activo',
  multa                     DECIMAL(10,2) DEFAULT 0.00,
  CONSTRAINT chk_prestamo_sucursal CHECK (id_sucursal = 2),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
);

INSERT IGNORE INTO Prestamo (id_prestamo, id_usuario, id_libro, id_sucursal, fecha_prestamo, fecha_devolucion_esperada, fecha_devolucion_real, estatus, multa) VALUES
  ( 4, 8,  11, 2, '2026-05-05', '2026-06-05', NULL,         'activo',   0.00),
  ( 9, 2,   4, 2, '2026-03-01', '2026-04-01', NULL,         'vencido', 50.00),
  (12, 2,  12, 2, '2026-03-20', '2026-04-20', NULL,         'vencido', 25.00);

ALTER TABLE Prestamo AUTO_INCREMENT = 100;
