-- =============================================================
-- NODO 3 — Ensenada  |  IP Tailscale: 100.121.240.118
-- Fragmento Horizontal: Usuarios suc=3, Inventario suc=3, Préstamos suc=3
CREATE DATABASE IF NOT EXISTS biblioteca_nodo3
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Ejecutar DESPUÉS de 00_base_todos_los_nodos.sql
-- =============================================================

USE biblioteca_nodo3;

-- ─────────────────────────────────────────────────────────────
-- NOTA: Las tablas UsuarioPerfil y UsuarioAcceso NO existen aquí.
-- Fragmentación vertical distribuida concentrada en 2 nodos:
--   - UsuarioPerfil → Nodo 1 (Mexicali Centro)
--   - UsuarioAcceso → Nodo 4 (Mexicali Universidad)
-- Las consultas de usuario se hacen remotamente desde la app.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Inventario (id_sucursal = 3)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Inventario (
  id_inventario      INT          PRIMARY KEY,
  id_libro           INT          NOT NULL,
  id_sucursal        INT          NOT NULL DEFAULT 3,
  copias_totales     INT          DEFAULT 0,
  copias_disponibles INT          DEFAULT 0,
  ubicacion_fisica   VARCHAR(100),
  CONSTRAINT chk_inventario_sucursal CHECK (id_sucursal = 3),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
);

-- id_inventario = (id_libro-1)*6 + 3  |  ubicacion = "Estante C <libro>"
INSERT IGNORE INTO Inventario VALUES
--  id   libro  suc  total  disp  ubicacion
  ( 3,   1,     3,   3,     3,    'Estante C 1'),
  ( 9,   2,     3,   4,     4,    'Estante C 2'),
  (15,   3,     3,   2,     1,    'Estante C 3'),   -- (3+3)%3=0 → 1 prestado
  (21,   4,     3,   5,     5,    'Estante C 4'),
  (27,   5,     3,   2,     2,    'Estante C 5'),
  (33,   6,     3,   3,     2,    'Estante C 6'),   -- (6+3)%3=0 → 1 prestado
  (39,   7,     3,   2,     2,    'Estante C 7'),
  (45,   8,     3,   3,     3,    'Estante C 8'),
  (51,   9,     3,   4,     3,    'Estante C 9'),   -- (9+3)%3=0 → 1 prestado
  (57,  10,     3,   2,     2,    'Estante C 10'),
  (63,  11,     3,   3,     3,    'Estante C 11'),
  (69,  12,     3,   4,     3,    'Estante C 12');  -- (12+3)%3=0 → 1 prestado

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Prestamo (id_sucursal = 3)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Prestamo (
  id_prestamo               INT          PRIMARY KEY AUTO_INCREMENT,
  id_usuario                INT          NOT NULL,
  id_libro                  INT          NOT NULL,
  id_sucursal               INT          NOT NULL DEFAULT 3,
  fecha_prestamo            DATE         NOT NULL,
  fecha_devolucion_esperada DATE         NOT NULL,
  fecha_devolucion_real     DATE,
  estatus                   ENUM('activo','devuelto','vencido') DEFAULT 'activo',
  multa                     DECIMAL(10,2) DEFAULT 0.00,
  CONSTRAINT chk_prestamo_sucursal CHECK (id_sucursal = 3),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
);

INSERT IGNORE INTO Prestamo (id_prestamo, id_usuario, id_libro, id_sucursal, fecha_prestamo, fecha_devolucion_esperada, fecha_devolucion_real, estatus, multa) VALUES
  ( 2,  3,  5, 3, '2026-04-25', '2026-05-25', NULL,         'activo',  0.00),
  ( 7, 10,  1, 3, '2026-05-02', '2026-06-02', NULL,         'activo',  0.00),
  (14,  3,  7, 3, '2026-02-01', '2026-03-01', '2026-03-01', 'devuelto', 0.00);

ALTER TABLE Prestamo AUTO_INCREMENT = 100;
