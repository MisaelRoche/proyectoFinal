-- =============================================================
-- NODO 4 — Mexicali Universidad  |  Fragmento VERTICAL: LibroAdmin
-- Ejecutar SOLO en el Nodo 4, DESPUÉS de nodo4.sql
-- Base de datos: biblioteca_nodo4
--
-- Fragmentación vertical sobre Libro:
--   Fragmento público (todos los nodos): id_libro, isbn, titulo, autor,
--                                        editorial, anio, id_categoria, paginas, idioma
--   Fragmento administrativo (SOLO Nodo 4): id_libro + costo, proveedor, fecha_adquisicion
--
-- Ambos fragmentos comparten id_libro (PK) como atributo de reconstrucción.
-- UNION: Libro JOIN LibroAdmin ON id_libro → tabla completa original.
-- =============================================================

USE biblioteca_nodo4;

CREATE TABLE IF NOT EXISTS LibroAdmin (
  id_libro          INT            PRIMARY KEY,
  costo             DECIMAL(10,2)  NOT NULL,
  proveedor         VARCHAR(200)   NOT NULL,
  fecha_adquisicion DATE           NOT NULL,
  FOREIGN KEY (id_libro) REFERENCES Libro(id_libro)
);

INSERT IGNORE INTO LibroAdmin (id_libro, costo, proveedor, fecha_adquisicion) VALUES
  ( 1,  180.00, 'Libros RM Distribuciones S.A.',         '2020-01-15'),
  ( 2,  320.00, 'Alfaguara México Distribuidora',         '2020-02-20'),
  ( 3,  650.00, 'Médica Panamericana de México',          '2019-08-10'),
  ( 4,  590.00, 'Pearson Educación de México S.A.',       '2020-03-05'),
  ( 5,  260.00, 'Libros y Más S.A. de C.V.',              '2021-01-20'),
  ( 6,  420.00, 'Editorial Planeta México S.A.',          '2019-11-30'),
  ( 7,  380.00, 'Prentice Hall Hispanoamericana S.A.',    '2020-05-14'),
  ( 8,  750.00, 'MIT Press México Distribuidora',         '2020-07-22'),
  ( 9,  480.00, 'Porrúa Hermanos y Cía. S.A. de C.V.',   '2021-03-08'),
  (10,  310.00, 'Editorial Debate México S.A.',           '2021-04-16'),
  (11,  390.00, 'Fondo de Cultura Económica México',      '2020-09-01'),
  (12,  240.00, 'Editorial Trillas S.A. de C.V.',         '2020-10-12');
