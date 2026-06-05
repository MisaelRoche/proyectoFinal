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
  id_libro          INT           PRIMARY KEY,
  isbn              VARCHAR(20),
  titulo            VARCHAR(200)  NOT NULL,
  autor             VARCHAR(200),
  editorial         VARCHAR(100),
  anio              INT,
  id_categoria      INT,
  paginas           INT,
  idioma            VARCHAR(30)   DEFAULT 'Español',
  costo             DECIMAL(10,2),
  proveedor         VARCHAR(200),
  fecha_adquisicion DATE,
  FOREIGN KEY (id_categoria) REFERENCES Categoria(id_categoria)
);

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

INSERT IGNORE INTO Libro (id_libro, isbn, titulo, autor, editorial, anio, id_categoria, paginas, costo, proveedor, fecha_adquisicion) VALUES
  (1,  '978-607-01-0001-1', 'Pedro Páramo',                       'Juan Rulfo',             'RM Editorial',        1955, 1, 124,  180.00, 'Libros RM Distribuciones S.A.',        '2020-01-15'),
  (2,  '978-607-01-0002-2', 'Cien años de soledad',               'Gabriel García Márquez', 'Alfaguara',           1967, 1, 471,  320.00, 'Alfaguara México Distribuidora',        '2020-02-20'),
  (3,  '978-607-01-0003-3', 'Biología Celular',                   'Bruce Alberts',           'Médica Panamericana', 2015, 2, 850,  650.00, 'Médica Panamericana de México',         '2019-08-10'),
  (4,  '978-607-01-0004-4', 'Física Universitaria Vol. 1',        'Sears & Zemansky',        'Pearson',             2018, 2, 700,  590.00, 'Pearson Educación de México S.A.',      '2020-03-05'),
  (5,  '978-607-01-0005-5', 'Historia de México',                 'Enrique Krauze',          'Tusquets',            2010, 3, 340,  260.00, 'Libros y Más S.A. de C.V.',             '2021-01-20'),
  (6,  '978-607-01-0006-6', 'La Conquista de México',             'Hugh Thomas',             'Planeta',             1994, 3, 912,  420.00, 'Editorial Planeta México S.A.',         '2019-11-30'),
  (7,  '978-607-01-0007-7', 'El Lenguaje de Programación C',      'Kernighan & Ritchie',     'Prentice Hall',       1988, 4, 288,  380.00, 'Prentice Hall Hispanoamericana S.A.',   '2020-05-14'),
  (8,  '978-607-01-0008-8', 'Algoritmos y Estructuras de Datos',  'Thomas Cormen',           'MIT Press',           2009, 4, 1292, 750.00, 'MIT Press México Distribuidora',        '2020-07-22'),
  (9,  '978-607-01-0009-9', 'Derecho Constitucional Mexicano',    'Felipe Tena Ramírez',     'Porrúa',              2016, 5, 620,  480.00, 'Porrúa Hermanos y Cía. S.A. de C.V.',  '2021-03-08'),
  (10, '978-607-01-0010-0', 'Teoría General del Derecho',         'Norberto Bobbio',         'Debate',              2012, 5, 290,  310.00, 'Editorial Debate México S.A.',          '2021-04-16'),
  (11, '978-607-01-0011-1', 'El Arte de México',                  'Teresa del Conde',        'FCE',                 2008, 6, 410,  390.00, 'Fondo de Cultura Económica México',     '2020-09-01'),
  (12, '978-607-01-0012-2', 'Arquitectura Prehispánica',          'Paul Gendrop',            'Trillas',             2001, 6, 220,  240.00, 'Editorial Trillas S.A. de C.V.',        '2020-10-12');

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
