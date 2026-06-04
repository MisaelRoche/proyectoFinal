-- =============================================================
-- NODO 1 — Fragmento Vertical: UsuarioPerfil (TODOS los usuarios)
-- Ejecutar SOLO en Nodo 1 (Mexicali Centro, 100.127.191.53)
-- Después de 00_base_todos_los_nodos.sql / nodo1.sql
-- =============================================================

USE biblioteca_nodo1;

-- Eliminar tablas anteriores si existen (migración desde esquema viejo)
DROP TABLE IF EXISTS UsuarioAcceso;
DROP TABLE IF EXISTS UsuarioPerfil;

-- UsuarioPerfil: identidad + ubicación (SIN CHECK por sucursal)
CREATE TABLE IF NOT EXISTS UsuarioPerfil (
  id_usuario           INT          PRIMARY KEY AUTO_INCREMENT,
  nombre               VARCHAR(100) NOT NULL,
  apellidos            VARCHAR(100),
  telefono             VARCHAR(20),
  direccion            VARCHAR(200),
  id_sucursal_registro INT          NOT NULL,
  fecha_registro       DATE,
  FOREIGN KEY (id_sucursal_registro) REFERENCES Sucursal(id_sucursal)
);

-- Los 10 usuarios de toda la red
INSERT INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, direccion, id_sucursal_registro, fecha_registro) VALUES
  ( 1, 'María',    'González Herrera',  '686-111-0001', 'Calle 1a #100, Mexicali',       1, '2023-01-15'),
  ( 2, 'Carlos',   'Ramírez López',     '664-111-0002', 'Av. Revolución #200, Tijuana',  2, '2023-03-22'),
  ( 3, 'Fernanda', 'Torres Ávila',      '646-111-0003', 'Calle 2a #300, Ensenada',        3, '2023-05-10'),
  ( 4, 'Luis',     'Morales Fuentes',   '686-111-0004', 'Blvd. UABC #400, Mexicali',      4, '2023-06-01'),
  ( 5, 'Ana',      'Castillo Vega',     '661-111-0005', 'Calle 3a #500, Rosarito',        5, '2023-07-14'),
  ( 6, 'Roberto',  'Sánchez Mendoza',   '665-111-0006', 'Av. Juárez #600, Tecate',        6, '2023-08-30'),
  ( 7, 'Laura',    'Díaz Contreras',    '686-111-0007', 'Calle 4a #700, Mexicali',        1, '2023-09-05'),
  ( 8, 'Miguel',   'Reyes Espinoza',    '664-111-0008', 'Blvd. Díaz Ordaz #800, Tijuana', 2, '2023-10-18'),
  ( 9, 'Paola',    'Flores Gutiérrez',  '686-111-0009', 'Calzada UABC #900, Mexicali',    4, '2024-01-07'),
  (10, 'Diego',    'Vargas Ontiveros',  '646-111-0010', 'Calle 5a #1000, Ensenada',       3, '2024-02-20');

ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;
