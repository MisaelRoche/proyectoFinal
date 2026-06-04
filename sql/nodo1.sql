-- =============================================================
-- NODO 1 — Mexicali Centro  |  IP Tailscale: 100.127.191.53
-- Fragmento Horizontal: Usuarios suc=1, Inventario suc=1, Préstamos suc=1
-- Base de datos: biblioteca_nodo1
-- Ejecutar este script (absorbe el contenido de 00_base)
-- =============================================================

CREATE DATABASE IF NOT EXISTS biblioteca_nodo1
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE biblioteca_nodo1;

-- ─────────────────────────────────────────────────────────────
-- Tablas maestras replicadas (mismo contenido que otros nodos)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS Categoria (
  id_categoria INT         PRIMARY KEY,
  nombre       VARCHAR(50) NOT NULL,
  descripcion  TEXT
);

CREATE TABLE IF NOT EXISTS Sucursal (
  id_sucursal INT          PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  direccion   VARCHAR(200),
  ciudad      VARCHAR(100),
  telefono    VARCHAR(20),
  responsable VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS Libro (
  id_libro     INT          PRIMARY KEY,
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

-- Insertar datos replicados
INSERT IGNORE INTO Categoria VALUES
  (1, 'Literatura',     'Novelas, cuentos y poesía'),
  (2, 'Ciencias',       'Biología, física, química'),
  (3, 'Historia',       'Historia universal y de México'),
  (4, 'Tecnología',     'Computación e ingeniería'),
  (5, 'Derecho',        'Leyes y jurisprudencia'),
  (6, 'Arte y Cultura', 'Pintura, música y arquitectura');

INSERT IGNORE INTO Sucursal VALUES
  (1, 'Mexicali Centro',     'Av. Obregón 120',        'Mexicali', '686-555-0101', 'Lic. Carmen Robles'),
  (2, 'Tijuana',              'Blvd. Agua Caliente 88', 'Tijuana',  '664-555-0202', 'Lic. Jorge Mendoza'),
  (3, 'Ensenada',             'Av. Ruiz 450',           'Ensenada', '646-555-0303', 'Lic. Patricia Soto'),
  (4, 'Mexicali Universidad', 'Calzada UABC 200',       'Mexicali', '686-555-0404', 'Dr. Ramón Castillo'),
  (5, 'Rosarito',             'Blvd. Benito Juárez 33', 'Rosarito', '661-555-0505', 'Lic. Sofía Guerrero'),
  (6, 'Tecate',               'Calle Principal 77',     'Tecate',   '665-555-0606', 'Lic. Héctor Vázquez');

INSERT IGNORE INTO Libro (id_libro, isbn, titulo, autor, editorial, anio, id_categoria, paginas) VALUES
  (1,  '978-607-01-0001-1', 'Pedro Páramo',                       'Juan Rulfo',             'RM Editorial',        1955, 1, 124),
  (2,  '978-607-01-0002-2', 'Cien años de soledad',               'Gabriel García Márquez', 'Alfaguara',           1967, 1, 471),
  (3,  '978-607-01-0003-3', 'Biología Celular',                   'Bruce Alberts',           'Médica Panamericana', 2015, 2, 850),
  (4,  '978-607-01-0004-4', 'Física Universitaria Vol. 1',        'Sears & Zemansky',        'Pearson',             2018, 2, 700),
  (5,  '978-607-01-0005-5', 'Historia de México',                 'Enrique Krauze',          'Tusquets',            2010, 3, 340),
  (6,  '978-607-01-0006-6', 'La Conquista de México',             'Hugh Thomas',             'Planeta',             1994, 3, 912),
  (7,  '978-607-01-0007-7', 'El Lenguaje de Programación C',      'Kernighan & Ritchie',     'Prentice Hall',       1988, 4, 288),
  (8,  '978-607-01-0008-8', 'Algoritmos y Estructuras de Datos',  'Thomas Cormen',           'MIT Press',           2009, 4, 1292),
  (9,  '978-607-01-0009-9', 'Derecho Constitucional Mexicano',    'Felipe Tena Ramírez',     'Porrúa',              2016, 5, 620),
  (10, '978-607-01-0010-0', 'Teoría General del Derecho',         'Norberto Bobbio',         'Debate',              2012, 5, 290),
  (11, '978-607-01-0011-1', 'El Arte de México',                  'Teresa del Conde',        'FCE',                 2008, 6, 410),
  (12, '978-607-01-0012-2', 'Arquitectura Prehispánica',          'Paul Gendrop',            'Trillas',             2001, 6, 220);

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTACIÓN VERTICAL de Usuario — 2 fragmentos
-- Basado en convergencia BEA/MAC/MFA/MAA: cluster {id,email,multas}
-- Fragmento H: id_sucursal_registro = 1
-- ─────────────────────────────────────────────────────────────

-- Fragmento Vertical 1: UsuarioPerfil (identidad + ubicación)
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

-- Fragmento Vertical 2: UsuarioAcceso (email + multas — cluster de alto acceso)
CREATE TABLE IF NOT EXISTS UsuarioAcceso (
  id_usuario        INT           PRIMARY KEY,
  email             VARCHAR(150),
  multas_acumuladas DECIMAL(10,2) DEFAULT 0.00,
  FOREIGN KEY (id_usuario) REFERENCES UsuarioPerfil(id_usuario)
);

INSERT IGNORE INTO UsuarioPerfil (id_usuario, nombre, apellidos, telefono, id_sucursal_registro, fecha_registro) VALUES
  (1, 'María', 'González Herrera', '686-111-0001', 1, '2023-01-15'),
  (7, 'Laura', 'Díaz Contreras',   '686-111-0007', 1, '2023-09-05');

INSERT IGNORE INTO UsuarioAcceso (id_usuario, email, multas_acumuladas) VALUES
  (1, 'mgonzalez@email.com',  0.00),
  (7, 'ldiaz@email.com',     75.00);

ALTER TABLE UsuarioPerfil AUTO_INCREMENT = 100;

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Inventario (id_sucursal = 1)
-- 12 filas — una por libro en esta sucursal
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Inventario (
  id_inventario      INT          PRIMARY KEY,
  id_libro           INT          NOT NULL,
  id_sucursal        INT          NOT NULL DEFAULT 1,
  copias_totales     INT          DEFAULT 0,
  copias_disponibles INT          DEFAULT 0,
  ubicacion_fisica   VARCHAR(100),
  CONSTRAINT chk_inventario_sucursal CHECK (id_sucursal = 1),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
);

-- id_inventario = (id_libro-1)*6 + id_sucursal  |  ubicacion = "Estante A <libro>"
INSERT IGNORE INTO Inventario VALUES
--  id   libro  suc  total  disp  ubicacion
  ( 1,   1,     1,   3,     3,    'Estante A 1'),
  ( 7,   2,     1,   4,     3,    'Estante A 2'),   -- (2+1)%3=0 → 1 prestado
  (13,   3,     1,   2,     2,    'Estante A 3'),
  (19,   4,     1,   5,     5,    'Estante A 4'),
  (25,   5,     1,   2,     1,    'Estante A 5'),   -- (5+1)%3=0 → 1 prestado
  (31,   6,     1,   3,     3,    'Estante A 6'),
  (37,   7,     1,   2,     2,    'Estante A 7'),
  (43,   8,     1,   3,     2,    'Estante A 8'),   -- (8+1)%3=0 → 1 prestado
  (49,   9,     1,   4,     4,    'Estante A 9'),
  (55,  10,     1,   2,     2,    'Estante A 10'),
  (61,  11,     1,   3,     2,    'Estante A 11'),  -- (11+1)%3=0 → 1 prestado
  (67,  12,     1,   4,     4,    'Estante A 12');

-- ─────────────────────────────────────────────────────────────
-- FRAGMENTO HORIZONTAL: Prestamo (id_sucursal = 1)
-- SIN FK a Usuario (el prestatario puede ser de otro nodo)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Prestamo (
  id_prestamo               INT          PRIMARY KEY AUTO_INCREMENT,
  id_usuario                INT          NOT NULL,
  id_libro                  INT          NOT NULL,
  id_sucursal               INT          NOT NULL DEFAULT 1,
  fecha_prestamo            DATE         NOT NULL,
  fecha_devolucion_esperada DATE         NOT NULL,
  fecha_devolucion_real     DATE,
  estatus                   ENUM('activo','devuelto','vencido') DEFAULT 'activo',
  multa                     DECIMAL(10,2) DEFAULT 0.00,
  CONSTRAINT chk_prestamo_sucursal CHECK (id_sucursal = 1),
  FOREIGN KEY (id_libro)    REFERENCES Libro(id_libro),
  FOREIGN KEY (id_sucursal) REFERENCES Sucursal(id_sucursal)
  -- Sin FK a Usuario: el usuario puede estar en otro nodo (préstamo inter-sucursal)
);

INSERT IGNORE INTO Prestamo (id_prestamo, id_usuario, id_libro, id_sucursal, fecha_prestamo, fecha_devolucion_esperada, fecha_devolucion_real, estatus, multa) VALUES
  ( 1, 1,  2, 1, '2026-04-20', '2026-05-20', NULL,         'activo',   0.00),
  (10, 7,  6, 1, '2026-03-10', '2026-04-10', NULL,         'vencido', 75.00),
  (13, 1,  5, 1, '2026-01-10', '2026-02-10', '2026-02-08', 'devuelto', 0.00);

ALTER TABLE Prestamo AUTO_INCREMENT = 100;
