-- =============================================================
-- NODO 5 — Rosarito  |  IP Tailscale: 100.95.94.48
-- Fragmento Horizontal: Usuarios suc=5, Inventario suc=5, Préstamos suc=5
CREATE DATABASE IF NOT EXISTS biblioteca_nodo5
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Ejecutar DESPUÉS de 00_base_todos_los_nodos.sql
-- =============================================================

USE biblioteca_nodo5;

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Usuario (id_sucursal_registro = 5)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Usuario (
  id_usuario           INT          PRIMARY KEY AUTO_INCREMENT,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  email                VARCHAR(150),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL DEFAULT 5,
  fecha_registro       DATE,
  multas_acumuladas    DECIMAL(10,2) DEFAULT 0.00,
  CONSTRAINT chk_usuario_sucursal CHECK (id_sucursal_registro = 5),
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

INSERT IGNORE INTO Usuario (id_usuario, nombre, apellidos, email, telefono, id_sucursal_registro, fecha_registro, multas_acumuladas) VALUES
  (5, 'Ana', 'Castillo Vega', 'acastillo@email.com', '661-111-0005', 5, '2023-07-14', 0.00);

ALTER TABLE Usuario AUTO_INCREMENT = 100;

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Inventario (id_sucursal = 5)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Inventario (
  id_inventario      INT          PRIMARY KEY,
  id_libro           INT          NOT NULL,
  id_sucursal        INT          NOT NULL DEFAULT 5,
  copias_totales     INT          DEFAULT 0,
  copias_disponibles INT          DEFAULT 0,
  ubicacion_fisica   VARCHAR(100),
  CONSTRAINT chk_inventario_sucursal CHECK (id_sucursal = 5),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
);

-- id_inventario = (id_libro-1)*6 + 5  |  ubicacion = "Estante D <libro>"
INSERT IGNORE INTO Inventario VALUES
--  id   libro  suc  total  disp  ubicacion
  ( 5,   1,     5,   3,     2,    'Estante D 1'),   -- (1+5)%3=0 → 1 prestado
  (11,   2,     5,   4,     4,    'Estante D 2'),
  (17,   3,     5,   2,     2,    'Estante D 3'),
  (23,   4,     5,   5,     4,    'Estante D 4'),   -- (4+5)%3=0 → 1 prestado
  (29,   5,     5,   2,     2,    'Estante D 5'),
  (35,   6,     5,   3,     3,    'Estante D 6'),
  (41,   7,     5,   2,     1,    'Estante D 7'),   -- (7+5)%3=0 → 1 prestado
  (47,   8,     5,   3,     3,    'Estante D 8'),
  (53,   9,     5,   4,     4,    'Estante D 9'),
  (59,  10,     5,   2,     1,    'Estante D 10'),  -- (10+5)%3=0 → 1 prestado
  (65,  11,     5,   3,     3,    'Estante D 11'),
  (71,  12,     5,   4,     4,    'Estante D 12');

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Prestamo (id_sucursal = 5)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Prestamo (
  id_prestamo               INT          PRIMARY KEY AUTO_INCREMENT,
  id_usuario                INT          NOT NULL,
  id_libro                  INT          NOT NULL,
  id_sucursal               INT          NOT NULL DEFAULT 5,
  fecha_prestamo            DATE         NOT NULL,
  fecha_devolucion_esperada DATE         NOT NULL,
  fecha_devolucion_real     DATE,
  estatus                   ENUM('activo','devuelto','vencido') DEFAULT 'activo',
  multa                     DECIMAL(10,2) DEFAULT 0.00,
  CONSTRAINT chk_prestamo_sucursal CHECK (id_sucursal = 5),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
);

INSERT IGNORE INTO Prestamo (id_prestamo, id_usuario, id_libro, id_sucursal, fecha_prestamo, fecha_devolucion_esperada, fecha_devolucion_real, estatus, multa) VALUES
  ( 3, 5,  7, 5, '2026-05-01', '2026-06-01', NULL,         'activo',   0.00),
  (15, 5,  2, 5, '2026-01-20', '2026-02-20', '2026-02-19', 'devuelto', 0.00);

ALTER TABLE Prestamo AUTO_INCREMENT = 100;
