-- =============================================================
-- NODO 6 — Tecate  |  IP Tailscale: 100.114.254.124
-- Fragmento Horizontal: Usuarios suc=6, Inventario suc=6, Préstamos suc=6
CREATE DATABASE IF NOT EXISTS biblioteca_nodo6
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Incluye préstamos INTER-SUCURSALES para demostrar integridad distribuida
-- Ejecutar DESPUÉS de 00_base_todos_los_nodos.sql
-- =============================================================

USE biblioteca_nodo6;

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTACIÓN VERTICAL de Usuario — 2 fragmentos
-- Basado en convergencia BEA/MAC/MFA/MAA: cluster {id,email,multas}
-- Fragmento H: id_sucursal_registro = 6
-- ─────────────────────────────────────────────────────────────

-- Fragmento Vertical 1: UsuarioPerfil (identidad + ubicación)
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

-- Fragmento Vertical 2: UsuarioAcceso (email + multas — cluster de alto acceso)
CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

INSERT IGNORE INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, id_sucursal_registro, fecha_registro) VALUES
  (6, 'Roberto', 'Sánchez Mendoza', '665-111-0006', 6, '2023-08-30');

INSERT IGNORE INTO UsuarioAcceso (id_usuario, email, multas_acumuladas) VALUES
  (6, 'rsanchez@email.com', 0.00);

ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Inventario (id_sucursal = 6)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Inventario (
  id_inventario      INT          PRIMARY KEY,
  id_libro           INT          NOT NULL,
  id_sucursal        INT          NOT NULL DEFAULT 6,
  copias_totales     INT          DEFAULT 0,
  copias_disponibles INT          DEFAULT 0,
  ubicacion_fisica   VARCHAR(100),
  CONSTRAINT chk_inventario_sucursal CHECK (id_sucursal = 6),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
);

-- id_inventario = (id_libro-1)*6 + 6  |  ubicacion = "Estante E <libro>"
INSERT IGNORE INTO Inventario VALUES
--  id   libro  suc  total  disp  ubicacion
  ( 6,   1,     6,   3,     3,    'Estante E 1'),
  (12,   2,     6,   4,     4,    'Estante E 2'),
  (18,   3,     6,   2,     1,    'Estante E 3'),   -- (3+6)%3=0 → 1 prestado
  (24,   4,     6,   5,     5,    'Estante E 4'),
  (30,   5,     6,   2,     2,    'Estante E 5'),
  (36,   6,     6,   3,     2,    'Estante E 6'),   -- (6+6)%3=0 → 1 prestado
  (42,   7,     6,   2,     2,    'Estante E 7'),
  (48,   8,     6,   3,     3,    'Estante E 8'),
  (54,   9,     6,   4,     3,    'Estante E 9'),   -- (9+6)%3=0 → 1 prestado
  (60,  10,     6,   2,     2,    'Estante E 10'),
  (66,  11,     6,   3,     3,    'Estante E 11'),
  (72,  12,     6,   4,     3,    'Estante E 12');  -- (12+6)%3=0 → 1 prestado

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Prestamo (id_sucursal = 6)
--
-- NOTA SOBRE INTEGRIDAD DISTRIBUIDA:
-- NO hay FK a Usuario porque el prestatario puede estar en otro nodo.
-- Ejemplo: préstamo 16 → usuario 2 (registrado en Tijuana/Nodo 2)
--          que pide prestado aquí en Tecate/Nodo 6 (préstamo inter-sucursal).
-- La validación de existencia del usuario se hace a nivel de aplicación,
-- consultando el nodo dueño del usuario por id_sucursal_registro.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Prestamo (
  id_prestamo               INT          PRIMARY KEY AUTO_INCREMENT,
  id_usuario                INT          NOT NULL,
  id_libro                  INT          NOT NULL,
  id_sucursal               INT          NOT NULL DEFAULT 6,
  fecha_prestamo            DATE         NOT NULL,
  fecha_devolucion_esperada DATE         NOT NULL,
  fecha_devolucion_real     DATE,
  estatus                   ENUM('activo','devuelto','vencido') DEFAULT 'activo',
  multa                     DECIMAL(10,2) DEFAULT 0.00,
  CONSTRAINT chk_prestamo_sucursal CHECK (id_sucursal = 6),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
  -- Sin FK a Usuario: el usuario puede ser de cualquier otro nodo
);

INSERT IGNORE INTO Prestamo (id_prestamo, id_usuario, id_libro, id_sucursal, fecha_prestamo, fecha_devolucion_esperada, fecha_devolucion_real, estatus, multa) VALUES
  -- Préstamo local: usuario 6 (Tecate) en sucursal 6
  ( 6,  6,  9, 6, '2026-04-30', '2026-05-30', NULL, 'activo',   0.00),
  -- Préstamo inter-sucursal: usuario 2 (Tijuana/Nodo 2) en sucursal 6
  (16,  2,  3, 6, '2026-05-15', '2026-06-15', NULL, 'activo',   0.00),
  -- Préstamo inter-sucursal: usuario 5 (Rosarito/Nodo 5) en sucursal 6
  (17,  5, 11, 6, '2026-05-20', '2026-06-20', NULL, 'activo',   0.00);

ALTER TABLE Prestamo AUTO_INCREMENT = 100;
