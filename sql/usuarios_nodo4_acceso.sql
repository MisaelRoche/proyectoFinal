-- =============================================================
-- NODO 4 — Fragmento Vertical: UsuarioAcceso (TODOS los usuarios)
-- Ejecutar SOLO en Nodo 4 (Mexicali Universidad, 100.67.56.91)
-- Después de 00_base_todos_los_nodos.sql / nodo4.sql
-- =============================================================

USE biblioteca_nodo4;

-- Eliminar tablas anteriores si existen (migración desde esquema viejo)
DROP TABLE IF EXISTS UsuarioAcceso;
DROP TABLE IF EXISTS UsuarioPerfil;

-- UsuarioAcceso: email + multas — cluster de alto acceso
-- NOTA: NO tiene FK a UsuarioPerfil porque está en otro nodo.
--       La integridad se garantiza a nivel de aplicación.
CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00
);

-- Los 10 usuarios de toda la red
INSERT INTO UsuarioAcceso (id_usuario, email, multas_acumuladas) VALUES
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
