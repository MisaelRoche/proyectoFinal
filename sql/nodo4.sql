-- =============================================================
-- NODO 4 — Mexicali Universidad  |  IP Tailscale: 100.67.56.91
-- Fragmento Horizontal: Usuarios suc=4, Inventario suc=4, Préstamos suc=4
CREATE DATABASE IF NOT EXISTS biblioteca_nodo4
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Fragmento Vertical admin: ver nodo4_libro_admin.sql (ejecutar aparte)
-- Ejecutar DESPUÉS de 00_base_todos_los_nodos.sql
-- =============================================================

USE biblioteca_nodo4;

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO VERTICAL DISTRIBUIDO: UsuarioAcceso (TODOS los usuarios)
-- Nodo 4 almacena el fragmento Acceso de los 10 usuarios.
-- El fragmento Perfil (nombre, dirección, sucursal) está en Nodo 1.
-- Reconstrucción: app-side merge {Perfil Nodo1} + {Acceso Nodo4}
-- NOTA: Sin FK a UsuarioPerfil (tabla en otro nodo). Integridad vía app.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00
);

INSERT IGNORE INTO UsuarioAcceso (id_usuario, email, multas_acumuladas) VALUES
  ( 1, 'mgonzalez@email.com',   0.00),
  ( 2, 'cramirez@email.com',   25.00),
  ( 3, 'ftorres@email.com',     0.00),
  ( 4, 'lmorales@email.com',   50.00),
  ( 5, 'acastillo@email.com',   0.00),
  ( 6, 'rsanchez@email.com',    0.00),
  ( 7, 'ldiaz@email.com',      75.00),
  ( 8, 'mreyes@email.com',      0.00),
  ( 9, 'pflores@email.com',     0.00),
  (10, 'dvargas@email.com',     0.00);

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Inventario (id_sucursal = 4)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Inventario (
  id_inventario      INT          PRIMARY KEY,
  id_libro           INT          NOT NULL,
  id_sucursal        INT          NOT NULL DEFAULT 4,
  copias_totales     INT          DEFAULT 0,
  copias_disponibles INT          DEFAULT 0,
  ubicacion_fisica   VARCHAR(100),
  CONSTRAINT chk_inventario_sucursal CHECK (id_sucursal = 4),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
);

-- id_inventario = (id_libro-1)*6 + 4  |  ubicacion = "Sala Estudio <libro>"
INSERT IGNORE INTO Inventario VALUES
--  id   libro  suc  total  disp  ubicacion
  ( 4,   1,     4,   3,     3,    'Sala Estudio 1'),
  (10,   2,     4,   4,     3,    'Sala Estudio 2'),   -- (2+4)%3=0 → 1 prestado
  (16,   3,     4,   2,     2,    'Sala Estudio 3'),
  (22,   4,     4,   5,     5,    'Sala Estudio 4'),
  (28,   5,     4,   2,     1,    'Sala Estudio 5'),   -- (5+4)%3=0 → 1 prestado
  (34,   6,     4,   3,     3,    'Sala Estudio 6'),
  (40,   7,     4,   2,     2,    'Sala Estudio 7'),
  (46,   8,     4,   3,     2,    'Sala Estudio 8'),   -- (8+4)%3=0 → 1 prestado
  (52,   9,     4,   4,     4,    'Sala Estudio 9'),
  (58,  10,     4,   2,     2,    'Sala Estudio 10'),
  (64,  11,     4,   3,     2,    'Sala Estudio 11'),  -- (11+4)%3=0 → 1 prestado
  (70,  12,     4,   4,     4,    'Sala Estudio 12');

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Prestamo (id_sucursal = 4)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Prestamo (
  id_prestamo               INT          PRIMARY KEY AUTO_INCREMENT,
  id_usuario                INT          NOT NULL,
  id_libro                  INT          NOT NULL,
  id_sucursal               INT          NOT NULL DEFAULT 4,
  fecha_prestamo            DATE         NOT NULL,
  fecha_devolucion_esperada DATE         NOT NULL,
  fecha_devolucion_real     DATE,
  estatus                   ENUM('activo','devuelto','vencido') DEFAULT 'activo',
  multa                     DECIMAL(10,2) DEFAULT 0.00,
  CONSTRAINT chk_prestamo_sucursal CHECK (id_sucursal = 4),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
);

INSERT IGNORE INTO Prestamo (id_prestamo, id_usuario, id_libro, id_sucursal, fecha_prestamo, fecha_devolucion_esperada, fecha_devolucion_real, estatus, multa) VALUES
  ( 5, 9,  3, 4, '2026-05-08', '2026-06-08', NULL, 'activo',  0.00),
  ( 8, 4,  8, 4, '2026-05-10', '2026-06-10', NULL, 'activo',  0.00),
  (11, 4, 10, 4, '2026-02-15', '2026-03-15', NULL, 'vencido', 50.00);

ALTER TABLE Prestamo AUTO_INCREMENT = 100;
